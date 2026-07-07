import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, RadioTower, Server, FileText, Globe, Users } from "lucide-react";
import { Logo } from "./Logo";

const principal = [
  { to: "/",             label: "Dashboard",    icon: LayoutGrid },
  { to: "/torres",       label: "Torres",       icon: RadioTower },
  { to: "/equipamentos", label: "Equipamentos", icon: Server },
] as const;

const operacao = [
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/mapa",       label: "Mapa",       icon: Globe },
] as const;

const admin = [{ to: "/equipas", label: "Gestão de Equipas", icon: Users }] as const;

function NavItem({
  to, label, icon: Icon, active, onNavigate,
}: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={[
        "flex items-center gap-2.5 mx-2 my-px px-4 py-2 rounded-lg text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-white/40 outline-none",
        active ? "bg-white/15 text-white font-medium" : "text-white/60 font-normal hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      <Icon className={["h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70"].join(" ")} />
      <span>{label}</span>
    </Link>
  );
}

function Section({ title }: { title: string }) {
  return <div className="px-4 pt-4 pb-2 text-[11px] text-white/30 font-semibold uppercase tracking-wider">{title}</div>;
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <Link to="/" onClick={onNavigate} className="text-white block">
          <Logo className="h-8 w-auto" />
        </Link>
        <div className="text-[10px] text-white/40 mt-2 uppercase tracking-[0.08em]">
          Monitorização de Torres
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <Section title="Principal" />
        {principal.map((i) => <NavItem key={i.to} {...i} active={isActive(i.to)} onNavigate={onNavigate} />)}
        <Section title="Operação" />
        {operacao.map((i) => <NavItem key={i.to} {...i} active={isActive(i.to)} onNavigate={onNavigate} />)}
        <Section title="Administração" />
        {admin.map((i) => <NavItem key={i.to} {...i} active={isActive(i.to)} onNavigate={onNavigate} />)}
      </nav>
      <div className="px-4 py-4 border-t border-white/10 text-xs text-white/40">
        <strong className="block text-white/70 font-semibold">Admin</strong>
        Sistema v0.1.0
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[220px] bg-azul flex-col z-40">
      <SidebarContent />
    </aside>
  );
}
