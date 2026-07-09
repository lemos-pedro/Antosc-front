import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  TrendingUp,
  BellRing,
  Zap,
  Battery,
  Wifi,
  Cloud,
  Lock,
  HardDrive,
  Thermometer,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { useAlarms } from "@/lib/alarms-store";
import { generateCompleteTowerData, generateTimeSeriesData, generateOperatorMetrics } from "@/lib/mock-tower-data";
import { MetricGauge } from "@/components/charts/MetricGauge";
import { StatusGrid } from "@/components/charts/StatusGrid";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { OperatorStatusList } from "@/components/charts/OperatorStatusList";

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

type TabType = "overview" | "energy" | "network" | "environment" | "security" | "system" | "alarms";

export function TorreDetailModal({ torreId, open, onOpenChange }: TorreDetailModalProps) {
  const { active: alarmesAtivos } = useAlarms();
  const [tab, setTab] = useState<TabType>("overview");

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
    ? generateCompleteTowerData(toUiTower(towerQuery.data, {
        regions: regionsQuery.data?.data,
        operators: operatorsQuery.data?.data,
        latestMetric: metricsQuery.data?.data[0],
      }))
    : null;

  const torreAlarms = torreId ? alarmesAtivos.filter((a) => a.torre === torreId) : [];

  const timeSeriesData = torreId ? generateTimeSeriesData(torreId) : [];
  const operatorMetrics = torreId ? generateOperatorMetrics(torreId) : [];

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

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
          <TabsList className="w-full bg-muted/50 grid grid-cols-7">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="energy">Energia</TabsTrigger>
            <TabsTrigger value="network">Rede</TabsTrigger>
            <TabsTrigger value="environment">Ambiente</TabsTrigger>
            <TabsTrigger value="security">Segurança</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
            <TabsTrigger value="alarms">Alarmes ({torreAlarms.length})</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
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

          {/* ENERGY TAB */}
          <TabsContent value="energy" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <MetricGauge value={torre?.batterySoc ?? 0} label="Bateria SoC" color="#EF4444" size={100} />
              <MetricGauge value={torre?.batterySoh ?? 0} label="Bateria SoH" color="#F97316" size={100} />
              <MetricGauge value={torre?.generatorFuelLevel ?? 0} label="Combustível" color="#06B6D4" size={100} />
            </div>
            <TimeSeriesChart
              data={timeSeriesData}
              title="Tensão Rectificador"
              lines={[
                { key: "rectifier", name: "Rectificador", color: "#2563EB" },
                { key: "battery", name: "Bateria", color: "#EF4444" },
              ]}
            />
            <StatusGrid
              items={[
                { label: "Fonte Activa", value: torre?.powerSourceActive?.toUpperCase() ?? NO_DATA, status: "info" },
                { label: "Mains", value: torre?.mainsStatus?.toUpperCase() ?? NO_DATA },
                { label: "Rectificador", value: torre?.rectifierStatus?.toUpperCase() ?? NO_DATA },
                { label: "Gerador", value: torre?.generatorStatus?.toUpperCase() ?? NO_DATA },
              ]}
            />
          </TabsContent>

          {/* NETWORK TAB */}
          <TabsContent value="network" className="space-y-4 mt-4">
            <OperatorStatusList operators={operatorMetrics} />
            <TimeSeriesChart
              data={timeSeriesData}
              title="Performance de Rede (24h)"
              lines={[
                { key: "rectifier", name: "Latência", color: "#2563EB" },
                { key: "temperature", name: "Jitter", color: "#06B6D4" },
              ]}
            />
            <StatusGrid
              items={[
                { label: "Backhaul", value: torre?.backhaul?.type ?? NO_DATA, status: "info" },
                { label: "Bandwidth", value: `${torre?.backhaul?.bandwidth ?? 0} Mbps`, status: "info" },
                { label: "Células", value: `${torre?.ran?.cells ?? 0}`, status: "info" },
                { label: "PRB", value: `${torre?.ran?.prb ?? 0}%`, status: "info" },
              ]}
            />
          </TabsContent>

          {/* ENVIRONMENT TAB */}
          <TabsContent value="environment" className="space-y-4 mt-4">
            <TimeSeriesChart
              data={timeSeriesData}
              title="Temperatura e Humidade (24h)"
              lines={[{ key: "temperature", name: "Temperatura", color: "#EF4444" }]}
              areas={[{ key: "generator", name: "Humidade", color: "#3B82F6" }]}
            />
            <StatusGrid
              items={[
                { label: "Temperatura", value: `${torre?.temperatura ?? 0}°C`, status: "info" },
                { label: "Humidade", value: `${torre?.humidity ?? 0}%`, status: "info" },
                { label: "Fluxo Ar", value: `${torre?.airflow ?? 0} CFM`, status: "info" },
                { label: "Porta Abrigo", value: torre?.shelter?.door?.toUpperCase() ?? NO_DATA },
                { label: "AC Abrigo", value: torre?.shelter?.ac?.toUpperCase() ?? NO_DATA },
                { label: "AC Temp", value: `${torre?.shelter?.acTemp ?? 0}°C`, status: "info" },
              ]}
            />
          </TabsContent>

          {/* SECURITY TAB */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <StatusGrid
              items={[
                { label: "Último Acesso", value: torre?.accessLog?.lastAccess ?? NO_DATA, icon: "🔓", status: "info" },
                { label: "Total Acessos", value: `${torre?.accessLog?.totalAccess ?? 0}`, icon: "📊", status: "info" },
                { label: "Câmaras", value: `${torre?.camera?.count ?? 0}`, icon: "📹", status: "info" },
                { label: "Gravação", value: torre?.camera?.recording ? "Ativa" : "Inativa", icon: "🔴" },
                { label: "Detecção", value: torre?.motion?.detected ? "Activa" : "Inactiva", icon: "👁️" },
                { label: "Eventos Moção", value: `${torre?.motion?.count ?? 0}`, icon: "📍", status: "info" },
              ]}
            />
          </TabsContent>

          {/* SYSTEM TAB */}
          <TabsContent value="system" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <MetricGauge value={torre?.cpu ?? 0} label="CPU" color="#2563EB" size={100} max={100} />
              <MetricGauge value={torre?.ram ?? 0} label="RAM" color="#06B6D4" size={100} max={100} />
              <MetricGauge value={torre?.storage ?? 0} label="Storage" color="#EF4444" size={100} max={100} />
            </div>
            <StatusGrid
              items={[
                { label: "Uptime", value: torre?.uptime ?? NO_DATA, status: "info" },
                { label: "CPU", value: `${torre?.cpu ?? 0}%`, status: "info" },
                { label: "RAM", value: `${torre?.ram ?? 0}%`, status: "info" },
                { label: "Storage", value: `${torre?.storage ?? 0}%`, status: "info" },
              ]}
            />
          </TabsContent>

          {/* ALARMS TAB */}
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
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
