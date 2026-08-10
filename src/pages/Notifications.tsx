import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { api, fmtDateTime } from "../api";
import type { Notification } from "../types";
import { Button, Card, PageHeader } from "../components/UI";

const DOT: Record<string, string> = {
  danger: "bg-rose-500",
  warning: "bg-accent",
  success: "bg-emerald-500",
  info: "bg-primary",
};

export default function Notifications() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const load = () => api<{ notifications: Notification[] }>("/api/notifications").then((d) => setNotifs(d.notifications)).catch(() => {});
  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api("/api/notifications/read-all", { method: "POST" });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${notifs.filter((n) => !n.read).length} non lues`}
        actions={
          <Button variant="secondary" onClick={markAll}><CheckCheck size={15} /> Tout marquer comme lu</Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {notifs.length === 0 && <div className="px-4 py-12 text-center text-sm text-slate-400">Aucune notification.</div>}
          {notifs.map((n, i) => (
            <div key={n.id || i} className={`flex gap-3 px-5 py-3.5 ${!n.read ? "bg-primary/10/40" : ""}`}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[n.type] || "bg-slate-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{n.title}</div>
                <div className="text-sm text-slate-600">{n.message}</div>
                {n.created_at && <div className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.created_at)}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!n.read && <span className="badge bg-primary/15 text-primary">Nouvelle</span>}
                {n.link && <Link to={n.link} className="btn btn-secondary btn-sm">Ouvrir</Link>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
