import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Users, Globe, Phone, Mail } from "lucide-react";
import { api, can, fmtMoney } from "../api";
import { useAuth } from "../App";
import type { Client } from "../types";
import { Button, Card, Field, Modal, PageHeader, Table, toast } from "../components/UI";

const EMPTY = {
  name: "", type: "entreprise", country: "", city: "", address: "",
  email: "", phone: "", contact_name: "", notes: "",
};

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = () => api<{ clients: Client[] }>("/api/clients").then((d) => setClients(d.clients)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type, country: c.country, city: c.city, address: c.address, email: c.email, phone: c.phone, contact_name: c.contact_name, notes: c.notes });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast("Le nom du client est requis", "error");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/clients/${editing.id}`, { method: "PUT", body: JSON.stringify(form) });
        toast("Client modifié");
      } else {
        await api("/api/clients", { method: "POST", body: JSON.stringify(form) });
        toast("Client créé");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Client) => {
    if (!confirm(`Supprimer le client « ${c.name} » ?`)) return;
    try {
      await api(`/api/clients/${c.id}`, { method: "DELETE" });
      toast("Client supprimé");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const filtered = clients.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.reference.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients enregistrés`}
        actions={
          can(user, "create") && (
            <Button onClick={openNew}><Plus size={16} /> Nouveau client</Button>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-3">
          <input className="input max-w-sm" placeholder="Rechercher un client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table head={["Référence", "Client", "Localisation", "Contact", "Dossiers", "Solde", ""]} empty="Aucun client">
          {filtered.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="td text-xs text-slate-500">{c.reference}</td>
              <td className="td">
                <Link to={`/clients/${c.id}`} className="font-semibold text-primary hover:underline">{c.name}</Link>
                {c.type === "particulier" && <span className="ml-1.5 text-xs text-slate-400">(particulier)</span>}
              </td>
              <td className="td text-xs">
                <span className="flex items-center gap-1.5"><Globe size={13} className="text-slate-400" />{c.country || "—"} {c.city && `· ${c.city}`}</span>
              </td>
              <td className="td text-xs">
                <div className="flex items-center gap-1.5"><Users size={13} className="text-slate-400" />{c.contact_name || "—"}</div>
                {c.phone && <div className="mt-0.5 flex items-center gap-1.5 text-slate-400"><Phone size={12} />{c.phone}</div>}
              </td>
              <td className="td">{c.dossier_count || 0}</td>
              <td className={`td font-semibold ${(c.solde || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {fmtMoney(c.solde)}
              </td>
              <td className="td">
                <div className="flex justify-end gap-1">
                  {can(user, "edit") && (
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openEdit(c)} title="Modifier">
                      <Pencil size={15} />
                    </button>
                  )}
                  {can(user, "delete") && (
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(c)} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le client" : "Nouveau client"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom / Raison sociale" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Comptoir Africain de Négoce" />
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="entreprise">Entreprise</option>
              <option value="particulier">Particulier</option>
            </select>
          </Field>
          <Field label="Contact principal">
            <input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </Field>
          <Field label="Pays">
            <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Maroc" />
          </Field>
          <Field label="Ville">
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Adresse" className="col-span-2">
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Notes" className="col-span-2">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>
    </div>
  );
}
