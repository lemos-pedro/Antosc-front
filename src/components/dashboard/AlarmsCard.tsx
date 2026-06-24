import { useState } from "react";
import { useAlarms } from "@/lib/alarms-store";
import type { Alarm } from "@/lib/api-adapters";
import type { AlarmSeverity } from "@/lib/api";
import { EmptyState } from "@/components/common/EmptyState";
import { Check } from "lucide-react";
import { AlarmDetailDialog } from "@/components/alarms/AlarmDetailDialog";

const sevColor: Record<AlarmSeverity, string> = {
  critical: "bg-offline",
  warning: "bg-degraded",
  info: "bg-azul-claro",
};

export function AlarmsCard() {
  const { active } = useAlarms();
  const [selected, setSelected] = useState<Alarm | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Alarmes recentes</h3>
        <span className="text-[11px] text-muted-foreground">{active.length} activos</span>
      </div>
      {active.length === 0 ? (
        <EmptyState icon={<Check className="h-8 w-8 text-online" />} title="Nenhum alarme activo" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {active.slice(0, 5).map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a)}
                className="w-full text-left flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted relative overflow-hidden transition-colors"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${sevColor[a.severity]}`} />
                <div className="flex-1 pl-2">
                  <div className="text-xs font-medium text-foreground">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                    {a.torre} · {a.vendor} · {a.time}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <AlarmDetailDialog alarm={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
