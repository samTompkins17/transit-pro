import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { api, fmtDateTime } from "../api";
import { Badge, Card, PageHeader, Table } from "../components/UI";

interface Log {
  id: number;
  user_name: string;
  action: string;
  entity: string;
  entity_id: number | null;
  created_at: string;
}

export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([]);
  useEffect(() => {
    api<{ logs: Log[] }>("/api/audit").then((d) => setLogs(d.logs)).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle="Historique des actions effectuées par les utilisateurs" />
      <Card className="overflow-hidden">
        <Table head={["Date & heure", "Utilisateur", "Action", "Entité", "ID"]} empty="Aucune action enregistrée">
          {logs.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50">
              <td className="td text-xs">{fmtDateTime(l.created_at)}</td>
              <td className="td font-medium">{l.user_name}</td>
              <td className="td">
                <Badge tone="bg-surface text-slate-600"><ScrollText size={12} /> {l.action}</Badge>
              </td>
              <td className="td text-xs">{l.entity || "—"}</td>
              <td className="td text-xs text-slate-400">{l.entity_id ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
