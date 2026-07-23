import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Activity, ShieldCheck, BellRing, Download, MapPin, Plus, FileText, Wrench, AlertOctagon, CheckCircle2, Wifi, Zap, Thermometer, Building2, Radio, CalendarCheck, Battery, Fuel, Droplets, DoorOpen, Flame, Snowflake, Signal, Gauge, Timer, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api, type AlarmSeverity, type EventType } from "@/lib/api";
import { errorMessage, queryKeys, toEvent, toUiTower } from "@/lib/api-adapters";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { useAlarms } from "@/lib/alarms-store";
import { TorreMap } from "@/components/torre/TorreMap";

export const Route = createFileRoute("/torres/$torreId")({
  head: ({ params }) => ({ meta: [{ title: `${params.torreId} — ANTOSC` }] }),
  component: TorreDetailPage,
});

type ManutEstado = "Agendada" | "Em curso" | "Concluída";
type ManutTipo = "Preventiva" | "Correctiva";
type Manutencao = {
  id: string;
  tipo: ManutTipo;
  equipa: string;
  tecnico: string;
  data: string;
  descricao: string;
  duracao: string;
  estado: ManutEstado;
};

const sevPill: Record<AlarmSeverity, string> = {
  critical: "bg-offline-bg text-offline",
  warning: "bg-degraded-bg text-degraded",
  info: "bg-muted text-azul-2",
};

const eventIcon: Record<EventType, React.ComponentType<{ className?: string }>> = {
  failure: AlertOctagon,
  alarm: BellRing,
  maintenance: Wrench,
  recovery: CheckCircle2,
};

const eventColor: Record<EventType, string> = {
  failure: "text-offline bg-offline-bg",
  alarm: "text-degraded bg-degraded-bg",
  maintenance: "text-azul-2 bg-muted",
  recovery: "text-online bg-online-bg",
};

const estadoColor: Record<ManutEstado, string> = {
  Agendada: "bg-muted text-azul-2",
  "Em curso": "bg-degraded-bg text-degraded",
  Concluída: "bg-online-bg text-online",
};

// --- Helpers de apresentação segura (sem inventar valores) ---
// Todos os campos opcionais do UiTower passam por aqui antes de ir para o
// ecrã: se não houver dado real, mostra "—" em vez de rebentar (undefined
// .toFixed()) ou de mostrar um zero enganoso.
const NO_DATA = "—";

function fmtNum(value: number | undefined, decimals = 1, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${value.toFixed(decimals)}${unit}`;
}

function fmtInt(value: number | undefined, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${Math.round(value)}${unit}`;
}

function fmtStr(value: string | undefined | null): string {
  return value && value.trim() ? value : NO_DATA;
}

function fmtBool(value: boolean | undefined, yes = "Sim", no = "Não"): string {
  if (value === undefined) return NO_DATA;
  return value ? yes : no;
}

function fmtDateTime(value: string | undefined): string {
  if (!value) return NO_DATA;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NO_DATA;
  return d.toLocaleString("pt-PT");
}

function TorreDetailPage() {
  const { torreId } = Route.useParams();
  const navigate = useNavigate();
  const { alarms, active, ack, close } = useAlarms();
  const towerQuery = useQuery({
    queryKey: queryKeys.tower(torreId),
    queryFn: () => api.getTower(torreId),
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
    queryKey: queryKeys.metrics(torreId),
    queryFn: () => api.listMetrics({ tower_id: torreId, limit: 30 }),
  });
const eventsQuery = useQuery({
  queryKey: torreId ? queryKeys.events(torreId) : ["disabled"],
  queryFn: () => torreId ? api.listTowerEvents(torreId, { limit: 100, status: "open" }) : Promise.reject("No tower ID"),
  enabled: !!torreId,
});

  const latestMetric = metricsQuery.data?.data[0];
  const torre = towerQuery.data
    ? toUiTower(towerQuery.data, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data, latestMetric })
    : null;
  const torreAlarms = alarms.filter((a) => a.torre === torreId);
  const torreEquip = torre
    ? [{ id: `${torre.id}-snmp`, tipo: "SNMP Target", torre: torre.id, vendor: torre.vendor, ip: torre.ip, status: torre.status, ultimaManut: torre.ultimaManut }]
    : [];
  const series = useMemo(() => {
    const metrics = metricsQuery.data?.data ?? [];
    if (metrics.length > 0) {
      return metrics.slice().reverse().map((metric) => {
        const mm = metric.metrics ?? {};
        const v =
          (typeof mm.mains_voltage_l1_v === "number" ? mm.mains_voltage_l1_v : undefined) ??
          (typeof mm.mains_voltage_l2_v === "number" ? mm.mains_voltage_l2_v : undefined) ??
          (typeof mm.mains_voltage_l3_v === "number" ? mm.mains_voltage_l3_v : undefined) ??
          0;
        return {
          dia: new Date(metric.collected_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
          valor: v,
        };
      });
    }
    return torre ? [{ dia: torre.ultimaManut, valor: torre.disp30d ?? 0 }] : [];
  }, [metricsQuery.data, torre]);
  const eventos = useMemo(() => (eventsQuery.data?.data ?? []).map(toEvent), [eventsQuery.data]);
  const [manuts, setManuts] = useState<Manutencao[]>([]);

  const hash = useRouterState({ select: (s) => s.location.hash });
  const validTabs = ["overview", "alarms", "events", "maint", "location"] as const;
  type TabId = typeof validTabs[number];
  const initialTab: TabId = (validTabs as readonly string[]).includes(hash) ? (hash as TabId) : "overview";
  const [tab, setTab] = useState<TabId>(initialTab);
  useEffect(() => {
    if ((validTabs as readonly string[]).includes(hash) && hash !== tab) setTab(hash as TabId);
  }, [hash]);

  const [alarmFilter, setAlarmFilter] = useState<"all" | AlarmSeverity>("all");
  const [eventFilter, setEventFilter] = useState<"all" | EventType>("all");

  const filteredAlarms = alarmFilter === "all" ? torreAlarms : torreAlarms.filter((a) => a.severity === alarmFilter);
  const filteredEvents = eventFilter === "all" ? eventos : eventos.filter((e) => e.tipo === eventFilter);

  const [newManut, setNewManut] = useState<{ tipo: ManutTipo; equipa: string; data: string; descricao: string }>({ tipo: "Preventiva", equipa: "Alpha", data: "", descricao: "" });
  const [dlgOpen, setDlgOpen] = useState(false);
  const operatorOptions = operatorsQuery.data?.data ?? [];

  if (towerQuery.isLoading) {
    return <div className="bg-card border border-border rounded-xl p-8 text-sm text-muted-foreground">A carregar torre...</div>;
  }

  if (towerQuery.isError || !torre) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-sm text-offline">
        {errorMessage(towerQuery.error)}
      </div>
    );
  }

  const activeAlarmsTotal = active.filter((a) => a.torre === torre.id).length + (torre.activeAlarms ?? 0);
  const slaKnown = torre.slaStatus !== undefined;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/torres" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Voltar
      </button>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">{torre.nome}</h1>
              <span className="text-xs font-mono text-muted-foreground">{torre.id}</span>
              <StatusBadge status={torre.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {torre.local} · {torre.regiao} · <span className="font-mono">{fmtStr(torre.ip)}</span> · {torre.operadores.map((o) => o.name).join(", ")} · SNMP {torre.snmpVersion}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-foreground font-mono">{(torre.disp30d ?? 0).toFixed(2)}%</div>
            <div className="text-[11px] text-muted-foreground">Disp. 30 dias</div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as TabId); if (typeof window !== "undefined") history.replaceState(null, "", `#${v}`); }}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="alarms">Alarmes</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="maint">Manutenções</TabsTrigger>
          <TabsTrigger value="location">Localização</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Estado operacional — cards de topo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={<ShieldCheck className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="Disp. 30d" value={`${(torre.disp30d ?? 0).toFixed(2)}%`} />
            <MetricCard icon={<TrendingUp className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Disp. 7d" value={fmtNum(torre.disp7d, 2, "%")} />
            <MetricCard
              icon={<ShieldCheck className={`h-[18px] w-[18px] ${slaKnown ? (torre.slaStatus === "dentro" ? "text-online" : "text-offline") : "text-muted-foreground"}`} />}
              iconBg={slaKnown ? (torre.slaStatus === "dentro" ? "#DCFCE7" : "#FEE2E2") : "#F1F5F9"}
              label={torre.slaTarget !== undefined ? `SLA (alvo ${torre.slaTarget}%)` : "SLA"}
              value={slaKnown ? (torre.slaStatus === "dentro" ? "Dentro" : "Fora") : NO_DATA}
            />
            <MetricCard icon={<BellRing className="h-[18px] w-[18px] text-offline" />} iconBg="#FEE2E2" label="Alarmes activos" value={activeAlarmsTotal} />
          </div>

          {/* 1. Identificação & Localização */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-azul-2" /> Identificação & localização</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Nome</dt><dd className="text-foreground">{torre.nome}</dd>
                <dt className="text-muted-foreground">Tower ID</dt><dd className="font-mono text-foreground">{torre.id}</dd>
                <dt className="text-muted-foreground">Site ID</dt><dd className="font-mono text-foreground">{fmtStr(torre.siteId)}</dd>
                <dt className="text-muted-foreground">Site level</dt><dd className="text-foreground">{fmtStr(torre.siteLevel)}</dd>
                <dt className="text-muted-foreground">Categoria</dt><dd className="text-foreground">{fmtStr(torre.siteCategory)}</dd>
                <dt className="text-muted-foreground">Load work level</dt><dd className="text-foreground">{fmtStr(torre.loadWorkLevel)}</dd>
                <dt className="text-muted-foreground">Operador</dt><dd className="text-foreground">{torre.operadores.map((o) => o.name).join(", ")}</dd>
                <dt className="text-muted-foreground">Região</dt><dd className="text-foreground">{torre.regiao}</dd>
                <dt className="text-muted-foreground">Endereço</dt><dd className="text-foreground">{fmtStr(torre.endereco)}</dd>
                <dt className="text-muted-foreground">Coordenadas</dt><dd className="font-mono text-foreground">{torre.latitude.toFixed(4)}, {torre.longitude.toFixed(4)}</dd>
                <dt className="text-muted-foreground">Contador eléctrico</dt><dd className="font-mono text-foreground">{fmtStr(torre.electricMeterId)}</dd>
              </dl>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-azul-2" /> Estado operacional</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Estado</dt><dd><StatusBadge status={torre.status} /></dd>
                <dt className="text-muted-foreground">Disp. 30d</dt><dd className="font-mono text-foreground">{(torre.disp30d ?? 0).toFixed(2)}%</dd>
                <dt className="text-muted-foreground">Disp. 7d</dt><dd className="font-mono text-foreground">{fmtNum(torre.disp7d, 2, "%")}</dd>
                <dt className="text-muted-foreground">Último contacto</dt><dd className="font-mono text-foreground">{fmtDateTime(torre.lastSeenAt)}</dd>
                <dt className="text-muted-foreground">Actualizado em</dt><dd className="font-mono text-foreground">{fmtDateTime(torre.updatedAt)}</dd>
                <dt className="text-muted-foreground">SLA alvo</dt><dd className="text-foreground">{torre.slaTarget !== undefined ? `${torre.slaTarget}%` : NO_DATA}</dd>
                <dt className="text-muted-foreground">SLA status</dt><dd className={slaKnown ? (torre.slaStatus === "dentro" ? "text-online" : "text-offline") : "text-muted-foreground"}>{slaKnown ? (torre.slaStatus === "dentro" ? "Dentro" : "Fora") : NO_DATA}</dd>
                <dt className="text-muted-foreground">Alarmes activos</dt><dd className="text-foreground">{torre.activeAlarms ?? NO_DATA}</dd>
                <dt className="text-muted-foreground">Falhas activas</dt><dd className="text-foreground">{torre.activeFailures ?? NO_DATA}</dd>
                <dt className="text-muted-foreground">Uptime</dt><dd className="font-mono text-foreground">{fmtStr(torre.uptime)}</dd>
              </dl>
            </div>
          </div>

          {/* 3. Energia — bloco crítico */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-degraded" /> Energia</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={<Zap className="h-[18px] w-[18px] text-degraded" />} iconBg="#FEF3C7" label="Tensão AC" value={fmtNum(torre.voltage, 1, " V")} />
              <MetricCard icon={<Gauge className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Corrente" value={fmtNum(torre.current, 1, " A")} />
              <MetricCard icon={<Battery className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="Bateria SoC" value={fmtInt(torre.batterySoc, "%")} />
              <MetricCard icon={<Battery className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Bateria SoH" value={fmtInt(torre.batterySoh, "%")} />
            </div>
            <dl className="text-xs grid grid-cols-2 md:grid-cols-3 gap-y-2 pt-3 border-t border-border">
              <dt className="text-muted-foreground">Tensão bateria</dt><dd className="font-mono text-foreground">{fmtNum(torre.batteryVoltage, 1, " V")}</dd>
              <dt className="text-muted-foreground">Temp. bateria</dt><dd className="font-mono text-foreground">{fmtNum(torre.batteryTemperature, 1, " °C")}</dd>
              <dt className="text-muted-foreground">Backup estimado</dt><dd className="font-mono text-foreground">{fmtStr(torre.batteryBackupEstimate)}</dd>
              <dt className="text-muted-foreground">Rede eléctrica</dt><dd className={torre.mainsStatus === "presente" ? "text-online" : torre.mainsStatus === "ausente" ? "text-offline" : "text-muted-foreground"}>{fmtStr(torre.mainsStatus)}</dd>
              <dt className="text-muted-foreground">Rectificador</dt><dd className={torre.rectifierStatus === "ok" ? "text-online" : torre.rectifierStatus === "alarme" ? "text-offline" : "text-muted-foreground"}>{torre.rectifierStatus === "ok" ? "OK" : torre.rectifierStatus === "alarme" ? "Alarme" : NO_DATA}</dd>
              <dt className="text-muted-foreground">Fonte activa</dt><dd className="text-foreground capitalize">{fmtStr(torre.powerSourceActive)}</dd>
              <dt className="text-muted-foreground">Gerador</dt><dd className={torre.generatorStatus === "ligado" ? "text-degraded" : torre.generatorStatus === "erro" ? "text-offline" : "text-muted-foreground"}>{fmtStr(torre.generatorStatus)}</dd>
              <dt className="text-muted-foreground flex items-center gap-1"><Fuel className="h-3 w-3" /> Combustível</dt><dd className="font-mono text-foreground">{fmtInt(torre.generatorFuelLevel, "%")}</dd>
              <dt className="text-muted-foreground">Runtime gerador</dt><dd className="font-mono text-foreground">{fmtInt(torre.generatorRuntimeHours, " h")}</dd>
            </dl>
            {torre.fuelTheftAlert === true && (
              <div className="bg-offline-bg text-offline text-xs px-3 py-2 rounded-md flex items-center gap-2">
                <AlertOctagon className="h-3 w-3" /> Alerta: possível furto de combustível (correlação multi-fonte).
              </div>
            )}
          </div>

          {/* 5 + 6. Ambiente/Shelter e Sinal/Rede */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Thermometer className="h-4 w-4 text-offline" /> Ambiente / Shelter</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temperatura</dt><dd className="font-mono text-foreground">{torre.temperatura !== undefined ? `${torre.temperatura} °C` : NO_DATA}</dd>
                <dt className="text-muted-foreground flex items-center gap-1"><Droplets className="h-3 w-3" /> Humidade</dt><dd className="font-mono text-foreground">{fmtInt(torre.humidity, "%")}</dd>
                <dt className="text-muted-foreground flex items-center gap-1"><DoorOpen className="h-3 w-3" /> Porta aberta</dt><dd className={torre.doorOpenAlarm === true ? "text-offline" : torre.doorOpenAlarm === false ? "text-online" : "text-muted-foreground"}>{fmtBool(torre.doorOpenAlarm)}</dd>
                <dt className="text-muted-foreground flex items-center gap-1"><Flame className="h-3 w-3" /> Alarme fumo</dt><dd className={torre.smokeAlarm === true ? "text-offline" : torre.smokeAlarm === false ? "text-online" : "text-muted-foreground"}>{fmtBool(torre.smokeAlarm)}</dd>
                <dt className="text-muted-foreground flex items-center gap-1"><Snowflake className="h-3 w-3" /> Ar condicionado</dt><dd className="text-foreground capitalize">{fmtStr(torre.acStatus)}</dd>
              </dl>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Signal className="h-4 w-4 text-azul-2" /> Sinal & rede</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground flex items-center gap-1"><Wifi className="h-3 w-3" /> RSSI</dt><dd className="font-mono text-foreground">{torre.signalStrength !== undefined ? `${torre.signalStrength} dBm` : NO_DATA}</dd>
                <dt className="text-muted-foreground">Link status</dt><dd className={torre.linkStatus === "up" ? "text-online" : torre.linkStatus === "degraded" ? "text-degraded" : torre.linkStatus === "down" ? "text-offline" : "text-muted-foreground"}>{fmtStr(torre.linkStatus)}</dd>
                <dt className="text-muted-foreground">Utilização BW</dt><dd className="font-mono text-foreground">{fmtInt(torre.bandwidthUtilization, "%")}</dd>
                <dt className="text-muted-foreground">Vendor</dt><dd className="text-foreground">{torre.vendor}</dd>
                <dt className="text-muted-foreground">SNMP</dt><dd className="text-foreground">{torre.snmpVersion}</dd>
                <dt className="text-muted-foreground">IP alvo</dt><dd className="font-mono text-foreground">{fmtStr(torre.ip)}</dd>
              </dl>
            </div>
          </div>

          {/* 8. SLA / Manutenção */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Timer className="h-4 w-4 text-azul-2" /> SLA & métricas de manutenção</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricCard icon={<ShieldCheck className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="SLA alvo" value={torre.slaTarget !== undefined ? `${torre.slaTarget}%` : NO_DATA} />
              <MetricCard icon={<ShieldCheck className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Realizado" value={fmtNum(torre.availabilityPercent ?? undefined, 2, "%")} />
              <MetricCard icon={<Timer className="h-[18px] w-[18px] text-degraded" />} iconBg="#FEF3C7" label="MTTR" value={fmtInt(torre.mttrHours, " h")} />
              <MetricCard icon={<Timer className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="MTBF" value={fmtInt(torre.mtbfHours, " h")} />
              <MetricCard icon={<CalendarCheck className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Última manut." value={torre.ultimaManut} />
            </div>
            <dl className="text-xs grid grid-cols-2 gap-y-2 pt-3 border-t border-border">
              <dt className="text-muted-foreground">Downtime no período</dt><dd className="font-mono text-foreground">{fmtInt(torre.downtimeMinutes, " min")}</dd>
              <dt className="text-muted-foreground">Manut. planeada (excl.)</dt><dd className="font-mono text-foreground">{fmtInt(torre.plannedMaintMinutes, " min")}</dd>
            </dl>
            <div className="pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
              <Radio className="h-3 w-3" /> Coleta SNMP activa
            </div>
          </div>

          {/* Legado: dl operacional resumido */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-azul-2" /> Contadores</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Eventos</dt><dd className="text-foreground">{eventos.length}</dd>
                <dt className="text-muted-foreground">Métricas coletadas</dt><dd className="text-foreground">{metricsQuery.data?.meta.total ?? metricsQuery.data?.data.length ?? 0}</dd>
              </dl>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-online" /> Última manutenção</h3>
              <p className="text-2xl font-semibold font-mono text-foreground">{torre.ultimaManut}</p>
              <p className="text-xs text-muted-foreground">Próxima inspecção sugerida em 30 dias.</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Métricas — últimas coletas</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series}>
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="valor" stroke="#2A5298" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Equipamentos da torre</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-5 py-2 text-left">Tipo</th><th className="px-5 py-2 text-left">Vendor</th><th className="px-5 py-2 text-left">IP</th><th className="px-5 py-2 text-left">Estado</th></tr>
              </thead>
              <tbody>
                {torreEquip.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-5 py-3">{e.tipo}</td>
                    <td className="px-5 py-3 text-muted-foreground">{e.vendor}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{fmtStr(e.ip)}</td>
                    <td className="px-5 py-3"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
                {torreEquip.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-xs text-muted-foreground">Sem equipamentos.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="alarms" className="space-y-3 mt-4">
          <div className="flex gap-2 flex-wrap">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button key={f} onClick={() => setAlarmFilter(f)} className={`px-3 py-1 text-xs rounded-md ${alarmFilter === f ? "bg-azul text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "Todos" : f === "critical" ? "Críticos" : f === "warning" ? "Avisos" : "Info"}
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {filteredAlarms.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Sem alarmes.</div>
            ) : (
              filteredAlarms.map((a) => (
                <div key={a.id} className="px-5 py-4 flex items-start gap-3">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${sevPill[a.severity]}`}>{a.severity}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{a.date} {a.time} · {a.status}</p>
                  </div>
                  {a.status !== "closed" && (
                    <div className="flex gap-2">
                      <button onClick={() => ack(a.id)} disabled={a.status === "ack"} className="text-[11px] px-2 py-1 rounded bg-muted hover:bg-azul hover:text-white disabled:opacity-50">Ack</button>
                      <button onClick={() => close(a.id)} className="text-[11px] px-2 py-1 rounded bg-muted hover:bg-offline hover:text-white">Fechar</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-3 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {(["all", "failure", "alarm", "maintenance", "recovery"] as const).map((f) => (
                <button key={f} onClick={() => setEventFilter(f)} className={`px-3 py-1 text-xs rounded-md ${eventFilter === f ? "bg-azul text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? "Todos" : f}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success("Histórico exportado em PDF")} className="text-xs inline-flex items-center gap-1 px-3 py-1 bg-card border border-border rounded-md hover:bg-muted"><Download className="h-3 w-3" /> PDF</button>
              <button onClick={() => toast.success("Histórico exportado em CSV")} className="text-xs inline-flex items-center gap-1 px-3 py-1 bg-card border border-border rounded-md hover:bg-muted"><FileText className="h-3 w-3" /> CSV</button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">Sem eventos.</div>
            ) : (
              <ol className="relative border-l border-border ml-3 space-y-4">
                {filteredEvents.map((e) => {
                  const Icon = eventIcon[e.tipo];
                  return (
                    <li key={e.id} className="ml-6">
                      <span className={`absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center ${eventColor[e.tipo]}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="text-sm font-medium">{e.title}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{e.date} {e.time} · {e.tipo}</div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </TabsContent>

        <TabsContent value="maint" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2">
                  <Plus className="h-3 w-3" /> Nova manutenção
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova manutenção em {torre.id}</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">Tipo</label>
                    <select value={newManut.tipo} onChange={(e) => setNewManut({ ...newManut, tipo: e.target.value as ManutTipo })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">
                      <option>Preventiva</option><option>Correctiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Equipa</label>
                    <select value={newManut.equipa} onChange={(e) => setNewManut({ ...newManut, equipa: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">
                      {operatorOptions.map((eq) => <option key={eq.operator_id}>{eq.name}</option>)}
                      {operatorOptions.length === 0 && <option>Operação</option>}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Data</label>
                    <input type="date" value={newManut.data} onChange={(e) => setNewManut({ ...newManut, data: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Descrição</label>
                    <textarea value={newManut.descricao} onChange={(e) => setNewManut({ ...newManut, descricao: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" />
                  </div>
                </div>
                <DialogFooter>
                  <button
                    onClick={() => {
                      setManuts([{ id: `M-${Date.now()}`, tipo: newManut.tipo, equipa: newManut.equipa, tecnico: "—", data: newManut.data, descricao: newManut.descricao, duracao: "—", estado: "Agendada" }, ...manuts]);
                      setDlgOpen(false);
                      toast.success("Manutenção agendada");
                    }}
                    className="px-4 py-2 bg-azul text-white rounded text-sm"
                  >
                    Agendar
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Data</th><th className="px-4 py-2 text-left">Tipo</th><th className="px-4 py-2 text-left">Equipa</th><th className="px-4 py-2 text-left">Técnico</th><th className="px-4 py-2 text-left">Descrição</th><th className="px-4 py-2 text-left">Duração</th><th className="px-4 py-2 text-left">Estado</th></tr>
              </thead>
              <tbody>
                {manuts.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{m.data}</td>
                    <td className="px-4 py-3">{m.tipo}</td>
                    <td className="px-4 py-3">{m.equipa}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.tecnico}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.descricao}</td>
                    <td className="px-4 py-3 font-mono text-xs">{m.duracao}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${estadoColor[m.estado]}`}>{m.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="location" className="space-y-3 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            <TorreMap torre={torre} />
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4 text-azul-2" /> Coordenadas</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Latitude: <span className="font-mono text-foreground">{torre.latitude}</span></p>
                <p>Longitude: <span className="font-mono text-foreground">{torre.longitude}</span></p>
                <p>Região: <span className="text-foreground">{torre.regiao}</span></p>
                <p>Local: <span className="text-foreground">{torre.local}</span></p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${torre.latitude},${torre.longitude}`}
                target="_blank" rel="noreferrer"
                className="block text-center text-xs px-3 py-2 bg-azul text-white rounded-md hover:bg-azul-2"
              >
                Abrir no Google Maps
              </a>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}