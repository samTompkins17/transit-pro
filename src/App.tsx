import { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { api, clearSession, getStoredUser, getToken, storeSession } from "./api";
import type { User } from "./types";
import { ToastHost } from "./components/UI";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Dossiers from "./pages/Dossiers";
import DossierDetail from "./pages/DossierDetail";
import Containers from "./pages/Containers";
import Documents from "./pages/Documents";
import Finance from "./pages/Finance";
import Employees from "./pages/Employees";
import Reports from "./pages/Reports";
import Audit from "./pages/Audit";
import Notifications from "./pages/Notifications";

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  setup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({ user: null, login: async () => {}, setup: async () => {}, logout: async () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState<User | null>(getStoredUser());

  const login = async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    storeSession(data.token, data.user);
    setUser(data.user);
  };

  // Premier lancement : crée le compte administrateur initial
  const setup = async (name: string, email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    storeSession(data.token, data.user);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;
    api<{ user: User }>("/api/auth/me")
      .then((d) => {
        const t = getToken();
        if (t) storeSession(t, d.user);
        setUser(d.user);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, setup, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route
            element={
              user ? (
                <Layout>
                  <Outlet />
                </Layout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/dossiers" element={<Dossiers />} />
            <Route path="/dossiers/:id" element={<DossierDetail />} />
            <Route path="/conteneurs" element={<Containers />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/employes" element={<Employees />} />
            <Route path="/rapports" element={<Reports />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastHost />
    </AuthContext.Provider>
  );
}
