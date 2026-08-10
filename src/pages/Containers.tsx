import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, History, Container as ContainerIcon, Ship } from "lucide-react";
import { api, can, fmtDate, label, STATUS_LABELS, STATUS_TONES, useMeta } from "../api";
import type { Dossier } from "../types";
import { useAuth } from "../App";
import type { Container, Meta, Movement } from "../types";
import { Badge, Button, Card, Field, Modal, PageHeader, StatusBadge, Table, toast } from "../components/UI";

const EMPTY = {
  number: "", size: "40", shipping_line: "", vessel: "", voyage: "",
  position: "", status: "en_transit", dossier_id: "",
};

export default function Containers() {
  const { user } = useAuth();
  const [containers, setContainers] = useState<Container[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Container | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Container | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [moveForm, setMoveForm] = useState({ date: "", position: "", status: "en_cours", note: "" });

  const load = () => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    api<{ containers: Container[] }>(`/api/containers?${p.toString()}`).then((d) => setContainers(d.containers)).catch(() => {});
  };
  useEffect(() => {
    load();
    useMeta().then(setMeta).catch(() => {});
    api<{ dossiers: Dossier[] }>("/api/dossiers").then((d) => setDossiers(d.dossiers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (c: Container) => {
    setEditing(c);
    setForm({ number: c.number, size: c.size, shipping_line: c.shipping_line, vessel: c.vessel, voyage: c.voyage, position: c.position, status: c.status, dossier_id: c.dossier_id ? String(c.dossier_id) : "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.number.trim()) return toast("Le numéro du conteneur est requis", "error");
    setSaving(true);
    try {
      const payload = { ...form, dossier_id: form.dossier_id ? Number(form.dossier_id) : null };
      if (editing) {
        await api(`/api/containers/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Conteneur modifié");
      } else {
        await api("/api/containers", { method: "POST", body: JSON.stringify(payload) });
        toast("Conteneur créé");
      }
      setOpen(false);
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const showDetail = async (c: Container) => {
    const d = await api<{ container: Container; movements: Movement[] }>(`/api/containers/${c.id}`);
    setDetail(d.container);
    setMovements(d.movements);
    setMoveForm({ date: "", position: d.container.position, status: d.container.status, note: "" });
  };

  const addMovement = async () => {
    if (!detail) return;
    try {
      await api(`/api/containers/${detail.id}/movements`, { method: "POST", body: JSON.stringify(moveForm) });
      toast("Mouvement ajouté");
      const d = await api<{ container: Container; movements: Movement[] }>(`/api/containers/${detail.id}`);
      setDetail(d.container);
      setMovements(d.movements);
      setMoveForm({ date: "", position: d.container.position, status: d.container.status, note: "" });
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Conteneurs"
        subtitle={`${containers.length} conteneurs · ${containers.filter((c) => c.status !== "livre" && c.status !== "vide" && c.status !== "restitue").length} actifs`}
        actions={can(user, "create") && <Button onClick={openNew}><Plus size={16} /> Nouveau conteneur</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-64 pl-9" placeholder="N°, navire, dossier…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            {Object.entries({ en_transit: "En transit", en_douane: "En douane", en_cours: "En cours", livre: "Livré", vide: "Vide", restitue: "Restitué" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Table head={["N° conteneur", "Taille", "Compagnie", "Navire / Voyage", "Position", "Dossier", "Statut", ""]} empty="Aucun conteneur">
          {containers.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="td">
                <button onClick={() => showDetail(c)} className="font-semibold text-primary hover:underline">{c.number}</button>
              </td>
              <td className="td"><Badge tone="bg-surface text-slate-600">{c.size}</Badge></td>
              <td className="td text-xs">{c.shipping_line || "—"}</td>
              <td className="td text-xs">{c.vessel || "—"}{c.voyage ? ` · ${c.voyage}` : ""}</td>
              <td className="td text-xs">{c.position || "—"}</td>
              <td className="td text-xs">
                {c.dossier_id ? <Link to={`/dossiers/${c.dossier_id}`} className="text-primary hover:underline">{c.dossier_number}</Link> : "—"}
              </td>
              <td className="td"><StatusBadge status={c.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
              <td className="td">
                <div className="flex justify-end gap-1">
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => showDetail(c)} title="Historique">
                    <History size={15} />
                  </button>
                  {can(user, "edit") && (
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openEdit(c)} title="Modifier">
                      <ContainerIcon size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {/* Modal création / édition */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Modifier ${editing.number}` : "Nouveau conteneur"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Numéro du conteneur *">
            <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Ex. MSKU 4821553 7" />
          </Field>
          <Field label="Taille">
            <select className="input" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
              {["20", "40", "40HC", "45", "20RF", "40RF"].map((s) => <option key={s} value={s}>{s}'</option>)}
            </select>
          </Field>
          <Field label="Compagnie maritime">
            <input className="input" value={form.shipping_line} onChange={(e) => setForm({ ...form, shipping_line: e.target.value })} placeholder="MSC, Maersk, CMA CGM…" />
          </Field>
          <Field label="Navire">
            <input className="input" value={form.vessel} onChange={(e) => setForm({ ...form, vessel: e.target.value })} />
          </Field>
          <Field label="N° de voyage">
            <input className="input" value={form.voyage} onChange={(e) => setForm({ ...form, voyage: e.target.value })} />
          </Field>
          <Field label="Dossier associé">
            <select className="input" value={form.dossier_id} onChange={(e) => setForm({ ...form, dossier_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {dossiers.slice(0, 50).map((d) => <option key={d.id} value={d.id}>{d.number} — {d.client_name}</option>)}
            </select>
          </Field>
          <Field label="Position">
            <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Port, en mer, douane…" />
          </Field>
          <Field label="Statut">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries({ en_transit: "En transit", en_douane: "En douane", en_cours: "En cours", livre: "Livré", vide: "Vide", restitue: "Restitué" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>

      {/* Modal détail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Conteneur ${detail?.number || ""}`} wide>
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-slate-400 uppercase">Taille</div><div className="font-semibold">{detail.size}'</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Compagnie</div><div className="font-semibold">{detail.shipping_line || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Navire</div><div className="flex items-center gap-1 font-semibold"><Ship size={14} className="text-slate-400" />{detail.vessel || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Voyage</div><div className="font-semibold">{detail.voyage || "—"}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-400 uppercase">Position</div><div className="font-semibold">{detail.position || "—"}</div></div>
              <div className="col-span-2"><div className="text-xs text-slate-400 uppercase">Statut</div><StatusBadge status={detail.status} labels={STATUS_LABELS} map={STATUS_TONES} /></div>
            </div>

            {can(user, "create") && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-700">Ajouter un mouvement</div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Field label="Date"><input className="input" type="date" value={moveForm.date} onChange={(e) => setMoveForm({ ...moveForm, date: e.target.value })} /></Field>
                  <Field label="Position"><input className="input" value={moveForm.position} onChange={(e) => setMoveForm({ ...moveForm, position: e.target.value })} /></Field>
                  <Field label="Statut">
                    <select className="input" value={moveForm.status} onChange={(e) => setMoveForm({ ...moveForm, status: e.target.value })}>
                      {Object.entries({ en_transit: "En transit", en_douane: "En douane", en_cours: "En cours", livre: "Livré" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <div className="flex items-end"><Button onClick={addMovement} className="w-full"><Plus size={15} /> Ajouter</Button></div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-700">Historique des mouvements</div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {movements.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs font-medium text-slate-500">{fmtDate(m.date)}</div>
                    <div className="min-w-0 flex-1 text-sm text-slate-700">{m.position || "—"}</div>
                    {m.note && <div className="text-xs text-slate-400">{m.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
