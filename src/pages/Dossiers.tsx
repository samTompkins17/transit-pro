import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Search } from "lucide-react";
import { api, can, fmtDate, isLate, label, OP_LABELS, STATUS_LABELS, STATUS_TONES, useMeta } from "../api";
import { useAuth } from "../App";
import type { Dossier, Meta } from "../types";
import { Badge, Button, Card, Field, Modal, PageHeader, Select, StatusBadge, Table, toast } from "../components/UI";

const EMPTY_FORM = {
  reference: "", client_id: "", agent_id: "", operation_type: "import",
  origin_country: "", destination_country: "", loading_port: "", destination_port: "",
  eta: "", delivery_date: "", status: "en_cours", notes: "",
};

export default function Dossiers() {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dossier | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = (params = "") =>
    api<{ dossiers: Dossier[] }>(`/api/dossiers${params}`).then((d) => setDossiers(d.dossiers)).catch(() => {});
  useEffect(() => {
    load();
    useMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    if (type) p.set("operation_type", type);
    const t = setTimeout(() => load(`?${p.toString()}`), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, type]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setOpen(true); };
  const openEdit = (d: Dossier) => {
    setEditing(d);
    setForm({
      reference: d.reference, client_id: String(d.client_id), agent_id: d.agent_id ? String(d.agent_id) : "",
      operation_type: d.operation_type, origin_country: d.origin_country, destination_country: d.destination_country,
      loading_port: d.loading_port, destination_port: d.destination_port, eta: d.eta || "", delivery_date: d.delivery_date || "",
      status: d.status, notes: d.notes,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_id) return toast("Le client est obligatoire", "error");
    setSaving(true);
    try {
      const payload = { ...form, client_id: Number(form.client_id), agent_id: form.agent_id ? Number(form.agent_id) : null };
      if (editing) {
        await api(`/api/dossiers/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Dossier modifié");
      } else {
        const r = await api<{ id: number; number: string }>("/api/dossiers", { method: "POST", body: JSON.stringify(payload) });
        toast(`Dossier ${r.number} créé`);
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dossiers"
        subtitle={`${dossiers.length} dossiers · ${dossiers.filter((d) => d.status !== "cloture" && d.status !== "annule").length} en cours`}
        actions={can(user, "create") && <Button onClick={openNew}><Plus size={16} /> Nouveau dossier</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-64 pl-9" placeholder="N°, référence, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input w-36" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="import">Import</option>
            <option value="export">Export</option>
            <option value="transit">Transit</option>
          </select>
        </div>
        <Table head={["N° dossier", "Client", "Type", "Route", "Arrivée prévue", "Progression", "Agent", "Statut", ""]} empty="Aucun dossier">
          {dossiers.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="td">
                <Link to={`/dossiers/${d.id}`} className="font-semibold text-primary hover:underline">{d.number}</Link>
                {d.reference && <div className="text-xs text-slate-400">{d.reference}</div>}
              </td>
              <td className="td">{d.client_name}</td>
              <td className="td"><Badge tone="bg-surface text-slate-600">{label(d.operation_type, OP_LABELS)}</Badge></td>
              <td className="td text-xs">{d.loading_port || "—"} → {d.destination_port || "—"}</td>
              <td className={`td text-xs ${isLate(d.eta) && d.status !== "cloture" && d.status !== "livre" && d.status !== "annule" ? "font-semibold text-rose-600" : ""}`}>
                {fmtDate(d.eta)}
              </td>
              <td className="td">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary/100"
                      style={{ width: `${d.steps_total ? Math.round((d.steps_done || 0) / d.steps_total * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{d.steps_done}/{d.steps_total}</span>
                </div>
              </td>
              <td className="td text-xs">{d.agent_name || "—"}</td>
              <td className="td"><StatusBadge status={d.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
              <td className="td">
                <div className="flex justify-end gap-1">
                  {can(user, "edit") && (
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openEdit(d)} title="Modifier">
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Modifier ${editing.number}` : "Nouveau dossier"} wide>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Client *">
            <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
              <option value="">— Sélectionner —</option>
              {(meta?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Agent responsable">
            <select className="input" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
              <option value="">— Non assigné —</option>
              {(meta?.agents || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Type d'opération">
            <Select options={[
              { value: "import", label: "Import" },
              { value: "export", label: "Export" },
              { value: "transit", label: "Transit" },
            ]} value={form.operation_type} onChange={(e) => setForm({ ...form, operation_type: e.target.value })} />
          </Field>
          <Field label="Référence interne">
            <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="REF-…" />
          </Field>
          <Field label="Pays d'origine">
            <input className="input" value={form.origin_country} onChange={(e) => setForm({ ...form, origin_country: e.target.value })} list="countries" />
          </Field>
          <Field label="Pays de destination">
            <input className="input" value={form.destination_country} onChange={(e) => setForm({ ...form, destination_country: e.target.value })} list="countries" />
          </Field>
          <Field label="Port d'embarquement">
            <input className="input" value={form.loading_port} onChange={(e) => setForm({ ...form, loading_port: e.target.value })} list="ports" />
          </Field>
          <Field label="Port de destination">
            <input className="input" value={form.destination_port} onChange={(e) => setForm({ ...form, destination_port: e.target.value })} list="ports" />
          </Field>
          <Field label="Statut">
            <Select options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
          </Field>
          <Field label="Date d'arrivée prévue (ETA)">
            <input className="input" type="date" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} />
          </Field>
          <Field label="Date de livraison">
            <input className="input" type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
          </Field>
          <Field label="Notes" className="col-span-3">
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <datalist id="countries">{(meta?.countries || []).map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="ports">{(meta?.ports || []).map((p) => <option key={p} value={p} />)}</datalist>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>
    </div>
  );
}
