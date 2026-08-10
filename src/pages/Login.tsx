import { useEffect, useState } from "react";
import { Ship, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "../App";
import { toast } from "../components/UI";

export default function Login() {
  const { login, setup } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Premier lancement : la base est vide, il faut créer le compte administrateur
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(!!d.needsSetup))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (needsSetup) {
        await setup(name, email, password);
        toast("Compte administrateur créé");
      } else {
        await login(email, password);
        toast("Connexion réussie");
      }
    } catch (err: any) {
      toast(err.message || "Échec de l'opération", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full">
      {/* Panneau de présentation */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <Ship size={24} />
          </div>
          <div>
            <div className="text-xl font-bold">TransitPro</div>
            <div className="text-sm text-slate-400">SaaS de gestion du transit &amp; de la douane</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-snug">
            Centralisez vos opérations de transit, vos conteneurs et votre facturation.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Dossiers, documents douaniers, suivi des opérations, finances et équipes — une plateforme
            unique pour les entreprises de transit, commissionnaires en douane et sociétés de logistique.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Dossiers", "Conteneurs", "Documents douaniers", "Facturation", "Rapports"].map((f) => (
              <span key={f} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-slate-500">© 2026 TransitPro — Plateforme sécurisée</div>
      </div>

      {/* Formulaire */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
              <Ship size={22} />
            </div>
            <span className="text-xl font-bold text-ink">TransitPro</span>
          </div>
          <h2 className="text-2xl font-bold text-ink">
            {needsSetup ? "Créer le compte administrateur" : "Connexion"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {needsSetup
              ? "Premier lancement : ce compte aura un accès complet à l'application."
              : "Accédez à votre espace de travail."}
          </p>

          {checking ? (
            <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Vérification…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {needsSetup && (
                <div>
                  <label className="label">Nom complet</label>
                  <input
                    className="input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex. Sarah Benali"
                  />
                </div>
              )}
              <div>
                <label className="label">Adresse e-mail</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.ma"
                />
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={needsSetup ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={needsSetup ? "8 caractères minimum" : "••••••••"}
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? <Loader2 size={16} className="animate-spin" /> : needsSetup ? <UserPlus size={16} /> : <ShieldCheck size={16} />}
                {needsSetup ? "Créer le compte" : "Se connecter"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
