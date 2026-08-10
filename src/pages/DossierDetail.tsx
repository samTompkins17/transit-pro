import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {          ArrowLeft, Check, ChevronRight, Container, FileText, CreditCard, History,
  MapPin, Globe, CalendarDays, User, Plus,
} from "lucide-react";
import { api, can, fmtDate, fmtMoney, isLate, label, OP_LABELS, STATUS_LABELS, STATUS_TONES, DOC_TYPE_LABELS, EXPENSE_CATEGORIES } from "../api";
import { useAuth } from "../App";
import type { Container as ContainerT, DocumentItem, Expense, Invoice, Movement, Step } from "../types";
import { Badge, Button, Card, Field, Modal, StatusBadge, Table, toast } from "../components/UI";

interface DetailData {
  dossier: any;
  steps: Step[];
  containers: ContainerT[];
  documents: DocumentItem[];
  invoices: Invoice[];
  expenses: Expense[];
  movements: Movement[];
}

export default function DossierDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<DetailData | null>(null);
  const [containerOpen, setContainerOpen] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [container, setContainer] = useState<ContainerT | null>(null);
  const [moveForm, setMoveForm] = useState({ date: "", position: "", status: "en_cours", note: "" });

  const load = () => api<DetailData>(`/api/dossiers/${id}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [id]);

  if (!data) return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Chargement…</div>;
  const { dossier, steps, containers, documents, invoices, expenses, movements: dossierMoves } = data;

  const toggleStep = async (step: Step) => {
    try {
      await api(`/api/dossiers/${dossier.id}/steps/${step.id}/toggle`, { method: "POST" });
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const openContainer = async (c: ContainerT) => {
    const d = await api<{ container: ContainerT; movements: Movement[] }>(`/api/containers/${c.id}`);
    setContainer(d.container);
    setMovements(d.movements);
    setMoveForm({ date: "", position: c.position, status: c.status, note: "" });
    setContainerOpen(true);
  };

  const addMovement = async () => {
    try {
      await api(`/api/containers/${container!.id}/movements`, { method: "POST", body: JSON.stringify(moveForm) });
      toast("Mouvement ajouté");
      const d = await api<{ container: ContainerT; movements: Movement[] }>(`/api/containers/${container!.id}`);
      setContainer(d.container);
      setMovements(d.movements);
      setMoveForm({ date: "", position: d.container.position, status: d.container.status, note: "" });
      load();
    } catch (e: any) { toast(e.message, "error"); }
  };

  const stepsDone = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((stepsDone / steps.length) * 100) : 0;

  return (
    <div>
      <Link to="/dossiers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary">
        <ArrowLeft size={15} /> Retour aux dossiers
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-ink">{dossier.number}</h1>
            <StatusBadge status={dossier.status} labels={STATUS_LABELS} map={STATUS_TONES} />
            <Badge tone="bg-surface text-slate-600">{label(dossier.operation_type, OP_LABELS)}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {dossier.reference && <><span className="font-medium text-slate-600">{dossier.reference}</span> · </>}
            <Link to={`/clients/${dossier.client_id}`} className="text-primary hover:underline">{dossier.client_name}</Link>
            {dossier.agent_name && <> · Agent : {dossier.agent_name}</>}
          </p>
        </div>
        <div className="w-56">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Avancement des opérations</span>
            <span className="font-semibold">{stepsDone}/{steps.length} · {pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Informations */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          { icon: <MapPin size={14} />, label: "Port d'embarquement", value: dossier.loading_port || "—" },
          { icon: <MapPin size={14} />, label: "Port de destination", value: dossier.destination_port || "—" },
          { icon: <Globe size={14} />, label: "Origine → Destination", value: `${dossier.origin_country || "—"} → ${dossier.destination_country || "—"}` },
          { icon: <CalendarDays size={14} />, label: "Arrivée prévue (ETA)", value: fmtDate(dossier.eta), warn: isLate(dossier.eta) },
          { icon: <CalendarDays size={14} />, label: "Livraison", value: fmtDate(dossier.delivery_date) },
          { icon: <User size={14} />, label: "Créé le", value: fmtDate(dossier.created_at) },
        ].map((item, i) => (
          <div key={i} className="card p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">{item.icon}{item.label}</div>
            <div className={`mt-1 truncate text-sm font-semibold ${item.warn ? "text-rose-600" : "text-ink"}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {dossier.notes && (
        <div className="mb-5 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent-dark">
          <span className="font-semibold">Note : </span>{dossier.notes}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Suivi des opérations */}
        <Card title="Suivi des opérations" className="xl:col-span-2">
          <div className="p-5">
            <ol className="relative space-y-1 border-l-2 border-slate-100 pl-6">
              {steps.map((s) => (
                <li key={s.id} className="relative">
                  <span className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <Check size={12} />
                  </span>
                  <button
                    onClick={() => toggleStep(s)}
                    disabled={!can(user, "create")}
                    className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${s.done ? "bg-emerald-50/50" : "hover:bg-slate-50"} ${can(user, "create") ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div>
                      <div className={`text-sm font-medium ${s.done ? "text-emerald-800" : "text-slate-700"}`}>{s.label}</div>
                      <div className="text-xs text-slate-400">
                        {s.done && s.done_at ? `Validée le ${fmtDate(s.done_at)}` : s.due_date ? `Échéance : ${fmtDate(s.due_date)}` : "En attente"}
                      </div>
                    </div>
                    {can(user, "create") && (
                      <span className={`text-xs font-medium ${s.done ? "text-emerald-600" : "text-slate-400 group-hover:text-primary"}`}>
                        {s.done ? "Validée" : "Valider"}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        {/* Colonne droite */}
        <div className="space-y-5">
          <Card title={`Conteneurs (${containers.length})`} actions={can(user, "create") && <Link to="/conteneurs" className="btn btn-secondary btn-sm"><Plus size={14} /> Ajouter</Link>}>
            <div className="divide-y divide-slate-100">
              {containers.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun conteneur associé.</div>}
              {containers.map((c) => (
                <button key={c.id} onClick={() => openContainer(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Container size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{c.number}</div>
                    <div className="truncate text-xs text-slate-400">{c.size} · {c.vessel || "—"}</div>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>

          <Card title={`Documents (${documents.length})`}>
            <div className="divide-y divide-slate-100">
              {documents.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun document.</div>}
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{doc.name}</div>
                    <div className="text-xs text-slate-400">{DOC_TYPE_LABELS[doc.type] || doc.type}</div>
                  </div>
                  {doc.expires_at && (
                    <span className={`text-[11px] font-medium ${isLate(doc.expires_at) ? "text-rose-600" : "text-slate-400"}`}>
                      {isLate(doc.expires_at) ? "Expiré" : `Valable → ${fmtDate(doc.expires_at)}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title={`Factures (${invoices.length})`}>
            <div className="divide-y divide-slate-100">
              {invoices.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucune facture.</div>}
              {invoices.map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <CreditCard size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{i.number}</div>
                    <div className="text-xs text-slate-400">{i.type === "devis" ? "Devis" : "Facture"} · {fmtDate(i.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-ink">{fmtMoney(i.amount)}</div>
                    <StatusBadge status={i.status} labels={STATUS_LABELS} map={STATUS_TONES} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Dépenses et mouvements */}
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title={`Dépenses (${expenses.length})`}>
          <Table head={["Date", "Libellé", "Catégorie", "Montant"]} empty="Aucune dépense">
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="td text-xs">{fmtDate(e.date)}</td>
                <td className="td">{e.label}</td>
                <td className="td text-xs"><Badge tone="bg-surface text-slate-600">{EXPENSE_CATEGORIES[e.category] || e.category}</Badge></td>
                <td className="td font-semibold">{fmtMoney(e.amount)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title={`Historique des mouvements (${dossierMoves.length})`}>
          <div className="max-h-72 overflow-y-auto">
            <div className="divide-y divide-slate-100">
              {dossierMoves.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun mouvement.</div>}
              {dossierMoves.map((m, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-slate-500">
                    <History size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{m.position || "—"}</div>
                    <div className="text-xs text-slate-400">{fmtDate(m.date)} · {m.container_number}{m.note ? ` · ${m.note}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Modal conteneur */}
      <Modal open={containerOpen} onClose={() => setContainerOpen(false)} title={`Conteneur ${container?.number || ""}`} wide>
        {container && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-slate-400 uppercase">Taille</div><div className="font-semibold">{container.size}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Compagnie</div><div className="font-semibold">{container.shipping_line || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Navire</div><div className="font-semibold">{container.vessel || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Voyage</div><div className="font-semibold">{container.voyage || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Position</div><div className="font-semibold">{container.position || "—"}</div></div>
              <div><div className="text-xs text-slate-400 uppercase">Statut</div><StatusBadge status={container.status} labels={STATUS_LABELS} map={STATUS_TONES} /></div>
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
