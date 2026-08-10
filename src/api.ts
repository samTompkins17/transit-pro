import type { Meta, User } from "./types";

const TOKEN_KEY = "tp_token";
const USER_KEY = "tp_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.location.href = "/login";
    throw new Error("Session expirée");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Erreur serveur");
  return data as T;
}

// --- Formatage -------------------------------------------------------------
const fmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const fmtMoney = (n: number | null | undefined) => fmt.format(Number(n || 0));

const pad = (n: number) => String(n).padStart(2, "0");

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

export function isLate(date: string | null): boolean {
  if (!date) return false;
  return String(date).slice(0, 10) < todayLocal();
}

export function relativeDay(value: string | null | undefined): string {
  if (!value) return "";
  const date = String(value).slice(0, 10);
  const today = todayLocal();
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  if (date === today) return "Aujourd'hui";
  if (date === tomorrowStr) return "Demain";
  return fmtDate(date);
}

// --- Libellés --------------------------------------------------------------
export const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  en_cours: "En cours",
  en_douane: "En douane",
  mainlevee: "Mainlevée",
  livre: "Livré",
  cloture: "Clôturé",
  annule: "Annulé",
  en_transit: "En transit",
  vide: "Vide",
  restitue: "Restitué",
  emise: "Émise",
  partielle: "Partielle",
  payee: "Payée",
  annulee: "Annulée",
};

export const STATUS_TONES: Record<string, string> = {
  brouillon: "bg-surface text-slate-600",
  en_cours: "bg-primary/10 text-primary",
  en_douane: "bg-accent/15 text-accent",
  mainlevee: "bg-primary/10 text-primary",
  livre: "bg-emerald-100 text-emerald-700",
  cloture: "bg-navy/10 text-navy",
  annule: "bg-rose-100 text-rose-700",
  annulee: "bg-rose-100 text-rose-700",
  en_transit: "bg-primary/10 text-primary",
  vide: "bg-surface text-slate-600",
  restitue: "bg-surface text-slate-600",
  emise: "bg-accent/15 text-accent",
  partielle: "bg-primary/10 text-primary",
  payee: "bg-emerald-100 text-emerald-700",
};

export function label(key: string | null | undefined, map: Record<string, string>, fallback = "—"): string {
  if (!key) return fallback;
  return map[key] || key;
}

export const OP_LABELS: Record<string, string> = { import: "Import", export: "Export", transit: "Transit" };
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  responsable: "Responsable Transit",
  comptable: "Comptable",
  employe: "Employé",
  client: "Client",
};
export const DOC_TYPE_LABELS: Record<string, string> = {
  facture_commerciale: "Facture commerciale",
  packing_list: "Packing list",
  bl: "Bill of Lading",
  certificat_origine: "Certificat d'origine",
  declaration_douaniere: "Déclaration douanière",
  autre: "Autre",
};
export const EXPENSE_CATEGORIES: Record<string, string> = {
  droits_taxes: "Droits & taxes",
  transport: "Transport",
  manutention: "Manutention",
  stockage: "Stockage",
  divers: "Divers",
};

// --- Métadonnées en cache ---------------------------------------------------
let metaCache: Meta | null = null;
export async function useMeta(): Promise<Meta> {
  if (metaCache) return metaCache;
  metaCache = await api<Meta>("/api/meta");
  return metaCache;
}

// --- Utilisateurs -----------------------------------------------------------
export function can(user: User | null, action: "create" | "edit" | "delete" | "admin" | "finance" | "client"): boolean {
  if (!user) return false;
  switch (action) {
    case "admin": return user.role === "admin";
    case "create":
      return ["admin", "responsable", "employe", "comptable"].includes(user.role);
    case "edit":
      return ["admin", "responsable", "comptable"].includes(user.role);
    case "finance":
      return ["admin", "comptable"].includes(user.role);
    case "delete":
      return user.role === "admin";
    case "client":
      return user.role === "client";
    default:
      return false;
  }
}
