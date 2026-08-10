import { Children, useEffect, useState, type ReactNode } from "react";
import { X, AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight } from "lucide-react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// --- Badge ------------------------------------------------------------------
export function Badge({ children, tone = "bg-surface text-slate-600" }: { children: ReactNode; tone?: string }) {
  return <span className={cx("badge", tone)}>{children}</span>;
}

export function StatusBadge({ status, labels, map }: { status: string; labels: Record<string, string>; map: Record<string, string> }) {
  const text = labels[status] || status;
  return <Badge tone={map[status] || "bg-surface text-slate-600"}>{text}</Badge>;
}

// --- Card -------------------------------------------------------------------
export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <div className={cx("card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

// --- Button -----------------------------------------------------------------
export function Button({ variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "success" }) {
  const v = { primary: "btn-primary", secondary: "btn-secondary", danger: "btn-danger", success: "btn-success" }[variant];
  return <button className={cx(v, className)} {...props} />;
}

// --- Modal ------------------------------------------------------------------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4 backdrop-blur-sm no-print" onClick={onClose}>
      <div
        className={cx("my-8 w-full rounded-xl bg-white shadow-2xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-surface hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// --- Formulaires ------------------------------------------------------------
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select className="input" {...props}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// --- Table ------------------------------------------------------------------
export function Table({ head, children, empty, colSpan }: { head: string[]; children: ReactNode; empty?: string; colSpan?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50/70">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Children.count(children) > 0 ? (
            children
          ) : empty ? (
            <tr>
              <td colSpan={colSpan || head.length} className="px-4 py-10 text-center text-sm text-slate-400">
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// --- StatCard ---------------------------------------------------------------
export function StatCard({ icon, label, value, sub, tone = "text-primary bg-primary/10" }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="card flex items-start gap-3.5 p-4">
      <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold text-ink leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

// --- PageHeader -------------------------------------------------------------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- Empty state ------------------------------------------------------------
export function EmptyState({ message }: { message: string }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{message}</div>;
}

// --- Toasts -----------------------------------------------------------------
type Toast = { id: number; kind: "success" | "error" | "info"; message: string };
let toastId = 0;
const listeners = new Set<(t: Toast) => void>();
export function toast(message: string, kind: Toast["kind"] = "success") {
  const t = { id: ++toastId, kind, message };
  listeners.forEach((l) => l(t));
}
export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.add(onToast);
    return () => { listeners.delete(onToast); };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 no-print">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx(
            "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg",
            t.kind === "success" && "bg-emerald-600",
            t.kind === "error" && "bg-rose-600",
            t.kind === "info" && "bg-slate-800"
          )}
        >
          {t.kind === "success" && <CheckCircle2 size={16} />}
          {t.kind === "error" && <AlertTriangle size={16} />}
          {t.kind === "info" && <Info size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            active === t.key ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// --- Pagination simple -------------------------------------------------------
export function MiniPager({ page, setPage, hasMore }: { page: number; setPage: (n: number) => void; hasMore: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
      <span>Page {page}</span>
      <div className="flex gap-1">
        <button className="rounded p-1 hover:bg-surface disabled:opacity-30" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
        <button className="rounded p-1 hover:bg-surface disabled:opacity-30" disabled={!hasMore} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
