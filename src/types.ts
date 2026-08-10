export type Role = "admin" | "responsable" | "comptable" | "employe" | "client";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  team: string;
  client_id: number | null;
  active: boolean;
  action_count?: number;
  client_name?: string | null;
}

export interface Client {
  id: number;
  name: string;
  reference: string;
  type: string;
  country: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  contact_name: string;
  notes: string;
  created_at: string;
  dossier_count?: number;
  solde?: number;
}

export interface Dossier {
  id: number;
  number: string;
  reference: string;
  client_id: number;
  client_name?: string;
  agent_id: number | null;
  agent_name?: string;
  operation_type: string;
  origin_country: string;
  destination_country: string;
  loading_port: string;
  destination_port: string;
  eta: string | null;
  delivery_date: string | null;
  status: string;
  notes: string;
  created_at: string;
  container_count?: number;
  steps_done?: number;
  steps_total?: number;
}

export interface Step {
  id: number;
  dossier_id: number;
  step_key: string;
  label: string;
  step_order: number;
  done: number;
  done_at: string | null;
  due_date: string | null;
}

export interface Container {
  id: number;
  number: string;
  size: string;
  shipping_line: string;
  vessel: string;
  voyage: string;
  position: string;
  status: string;
  dossier_id: number | null;
  dossier_number?: string;
  client_name?: string;
  created_at: string;
}

export interface Movement {
  id: number;
  container_id: number;
  date: string;
  position: string;
  status: string;
  note: string;
  container_number?: string;
}

export interface DocumentItem {
  id: number;
  dossier_id: number | null;
  client_id: number | null;
  type: string;
  name: string;
  filename: string;
  size: number;
  uploaded_by: number | null;
  uploader_name?: string;
  uploaded_at: string;
  expires_at: string | null;
  notes: string;
  dossier_number?: string;
  client_name?: string;
}

export interface Invoice {
  id: number;
  number: string;
  type: string;
  client_id: number;
  client_name?: string;
  dossier_id: number | null;
  dossier_number?: string;
  date: string;
  due_date: string | null;
  amount: number;
  status: string;
  notes: string;
  paid?: number;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
  phone?: string;
  client_ref?: string;
  agent_name?: string;
}

export interface Payment {
  id: number;
  invoice_id: number | null;
  client_id: number;
  client_name?: string;
  invoice_number?: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
}

export interface Expense {
  id: number;
  dossier_id: number | null;
  date: string;
  label: string;
  category: string;
  amount: number;
  paid_by: string;
}

export interface Notification {
  id?: number;
  type: "info" | "warning" | "danger" | "success";
  title: string;
  message: string;
  link?: string;
  read?: number;
  created_at?: string;
}

export interface Meta {
  clients: { id: number; name: string }[];
  agents: { id: number; name: string; role: string }[];
  countries: string[];
  ports: string[];
}
