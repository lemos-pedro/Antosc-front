import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/layout/Logo";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ANTOSC" },
      { name: "description", content: "Autenticação no sistema de monitorização ANTOSC." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [errEmail, setErrEmail] = useState("");
  const [errPwd, setErrPwd] = useState("");
  const [fails, setFails] = useState(0);
  const [lock, setLock] = useState(0);

  useEffect(() => { if (user) navigate({ to: "/" }); }, [user, navigate]);

  useEffect(() => {
    if (lock <= 0) return;
    const t = setInterval(() => setLock((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [lock]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setErrEmail(""); setErrPwd("");
    if (!email) return setErrEmail("Email obrigatório");
    if (!pwd) return setErrPwd("Password obrigatória");
    if (lock > 0) return;
    setBusy(true);
    try {
      await login(email, pwd);
    } catch {
      const n = fails + 1;
      setFails(n);
      setErr("Email ou password incorrectos");
      if (n >= 5) { setLock(30); setFails(0); }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="lg:w-2/5 bg-azul text-white p-10 flex flex-col justify-between relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative">
          <Logo className="h-10 w-auto" />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight max-w-sm">Monitorização operacional de torres.</h2>
          <p className="text-white/60 text-sm mt-3 max-w-sm">
            Visibilidade total sobre o parque de torres, alarmes e equipas de O&amp;M em Angola.
          </p>
        </div>
        <div className="relative text-[11px] text-white/40">© ANTOSC · Sistema v0.1.0</div>
      </div>

      <div className="lg:w-3/5 flex items-center justify-center p-6 lg:p-10 bg-background">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-foreground">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1">Acesso restrito a equipas autorizadas.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@antosc.ao"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-azul-claro"
                />
              </div>
              {errEmail && <p className="text-xs text-offline mt-1">{errEmail}</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Password</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-azul-claro"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errPwd && <p className="text-xs text-offline mt-1">{errPwd}</p>}
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />
                Lembrar-me
              </label>
              <a href="/recuperar-password" className="text-azul-2 hover:underline">Esqueceu a password?</a>
            </div>

            {err && <p className="text-xs text-offline bg-offline-bg px-3 py-2 rounded">{err}</p>}
            {lock > 0 && (
              <p className="text-xs text-degraded bg-degraded-bg px-3 py-2 rounded">
                Demasiadas tentativas. Tente novamente em {lock}s.
              </p>
            )}

            <button
              type="submit"
              disabled={busy || lock > 0}
              className="w-full bg-azul text-white py-2.5 rounded-md font-medium text-sm hover:bg-azul-2 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
