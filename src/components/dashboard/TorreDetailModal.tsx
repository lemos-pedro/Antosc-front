import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ShieldCheck, TrendingUp, BellRing, Zap, Battery, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { useAlarms } from "@/lib/alarms-store";

interface TorreDetailModalProps {
  torreId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_DATA = "—";

function fmtNum(value: number | undefined, decimals = 1, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${value.toFixed(decimals)}${unit}`;
}

export function TorreDetailModal({ torreId, open, onOpenChange }: TorreDetailModalProps) {
  const { active: alarmesAtivos } = useAlarms();
  const [tab, setTab] = useState<"overview" | "alarms" | "events">("overview");

  const towerQuery = useQuery({
    queryKey: torreId ? queryKeys.tower(torreId) : ["disabled"],
    queryFn: () => torreId ? api.getTower(torreId) : Promise.reject("No tower ID"),
    enabled: !!torreId,
  });

  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });

  const operatorsQuery = useQuery({
    queryKey: queryKeys.operators,
    queryFn: () => api.listOperators({ limit: 500 }),
  });

  const metricsQuery = useQuery({
    queryKey: torreId ? queryKeys.metrics(torreId) : ["disabled"],
    queryFn: () => torreId ? api.listMetrics({ tower_id: torreId, limit: 30 }) : Promise.reject("No tower ID"),
    enabled: !!torreId,
  });

  const eventsQuery = useQuery({
    queryKey: torreId ? queryKeys.events(torreId) : ["disabled"],
    queryFn: () => torreId ? api.listTowerEvents(torreId, { limit: 100 }) : Promise.reject("No tower ID"),
    enabled: !!torreId,
  });

  const torre = towerQuery.data
    ? toUiTower(towerQuery.data, {
        regions: regionsQuery.data?.data,
        operators: operatorsQuery.data?.data,
        latestMetric: metricsQuery.data?.data[0],
      })
    : null;

  const torreAlarms = torreId ? alarmesAtivos.filter((a) => a.torre === torreId) : [];

  const series = useMemo(() => {
    const metrics = metricsQuery.data?.data ?? [];
    if (metrics.length > 0) {
      return metrics
        .slice()
        .reverse()
        .map((metric) => ({
          dia: new Date(metric.collected_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
          valor: metric.signal_strength ?? metric.voltage ?? 0,
        }));
    }
    return [];
  }, [metricsQuery.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {towerQuery.isLoading || !torre ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">A carregar detalhes da torre...</p>
          </div>
        ) : (
          <>
            <DialogHeader className="flex items-start justify-between flex-row">
              <div>
                <DialogTitle className="text-lg">{torre.nome}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">{torre.id}</p>
              </div>
              <StatusBadge status={torre.status} />
            </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="overview" className="flex-1">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="alarms" className="flex-1">
              Alarmes ({torreAlarms.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1">
              Eventos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Métricas principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={<ShieldCheck className="h-4 w-4 text-online" />}
                iconBg="#DCFCE7"
                label="Disp. 30d"
                value={`${torre.disp30d.toFixed(2)}%`}
              />
              <MetricCard
                icon={<TrendingUp className="h-4 w-4 text-azul-2" />}
                iconBg="#EFF6FF"
                label="Disp. 7d"
                value={fmtNum(torre.disp7d, 2, "%")}
              />
              <MetricCard
                icon={<BellRing className="h-4 w-4 text-offline" />}
                iconBg="#FEE2E2"
                label="Alarmes"
                value={torreAlarms.length}
              />
              <MetricCard
                icon={<Zap className="h-4 w-4 text-degraded" />}
                iconBg="#FEF3C7"
                label="Tensão"
                value={fmtNum(torre.voltage, 1, " V")}
              />
            </div>

            {/* Identificação */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Identificação</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Local</p>
                  <p className="text-foreground">{torre.local}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Região</p>
                  <p className="text-foreground">{torre.regiao}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP</p>
                  <p className="font-mono text-foreground">{torre.ip || NO_DATA}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Operador</p>
                  <p className="text-foreground">{torre.operador}</p>
                </div>
              </div>
            </div>

            {/* Gráfico de métricas */}
            {series.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-foreground mb-3">Métricas — últimas coletas</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={series}>
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="valor" stroke="#2A5298" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Energia */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Energia</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Tensão AC</p>
                  <p className="text-foreground">{fmtNum(torre.voltage, 1, " V")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Corrente</p>
                  <p className="text-foreground">{fmtNum(torre.current, 1, " A")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bateria SoC</p>
                  <p className="text-foreground">{fmtNum(torre.batterySoc, 0, "%")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bateria SoH</p>
                  <p className="text-foreground">{fmtNum(torre.batterySoh, 0, "%")}</p>
                </div>
              </div>
            </div>

            {/* Ambiente */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Ambiente</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Temperatura</p>
                  <p className="text-foreground">{fmtNum(torre.temperatura, 1, " °C")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Humidade</p>
                  <p className="text-foreground">{fmtNum(torre.humidity, 0, "%")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sinal (RSSI)</p>
                  <p className="text-foreground">{fmtNum(torre.signalStrength, 0, " dBm")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Link</p>
                  <p className="text-foreground capitalize">{torre.linkStatus || NO_DATA}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alarms" className="mt-4 space-y-2">
            {towerQuery.isLoading && <p className="text-xs text-muted-foreground">A carregar...</p>}
            {torreAlarms.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem alarmes activos</p>
            ) : (
              <div className="space-y-2">
                {torreAlarms.map((a) => (
                  <div key={a.id} className="bg-muted/50 rounded p-3 text-xs border-l-2 border-offline">
                    <div className="font-medium text-foreground">{a.title}</div>
                    <div className="text-muted-foreground mt-1">
                      {a.date} {a.time} · <span className="uppercase text-[10px] font-semibold">{a.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-2">
            {eventsQuery.isLoading && <p className="text-xs text-muted-foreground">A carregar...</p>}
            {eventsQuery.isError && <p className="text-xs text-offline">{errorMessage(eventsQuery.error)}</p>}
            {(eventsQuery.data?.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem eventos</p>
            ) : (
              <div className="space-y-2">
                {(eventsQuery.data?.data ?? []).slice(0, 10).map((e) => (
                  <div key={e.event_id} className="bg-muted/50 rounded p-3 text-xs">
                    <div className="font-medium text-foreground">{e.message}</div>
                    <div className="text-muted-foreground mt-1">
                      {new Date(e.occurred_at).toLocaleString("pt-PT")} · <span className="uppercase text-[10px]">{e.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
