import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen, Container, AlertTriangle, TrendingUp, Hourglass, PiggyBank,
  CalendarDays, ArrowRight, FileWarning, CreditCard,
} from "lucide-react";
import { api, can, fmtMoney, fmtDate, label, OP_LABELS, STATUS_LABELS, STATUS_TONES, relativeDay } from "../api";
import type { Container as ContainerT, Dossier, Invoice, Notification } from "../types";
import { Badge, Card, StatCard, StatusBadge, Table } from "../components/UI";
import { useAuth } from "../App";

interface DashboardData {
  stats: {
    dossiersEnCours: number;
    conteneursEnTransit: number;
    enRetard: number;
    ca: number;
    enAttente: number;
    soldeClients: number;
  };
  recentDossiers: Dossier[];
  conteneurs: ContainerT[];
  calendar: { kind: string; date: string; label: string; dossier_number: string; dossier_id: number }[];
  notifications: Notification[];
  unpaid: Invoice[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch(() => {});
  }, []);

  if (!data) {
    return <div className="flex h-64 items-center justify-center text-sm text-slate-400">Chargement…</div>;
  }

  const s = data.stats;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Bonjour, {user?.name.split(" ")[0]} 👋</h1>
          <p className="mt-0.5 text-sm text-slate-500">Voici un aperçu de vos opérations de transit.</p>
        </div>
        {can(user, "create") && <Link to="/dossiers" className="btn-primary">+ Nouveau dossier</Link>}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={<FolderOpen size={20} />} label="Dossiers en cours" value={s.dossiersEnCours} tone="bg-primary/10 text-primary" />
        <StatCard icon={<Container size={20} />} label="Conteneurs en transit" value={s.conteneursEnTransit} tone="bg-primary/10 text-primary" />
        <StatCard icon={<AlertTriangle size={20} />} label="Expéditions en retard" value={s.enRetard} tone="bg-accent/15 text-accent" sub={s.enRetard > 0 ? "Action requise" : "Tout est à l'heure"} />
        <StatCard icon={<TrendingUp size={20} />} label="CA de l'année" value={fmtMoney(s.ca)} tone="bg-primary/10 text-primary" />
        <StatCard icon={<Hourglass size={20} />} label="Paiements en attente" value={fmtMoney(s.enAttente)} tone="bg-accent/15 text-accent" />
        <StatCard icon={<PiggyBank size={20} />} label="Solde clients" value={fmtMoney(s.soldeClients)} tone="bg-navy/10 text-navy" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 xl:col-span-2">
          <Card title="Dossiers récents" actions={<Link to="/dossiers" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Tout voir <ArrowRight size={13} /></Link>}>
            <Table
              head={["N°", "Client", "Type", "Route", "Arrivée prévue", "Statut"]}
              empty="Aucun dossier"
            >
              {data.recentDossiers.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="td"><Link to={`/dossiers/${d.id}`} className="font-semibold text-primary hover:underline">{d.number}</Link></td>
                  <td className="td">{d.client_name}</td>
                  <td className="td"><Badge tone="bg-surface text-slate-600">{label(d.operation_type, OP_LABELS)}</Badge></td>
                  <td className="td text-xs">{d.loading_port || "—"} → {d.destination_port || "—"}</td>
                  <td className="td text-xs">{fmtDate(d.eta)}</td>
                  <td className="td"><StatusBadge status={d.status} labels={STATUS_LABELS} map={STATUS_TONES} /></td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Calendrier — 7 prochains jours" actions={<span className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays size={14} /> Échéances & arrivées</span>}>
            <div className="divide-y divide-slate-100">
              {data.calendar.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">Aucune échéance à venir.</div>}
              {data.calendar.map((c, i) => (
                <Link key={i} to={`/dossiers/${c.dossier_id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <div className="w-24 shrink-0 text-sm font-semibold text-slate-700">{relativeDay(c.date)}</div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-slate-500">
                    {c.kind === "arrivée" ? <Container size={16} /> : <CalendarDays size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{c.label}</div>
                    <div className="text-xs text-slate-400">{c.dossier_number}</div>
                  </div>
                  <ArrowRight size={15} className="shrink-0 text-slate-300" />
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          <Card title="Notifications" actions={<Link to="/notifications" className="text-xs font-semibold text-primary hover:underline">Tout voir</Link>}>
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {data.notifications.map((n, i) => (
                <div key={i} className="flex gap-2.5 px-4 py-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.type === "danger" ? "bg-rose-500" : n.type === "warning" ? "bg-accent" : n.type === "success" ? "bg-emerald-500" : "bg-primary"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Conteneurs en transit" actions={<Link to="/conteneurs" className="text-xs font-semibold text-primary hover:underline">Tout voir</Link>}>
            <div className="divide-y divide-slate-100">
              {data.conteneurs.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun conteneur actif.</div>}
              {data.conteneurs.map((c) => (
                <Link key={c.id} to="/conteneurs" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Container size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{c.number}</div>
                    <div className="truncate text-xs text-slate-400">{c.position}</div>
                  </div>
                  <Badge tone={STATUS_TONES[c.status] || "bg-surface text-slate-600"}>{label(c.status, STATUS_LABELS)}</Badge>
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Factures impayées" actions={<Link to="/finance" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Finance <ArrowRight size={13} /></Link>}>
            <div className="divide-y divide-slate-100">
              {data.unpaid.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aucune facture impayée 🎉</div>}
              {data.unpaid.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <FileWarning size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{inv.number}</div>
                    <div className="truncate text-xs text-slate-400">{inv.client_name} · échéance {fmtDate(inv.due_date)}</div>
                  </div>
                  <div className="text-sm font-semibold text-ink">{fmtMoney(inv.amount - (inv.paid || 0))}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
