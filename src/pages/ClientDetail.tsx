import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Mail, Phone, MapPin, Globe, User, Pencil } from "lucide-react";
import { api, can, fmtDate, fmtMoney, label, OP_LABELS, STATUS_LABELS, STATUS_TONES, DOC_TYPE_LABELS, isLate } from "../api";
import { useAuth } from "../App";
import type { Client, DocumentItem, Dossier, Invoice } from "../types";
import { Badge, Button, Card, Modal, PageHeader, StatusBadge, Table, toast } from "../components/UI";

interface Contact extends Record<string, any> { id: number; name: string; email: string; phone: string; role: string; }

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<{ client: Client; contacts: Contact[]; dossiers: Dossier[]; documents: DocumentItem[]; invoices: Invoice[] } | null>(null);
  const [tab, setTab] = useState("dossiers");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = () => api(`/api/clients/${id}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Chargement…</div>;
  const { client, contacts, dossiers, documents, invoices } = data;

  const paid = invoices.reduce((s, i) => s + (i.paid || 0), 0);
  const billed = invoices.reduce((s, i) => s + (i.type === "facture" && i.status !== "annulee" ? i.amount : 0), 0);
  const solde = Math.round((billed - paid) * 100) / 100;

  const openEdit = () => {
    setForm({
      name: client.name, type: client.type, country: client.country, city: client.city, address: client.address,
      email: client.email, phone: client.phone, contact_name: client.contact_name, notes: client.notes,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      await api(`/api/clients/${client.id}`, { method: "PUT", body: JSON.stringify(form) });
      toast("Client modifié");
      setEditOpen(false);
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const tabs = [
    { key: "dossiers", label: `Dossiers (${dossiers.length})` },
    { key: "contacts", label: `Contacts (${contacts.length})` },
    { key: "documents", label: `Documents (${documents.length})` },
    { key: "factures", label: `Factures (${invoices.length})` },
  ];

  return (
    <div>
      <Link to="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary">
        <ArrowLeft size={15} /> Retour aux clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.reference} · créé le ${fmtDate(client.created_at)}`}
        actions={can(user, "edit") && <Button variant="secondary" onClick={openEdit}><Pencil size={15} /> Modifier</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide"><Building2 size={14} /> Dossiers</div>
          <div className="mt-1 text-2xl font-bold text-ink">{dossiers.length}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide"><Globe size={14} /> Opérations</div>
          <div className="mt-1 text-2xl font-bold text-ink">{dossiers.filter((d) => d.status !== "cloture" && d.status !== "annule").length} <span className="text-sm font-normal text-slate-400">en cours</span></div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide"><Mail size={14} /> Facturé</div>
          <div className="mt-1 text-2xl font-bold text-ink">{fmtMoney(billed)}</div>
        </Card>
        <Card className={`p-4 ${solde > 0 ? "bg-rose-50/60" : "bg-emerald-50/60"}`}>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wide"><User size={14} /> Solde client</div>
          <div className={`mt-1 text-2xl font-bold ${solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtMoney(solde)}</div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Informations</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>{[client.address, client.city, client.country].filter(Boolean).join(", ") || "—"}</span></div>
            <div className="flex gap-2"><Mail size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>{client.email || "—"}</span></div>
            <div className="flex gap-2"><Phone size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>{client.phone || "—"}</span></div>
            <div className="flex gap-2"><User size={15} className="mt-0.5 shrink-0 text-slate-400" /><span>{client.contact_name || "—"}</span></div>
          </dl>
          {client.notes && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Notes</div>
              {client.notes}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 pt-3">
              <div className="flex gap-1">
                {tabs.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-t-lg px-3.5 py-2 text-sm font-medium ${tab === t.key ? "border-b-2 border-primary text-primary" : "text-slate-500 hover:text-slate-700"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "dossiers" && (
              <Table head={["N°", "Type", "Route", "Arrivée prévue", "Statut", ""]} empty="Aucun dossier pour ce client">
                {dossiers.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="td"><Link to={`/dossiers/${d.id}`} className="font-semibold text-primary hover:underline">{d.number}</Link></td>
                    <td className="td"><Badge tone="bg-surface text-slate-600">{label(d.operation_type, OP_LABELS)}</Badge></td>
                    <td className="td text-xs">{d.loading_port || "—"} → {d.destination_port || "—"}</td>
                    <td className={`td text-xs ${isLate(d.eta) ? "font-semibold text-rose-600" : ""}`}>{fmtDate(d.eta)}</td>
                    <td className="td"><StatusBadge status={d.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
                    <td className="td"><Link to={`/dossiers/${d.id}`} className="text-xs font-semibold text-primary hover:underline">Ouvrir</Link></td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "contacts" && (
              <Table head={["Nom", "Fonction", "E-mail", "Téléphone"]} empty="Aucun contact">
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="td font-medium">{c.name}</td>
                    <td className="td text-xs">{c.role || "—"}</td>
                    <td className="td text-xs">{c.email || "—"}</td>
                    <td className="td text-xs">{c.phone || "—"}</td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "documents" && (
              <Table head={["Type", "Document", "Dossier", "Expiration"]} empty="Aucun document">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="td"><Badge tone="bg-primary/10 text-primary">{DOC_TYPE_LABELS[doc.type] || doc.type}</Badge></td>
                    <td className="td font-medium">{doc.name}</td>
                    <td className="td text-xs">{doc.dossier_number || "—"}</td>
                    <td className={`td text-xs ${isLate(doc.expires_at) ? "font-semibold text-rose-600" : ""}`}>{fmtDate(doc.expires_at)}</td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "factures" && (
              <Table head={["N°", "Type", "Date", "Échéance", "Montant", "Payé", "Statut"]} empty="Aucune facture">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="td font-medium">{i.number}</td>
                    <td className="td"><Badge tone={i.type === "devis" ? "bg-surface text-slate-600" : "bg-emerald-50 text-emerald-700"}>{i.type === "devis" ? "Devis" : "Facture"}</Badge></td>
                    <td className="td text-xs">{fmtDate(i.date)}</td>
                    <td className="td text-xs">{fmtDate(i.due_date)}</td>
                    <td className="td font-semibold">{fmtMoney(i.amount)}</td>
                    <td className="td text-xs">{fmtMoney(i.paid)}</td>
                    <td className="td"><StatusBadge status={i.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier le client">
        <div className="grid grid-cols-2 gap-3">
          {(["name", "contact_name", "country", "city", "address", "email", "phone", "notes"] as const).map((k) => (
            <div key={k} className={k === "name" || k === "notes" ? "col-span-2" : ""}>
              <label className="label">{k === "name" ? "Nom / Raison sociale" : k === "contact_name" ? "Contact principal" : k === "country" ? "Pays" : k === "city" ? "Ville" : k === "address" ? "Adresse" : k === "email" ? "E-mail" : k === "phone" ? "Téléphone" : "Notes"}</label>
              {k === "notes" ? (
                <textarea className="input" rows={2} value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ) : (
                <input className="input" value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(false)}>Annuler</Button>
          <Button onClick={saveEdit}>Enregistrer</Button>
        </div>
      </Modal>
    </div>
  );
}
