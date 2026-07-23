import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

export const Route = createFileRoute("/recuperar-password")({
  head: () => ({ meta: [{ title: "Recuperar password — ANTOSC" }] }),
  component: RecuperarPage,
});

function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-sm p-8">
        <div className="text-azul mb-6"><Logo className="h-8 w-auto" /></div>
        <h1 className="text-xl font-semibold text-foreground">Recuperar password</h1>
        <p className="text-sm text-muted-foreground mt-1">Receba um link para redefinir a sua password.</p>

        {sent ? (
          <div className="mt-6 flex flex-col items-center text-center py-6">
            <CheckCircle2 className="h-10 w-10 text-online mb-3" />
            <p className="text-sm text-foreground font-medium">Pedido enviado</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs">
              Se o email existir no sistema, receberá instruções em breve.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); setSent(true); }}
            className="mt-6 space-y-4"
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@antosc.ao"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-azul-claro"
              />
            </div>
            <button className="w-full bg-azul text-white py-2.5 rounded-md font-medium text-sm hover:bg-azul-2">
              Enviar link
            </button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-flex items-center gap-1 text-xs text-azul-2 hover:underline">
          <ArrowLeft className="h-3 w-3" /> Voltar ao login
        </Link>
      </div>
    </div>
  );
}
