import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, Info, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAlarms } from "@/lib/alarms-store";
import { api, type AlarmSeverity, type TicketStatus } from "@/lib/api";
import { queryKeys } from "@/lib/api-adapters";
import { AlarmDetailDialog } from "@/components/alarms/AlarmDetailDialog";
import type { Alarm } from "@/lib/api-adapters";
import { EmptyState } from "@/components/common/EmptyState";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/alarmes")({
  head: () => ({
    meta: [
      { title: "Alarmes — ANTOSC" },
      { name: "description", content: "Feed de alarmes agrupados e tickets abertos." },
    ],
  }),
  component: AlarmesPage,
});

const sevMeta: Record<AlarmSeverity, { label: string; Icon: typeof Info; cls: string }> = {
  critical: { label: "Crítico", Icon: AlertOctagon, cls: "bg-offline/15 text-offline border-l-offline" },
  warning:  { label: "Aviso",   Icon: AlertTriangle, cls: "bg-degraded/15 text-degraded border-l-degraded" },
  info:     { label: "Info",    Icon: Info, cls: "bg-azul-claro/15 text-azul-2 border-l-azul-claro" },
};

type Group = {
  key: string;
  severity: AlarmSeverity;
  message: string;
  ocorrencias: Alarm[];
  ultima: Alarm;
  sites: Set<string>;
  vendors: Set<string>;
};

function groupByKey(alarms: Alarm[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of alarms) {
    // alarm_key = severity + message truncada (não existe no backend hoje)
    const key = `${a.severity}::${(a.title ?? "").slice(0, 80).toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.ocorrencias.push(a);
      existing.sites.add(a.torre);
      existing.vendors.add(a.vendor);
      if (`${a.date} ${a.time}` > `${existing.ultima.date} ${existing.ultima.time}`) {
        existing.ultima = a;
      }
    } else {
      map.set(key, {
        key,
        severity: a.severity,
        message: a.title,
        ocorrencias: [a],
        ultima: a,
        sites: new Set([a.torre]),
        vendors: new Set([a.vendor]),
      });
    }
  }
  const sevOrder: Record<AlarmSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return Array.from(map.values()).sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.ocorrencias.length - a.ocorrencias.length,
  );
}

function AlarmesPage() {
  const { alarms, active } = useAlarms();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Alarm | null>(null);
  const [filter, setFilter] = useState<"all" | AlarmSeverity>("all");

  const grupos = useMemo(() => {
    const source = filter === "all" ? active : active.filter((a) => a.severity === filter);
    return groupByKey(source);
  }, [active, filter]);

  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: () => api.listTickets({ limit: 100 }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Alarmes & Tickets</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {active.length} alarmes activos · {grupos.length} agrupados por assinatura
        </p>
      </div>

      <Tabs defaultValue="feed">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="feed">Feed agrupado</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  filter === f ? "bg-azul text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Todos" : sevMeta[f as AlarmSeverity].label}
              </button>
            ))}
          </div>

          {grupos.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10">
              <EmptyState icon={null} title="Sem alarmes activos" hint="Todos os sites estão dentro dos limites." />
            </div>
          ) : (
            <div className="space-y-2">
              {grupos.map((g) => {
                const meta = sevMeta[g.severity];
                const isOpen = expanded === g.key;
                return (
                  <div key={g.key} className={`bg-card border border-border rounded-xl overflow-hidden border-l-4 ${meta.cls}`}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : g.key)}
                      className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                    >
                      <meta.Icon className="h-4 w-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {g.ocorrencias.length} ocorrências · {g.sites.size} sites · última {g.ultima.date} {g.ultima.time}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {Array.from(g.vendors).slice(0, 2).join(", ")}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border bg-muted/20">
                        {g.ocorrencias.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className="w-full text-left px-5 py-2 flex items-center gap-3 text-xs hover:bg-muted/40"
                          >
                            <span className="font-mono text-muted-foreground">{a.date} {a.time}</span>
                            <span className="font-mono">{a.torre}</span>
                            <span className="text-muted-foreground truncate flex-1">{a.title}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">{a.status}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {ticketsQuery.isLoading && <div className="p-8 text-center text-xs text-muted-foreground">A carregar tickets...</div>}
            {ticketsQuery.isError && <div className="p-8 text-center text-xs text-offline">Sem acesso aos tickets (auth necessária).</div>}
            {ticketsQuery.data && ticketsQuery.data.data.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">Sem tickets registados.</div>
            )}
            {ticketsQuery.data && ticketsQuery.data.data.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 text-left">ID</th>
                    <th className="px-5 py-2 text-left">Site</th>
                    <th className="px-5 py-2 text-left">Estado</th>
                    <th className="px-5 py-2 text-left">Criado</th>
                    <th className="px-5 py-2 text-left">Ack</th>
                    <th className="px-5 py-2 text-left">Fechado</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketsQuery.data.data.map((t) => (
                    <tr key={t.ticket_id} className="border-t border-border">
                      <td className="px-5 py-3 font-mono text-xs">{t.ticket_id.slice(0, 8)}</td>
                      <td className="px-5 py-3 font-mono text-xs">{t.tower_name}</td>
                      <td className="px-5 py-3"><TicketPill status={t.status} /></td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{fmtDateTime(t.acknowledged_at)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{fmtDateTime(t.closed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlarmDetailDialog alarm={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function TicketPill({ status }: { status: TicketStatus }) {
  const cls =
    status === "open"
      ? "bg-offline/15 text-offline"
      : status === "acknowledged"
        ? "bg-degraded/15 text-degraded"
        : "bg-online/15 text-online";
  return (
    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold ${cls}`}>
      {status === "open" ? "Aberto" : status === "acknowledged" ? "Ack" : "Fechado"}
    </span>
  );
}