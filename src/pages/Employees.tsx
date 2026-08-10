import { useEffect, useState } from "react";
import { Plus, Pencil, Shield, Users, Building2, KeyRound } from "lucide-react";
import { api, ROLE_LABELS } from "../api";
import type { User } from "../types";
import { Badge, Button, Card, Field, Modal, PageHeader, Table, toast } from "../components/UI";

const ROLE_TONES: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700",
  responsable: "bg-primary/10 text-primary",
  comptable: "bg-emerald-100 text-emerald-700",
  employe: "bg-accent/15 text-accent",
  client: "bg-navy/10 text-navy",
};

const EMPTY = { name: "", email: "", password: "", role: "employe", team: "", client_id: "", active: true };

export default function Employees() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const load = () => {
    api<{ users: User[] }>("/api/users").then((d) => setUsers(d.users)).catch(() => {});
    api<{ clients: { id: number; name: string }[] }>("/api/clients").then((d) => setClients(d.clients)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, team: u.team, client_id: u.client_id ? String(u.client_id) : "", active: !!u.active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return toast("Nom et e-mail obligatoires", "error");
    setSaving(true);
    try {
      const payload = { ...form, client_id: form.client_id ? Number(form.client_id) : null, active: form.active };
      if (editing) {
        await api(`/api/users/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Compte modifié");
      } else {
        if (!form.password) { toast("Mot de passe obligatoire pour un nouveau compte", "error"); setSaving(false); return; }
        await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
        toast("Compte créé");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader
        title="Employés & comptes"
        subtitle={`${users.length} comptes utilisateurs · gestion des rôles et permissions`}
        actions={<Button onClick={openNew}><Plus size={16} /> Nouveau compte</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { role: "admin", label: "Administrateurs" },
          { role: "responsable", label: "Responsables Transit" },
          { role: "comptable", label: "Comptables" },
          { role: "employe", label: "Employés" },
        ].map((r) => (
          <div key={r.role} className="card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide"><Shield size={14} /> {r.label}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{users.filter((u) => u.role === r.role).length}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <Table head={["Compte", "Rôle", "Équipe", "Client lié", "Statut", "Actions", ""]} empty="Aucun compte">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="td">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                    {u.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="font-medium text-ink">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="td"><Badge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
              <td className="td text-xs">{u.team || "—"}</td>
              <td className="td text-xs">
                {u.client_id ? <span className="inline-flex items-center gap-1"><Building2 size={13} className="text-slate-400" /> Client n°{u.client_id}</span> : "—"}
              </td>
              <td className="td">
                <Badge tone={u.active ? "bg-emerald-100 text-emerald-700" : "bg-surface text-slate-500"}>{u.active ? "Actif" : "Inactif"}</Badge>
              </td>
              <td className="td text-xs text-slate-400">{u.action_count || 0} actions</td>
              <td className="td">
                <div className="flex justify-end">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openEdit(u)} title="Modifier">
                    <Pencil size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound size={16} className="text-primary" /> Rôles & permissions</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><span className="font-semibold text-ink">Administrateur</span> — accès complet à toutes les fonctionnalités.</li>
            <li><span className="font-semibold text-ink">Responsable Transit</span> — gestion des dossiers, conteneurs et suivi des opérations.</li>
            <li><span className="font-semibold text-ink">Comptable</span> — devis, factures, paiements et rapports financiers.</li>
            <li><span className="font-semibold text-ink">Employé</span> — accès limité selon les autorisations définies.</li>
            <li><span className="font-semibold text-ink">Client</span> — portail sécurisé : suivi des dossiers, téléchargement de documents, consultation des factures.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Users size={16} className="text-primary" /> Équipes</h3>
          <p className="text-sm text-slate-600">
            Regroupez vos collaborateurs par équipe (Direction, Équipe Transit, Finance…) via le champ « Équipe » de chaque compte.
            Cette organisation permet de structurer les responsabilités et la répartition des dossiers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(new Set(users.map((u) => u.team).filter(Boolean))).map((t) => (
              <Badge key={t} tone="bg-primary/10 text-primary">{t}</Badge>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Modifier ${editing.name}` : "Nouveau compte"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom complet *">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail *">
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Mot de passe">
            <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Laisser vide pour conserver" : "Obligatoire"} />
          </Field>
          <Field label="Rôle">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Équipe">
            <input className="input" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="Ex. Équipe Transit" />
          </Field>
          {form.role === "client" && (
            <Field label="Client associé">
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">— Sélectionner —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" />
            Compte actif
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>
    </div>
  );
}
