import { useEffect, useState } from "react";
import {
  Plus, TrendingUp, Wallet, Hourglass, Receipt, CreditCard, Printer, Pencil,
  ArrowDownToLine, Scale,
} from "lucide-react";
import { api, can, fmtDate, fmtMoney, label, STATUS_LABELS, STATUS_TONES } from "../api";
import { useAuth } from "../App";
import type { Expense, Invoice, Payment } from "../types";
import { Badge, Button, Card, Field, Modal, PageHeader, StatCard, StatusBadge, Table, Tabs, toast } from "../components/UI";

const EMPTY_INVOICE = { type: "facture", client_id: "", dossier_id: "", date: "", due_date: "", amount: "", status: "emise", notes: "" };
const EMPTY_PAYMENT = { invoice_id: "", client_id: "", date: "", amount: "", method: "virement", reference: "" };
const EMPTY_EXPENSE = { dossier_id: "", date: "", label: "", category: "divers", amount: "", paid_by: "" };

interface Summary {
  ca: number; encaisse: number; enAttente: number; depenses: number;
  balances: { id: number; name: string; facture: number; paye: number; solde: number }[];
}

export default function Finance() {
  const { user } = useAuth();
  const isClient = user?.role === "client";
  const [tab, setTab] = useState(isClient ? "factures" : "factures");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clients, setClients] = useState<{ id: number; name: string }[]>([]);
  const [dossiers, setDossiers] = useState<{ id: number; number: string; client_name: string; client_id: number }[]>([]);

  const [invOpen, setInvOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [invForm, setInvForm] = useState({ ...EMPTY_INVOICE });
  const [payOpen, setPayOpen] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ ...EMPTY_PAYMENT });
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState({ ...EMPTY_EXPENSE });
  const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const [printInv, setPrintInv] = useState<{ invoice: Invoice; payments: Payment[] } | null>(null);

  const [saving, setSaving] = useState(false);

  const load = () => {
    api<{ invoices: Invoice[] }>("/api/invoices").then((d) => setInvoices(d.invoices)).catch(() => {});
    if (!isClient) {
      api<{ payments: Payment[] }>("/api/payments").then((d) => setPayments(d.payments)).catch(() => {});
      api<Summary>("/api/finance/summary").then(setSummary).catch(() => {});
    }
  };
  useEffect(() => {
    load();
    api<{ clients: { id: number; name: string }[] }>("/api/clients").then((d) => setClients(d.clients)).catch(() => {});
    api<{ dossiers: { id: number; number: string; client_name: string; client_id: number }[] }>("/api/dossiers").then((d) => setDossiers(d.dossiers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewInv = () => { setEditingInv(null); setInvForm({ ...EMPTY_INVOICE, date: localToday() }); setInvOpen(true); };
  const openEditInv = (i: Invoice) => {
    setEditingInv(i);
    setInvForm({ type: i.type, client_id: String(i.client_id), dossier_id: i.dossier_id ? String(i.dossier_id) : "", date: i.date, due_date: i.due_date || "", amount: String(i.amount), status: i.status, notes: i.notes });
    setInvOpen(true);
  };

  const saveInvoice = async () => {
    if (!invForm.client_id || !invForm.amount) return toast("Client et montant obligatoires", "error");
    setSaving(true);
    try {
      const payload = { ...invForm, client_id: Number(invForm.client_id), dossier_id: invForm.dossier_id ? Number(invForm.dossier_id) : null, amount: Number(invForm.amount) };
      if (editingInv) {
        await api(`/api/invoices/${editingInv.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast("Document modifié");
      } else {
        await api("/api/invoices", { method: "POST", body: JSON.stringify(payload) });
        toast("Document créé");
      }
      setInvOpen(false);
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const openPay = (i: Invoice) => {
    setPayFor(i);
    const remaining = Math.round((i.amount - (i.paid || 0)) * 100) / 100;
    setPayForm({ ...EMPTY_PAYMENT, invoice_id: String(i.id), client_id: String(i.client_id), date: localToday(), amount: String(remaining) });
    setPayOpen(true);
  };

  const savePayment = async () => {
    if (!payFor || !payForm.amount) return toast("Montant obligatoire", "error");
    setSaving(true);
    try {
      await api(`/api/invoices/${payFor.id}/pay`, { method: "POST", body: JSON.stringify({ ...payForm, amount: Number(payForm.amount), client_id: Number(payForm.client_id) }) });
      toast("Encaissement enregistré");
      setPayOpen(false);
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const saveExpense = async () => {
    if (!expForm.label || !expForm.amount) return toast("Libellé et montant obligatoires", "error");
    setSaving(true);
    try {
      await api("/api/expenses", { method: "POST", body: JSON.stringify({ ...expForm, dossier_id: expForm.dossier_id ? Number(expForm.dossier_id) : null, amount: Number(expForm.amount) }) });
      toast("Dépense enregistrée");
      setExpOpen(false);
      setExpForm({ ...EMPTY_EXPENSE });
      load();
    } catch (e: any) { toast(e.message, "error"); } finally { setSaving(false); }
  };

  const openPrint = async (i: Invoice) => {
    const d = await api<{ invoice: Invoice; payments: Payment[] }>(`/api/invoices/${i.id}`);
    setPrintInv(d);
  };

  const tabs = isClient
    ? [{ key: "factures", label: "Mes factures" }]
    : [
        { key: "factures", label: "Factures & devis" },
        { key: "encaissements", label: "Encaissements" },
        { key: "depenses", label: "Dépenses" },
        { key: "soldes", label: "Solde clients" },
      ];

  return (
    <div>
      <PageHeader
        title="Gestion financière"
        subtitle={isClient ? "Consultez vos factures et paiements" : "Facturation, encaissements, dépenses et rentabilité"}
        actions={!isClient && can(user, "finance") && (
          <>
            <Button variant="secondary" onClick={() => { setExpOpen(true); }}><Scale size={16} /> Dépense</Button>
            <Button onClick={openNewInv}><Plus size={16} /> Nouvelle facture</Button>
          </>
        )}
      />

      {!isClient && summary && (
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={<TrendingUp size={20} />} label="Chiffre d'affaires" value={fmtMoney(summary.ca)} tone="bg-primary/10 text-primary" />
          <StatCard icon={<ArrowDownToLine size={20} />} label="Encaissé" value={fmtMoney(summary.encaisse)} tone="bg-primary/10 text-primary" />
          <StatCard icon={<Hourglass size={20} />} label="En attente" value={fmtMoney(summary.enAttente)} tone="bg-accent/15 text-accent" />
          <StatCard icon={<Wallet size={20} />} label="Dépenses" value={fmtMoney(summary.depenses)} tone="bg-accent/15 text-accent" />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 pt-3">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {/* Factures */}
        {tab === "factures" && (
          <Table head={["N°", "Type", "Client", "Dossier", "Date", "Échéance", "Montant", "Payé", "Reste", "Statut", ""]} empty="Aucune facture">
            {invoices.map((i) => {
              const paid = i.paid || 0;
              const rest = Math.round((i.amount - paid) * 100) / 100;
              return (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="td font-semibold text-ink">{i.number}</td>
                  <td className="td"><Badge tone={i.type === "devis" ? "bg-surface text-slate-600" : "bg-emerald-50 text-emerald-700"}>{i.type === "devis" ? "Devis" : "Facture"}</Badge></td>
                  <td className="td">{i.client_name}</td>
                  <td className="td text-xs">{i.dossier_number || "—"}</td>
                  <td className="td text-xs">{fmtDate(i.date)}</td>
                  <td className="td text-xs">{fmtDate(i.due_date)}</td>
                  <td className="td font-semibold">{fmtMoney(i.amount)}</td>
                  <td className="td text-xs text-emerald-600">{fmtMoney(paid)}</td>
                  <td className={`td font-semibold ${rest > 0 ? "text-rose-600" : "text-slate-400"}`}>{fmtMoney(rest)}</td>
                  <td className="td"><StatusBadge status={i.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openPrint(i)} title="Imprimer">
                        <Printer size={15} />
                      </button>
                      {!isClient && can(user, "finance") && i.status !== "payee" && (
                        <button className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => openPay(i)} title="Encaisser">
                          <CreditCard size={15} />
                        </button>
                      )}
                      {!isClient && can(user, "finance") && (
                        <button className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-primary" onClick={() => openEditInv(i)} title="Modifier">
                          <Pencil size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}

        {/* Encaissements */}
        {tab === "encaissements" && (
          <Table head={["Date", "Client", "Facture", "Montant", "Méthode", "Référence"]} empty="Aucun encaissement">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="td text-xs">{fmtDate(p.date)}</td>
                <td className="td">{p.client_name}</td>
                <td className="td text-xs">{p.invoice_number || "—"}</td>
                <td className="td font-semibold text-emerald-600">+ {fmtMoney(p.amount)}</td>
                <td className="td text-xs">{p.method}</td>
                <td className="td text-xs">{p.reference || "—"}</td>
              </tr>
            ))}
          </Table>
        )}

        {/* Dépenses */}
        {tab === "depenses" && (
          <div>
            <div className="flex justify-end border-b border-slate-100 p-3">
              <Button onClick={() => setExpOpen(true)}><Plus size={15} /> Nouvelle dépense</Button>
            </div>
            <ExpenseTable />
          </div>
        )}

        {/* Solde clients */}
        {tab === "soldes" && summary && (
          <Table head={["Client", "Facturé", "Payé", "Solde"]} empty="Aucun client">
            {summary.balances.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="td font-medium">{b.name}</td>
                <td className="td">{fmtMoney(b.facture)}</td>
                <td className="td text-emerald-600">{fmtMoney(b.paye)}</td>
                <td className={`td font-semibold ${b.solde > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtMoney(b.solde)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>

      {/* Modale facture */}
      <Modal open={invOpen} onClose={() => setInvOpen(false)} title={editingInv ? `Modifier ${editingInv.number}` : "Nouvelle facture / devis"} wide>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={invForm.type} onChange={(e) => setInvForm({ ...invForm, type: e.target.value })}>
              <option value="facture">Facture</option>
              <option value="devis">Devis</option>
            </select>
          </Field>
          <Field label="Client *">
            <select className="input" value={invForm.client_id} onChange={(e) => { setInvForm({ ...invForm, client_id: e.target.value, dossier_id: "" }); }}>
              <option value="">— Sélectionner —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Dossier associé">
            <select className="input" value={invForm.dossier_id} onChange={(e) => setInvForm({ ...invForm, dossier_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {dossiers.filter((d) => !invForm.client_id || d.client_id === Number(invForm.client_id)).slice(0, 60).map((d) => <option key={d.id} value={d.id}>{d.number}</option>)}
            </select>
          </Field>
          <Field label="Montant HT (€) *">
            <input className="input" type="number" min="0" step="0.01" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={invForm.date} onChange={(e) => setInvForm({ ...invForm, date: e.target.value })} />
          </Field>
          <Field label="Échéance">
            <input className="input" type="date" value={invForm.due_date} onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })} />
          </Field>
          <Field label="Statut">
            <select className="input" value={invForm.status} onChange={(e) => setInvForm({ ...invForm, status: e.target.value })}>
              {Object.entries({ brouillon: "Brouillon", emise: "Émise", partielle: "Partielle", payee: "Payée", annulee: "Annulée" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <input className="input" value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setInvOpen(false)}>Annuler</Button>
          <Button onClick={saveInvoice} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>

      {/* Modale encaissement */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Encaisser ${payFor?.number || ""}`}>
        {payFor && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Montant facture</span><span className="font-semibold">{fmtMoney(payFor.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Déjà payé</span><span className="font-semibold text-emerald-600">{fmtMoney(payFor.paid)}</span></div>
              <div className="mt-1 flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-500">Reste dû</span><span className="font-semibold text-rose-600">{fmtMoney(Math.round((payFor.amount - (payFor.paid || 0)) * 100) / 100)}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><input className="input" type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></Field>
              <Field label="Montant (€)"><input className="input" type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
              <Field label="Méthode">
                <select className="input" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                  {["virement", "chèque", "espèces", "carte"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Référence"><input className="input" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPayOpen(false)}>Annuler</Button>
              <Button variant="success" onClick={savePayment} disabled={saving}><CreditCard size={15} /> Encaisser</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modale dépense */}
      <Modal open={expOpen} onClose={() => setExpOpen(false)} title="Nouvelle dépense">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Libellé *" className="col-span-2"><input className="input" value={expForm.label} onChange={(e) => setExpForm({ ...expForm, label: e.target.value })} placeholder="Ex. Droits de douane ADII" /></Field>
          <Field label="Montant (€) *"><input className="input" type="number" min="0" step="0.01" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} /></Field>
          <Field label="Catégorie">
            <select className="input" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}>
              {Object.entries({ droits_taxes: "Droits & taxes", transport: "Transport", manutention: "Manutention", stockage: "Stockage", divers: "Divers" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className="input" type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} /></Field>
          <Field label="Dossier associé">
            <select className="input" value={expForm.dossier_id} onChange={(e) => setExpForm({ ...expForm, dossier_id: e.target.value })}>
              <option value="">— Aucun —</option>
              {dossiers.slice(0, 60).map((d) => <option key={d.id} value={d.id}>{d.number}</option>)}
            </select>
          </Field>
          <Field label="Payé par" className="col-span-2"><input className="input" value={expForm.paid_by} onChange={(e) => setExpForm({ ...expForm, paid_by: e.target.value })} placeholder="Espèces, virement…" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setExpOpen(false)}>Annuler</Button>
          <Button onClick={saveExpense} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        </div>
      </Modal>

      {/* Impression facture */}
      {printInv && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/50 p-4 no-print" onClick={() => setPrintInv(null)}>
          <div className="mx-auto my-6 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPrintInv(null)}>Fermer</Button>
              <Button onClick={() => window.print()}><Printer size={15} /> Imprimer</Button>
            </div>
            <InvoiceDocument invoice={printInv.invoice} payments={printInv.payments} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseTable() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  useEffect(() => {
    // Les dépenses sont exposées via le résumé ; on les recharge via une route dédiée
    api<{ expenses: Expense[] }>("/api/expenses").then((d) => setExpenses(d.expenses)).catch(() => {});
  }, []);
  return (
    <Table head={["Date", "Libellé", "Catégorie", "Dossier", "Payé par", "Montant"]} empty="Aucune dépense">
      {expenses.map((e) => (
        <tr key={e.id} className="hover:bg-slate-50">
          <td className="td text-xs">{fmtDate(e.date)}</td>
          <td className="td font-medium">{e.label}</td>
          <td className="td text-xs"><Badge tone="bg-surface text-slate-600">{e.category}</Badge></td>
          <td className="td text-xs">{e.dossier_id ? `Dossier #${e.dossier_id}` : "—"}</td>
          <td className="td text-xs">{e.paid_by || "—"}</td>
          <td className="td font-semibold text-rose-600">− {fmtMoney(e.amount)}</td>
        </tr>
      ))}
    </Table>
  );
}

function InvoiceDocument({ invoice, payments }: { invoice: Invoice; payments: Payment[] }) {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <div className="print-area rounded-xl bg-white p-8 shadow-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><Receipt size={18} /></span>
            TransitPro
          </div>
          <div className="mt-1 text-xs text-slate-500">Transit · Douane · Logistique</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-ink">{invoice.type === "devis" ? "DEVIS" : "FACTURE"}</div>
          <div className="text-sm font-semibold text-primary">{invoice.number}</div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Facturé à</div>
          <div className="font-semibold text-ink">{invoice.client_name}</div>
          <div className="text-slate-500">{invoice.address}</div>
          <div className="text-slate-500">{invoice.city} {invoice.country}</div>
          <div className="text-slate-500">{invoice.email}</div>
        </div>
        <div className="text-right">
          <div><span className="text-slate-500">Date : </span><span className="font-medium">{fmtDate(invoice.date)}</span></div>
          <div><span className="text-slate-500">Échéance : </span><span className="font-medium">{fmtDate(invoice.due_date)}</span></div>
          {invoice.dossier_number && <div><span className="text-slate-500">Dossier : </span><span className="font-medium">{invoice.dossier_number}</span></div>}
          <div><span className="text-slate-500">Réf. client : </span><span className="font-medium">{invoice.client_ref || "—"}</span></div>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-500">Description</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-slate-500">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="px-4 py-3 text-slate-700">{invoice.notes || `Prestations de transit — ${invoice.dossier_number || ""}`}</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtMoney(invoice.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total HT</span><span className="font-semibold">{fmtMoney(invoice.amount)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="font-semibold">Total TTC</span><span className="text-base font-bold text-ink">{fmtMoney(invoice.amount)}</span></div>
          {payments.length > 0 && (
            <div className="flex justify-between text-emerald-600"><span>Déjà encaissé</span><span>− {fmtMoney(totalPaid)}</span></div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-rose-600"><span className="font-semibold">Reste à payer</span><span className="font-bold">{fmtMoney(invoice.amount - totalPaid)}</span></div>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
        TransitPro — Merci de votre confiance. Paiement par virement bancaire.
      </div>
    </div>
  );
}
