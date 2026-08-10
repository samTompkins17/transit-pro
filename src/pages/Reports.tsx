import { useEffect, useState } from "react";
import { TrendingUp, Wallet, Scale, FolderOpen, BarChart3 } from "lucide-react";
import { api, fmtMoney, label, OP_LABELS, STATUS_LABELS } from "../api";
import { Card, PageHeader, StatCard } from "../components/UI";

interface ReportsData {
  byType: { operation_type: string; c: number }[];
  byStatus: { status: string; c: number }[];
  revenueByMonth: { mois: string; ca: number }[];
  byClient: { name: string; dossiers: number; ca: number }[];
  byAgent: { name: string; dossiers: number }[];
  expenses: number;
  revenue: number;
  profit: number;
  totalDossiers: number;
}

function Bar({ value, max, color = "bg-primary/100" }: { value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs font-semibold text-slate-600">{value}</span>
    </div>
  );
}

export default function Reports() {
  const today = new Date();
  const startOfYear = `${today.getFullYear()}-01-01`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [from, setFrom] = useState(startOfYear);
  const [to, setTo] = useState(todayStr);
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    api<ReportsData>(`/api/reports?from=${from}&to=${to}`).then(setData).catch(() => {});
  }, [from, to]);

  return (
    <div>
      <PageHeader title="Rapports" subtitle="Analyse de l'activité par période" />
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Du</label>
            <input className="input w-44" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Au</label>
            <input className="input w-44" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={() => { setFrom(startOfYear); setTo(todayStr); }}>
            Réinitialiser
          </button>
        </div>
      </Card>

      {!data && <div className="flex h-40 items-center justify-center text-sm text-slate-400">Chargement…</div>}

      {data && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard icon={<TrendingUp size={20} />} label="Chiffre d'affaires" value={fmtMoney(data.revenue)} tone="bg-primary/10 text-primary" />
            <StatCard icon={<Wallet size={20} />} label="Dépenses" value={fmtMoney(data.expenses)} tone="bg-accent/15 text-accent" />
            <StatCard icon={<Scale size={20} />} label="Rentabilité" value={fmtMoney(data.profit)} sub={data.revenue ? `${Math.round((data.profit / data.revenue) * 100)}% de marge` : ""} tone="bg-primary/10 text-primary" />
            <StatCard icon={<FolderOpen size={20} />} label="Dossiers créés" value={data.totalDossiers} tone="bg-primary/10 text-primary" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Chiffre d'affaires par mois">
              <div className="space-y-3 p-5">
                {data.revenueByMonth.length === 0 && <p className="text-sm text-slate-400">Aucune donnée sur la période.</p>}
                {data.revenueByMonth.map((m) => (
                  <div key={m.mois}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">{m.mois}</span>
                      <span className="text-slate-500">{fmtMoney(m.ca)}</span>
                    </div>
                    <Bar value={m.ca} max={Math.max(...data.revenueByMonth.map((x) => x.ca), 1)} color="bg-emerald-500" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Volume par type d'opération">
              <div className="space-y-3 p-5">
                {data.byType.map((t) => (
                  <div key={t.operation_type}>
                    <div className="mb-1 text-xs font-medium text-slate-600">{label(t.operation_type, OP_LABELS)}</div>
                    <Bar value={t.c} max={Math.max(...data.byType.map((x) => x.c), 1)} />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Répartition par statut de dossier">
              <div className="space-y-3 p-5">
                {data.byStatus.map((s) => (
                  <div key={s.status}>
                    <div className="mb-1 text-xs font-medium text-slate-600">{label(s.status, STATUS_LABELS)}</div>
                    <Bar value={s.c} max={Math.max(...data.byStatus.map((x) => x.c), 1)} color="bg-primary" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Performances par agent">
              <div className="space-y-3 p-5">
                {data.byAgent.map((a) => (
                  <div key={a.name}>
                    <div className="mb-1 text-xs font-medium text-slate-600">{a.name}</div>
                    <Bar value={a.dossiers} max={Math.max(...data.byAgent.map((x) => x.dossiers), 1)} color="bg-navy" />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Statistiques par client" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50/70">
                    <tr>
                      <th className="th">Client</th>
                      <th className="th">Dossiers</th>
                      <th className="th">Chiffre d'affaires</th>
                      <th className="th">Part du CA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.byClient.map((c) => (
                      <tr key={c.name}>
                        <td className="td font-medium">{c.name}</td>
                        <td className="td">{c.dossiers}</td>
                        <td className="td font-semibold">{fmtMoney(c.ca)}</td>
                        <td className="td">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-surface">
                              <div className="h-full rounded-full bg-primary/100" style={{ width: `${data.revenue ? Math.max(3, (c.ca / data.revenue) * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{data.revenue ? Math.round((c.ca / data.revenue) * 100) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
