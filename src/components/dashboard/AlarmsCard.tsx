import { useState } from "react";
import { useAlarms } from "@/lib/alarms-store";
import type { Alarm } from "@/lib/api-adapters";
import type { AlarmSeverity } from "@/lib/api";
import { EmptyState } from "@/components/common/EmptyState";
import { Check, AlertTriangle, AlertCircle } from "lucide-react";
import { AlarmDetailDialog } from "@/components/alarms/AlarmDetailDialog";

const sevColor: Record<AlarmSeverity, string> = {
  critical: "bg-offline-bg text-offline border-l-offline",
  warning: "bg-degraded-bg text-degraded border-l-degraded",
  info: "bg-muted text-azul-2 border-l-azul-2",
};

const sevIcon: Record<AlarmSeverity, React.ComponentType<{ className?: string }>> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Check,
};

export function AlarmsCard() {
  const { active } = useAlarms();
  const [selected, setSelected] = useState<Alarm | null>(null);

  const critical = active.filter((a) => a.severity === "critical").length;
  const warning = active.filter((a) => a.severity === "warning").length;
  const info = active.filter((a) => a.severity === "info").length;

  return (
    <div className={`border border-border rounded-xl p-5 transition-colors ${
      critical > 0 ? "bg-offline-bg/5" : warning > 0 ? "bg-degraded-bg/5" : "bg-card"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Alarmes</h3>
        <div className="flex gap-2">
          {critical > 0 && <span className="text-[10px] px-2 py-1 rounded-full bg-offline-bg text-offline font-semibold">{critical} crítico</span>}
          {warning > 0 && <span className="text-[10px] px-2 py-1 rounded-full bg-degraded-bg text-degraded font-semibold">{warning} aviso</span>}
          {active.length === 0 && <span className="text-[10px] px-2 py-1 rounded-full bg-online-bg text-online font-semibold">Limpo</span>}
        </div>
      </div>
      {active.length === 0 ? (
        <EmptyState icon={<Check className="h-8 w-8 text-online" />} title="Nenhum alarme activo" />
      ) : (
        <ul className="flex flex-col gap-2">
          {active.slice(0, 10).map((a) => {
            const Icon = sevIcon[a.severity];
            return (
              <li key={a.id}>
                <button
                  onClick={() => setSelected(a)}
                  className={`w-full text-left flex gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${sevColor[a.severity]} border-l-2`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.title}</div>
                    <div className="text-[11px] opacity-75 mt-0.5 font-mono">
                      {a.towerName} · {a.vendor} · {a.time}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AlarmDetailDialog alarm={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
