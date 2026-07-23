import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, TrendingUp, BellRing, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { MetricCard } from "./MetricCard";
import { StatusBadge } from "./StatusBadge";
import { useAlarms } from "@/lib/alarms-store";
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

// Lê um valor de m.metrics (Record<string, number | string | boolean>) e
// devolve number | null. Nunca inventa 0 como fallback silencioso — 0 é um
// valor real (ex: rectifier_2_input_v: 0 quando o rectificador está OFF),
// por isso a ausência de dado tem de ficar null, não 0.
function numOrNull(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) return Number(value);
  return null;
}

function fmtNum(value: number | undefined | null, decimals = 1, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${value.toFixed(decimals)}${unit}`;
}

type TabType = "overview" | "energy" | "network" | "environment" | "security" | "system" | "alarms";

export function TorreDetailModal({ torreId, open, onOpenChange }: TorreDetailModalProps) {
  const { active: alarmesAtivos } = useAlarms();
  const [tab, setTab] = useState<TabType>("overview");

  const towerQuery = useQuery({
    queryKey: torreId ? queryKeys.tower(torreId) : ["disabled"],
    queryFn: () => (torreId ? api.getTower(torreId) : Promise.reject("No tower ID")),
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

  // Histórico de métricas (usado no gráfico Visão Geral e nos gráficos de séries temporais)
  const metricsQuery = useQuery({
    queryKey: torreId ? queryKeys.metrics(torreId) : ["disabled"],
    queryFn: () =>
      torreId ? api.listMetrics({ tower_id: torreId, limit: 100 }) : Promise.reject("No site ID"),
    enabled: !!torreId,
  });

  const eventsQuery = useQuery({
    queryKey: torreId ? queryKeys.events(torreId) : ["disabled"],
    queryFn: () =>
      torreId ? api.listTowerEvents(torreId, { limit: 100 }) : Promise.reject("No site ID"),
    enabled: !!torreId,
  });

  // Leitura em tempo real do gerador (combustível, tensão de bateria do
  // gerador e horas de funcionamento). Endpoint dedicado, fora do payload
  // de ApiTower/ApiMetric — por isso é uma query própria, tal como
  // metricsQuery e eventsQuery.
  const generatorQuery = useQuery({
    queryKey: torreId ? queryKeys.generator(torreId) : ["disabled"],
    queryFn: () =>
      torreId ? api.getTowerGenerator(torreId) : Promise.reject("No site ID"),
    enabled: !!torreId,
  });

  const torre = towerQuery.data
    ? toUiTower(towerQuery.data, {
        regions: regionsQuery.data?.data,
        operators: operatorsQuery.data?.data,
        latestMetric: metricsQuery.data?.data[0],
      })
    : null;

  const torreAlarms = torreId
    ? alarmesAtivos.filter((a) => a.towerId === torreId)
    : [];
  // Série para o gráfico simples da Visão Geral. m.voltage não existe em
  // ApiMetric — o valor real está em m.metrics.mains_voltage_l1_v (com
  // fallback para L2/L3, igual ao que o toUiTower faz para o campo "voltage").
  const series = useMemo(() => {
    const metrics = metricsQuery.data?.data ?? [];
    if (metrics.length === 0) return [];
    return metrics
      .slice()
      .reverse()
      .map((metric) => {
        const mm = metric.metrics ?? {};
        return {
          dia: new Date(metric.collected_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
        valor:
          numOrNull(mm.mains_voltage_l1_v) ??
          numOrNull(mm.mains_voltage_l2_v) ??
          numOrNull(mm.mains_voltage_l3_v),
        };
      });
  }, [metricsQuery.data]);

  // Série temporal para os gráficos de Energia / Rede / Ambiente. Todos os
  // valores vêm de dentro de m.metrics (ApiMetric.metrics), nunca direto de
  // m.voltage/m.battery_voltage/etc — esses campos não existem em ApiMetric.
  //
  // Rectificadores: a torre pode ter até 3 (rectifier_1/2/3_input_v). Em vez
  // de agregar numa média (o que esconderia um rectificador em falha, como
  // acontece quando rectifier_2_status != 1), mantemos as 3 linhas
  // separadas — r1, r2, r3 — para que uma queda num deles seja visível no
  // gráfico e não apenas dissolvida numa média com os outros dois.
  const timeSeriesData = useMemo(() => {
    const metrics = metricsQuery.data?.data ?? [];
    if (metrics.length === 0) return [];
    return metrics
      .slice()
      .reverse()
      .map((m) => {
        const mm = m.metrics ?? {};
        return {
          time: new Date(m.collected_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
          battery: numOrNull(mm.battery_voltage_v),
          r1: numOrNull(mm.rectifier_1_input_v),
          r2: numOrNull(mm.rectifier_2_input_v),
          r3: numOrNull(mm.rectifier_3_input_v),
          temperature:
            numOrNull(mm.controller_temperature_c) ?? numOrNull(mm.battery_temperature_c),
          // Sem campo de humidade neste payload de metrics — confirmar com o
          // backend se existe sob outra chave antes de reativar esta linha.
          humidity: null as number | null,
        };
      });
  }, [metricsQuery.data]);

  // Lista de operadores presentes na torre, a partir dos dados reais da API de operadores/torre
  const operatorMetrics = useMemo(() => {
    if (!torreId) return [];
    return (operatorsQuery.data?.data ?? [])
      .filter((op: any) => op.tower_id === torreId || op.towers?.includes?.(torreId))
      .map((op: any) => ({
        name: op.name ?? op.operator_name ?? NO_DATA,
        status: op.status ?? "unknown",
        signal: op.signal_strength ?? null,
      }));
  }, [operatorsQuery.data, torreId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {towerQuery.isLoading || !torre ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">A carregar detalhes do site...</p>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard
                    icon={<ShieldCheck className="h-4 w-4 text-online" />}
                    iconBg="#DCFCE7"
                    label="Disp. 30d"
                    value={fmtNum(torre.disp30d, 2, "%")}
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
                      <p className="text-foreground">
                        {torre.operadores?.length ? torre.operadores.map((o) => o.name).join(", ") : NO_DATA}
                      </p>
                    </div>
                  </div>
                </div>

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
                  <MetricGauge value={torre.batterySoc ?? 0} label="Bateria SoC" color="#44ef52" size={100} />
                  <MetricGauge value={torre.batterySoh ?? 0} label="Bateria SoH" color="#F97316" size={100} />
                  {/* Combustível agora vem do endpoint dedicado /energy/generator
                      (generatorQuery), em vez de torre.generatorFuelLevel, que
                      o toUiTower nunca preenche (sem fonte no ApiTower/ApiMetric). */}
                  <MetricGauge
                    value={generatorQuery.data?.FuelPercent ?? 0}
                    label="Combustível"
                    color="#06B6D4"
                    size={100}
                  />
                </div>

                {timeSeriesData.length > 0 ? (
                  <TimeSeriesChart
                    data={timeSeriesData}
                    title="Tensão Rectificadores (R1/R2/R3) / Bateria"
                    lines={[
                      { key: "r1", name: "Rectificador 1", color: "#2563EB" },
                      { key: "r2", name: "Rectificador 2", color: "#F97316" },
                      { key: "r3", name: "Rectificador 3", color: "#22C55E" },
                      { key: "battery", name: "Bateria", color: "#EF4444" },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem histórico de métricas</p>
                )}

                {/* Gerador — dados em tempo real do endpoint /api/v1/towers/{id}/energy/generator */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-foreground">Gerador</h4>
                  {generatorQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">A carregar dados do gerador...</p>
                  ) : generatorQuery.isError ? (
                    <p className="text-xs text-offline">{errorMessage(generatorQuery.error)}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Combustível</p>
                        <p className="text-foreground">
                          {fmtNum(generatorQuery.data?.FuelLiters, 0, " L")} (
                          {fmtNum(generatorQuery.data?.FuelPercent, 0, "%")})
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tensão Bateria (gerador)</p>
                        <p className="text-foreground">{fmtNum(generatorQuery.data?.BatteryVoltageV, 1, " V")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Horas de Funcionamento</p>
                        <p className="text-foreground">
                          {generatorQuery.data?.RunHoursTotal !== undefined
                            ? `${generatorQuery.data.RunHoursTotal} h`
                            : NO_DATA}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Última Coleta</p>
                        <p className="text-foreground">
                          {generatorQuery.data?.CollectedAt
                            ? new Date(generatorQuery.data.CollectedAt).toLocaleString("pt-PT")
                            : NO_DATA}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <StatusGrid
                  items={[
                    { label: "Fonte Activa", value: torre.powerSourceActive?.toUpperCase() ?? NO_DATA, status: "info" },
                    { label: "Mains", value: torre.mainsStatus?.toUpperCase() ?? NO_DATA },
                    { label: "Rectificador", value: torre.rectifierStatus?.toUpperCase() ?? NO_DATA },
                    { label: "Gerador", value: torre.generatorStatus?.toUpperCase() ?? NO_DATA },
                  ]}
                />
              </TabsContent>

              {/* NETWORK TAB */}
              <TabsContent value="network" className="space-y-4 mt-4">
                {operatorMetrics.length > 0 ? (
                  <OperatorStatusList operators={operatorMetrics} />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem dados de operadores</p>
                )}
                {timeSeriesData.length > 0 && (
                  <TimeSeriesChart
                    data={timeSeriesData}
                    title="Temperatura / Humidade (histórico)"
                    lines={[{ key: "temperature", name: "Temperatura", color: "#06B6D4" }]}
                  />
                )}
                <StatusGrid
                  items={[
                    { label: "Backhaul", value: NO_DATA, status: "info" },
                    { label: "Bandwidth", value: fmtNum(torre.bandwidthUtilization, 0, "%"), status: "info" },
                    { label: "Link", value: torre.linkStatus?.toUpperCase() ?? NO_DATA, status: "info" },
                    { label: "Sinal", value: fmtNum(torre.signalStrength, 0, " dBm"), status: "info" },
                  ]}
                />
              </TabsContent>

              {/* ENVIRONMENT TAB */}
              <TabsContent value="environment" className="space-y-4 mt-4">
                {timeSeriesData.length > 0 ? (
                  <TimeSeriesChart
                    data={timeSeriesData}
                    title="Temperatura (histórico)"
                    lines={[{ key: "temperature", name: "Temperatura", color: "#EF4444" }]}
                    // Área de Humidade removida: não há campo de humidade no
                    // payload de metrics devolvido pela API para esta torre.
                    // Reativar quando o backend expuser essa métrica.
                  />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem histórico de métricas</p>
                )}
                <StatusGrid
                  items={[
                    { label: "Temperatura", value: fmtNum(torre.temperatura, 1, "°C"), status: "info" },
                    { label: "Humidade", value: fmtNum(torre.humidity, 0, "%"), status: "info" },
                    { label: "Fluxo Ar", value: NO_DATA, status: "info" },
                    { label: "Porta Abrigo", value: torre.doorOpenAlarm === undefined ? NO_DATA : (torre.doorOpenAlarm ? "ABERTA" : "FECHADA") },
                    { label: "AC Abrigo", value: torre.acStatus?.toUpperCase() ?? NO_DATA },
                    { label: "Fumo", value: torre.smokeAlarm === undefined ? NO_DATA : (torre.smokeAlarm ? "ALARME" : "OK"), status: "info" },
                  ]}
                />
              </TabsContent>

              {/* SECURITY TAB */}
              <TabsContent value="security" className="space-y-4 mt-4">
                <StatusGrid
                  items={[
                    { label: "Último Acesso", value: NO_DATA, status: "info" },
                    { label: "Total Acessos", value: NO_DATA, status: "info" },
                    { label: "Câmaras", value: NO_DATA, status: "info" },
                    { label: "Gravação", value: NO_DATA },
                    { label: "Detecção", value: NO_DATA },
                    { label: "Eventos Moção", value: NO_DATA, status: "info" },
                  ]}
                />
              </TabsContent>

              {/* SYSTEM TAB */}
              <TabsContent value="system" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <MetricGauge value={0} label="CPU" color="#2563EB" size={100} max={100} />
                  <MetricGauge value={0} label="RAM" color="#06B6D4" size={100} max={100} />
                  <MetricGauge value={0} label="Storage" color="#EF4444" size={100} max={100} />
                </div>
                <StatusGrid
                  items={[
                    { label: "Uptime", value: torre.uptime ?? NO_DATA, status: "info" },
                    { label: "CPU", value: NO_DATA, status: "info" },
                    { label: "RAM", value: NO_DATA, status: "info" },
                    { label: "Storage", value: NO_DATA, status: "info" },
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
                {eventsQuery.isError && (
                  <p className="text-xs text-offline mt-2">{errorMessage(eventsQuery.error)}</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}