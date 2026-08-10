import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderOpen, Container, FileText, Wallet, UserCog,
  BarChart3, ScrollText, Bell, LogOut, Ship, ChevronDown,
} from "lucide-react";
import { useAuth } from "../App";
import { api, ROLE_LABELS, can } from "../api";
import type { Notification, Role } from "../types";
import { cx } from "./UI";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  roles: Role[];
}

const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "responsable", "comptable", "employe", "client"] },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin", "responsable", "comptable"] },
  { to: "/dossiers", label: "Dossiers", icon: FolderOpen, roles: ["admin", "responsable", "comptable", "employe", "client"] },
  { to: "/conteneurs", label: "Conteneurs", icon: Container, roles: ["admin", "responsable", "comptable", "employe", "client"] },
  { to: "/documents", label: "Documents", icon: FileText, roles: ["admin", "responsable", "comptable", "employe", "client"] },
  { to: "/finance", label: "Finance", icon: Wallet, roles: ["admin", "responsable", "comptable", "client"] },
  { to: "/employes", label: "Employés", icon: UserCog, roles: ["admin"] },
  { to: "/rapports", label: "Rapports", icon: BarChart3, roles: ["admin", "responsable", "comptable"] },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "responsable", "comptable", "employe", "client"] },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Tableau de bord",
  "/clients": "Clients",
  "/dossiers": "Dossiers",
  "/conteneurs": "Conteneurs",
  "/documents": "Documents",
  "/finance": "Finance",
  "/employes": "Employés",
  "/rapports": "Rapports",
  "/audit": "Journal d'audit",
  "/notifications": "Notifications",
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadNotifs = () => {
    api<{ notifications: Notification[] }>("/api/notifications").then((d) => setNotifs(d.notifications)).catch(() => {});
  };

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 45000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;
  const items = NAV.filter((n) => n.roles.includes(user!.role));
  const pageTitle = PAGE_TITLES[location.pathname] || "TransitPro";
  const current = items.find((n) => (n.to !== "/" ? location.pathname.startsWith(n.to) : location.pathname === "/"));

  const markAllRead = async () => {
    await api("/api/notifications/read-all", { method: "POST" });
    loadNotifs();
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="no-print flex w-60 shrink-0 flex-col bg-navy text-slate-300">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
            <Ship size={20} />
          </div>
          <div>
            <div className="text-base font-bold text-white leading-none">TransitPro</div>
            <div className="mt-0.5 text-[11px] text-slate-400">Transit · Douane · Logistique</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon size={17} />
                <span className="flex-1">{n.label}</span>
                {n.to === "/notifications" && unread > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
              {user!.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user!.name}</div>
              <div className="truncate text-[11px] text-slate-400">{ROLE_LABELS[user!.role]}</div>
            </div>
            <button onClick={() => logout()} title="Se déconnecter" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">TransitPro</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-ink">{current?.label || pageTitle}</span>
          </div>
          <div className="flex-1" />
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen(!bellOpen)}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-surface"
              title="Notifications"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 mt-2 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <span className="text-sm font-semibold text-ink">Notifications</span>
                  <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">
                    Tout marquer comme lu
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.slice(0, 8).map((n, i) => (
                    <button
                      key={n.id || i}
                      onClick={() => {
                        if (n.id) api(`/api/notifications/${n.id}/read`, { method: "POST" }).then(loadNotifs);
                        if (n.link) { navigate(n.link); setBellOpen(false); }
                      }}
                      className={cx(
                        "flex w-full gap-2.5 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50",
                        !n.read && "bg-primary/10/40"
                      )}
                    >
                      <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.type === "danger" ? "bg-rose-500" : n.type === "warning" ? "bg-accent" : n.type === "success" ? "bg-emerald-500" : "bg-primary")} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{n.title}</span>
                        <span className="block text-xs text-slate-500">{n.message}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button onClick={() => { navigate("/notifications"); setBellOpen(false); }} className="w-full py-2.5 text-center text-xs font-semibold text-primary hover:bg-slate-50">
                  Voir toutes les notifications
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {user!.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <div className="text-sm font-semibold text-ink">{user!.name}</div>
                  <div className="text-xs text-slate-500">{user!.email}</div>
                  <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {ROLE_LABELS[user!.role]}
                  </span>
                </div>
                {can(user, "admin") && (
                  <button onClick={() => { navigate("/employes"); setMenuOpen(false); }} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                    Gestion des employés
                  </button>
                )}
                <button onClick={() => logout()} className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
