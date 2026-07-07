import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, BellRing, Wrench, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { queryKeys, type Alarm, type EventType } from "@/lib/api-adapters";

const eventIcons: Record<EventType, React.ComponentType<{ className?: string }>> = {
  failure: AlertOctagon,
  alarm: BellRing,
  maintenance: Wrench,
  recovery: CheckCircle2,
};

const eventColors: Record<EventType, { text: string; bg: string }> = {
  failure: { text: "text-offline", bg: "bg-offline-bg" },
  alarm: { text: "text-degraded", bg: "bg-degraded-bg" },
  maintenance: { text: "text-azul-2", bg: "bg-muted" },
  recovery: { text: "text-online", bg: "bg-online-bg" },
};

export function EventsTimelineCard() {
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  const towerIds = (towersQuery.data?.data ?? []).map((t) => t.tower_id).slice(0, 5); // primeiras 5 torres

  // Buscar eventos de cada torre
  const eventsQueries = towerIds.map((id) =>
    useQuery({
      queryKey: queryKeys.events(id),
      queryFn: () => api.listTowerEvents(id, { limit: 10 }),
    }),
  );

  const allEvents = eventsQueries
    .flatMap((q) => q.data?.data ?? [])
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Eventos Recentes</h3>

      {allEvents.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">Sem eventos recentes</div>
      ) : (
        <div className="space-y-3">
          {allEvents.map((event) => {
            const Icon = eventIcons[event.type];
            const colors = eventColors[event.type];
            const date = new Date(event.occurred_at);
            const timeStr = date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
            const dateStr = date.toLocaleDateString("pt-PT");

            return (
              <div key={event.event_id} className="flex gap-3">
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-foreground">{event.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                        {dateStr} {timeStr} · <span className="uppercase text-[10px] font-semibold">{event.type}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
