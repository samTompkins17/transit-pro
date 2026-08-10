import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Chemins configurables (voir .env.example) — par défaut : ./data/app.db
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || join(DATA_DIR, "app.db");
export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const res = stmt.run(...params);
  return { lastInsertRowid: Number(res.lastInsertRowid), changes: Number(res.changes) };
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT DEFAULT '',
  client_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  reference TEXT UNIQUE,
  type TEXT DEFAULT 'entreprise',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS client_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS dossiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  reference TEXT DEFAULT '',
  client_id INTEGER NOT NULL,
  agent_id INTEGER,
  operation_type TEXT NOT NULL,
  origin_country TEXT DEFAULT '',
  destination_country TEXT DEFAULT '',
  loading_port TEXT DEFAULT '',
  destination_port TEXT DEFAULT '',
  eta TEXT,
  delivery_date TEXT,
  status TEXT DEFAULT 'en_cours',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS dossier_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  done INTEGER DEFAULT 0,
  done_at TEXT,
  due_date TEXT
);
CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  size TEXT DEFAULT '40',
  shipping_line TEXT DEFAULT '',
  vessel TEXT DEFAULT '',
  voyage TEXT DEFAULT '',
  position TEXT DEFAULT '',
  status TEXT DEFAULT 'en_transit',
  dossier_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS container_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  container_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  position TEXT DEFAULT '',
  status TEXT DEFAULT '',
  note TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER,
  client_id INTEGER,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  filename TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now','localtime')),
  expires_at TEXT,
  notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'facture',
  client_id INTEGER NOT NULL,
  dossier_id INTEGER,
  date TEXT NOT NULL,
  due_date TEXT,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'emise',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER,
  client_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'virement',
  reference TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dossier_id INTEGER,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT DEFAULT 'divers',
  amount REAL NOT NULL,
  paid_by TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  link TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  entity_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
`);
