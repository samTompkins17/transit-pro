import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Search, FileText, Upload, Download, Printer, Trash2, FileUp, FileWarning,
} from "lucide-react";
import { api, can, fmtDate, fmtDateTime, isLate, label, DOC_TYPE_LABELS } from "../api";
import { useAuth } from "../App";
import type { DocumentItem, Meta } from "../types";
import { Badge, Button, Card, Field, Modal, PageHeader, Table, toast } from "../components/UI";

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "facture_commerciale", dossier_id: "", expires_at: "", notes: "" });
  const [fileName, setFileName] = useState("");
  const [base64, setBase64] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dossiers, setDossiers] = useState<{ id: number; number: string; client_name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (type) p.set("type", type);
    api<{ documents: DocumentItem[] }>(`/api/documents?${p.toString()}`).then((d) => setDocs(d.documents)).catch(() => {});
  };
  useEffect(() => {
    load();
    api<{ clients: { id: number; name: string }[] }>("/api/clients").then(() => {}).catch(() => {});
    api<{ dossiers: { id: number; number: string; client_name: string }[] }>("/api/dossiers").then((d) => setDossiers(d.dossiers)).catch(() => {});
    import("../api").then((m) => m.useMeta()).then(setMeta).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast("Fichier trop volumineux (max 15 Mo)", "error");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setBase64(dataUrl.split(",")[1] || "");
      setFileName(file.name);
      setForm((f) => ({ ...f, name: f.name || file.name.replace(/\.[^.]+$/, "") }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name.trim()) return toast("Le nom du document est requis", "error");
    setSaving(true);
    try {
      await api("/api/documents", {
        method: "POST",
        body: JSON.stringify({ ...form, dossier_id: form.dossier_id ? Number(form.dossier_id) : null, filename: fileName || undefined, base64: base64 || undefined }),
      });
      toast("Document enregistré");
      setOpen(false);
      setForm({ name: "", type: "facture_commerciale", dossier_id: "", expires_at: "", notes: "" });
      setFileName("");
      setBase64("");
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const remove = async (d: DocumentItem) => {
    if (!confirm(`Supprimer le document « ${d.name} » ?`)) return;
    try {
      await api(`/api/documents/${d.id}`, { method: "DELETE" });
      toast("Document supprimé");
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  return (
    <div>
      <PageHeader
        title="Gestion documentaire"
        subtitle={`${docs.length} documents · ${docs.filter((d) => isLate(d.expires_at)).length} expirés`}
        actions={can(user, "create") && <Button onClick={() => setOpen(true)}><Plus size={16} /> Ajouter un document</Button>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input w-64 pl-9" placeholder="Rechercher un document…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-56" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les types</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <Table head={["Type", "Document", "Dossier", "Expiration", "Ajouté par", "Fichier", ""]} empty="Aucun document">
          {docs.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <td className="td"><Badge tone="bg-primary/10 text-primary">{DOC_TYPE_LABELS[d.type] || d.type}</Badge></td>
              <td className="td">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <FileText size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate">{d.name}</span>
                </div>
                {d.notes && <div className="truncate text-xs text-slate-400">{d.notes}</div>}
              </td>
              <td className="td text-xs">
                {d.dossier_id ? <Link to={`/dossiers/${d.dossier_id}`} className="text-primary hover:underline">{d.dossier_number}</Link> : "—"}
              </td>
              <td className="td text-xs">
                {d.expires_at ? (
                  <span className={`inline-flex items-center gap-1 ${isLate(d.expires_at) ? "font-semibold text-rose-600" : "text-slate-600"}`}>
                    {isLate(d.expires_at) && <FileWarning size={13} />}
                    {fmtDate(d.expires_at)}
                    {isLate(d.expires_at) && <Badge tone="bg-rose-100 text-rose-700">Expiré</Badge>}
                  </span>
                ) : "—"}
              </td>
              <td className="td text-xs">{d.uploader_name || "—"}<div className="text-[11px] text-slate-400">{fmtDateTime(d.uploaded_at)}</div></td>
              <td className="td text-xs">
                {d.filename ? <span className="text-emerald-600">Téléversé ✓</span> : <span className="text-slate-400">Sans fichier</span>}
              </td>
              <td className="td">
                <div className="flex justify-end gap-1">
                  {d.filename && (
                    <>
                      <a href={`/uploads/${d.filename}`} download className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" title="Télécharger">
                        <Download size={15} />
                      </a>
                      <a href={`/uploads/${d.filename}`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" title="Imprimer / ouvrir">
                        <Printer size={15} />
                      </a>
                    </>
                  )}
                  {can(user, "delete") && (
                    <button className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(d)} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un document" wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du document *" className="col-span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Facture commerciale — CAN-2026-011" />
          </Field>
          <Field label="Type de document">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Dossier associé">
            <select className="input" value={form.dossier_id} onChange={(e) => setForm({ ...form, dossier_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {dossiers.slice(0, 80).map((d) => <option key={d.id} value={d.id}>{d.number} — {d.client_name}</option>)}
            </select>
          </Field>
          <Field label="Date d'expiration">
            <input className="input" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <label className="label">Fichier PDF / image (optionnel)</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="hidden" onChange={onFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500 hover:border-primary hover:text-primary"
            >
              {fileName ? <><FileUp size={18} className="text-emerald-600" /> {fileName}</> : <><Upload size={18} /> Cliquer pour choisir un fichier (max 15 Mo)</>}
            </button>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>
    </div>
  );
}
