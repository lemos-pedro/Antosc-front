import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/api-adapters";
import { useAlarms } from "@/lib/alarms-store";

export function StatusSummaryCard() {
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  const { active: activeAlarms } = useAlarms();

  const towers = towersQuery.data?.data ?? [];
  const online = towers.filter((t) => t.status === "online").length;
  const degraded = towers.filter((t) => t.status === "degraded").length;
  const offline = towers.filter((t) => t.status === "offline").length;

  const systemHealth = towers.length > 0 ? (online / towers.length) * 100 : 0;
  const healthStatus =
    systemHealth >= 95 ? "excellent" : systemHealth >= 90 ? "good" : systemHealth >= 80 ? "fair" : "poor";
  const healthColor =
    healthStatus === "excellent"
      ? "text-online bg-online-bg"
      : healthStatus === "good"
        ? "text-azul-2 bg-muted"
        : healthStatus === "fair"
          ? "text-degraded bg-degraded-bg"
          : "text-offline bg-offline-bg";

  return (
    <div className={`rounded-xl p-5 border transition-all ${
      healthStatus === "excellent" || healthStatus === "good"
        ? "border-border bg-card"
        : "border-offline/30 bg-offline-bg/5"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Saúde do Sistema</h3>
        </div>
        <span
          className={`text-[11px] px-3 py-1 rounded-full font-semibold ${healthColor} animate-pulse`}
        >
          {healthStatus === "excellent"
            ? "Excelente"
            : healthStatus === "good"
              ? "Bom"
              : healthStatus === "fair"
                ? "Justo"
                : "Crítico"}
        </span>
      </div>

      <div className="space-y-3">
        {/* Health metric */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Disponibilidade</span>
            <span className={`text-lg font-bold tabular-nums ${healthColor}`}>{systemHealth.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthStatus === "excellent"
                  ? "bg-online"
                  : healthStatus === "good"
                    ? "bg-azul-2"
                    : healthStatus === "fair"
                      ? "bg-degraded"
                      : "bg-offline"
              }`}
              style={{ width: `${systemHealth}%` }}
            />
          </div>
        </div>

        {/* Status distribution */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
          <div className="text-center">
            <div className="text-lg font-semibold text-online">{online}</div>
            <div className="text-[11px] text-muted-foreground">Online</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-degraded">{degraded}</div>
            <div className="text-[11px] text-muted-foreground">Degradadas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-offline">{offline}</div>
            <div className="text-[11px] text-muted-foreground">Offline</div>
          </div>
        </div>

        {/* Alerts indicator */}
        {activeAlarms.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-offline-bg/10 border border-offline/20 text-xs text-offline">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium">{activeAlarms.length} alerta ativo</span>
          </div>
        )}
      </div>
    </div>
  );
}
