import { CheckCircle2, AlertTriangle, WifiOff, HelpCircle } from "lucide-react";
import type { TowerStatus } from "@/lib/api";

const map: Record<TowerStatus, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  online:   { label: "Online",    cls: "bg-online-bg text-online border border-online/20", icon: CheckCircle2 },
  degraded: { label: "Degradada", cls: "bg-degraded-bg text-degraded border border-degraded/20", icon: AlertTriangle },
  offline:  { label: "Offline",   cls: "bg-offline-bg text-offline border border-offline/20", icon: WifiOff },
};

export function StatusBadge({ status }: { status: TowerStatus }) {
  const entry = map[status];

  if (!entry) {
    // status inesperado (null/undefined/valor não mapeado) — não rebenta a UI
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-muted/20 bg-muted/10 text-muted-foreground">
        <HelpCircle className="w-3 h-3" />
        —
      </span>
    );
  }

  const { label, cls, icon: Icon } = entry;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${cls}`}>
      <Icon className={`w-3 h-3 ${status === "online" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}