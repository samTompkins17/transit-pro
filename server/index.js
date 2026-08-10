import express from "express";
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, run, all, get } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration .env facultative (voir .env.example)
try {
  const envPath = resolve(__dirname, "..", ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
} catch {
  // .env absent ou invalide — on continue avec les variables d'environnement
}

const PORT = Number(process.env.PORT) || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, "..", "uploads");
mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(UPLOAD_DIR));

// En-têtes de sécurité de base
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

// ---------------------------------------------------------------------------
// Authentification (sessions en mémoire)
// ---------------------------------------------------------------------------
const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 jours
const sessions = new Map(); // token -> { userId, expiresAt }

function createSession(userId) {
  const token = randomUUID();
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL });
  return token;
}

// Hachage des mots de passe (scrypt, sans dépendance native)
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, team: u.team,
    client_id: u.client_id, active: !!u.active,
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "Non authentifié" });
  }
  const user = get("SELECT * FROM users WHERE id = ?", [session.userId]);
  if (!user || !user.active) return res.status(401).json({ error: "Compte inactif" });
  session.expiresAt = Date.now() + SESSION_TTL; // session glissante
  req.user = user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé pour votre rôle" });
    }
    next();
  };
}

function audit(req, action, entity, entityId) {
  run(
    `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id) VALUES (?,?,?,?,?)`,
    [req.user.id, req.user.name, action, entity, entityId ?? null]
  );
}

const pad2 = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowStr = () => {
  const pad = (n) => String(n).padStart(2, "0");
  const dt = new Date();
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const loginAttempts = new Map(); // clé -> { count, resetAt }
const LOGIN_MAX_ATTEMPTS = 10; // tentatives maximum…
const LOGIN_WINDOW = 15 * 60 * 1000; // …par fenêtre de 15 minutes

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const key = `${req.ip || "?"}|${String(email || "").toLowerCase()}`;
  const now = Date.now();
  let attempt = loginAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + LOGIN_WINDOW };
    loginAttempts.set(key, attempt);
  }
  if (attempt.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Trop de tentatives. Réessayez dans quelques minutes." });
  }
  const user = get("SELECT * FROM users WHERE email = ? AND active = 1", [String(email || "").toLowerCase().trim()]);
  if (!user || !verifyPassword(password || "", user.password)) {
    attempt.count += 1;
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }
  attempt.count = 0;
  const token = createSession(user.id);
  audit({ user }, "Connexion", "auth", user.id);
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", auth, (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Premier lancement : création du compte administrateur
app.get("/api/auth/status", (req, res) => {
  const count = get("SELECT COUNT(*) AS c FROM users").c;
  res.json({ needsSetup: count === 0 });
});

app.post("/api/auth/setup", (req, res) => {
  const count = get("SELECT COUNT(*) AS c FROM users").c;
  if (count > 0) return res.status(400).json({ error: "Un compte administrateur existe déjà." });
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nom, e-mail et mot de passe requis." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
  }
  const r = run(
    `INSERT INTO users (name, email, password, role, team, active) VALUES (?,?,?,?,?,1)`,
    [String(name).trim(), String(email).toLowerCase().trim(), hashPassword(password), "admin", "Direction"]
  );
  const user = get("SELECT * FROM users WHERE id = ?", [r.lastInsertRowid]);
  const token = createSession(Number(r.lastInsertRowid));
  run(
    `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id) VALUES (?,?,?,?,NULL)`,
    [user.id, user.name, "Création du compte administrateur initial", "system"]
  );
  res.json({ token, user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------
function clientScope(req) {
  return req.user.role === "client" ? `AND c.id = ${Number(req.user.client_id || 0)}` : "";
}

function dossierScope(req) {
  return req.user.role === "client" ? `AND d.client_id = ${Number(req.user.client_id || 0)}` : "";
}

// ---------------------------------------------------------------------------
// Métadonnées (listes déroulantes)
// ---------------------------------------------------------------------------
app.get("/api/meta", auth, (req, res) => {
  const clients = req.user.role === "client"
    ? all("SELECT id, name FROM clients WHERE id = ?", [req.user.client_id])
    : all("SELECT id, name FROM clients ORDER BY name");
  const agents = all("SELECT id, name, role FROM users WHERE role IN ('admin','responsable','employe') AND active = 1 ORDER BY name");
  const countries = ["Maroc", "France", "Espagne", "Allemagne", "Chine", "Inde", "Turquie", "Côte d'Ivoire", "Sénégal", "Belgique", "Italie", "États-Unis", "Émirats arabes unis", "Brésil", "Canada", "Autres"];
  const ports = ["Casablanca", "Tanger Med", "Agadir", "Mohammedia", "Nador", "Le Havre", "Marseille", "Valence", "Barcelone", "Hambourg", "Shanghai", "Shenzhen", "Mumbai", "Istanbul", "Dakar", "Abidjan", "Anvers", "Rotterdam", "Gênes"];
  res.json({ clients, agents, countries, ports });
});

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------
app.get("/api/dashboard", auth, (req, res) => {
  const cs = clientScope(req);
  const ds = dossierScope(req);

  const dossiersEnCours = get(
    `SELECT COUNT(*) AS c FROM dossiers d WHERE d.status NOT IN ('cloture','annule') ${ds}`,
  ).c;
  const conteneursEnTransit = get(
    `SELECT COUNT(*) AS c FROM containers co JOIN dossiers d ON co.dossier_id = d.id
     WHERE co.status NOT IN ('livre','vide','restitue') AND d.status NOT IN ('cloture','annule') ${ds}`,
  ).c;
  const enRetard = get(
    `SELECT COUNT(*) AS c FROM dossiers d
     WHERE d.eta IS NOT NULL AND d.eta < ? AND d.status NOT IN ('cloture','annule','livre') ${ds}`,
    [todayStr()],
  ).c;
  const ca = get(
    `SELECT COALESCE(SUM(amount),0) AS s FROM invoices i JOIN clients c ON i.client_id = c.id
     WHERE i.type = 'facture' AND i.status NOT IN ('annulee') AND strftime('%Y', i.date) = strftime('%Y','now') ${cs}`,
  ).s;
  const enAttente = get(
    `SELECT COALESCE(SUM(amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id),0)),0) AS s
     FROM invoices i JOIN clients c ON i.client_id = c.id
     WHERE i.type = 'facture' AND i.status IN ('emise','partielle') ${cs}`,
  ).s;
  const soldeClients = get(
    `SELECT COALESCE(SUM(amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id),0)),0) AS s
     FROM invoices i JOIN clients c ON i.client_id = c.id
     WHERE i.type = 'facture' AND i.status IN ('emise','partielle') ${cs}`,
  ).s;

  const recentDossiers = all(
    `SELECT d.*, c.name AS client_name, u.name AS agent_name
     FROM dossiers d JOIN clients c ON d.client_id = c.id LEFT JOIN users u ON d.agent_id = u.id
     WHERE 1=1 ${ds} ORDER BY d.id DESC LIMIT 8`,
  );

  const conteneurs = all(
    `SELECT co.*, d.number AS dossier_number, d.client_id
     FROM containers co LEFT JOIN dossiers d ON co.dossier_id = d.id
     WHERE 1=1 ${ds} AND co.status NOT IN ('livre','vide','restitue') ORDER BY co.id DESC LIMIT 6`,
  );

  // Calendrier : échéances des 7 prochains jours (étapes dues + arrivées prévues)
  const weekStart = todayStr();
  const weekEndDate = new Date(Date.now() + 7 * 86400000);
  const weekEnd = `${weekEndDate.getFullYear()}-${pad2(weekEndDate.getMonth() + 1)}-${pad2(weekEndDate.getDate())}`;
  const calendar = all(
    `SELECT 'étape' AS kind, s.due_date AS date, s.label AS label, d.number AS dossier_number, d.id AS dossier_id
     FROM dossier_steps s JOIN dossiers d ON s.dossier_id = d.id
     WHERE s.done = 0 AND s.due_date IS NOT NULL AND s.due_date BETWEEN ? AND ? ${ds}
     UNION ALL
     SELECT 'arrivée' AS kind, d.eta AS date, d.operation_type || ' — ' || d.loading_port || ' → ' || d.destination_port AS label, d.number AS dossier_number, d.id AS dossier_id
     FROM dossiers d WHERE d.eta IS NOT NULL AND d.eta BETWEEN ? AND ? AND d.status NOT IN ('cloture','annule','livre') ${ds}
     ORDER BY date ASC LIMIT 12`,
    [weekStart, weekEnd, weekStart, weekEnd],
  );

  // Notifications dynamiques
  const dynamic = [];
  const docsExpire = all(
    `SELECT doc.*, d.number AS dossier_number FROM documents doc LEFT JOIN dossiers d ON doc.dossier_id = d.id
     WHERE doc.expires_at IS NOT NULL AND doc.expires_at < ? ${ds}`,
    [todayStr()],
  );
  for (const doc of docsExpire) {
    dynamic.push({ type: "danger", title: "Document expiré", message: `« ${doc.name} » a expiré.`, link: doc.dossier_id ? `/dossiers/${doc.dossier_id}` : "/documents" });
  }
  const docsBientot = all(
    `SELECT doc.*, d.number AS dossier_number FROM documents doc LEFT JOIN dossiers d ON doc.dossier_id = d.id
     WHERE doc.expires_at IS NOT NULL AND doc.expires_at >= ? AND doc.expires_at <= ? ${ds}`,
    [todayStr(), weekEnd],
  );
  for (const doc of docsBientot) {
    dynamic.push({ type: "warning", title: "Document expire bientôt", message: `« ${doc.name} » expire le ${doc.expires_at}.`, link: doc.dossier_id ? `/dossiers/${doc.dossier_id}` : "/documents" });
  }
  const retards = all(
    `SELECT d.number, d.id FROM dossiers d WHERE d.eta IS NOT NULL AND d.eta < ? AND d.status NOT IN ('cloture','annule','livre') ${ds}`,
    [todayStr()],
  );
  for (const r of retards) {
    dynamic.push({ type: "warning", title: "Dossier en retard", message: `Le dossier ${r.number} dépasse la date d'arrivée prévue.`, link: `/dossiers/${r.id}` });
  }
  const stored = all("SELECT * FROM notifications ORDER BY read ASC, id DESC LIMIT 10");
  const notifications = [...dynamic, ...stored].slice(0, 12);

  const unpaid = all(
    `SELECT i.*, c.name AS client_name,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0) AS paid
     FROM invoices i JOIN clients c ON i.client_id = c.id
     WHERE i.type='facture' AND i.status IN ('emise','partielle') ${cs} ORDER BY i.due_date ASC LIMIT 6`,
  );

  res.json({
    stats: { dossiersEnCours, conteneursEnTransit, enRetard, ca, enAttente, soldeClients },
    recentDossiers, conteneurs, calendar, notifications, unpaid,
  });
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
app.get("/api/clients", auth, (req, res) => {
  const scope = req.user.role === "client" ? `WHERE id = ${Number(req.user.client_id || 0)}` : "";
  const clients = all(
    `SELECT c.*,
       (SELECT COUNT(*) FROM dossiers d WHERE d.client_id = c.id) AS dossier_count,
       (SELECT COALESCE(SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0)),0) FROM invoices i WHERE i.client_id = c.id AND i.type='facture' AND i.status IN ('emise','partielle')) AS solde
     FROM clients c ${scope} ORDER BY c.name`
  );
  res.json({ clients });
});

app.post("/api/clients", auth, requireRole("admin", "responsable", "comptable"), (req, res) => {
  const b = req.body || {};
  const lastRef = get("SELECT reference FROM clients ORDER BY id DESC LIMIT 1");
  const ref = b.reference || `CLI-${String((lastRef ? parseInt(String(lastRef.reference).split("-")[1], 10) : 0) + 1).padStart(4, "0")}`;
  const r = run(
    `INSERT INTO clients (name, reference, type, country, city, address, email, phone, contact_name, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [b.name, ref, b.type || "entreprise", b.country || "", b.city || "", b.address || "", b.email || "", b.phone || "", b.contact_name || "", b.notes || ""]
  );
  if (b.contact_name) {
    run(`INSERT INTO client_contacts (client_id, name, email, phone, role) VALUES (?,?,?,?,?)`,
      [r.lastInsertRowid, b.contact_name, b.email || "", b.phone || "", "Contact principal"]);
  }
  audit(req, "Création du client", "client", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.put("/api/clients/:id", auth, requireRole("admin", "responsable", "comptable"), (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE clients SET name=?, type=?, country=?, city=?, address=?, email=?, phone=?, contact_name=?, notes=? WHERE id=?`,
    [b.name, b.type || "entreprise", b.country || "", b.city || "", b.address || "", b.email || "", b.phone || "", b.contact_name || "", b.notes || "", req.params.id]
  );
  audit(req, "Modification du client", "client", Number(req.params.id));
  res.json({ ok: true });
});

app.delete("/api/clients/:id", auth, requireRole("admin"), (req, res) => {
  const dossiers = get("SELECT COUNT(*) AS c FROM dossiers WHERE client_id = ?", [req.params.id]).c;
  if (dossiers > 0) return res.status(400).json({ error: "Impossible de supprimer : le client possède des dossiers." });
  run("DELETE FROM client_contacts WHERE client_id = ?", [req.params.id]);
  run("DELETE FROM clients WHERE id = ?", [req.params.id]);
  audit(req, "Suppression du client", "client", Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/clients/:id", auth, (req, res) => {
  if (req.user.role === "client" && Number(req.params.id) !== req.user.client_id) {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const client = get("SELECT * FROM clients WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client introuvable" });
  const contacts = all("SELECT * FROM client_contacts WHERE client_id = ? ORDER BY id", [req.params.id]);
  const dossiers = all(
    `SELECT d.*, u.name AS agent_name FROM dossiers d LEFT JOIN users u ON d.agent_id = u.id WHERE d.client_id = ? ORDER BY d.id DESC`,
    [req.params.id]
  );
  const documents = all("SELECT * FROM documents WHERE client_id = ? OR dossier_id IN (SELECT id FROM dossiers WHERE client_id = ?) ORDER BY id DESC", [req.params.id, req.params.id]);
  const invoices = all(
    `SELECT i.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0) AS paid FROM invoices i WHERE i.client_id = ? ORDER BY i.id DESC`,
    [req.params.id]
  );
  res.json({ client, contacts, dossiers, documents, invoices });
});

// ---------------------------------------------------------------------------
// Dossiers
// ---------------------------------------------------------------------------
function nextDossierNumber() {
  const last = get("SELECT number FROM dossiers ORDER BY id DESC LIMIT 1");
  const year = new Date().getFullYear();
  if (last && String(last.number).startsWith(`DOS-${year}-`)) {
    const n = parseInt(String(last.number).split("-").pop(), 10) + 1;
    return `DOS-${year}-${String(n).padStart(3, "0")}`;
  }
  return `DOS-${year}-001`;
}

const STEPS = [
  ["creation", "Création du dossier"],
  ["documents", "Réception des documents"],
  ["declaration", "Déclaration en douane"],
  ["paiement", "Paiement des droits et taxes"],
  ["controle", "Contrôle douanier"],
  ["mainlevee", "Mainlevée"],
  ["chargement", "Chargement"],
  ["livraison", "Livraison"],
  ["cloture", "Clôture du dossier"],
];

app.get("/api/dossiers", auth, (req, res) => {
  const { search, status, operation_type, client_id } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === "client") { where.push("d.client_id = ?"); params.push(req.user.client_id); }
  if (search) { where.push("(d.number LIKE ? OR d.reference LIKE ? OR c.name LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push("d.status = ?"); params.push(status); }
  if (operation_type) { where.push("d.operation_type = ?"); params.push(operation_type); }
  if (client_id) { where.push("d.client_id = ?"); params.push(Number(client_id)); }
  const sql = `
    SELECT d.*, c.name AS client_name, u.name AS agent_name,
      (SELECT COUNT(*) FROM containers co WHERE co.dossier_id = d.id) AS container_count,
      (SELECT COUNT(*) FROM dossier_steps s WHERE s.dossier_id = d.id AND s.done = 1) AS steps_done,
      (SELECT COUNT(*) FROM dossier_steps s WHERE s.dossier_id = d.id) AS steps_total
    FROM dossiers d JOIN clients c ON d.client_id = c.id LEFT JOIN users u ON d.agent_id = u.id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY d.id DESC LIMIT 200`;
  res.json({ dossiers: all(sql, params) });
});

app.get("/api/dossiers/:id", auth, (req, res) => {
  const dossier = get(
    `SELECT d.*, c.name AS client_name, c.email AS client_email, c.phone AS client_phone, u.name AS agent_name
     FROM dossiers d JOIN clients c ON d.client_id = c.id LEFT JOIN users u ON d.agent_id = u.id WHERE d.id = ?`,
    [req.params.id]
  );
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable" });
  if (req.user.role === "client" && dossier.client_id !== req.user.client_id) {
    return res.status(403).json({ error: "Accès refusé" });
  }
  const steps = all("SELECT * FROM dossier_steps WHERE dossier_id = ? ORDER BY step_order", [req.params.id]);
  const containers = all("SELECT * FROM containers WHERE dossier_id = ? ORDER BY id", [req.params.id]);
  const documents = all("SELECT * FROM documents WHERE dossier_id = ? ORDER BY id DESC", [req.params.id]);
  const invoices = all(
    `SELECT i.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0) AS paid FROM invoices i WHERE i.dossier_id = ? ORDER BY i.id DESC`,
    [req.params.id]
  );
  const expenses = all("SELECT * FROM expenses WHERE dossier_id = ? ORDER BY date DESC", [req.params.id]);
  const movements = all(
    `SELECT m.*, co.number AS container_number FROM container_movements m JOIN containers co ON m.container_id = co.id WHERE co.dossier_id = ? ORDER BY m.id DESC LIMIT 20`,
    [req.params.id]
  );
  res.json({ dossier, steps, containers, documents, invoices, expenses, movements });
});

app.post("/api/dossiers", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const b = req.body || {};
  const number = nextDossierNumber();
  const r = run(
    `INSERT INTO dossiers (number, reference, client_id, agent_id, operation_type, origin_country, destination_country, loading_port, destination_port, eta, delivery_date, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [number, b.reference || "", b.client_id, b.agent_id || null, b.operation_type || "import",
     b.origin_country || "", b.destination_country || "", b.loading_port || "", b.destination_port || "",
     b.eta || null, b.delivery_date || null, b.status || "en_cours", b.notes || ""]
  );
  for (const [i, s] of STEPS.entries()) {
    const done = b.status === "cloture" || (b.status === "livre" && i < 8);
    run(
      `INSERT INTO dossier_steps (dossier_id, step_key, label, step_order, done, done_at, due_date) VALUES (?,?,?,?,?,?,?)`,
      [r.lastInsertRowid, s[0], s[1], i + 1, done ? 1 : 0, done ? nowStr() : null, b.eta ? b.eta : null]
    );
  }
  run(`INSERT INTO notifications (type, title, message, link) VALUES ('info', 'Nouveau dossier', 'Le dossier ${number} a été créé.', '/dossiers/${r.lastInsertRowid}')`);
  audit(req, "Création du dossier", "dossier", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, number });
});

app.put("/api/dossiers/:id", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE dossiers SET reference=?, client_id=?, agent_id=?, operation_type=?, origin_country=?, destination_country=?, loading_port=?, destination_port=?, eta=?, delivery_date=?, status=?, notes=? WHERE id=?`,
    [b.reference || "", b.client_id, b.agent_id || null, b.operation_type || "import",
     b.origin_country || "", b.destination_country || "", b.loading_port || "", b.destination_port || "",
     b.eta || null, b.delivery_date || null, b.status || "en_cours", b.notes || "", req.params.id]
  );
  audit(req, "Modification du dossier", "dossier", Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/dossiers/:id/steps/:stepId/toggle", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const step = get("SELECT * FROM dossier_steps WHERE id = ? AND dossier_id = ?", [req.params.stepId, req.params.id]);
  if (!step) return res.status(404).json({ error: "Étape introuvable" });
  const done = step.done ? 0 : 1;
  run(`UPDATE dossier_steps SET done = ?, done_at = ? WHERE id = ?`, [done, done ? nowStr() : null, step.id]);
  const dossier = get("SELECT * FROM dossiers WHERE id = ?", [req.params.id]);
  const allDone = get("SELECT COUNT(*) AS c FROM dossier_steps WHERE dossier_id = ? AND done = 0", [req.params.id]).c === 0;
  const newStatus = allDone && dossier.status !== "annule" ? "livre" : dossier.status;
  if (newStatus !== dossier.status) run(`UPDATE dossiers SET status = ? WHERE id = ?`, [newStatus, dossier.id]);
  audit(req, done ? "Étape validée" : "Étape dévalidée", "dossier", Number(req.params.id));
  res.json({ ok: true, done, status: newStatus });
});

app.delete("/api/dossiers/:id", auth, requireRole("admin"), (req, res) => {
  run("DELETE FROM dossier_steps WHERE dossier_id = ?", [req.params.id]);
  run("DELETE FROM documents WHERE dossier_id = ?", [req.params.id]);
  run("DELETE FROM containers WHERE dossier_id = ?", [req.params.id]);
  run("DELETE FROM dossiers WHERE id = ?", [req.params.id]);
  audit(req, "Suppression du dossier", "dossier", Number(req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Conteneurs
// ---------------------------------------------------------------------------
app.get("/api/containers", auth, (req, res) => {
  const { search, status } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === "client") { where.push("d.client_id = ?"); params.push(req.user.client_id); }
  if (search) { where.push("(co.number LIKE ? OR co.vessel LIKE ? OR d.number LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (status) { where.push("co.status = ?"); params.push(status); }
  const containers = all(
    `SELECT co.*, d.number AS dossier_number, d.client_id, c.name AS client_name
     FROM containers co LEFT JOIN dossiers d ON co.dossier_id = d.id LEFT JOIN clients c ON d.client_id = c.id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY co.id DESC LIMIT 200`,
    params
  );
  res.json({ containers });
});

app.get("/api/containers/:id", auth, (req, res) => {
  const container = get(
    `SELECT co.*, d.number AS dossier_number, c.name AS client_name FROM containers co
     LEFT JOIN dossiers d ON co.dossier_id = d.id LEFT JOIN clients c ON d.client_id = c.id WHERE co.id = ?`,
    [req.params.id]
  );
  if (!container) return res.status(404).json({ error: "Conteneur introuvable" });
  const movements = all("SELECT * FROM container_movements WHERE container_id = ? ORDER BY id DESC", [req.params.id]);
  res.json({ container, movements });
});

app.post("/api/containers", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const b = req.body || {};
  const r = run(
    `INSERT INTO containers (number, size, shipping_line, vessel, voyage, position, status, dossier_id) VALUES (?,?,?,?,?,?,?,?)`,
    [b.number, b.size || "40", b.shipping_line || "", b.vessel || "", b.voyage || "", b.position || "", b.status || "en_transit", b.dossier_id || null]
  );
  run(
    `INSERT INTO container_movements (container_id, date, position, status, note) VALUES (?,?,?,?,?)`,
    [r.lastInsertRowid, todayStr(), b.position || "", b.status || "en_transit", "Création du conteneur"]
  );
  audit(req, "Création du conteneur", "conteneur", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.put("/api/containers/:id", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const b = req.body || {};
  const prev = get("SELECT * FROM containers WHERE id = ?", [req.params.id]);
  run(
    `UPDATE containers SET number=?, size=?, shipping_line=?, vessel=?, voyage=?, position=?, status=?, dossier_id=? WHERE id=?`,
    [b.number, b.size || "40", b.shipping_line || "", b.vessel || "", b.voyage || "", b.position || "", b.status || "en_transit", b.dossier_id || null, req.params.id]
  );
  if (prev && (prev.position !== b.position || prev.status !== b.status)) {
    run(
      `INSERT INTO container_movements (container_id, date, position, status, note) VALUES (?,?,?,?,?)`,
      [req.params.id, todayStr(), b.position || "", b.status || "en_transit", "Mise à jour manuelle"]
    );
  }
  audit(req, "Modification du conteneur", "conteneur", Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/containers/:id/movements", auth, requireRole("admin", "responsable", "employe"), (req, res) => {
  const b = req.body || {};
  run(
    `INSERT INTO container_movements (container_id, date, position, status, note) VALUES (?,?,?,?,?)`,
    [req.params.id, b.date || todayStr(), b.position || "", b.status || "en_cours", b.note || ""]
  );
  if (b.position) run(`UPDATE containers SET position = ? WHERE id = ?`, [b.position, req.params.id]);
  if (b.status) run(`UPDATE containers SET status = ? WHERE id = ?`, [b.status, req.params.id]);
  audit(req, "Mouvement de conteneur ajouté", "conteneur", Number(req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
const DOC_TYPES = [
  ["facture_commerciale", "Facture commerciale"],
  ["packing_list", "Packing list"],
  ["bl", "Bill of Lading (BL)"],
  ["certificat_origine", "Certificat d'origine"],
  ["declaration_douaniere", "Déclaration douanière"],
  ["autre", "Autre document"],
];

app.get("/api/documents", auth, (req, res) => {
  const { type, search, dossier_id } = req.query;
  const where = [];
  const params = [];
  if (req.user.role === "client") {
    where.push("(doc.client_id = ? OR doc.dossier_id IN (SELECT id FROM dossiers WHERE client_id = ?))");
    params.push(req.user.client_id, req.user.client_id);
  }
  if (type) { where.push("doc.type = ?"); params.push(type); }
  if (search) { where.push("doc.name LIKE ?"); params.push(`%${search}%`); }
  if (dossier_id) { where.push("doc.dossier_id = ?"); params.push(Number(dossier_id)); }
  const documents = all(
    `SELECT doc.*, d.number AS dossier_number, c.name AS client_name, u.name AS uploader_name
     FROM documents doc
     LEFT JOIN dossiers d ON doc.dossier_id = d.id
     LEFT JOIN clients c ON d.client_id = c.id
     LEFT JOIN users u ON doc.uploaded_by = u.id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY doc.id DESC LIMIT 300`,
    params
  );
  res.json({ documents, types: DOC_TYPES });
});

app.post("/api/documents", auth, requireRole("admin", "responsable", "employe", "comptable"), (req, res) => {
  const b = req.body || {};
  let filename = b.filename || "";
  if (b.base64) {
    filename = `${randomUUID().slice(0, 8)}_${String(b.filename || "document").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    writeFileSync(join(UPLOAD_DIR, filename), Buffer.from(b.base64, "base64"));
  }
  const r = run(
    `INSERT INTO documents (dossier_id, client_id, type, name, filename, size, uploaded_by, expires_at, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [b.dossier_id || null, b.client_id || null, b.type || "autre", b.name || "Document", filename,
     b.size || 0, req.user.id, b.expires_at || null, b.notes || ""]
  );
  audit(req, "Ajout de document", "document", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.delete("/api/documents/:id", auth, requireRole("admin", "responsable"), (req, res) => {
  run("DELETE FROM documents WHERE id = ?", [req.params.id]);
  audit(req, "Suppression de document", "document", Number(req.params.id));
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Finances
// ---------------------------------------------------------------------------
function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const last = get("SELECT number FROM invoices ORDER BY id DESC LIMIT 1");
  if (last && String(last.number).startsWith(`FAC-${year}-`)) {
    const n = parseInt(String(last.number).split("-").pop(), 10) + 1;
    return `FAC-${year}-${String(n).padStart(4, "0")}`;
  }
  return `FAC-${year}-0001`;
}

app.get("/api/invoices", auth, (req, res) => {
  const where = [];
  const params = [];
  if (req.user.role === "client") { where.push("i.client_id = ?"); params.push(req.user.client_id); }
  const invoices = all(
    `SELECT i.*, c.name AS client_name, d.number AS dossier_number,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0) AS paid
     FROM invoices i
     JOIN clients c ON i.client_id = c.id
     LEFT JOIN dossiers d ON i.dossier_id = d.id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY i.id DESC LIMIT 300`,
    params
  );
  res.json({ invoices });
});

app.get("/api/invoices/:id", auth, (req, res) => {
  const invoice = get(
    `SELECT i.*, c.name AS client_name, c.address, c.city, c.country, c.email, c.phone, c.reference AS client_ref,
       d.number AS dossier_number, u.name AS agent_name
     FROM invoices i JOIN clients c ON i.client_id = c.id LEFT JOIN dossiers d ON i.dossier_id = d.id
     LEFT JOIN users u ON d.agent_id = u.id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
  const payments = all("SELECT * FROM payments WHERE invoice_id = ? ORDER BY id", [req.params.id]);
  res.json({ invoice, payments });
});

app.post("/api/invoices", auth, requireRole("admin", "responsable", "comptable"), (req, res) => {
  const b = req.body || {};
  const number = b.number || nextInvoiceNumber();
  const r = run(
    `INSERT INTO invoices (number, type, client_id, dossier_id, date, due_date, amount, status, notes) VALUES (?,?,?,?,?,?,?,?,?)`,
    [number, b.type || "facture", b.client_id, b.dossier_id || null, b.date || todayStr(), b.due_date || null,
     Number(b.amount) || 0, b.status || "emise", b.notes || ""]
  );
  audit(req, "Création de " + (b.type === "devis" ? "devis" : "facture"), "facture", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid, number });
});

app.put("/api/invoices/:id", auth, requireRole("admin", "comptable"), (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE invoices SET type=?, client_id=?, dossier_id=?, date=?, due_date=?, amount=?, status=?, notes=? WHERE id=?`,
    [b.type || "facture", b.client_id, b.dossier_id || null, b.date || todayStr(), b.due_date || null,
     Number(b.amount) || 0, b.status || "emise", b.notes || "", req.params.id]
  );
  audit(req, "Modification de facture", "facture", Number(req.params.id));
  res.json({ ok: true });
});

app.post("/api/invoices/:id/pay", auth, requireRole("admin", "comptable"), (req, res) => {
  const b = req.body || {};
  const invoice = get("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
  if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
  const amount = Number(b.amount) || invoice.amount;
  run(
    `INSERT INTO payments (invoice_id, client_id, date, amount, method, reference) VALUES (?,?,?,?,?,?)`,
    [invoice.id, invoice.client_id, b.date || todayStr(), amount, b.method || "virement", b.reference || ""]
  );
  const paid = get("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?", [invoice.id]).s;
  const status = paid >= invoice.amount ? "payee" : "partielle";
  run(`UPDATE invoices SET status = ? WHERE id = ?`, [status, invoice.id]);
  run(`INSERT INTO notifications (type, title, message, link) VALUES ('success','Paiement reçu','Encaissement de ${amount.toLocaleString("fr-FR")} € sur la facture ${invoice.number}.','/finance')`);
  audit(req, "Encaissement enregistré", "facture", invoice.id);
  res.json({ ok: true, status, paid });
});

app.get("/api/expenses", auth, (req, res) => {
  const expenses = all(
    `SELECT e.*, d.number AS dossier_number FROM expenses e LEFT JOIN dossiers d ON e.dossier_id = d.id ORDER BY e.id DESC LIMIT 200`
  );
  res.json({ expenses });
});

app.post("/api/expenses", auth, requireRole("admin", "comptable", "responsable"), (req, res) => {
  const b = req.body || {};
  const r = run(
    `INSERT INTO expenses (dossier_id, date, label, category, amount, paid_by) VALUES (?,?,?,?,?,?)`,
    [b.dossier_id || null, b.date || todayStr(), b.label, b.category || "divers", Number(b.amount) || 0, b.paid_by || ""]
  );
  audit(req, "Dépense enregistrée", "depense", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.get("/api/finance/summary", auth, (req, res) => {
  const cs = clientScope(req);
  const ca = get(
    `SELECT COALESCE(SUM(amount),0) AS s FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.type='facture' AND i.status NOT IN ('annulee') ${cs}`
  ).s;
  const encaisse = get(
    `SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p JOIN clients c ON p.client_id = c.id ${cs}`
  ).s;
  const enAttente = get(
    `SELECT COALESCE(SUM(i.amount - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id),0)),0) AS s
     FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.type='facture' AND i.status IN ('emise','partielle') ${cs}`
  ).s;
  const depenses = get(`SELECT COALESCE(SUM(amount),0) AS s FROM expenses`).s;
  const clientWhere = req.user.role === "client" ? `WHERE c.id = ${Number(req.user.client_id || 0)}` : "";
  const balances = all(
    `SELECT c.id, c.name,
       COALESCE((SELECT SUM(i.amount) FROM invoices i WHERE i.client_id = c.id AND i.type='facture' AND i.status NOT IN ('annulee')),0) AS facture,
       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.client_id = c.id),0) AS paye
     FROM clients c ${clientWhere} ORDER BY c.name`
  ).map((b) => ({ ...b, solde: Math.round((b.facture - b.paye) * 100) / 100 }));
  res.json({ ca, encaisse, enAttente, depenses, balances });
});

app.get("/api/payments", auth, (req, res) => {
  const payments = all(
    `SELECT p.*, c.name AS client_name, i.number AS invoice_number FROM payments p
     JOIN clients c ON p.client_id = c.id LEFT JOIN invoices i ON p.invoice_id = i.id
     ORDER BY p.id DESC LIMIT 200`
  );
  res.json({ payments });
});

// ---------------------------------------------------------------------------
// Employés / utilisateurs
// ---------------------------------------------------------------------------
app.get("/api/users", auth, requireRole("admin"), (req, res) => {
  const users = all(
    `SELECT u.*, c.name AS client_name,
       (SELECT COUNT(*) FROM audit_log a WHERE a.user_id = u.id) AS action_count
     FROM users u LEFT JOIN clients c ON u.client_id = c.id ORDER BY u.id`
  ).map(publicUser);
  res.json({ users });
});

app.post("/api/users", auth, requireRole("admin"), (req, res) => {
  const b = req.body || {};
  const r = run(
    `INSERT INTO users (name, email, password, role, team, client_id, active) VALUES (?,?,?,?,?,?,?)`,
    [b.name, String(b.email).toLowerCase(), hashPassword(b.password || "changeme"), b.role || "employe", b.team || "", b.client_id || null, b.active === false ? 0 : 1]
  );
  audit(req, "Création d'utilisateur", "user", r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});

app.put("/api/users/:id", auth, requireRole("admin"), (req, res) => {
  const b = req.body || {};
  run(
    `UPDATE users SET name=?, email=?, role=?, team=?, client_id=?, active=? WHERE id=?`,
    [b.name, String(b.email).toLowerCase(), b.role || "employe", b.team || "", b.client_id || null, b.active === false ? 0 : 1, req.params.id]
  );
  if (b.password) run(`UPDATE users SET password=? WHERE id=?`, [hashPassword(b.password), req.params.id]);
  audit(req, "Modification d'utilisateur", "user", Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/audit", auth, requireRole("admin"), (req, res) => {
  const logs = all("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200");
  res.json({ logs });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
app.get("/api/notifications", auth, (req, res) => {
  const notifications = all("SELECT * FROM notifications ORDER BY read ASC, id DESC LIMIT 30");
  res.json({ notifications });
});

app.post("/api/notifications/:id/read", auth, (req, res) => {
  run("UPDATE notifications SET read = 1 WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/notifications/read-all", auth, (req, res) => {
  run("UPDATE notifications SET read = 1");
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------
app.get("/api/reports", auth, (req, res) => {
  const from = req.query.from || `${new Date().getFullYear()}-01-01`;
  const to = req.query.to || todayStr();
  const ds = dossierScope(req);

  const byType = all(
    `SELECT operation_type, COUNT(*) AS c FROM dossiers WHERE date(created_at) BETWEEN ? AND ? ${ds.replace("d.", "")} GROUP BY operation_type`,
    [from, to]
  );
  const byStatus = all(
    `SELECT status, COUNT(*) AS c FROM dossiers WHERE date(created_at) BETWEEN ? AND ? ${ds.replace("d.", "")} GROUP BY status`,
    [from, to]
  );
  const revenueByMonth = all(
    `SELECT substr(date,1,7) AS mois, SUM(amount) AS ca FROM invoices
     WHERE type='facture' AND status NOT IN ('annulee') AND date BETWEEN ? AND ?
     GROUP BY mois ORDER BY mois`,
    [from, to]
  );
  const byClient = all(
    `SELECT c.name, COUNT(d.id) AS dossiers, COALESCE(SUM(CASE WHEN i.type='facture' AND i.status NOT IN ('annulee') THEN i.amount END),0) AS ca
     FROM clients c LEFT JOIN dossiers d ON d.client_id = c.id AND date(d.created_at) BETWEEN ? AND ?
     LEFT JOIN invoices i ON i.client_id = c.id AND i.type='facture' AND i.status NOT IN ('annulee') AND date(i.date) BETWEEN ? AND ?
     GROUP BY c.id ORDER BY ca DESC`,
    [from, to, from, to]
  );
  const byAgent = all(
    `SELECT u.name, COUNT(d.id) AS dossiers
     FROM users u LEFT JOIN dossiers d ON d.agent_id = u.id AND date(d.created_at) BETWEEN ? AND ?
     WHERE u.role IN ('admin','responsable','employe')
     GROUP BY u.id ORDER BY dossiers DESC`,
    [from, to]
  );
  const expenses = get(
    `SELECT COALESCE(SUM(amount),0) AS s FROM expenses WHERE date BETWEEN ? AND ?`, [from, to]
  ).s;
  const revenue = get(
    `SELECT COALESCE(SUM(amount),0) AS s FROM invoices WHERE type='facture' AND status NOT IN ('annulee') AND date BETWEEN ? AND ?`, [from, to]
  ).s;
  const totalDossiers = get(
    `SELECT COUNT(*) AS c FROM dossiers WHERE date(created_at) BETWEEN ? AND ? ${ds.replace("d.", "")}`, [from, to]
  ).c;

  res.json({
    byType, byStatus, revenueByMonth, byClient, byAgent,
    expenses, revenue, profit: revenue - expenses, totalDossiers,
  });
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
const DIST_DIR = join(__dirname, "..", "dist");

// Routes API inconnues : réponse JSON, jamais de HTML
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route API introuvable" });
});

// En production (build généré) : sert l'interface et gère le repli SPA
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
    res.sendFile(join(DIST_DIR, "index.html"));
  });
  console.log(`✔ Interface servie depuis ${DIST_DIR}`);
}

app.listen(PORT, () => {
  console.log(`✔ API TransitPro démarrée sur le port ${PORT}`);
});
