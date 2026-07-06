import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Activity, ShieldCheck, BellRing, Download, MapPin, Plus, FileText, Wrench, AlertOctagon, CheckCircle2, Wifi, Zap, Thermometer, Building2, Radio, CalendarCheck, Battery, Fuel, Droplets, DoorOpen, Flame, Snowflake, Signal, Gauge, Timer, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api, type AlarmSeverity, type EventType } from "@/lib/api";
import { queryKeys, toEvent, toUiTower, mockToUiTower } from "@/lib/api-adapters";
import { torres as mockTorres } from "@/lib/mock-data";
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
    queryKey: queryKeys.events(torreId),
    queryFn: () => api.listTowerEvents(torreId, { limit: 100 }),
  });
  const latestMetric = metricsQuery.data?.data[0];
  const mockFallback = mockTorres.find((t) => t.id === torreId);
  const torre = towerQuery.data
    ? toUiTower(towerQuery.data, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data, latestMetric })
    : mockFallback
      ? mockToUiTower(mockFallback)
      : null;
  const usingFallback = !towerQuery.data && !!mockFallback;
  const torreAlarms = alarms.filter((a) => a.torre === torreId);
  const torreEquip = torre
    ? [{ id: `${torre.id}-snmp`, tipo: "SNMP Target", torre: torre.id, vendor: torre.vendor, ip: torre.ip, status: torre.status, ultimaManut: torre.ultimaManut }]
    : [];
  const series = useMemo(() => {
    const metrics = metricsQuery.data?.data ?? [];
    if (metrics.length > 0) {
      return metrics.slice().reverse().map((metric) => ({
        dia: new Date(metric.collected_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
        valor: metric.signal_strength ?? metric.voltage ?? 0,
      }));
    }
    return torre ? [{ dia: torre.ultimaManut, valor: torre.disp30d }] : [];
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

  if (towerQuery.isLoading && !mockFallback) {
    return <div className="bg-card border border-border rounded-xl p-8 text-sm text-muted-foreground">A carregar torre...</div>;
  }

  if (!torre) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-sm text-offline">
        Torre {torreId} não encontrada.
      </div>
    );
  }

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
              {torre.local} · {torre.regiao} · <span className="font-mono">{torre.ip}</span> · {torre.operador} · SNMP {torre.snmpVersion}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-foreground font-mono">{torre.disp30d.toFixed(2)}%</div>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={<ShieldCheck className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="Disp. 30d" value={`${torre.disp30d.toFixed(2)}%`} />
            <MetricCard icon={<Clock className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Eventos" value={eventos.length} />
            <MetricCard icon={<Activity className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Métricas" value={metricsQuery.data?.meta.total ?? metricsQuery.data?.data.length ?? 0} />
            <MetricCard icon={<BellRing className="h-[18px] w-[18px] text-offline" />} iconBg="#FEE2E2" label="Alarmes activos" value={active.filter((a) => a.torre === torre.id).length} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={<Wifi className="h-[18px] w-[18px] text-azul-2" />} iconBg="#EFF6FF" label="Sinal (RSSI)" value={`${torre.signalStrength} dBm`} />
            <MetricCard icon={<Zap className="h-[18px] w-[18px] text-degraded" />} iconBg="#FEF3C7" label="Tensão" value={`${torre.voltage.toFixed(1)} V`} />
            <MetricCard icon={<Thermometer className="h-[18px] w-[18px] text-offline" />} iconBg="#FEE2E2" label="Temperatura" value={`${torre.temperatura} °C`} />
            <MetricCard icon={<Activity className="h-[18px] w-[18px] text-online" />} iconBg="#DCFCE7" label="Uptime" value={torre.uptime} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-azul-2" /> Informação geral</h3>
              <dl className="text-xs grid grid-cols-2 gap-y-2">
                <dt className="text-muted-foreground">Nome</dt><dd className="text-foreground">{torre.nome}</dd>
                <dt className="text-muted-foreground">Localização</dt><dd className="text-foreground">{torre.local}, {torre.regiao}</dd>
                <dt className="text-muted-foreground">Operador</dt><dd className="text-foreground">{torre.operador}</dd>
                <dt className="text-muted-foreground">Vendor</dt><dd className="text-foreground">{torre.vendor}</dd>
                <dt className="text-muted-foreground">IP</dt><dd className="text-foreground font-mono">{torre.ip}</dd>
                <dt className="text-muted-foreground">SNMP</dt><dd className="text-foreground">{torre.snmpVersion}</dd>
              </dl>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-online" /> Última manutenção</h3>
              <p className="text-2xl font-semibold font-mono text-foreground">{torre.ultimaManut}</p>
              <p className="text-xs text-muted-foreground">Próxima inspecção sugerida em 30 dias.</p>
              <div className="pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
                <Radio className="h-3 w-3" /> Coleta SNMP activa
              </div>
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
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{e.ip}</td>
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
                <p>Latitude: <span className="font-mono text-foreground">{torre.lat}</span></p>
                <p>Longitude: <span className="font-mono text-foreground">{torre.lng}</span></p>
                <p>Região: <span className="text-foreground">{torre.regiao}</span></p>
                <p>Local: <span className="text-foreground">{torre.local}</span></p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${torre.lat},${torre.lng}`}
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
