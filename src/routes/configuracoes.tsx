import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Archive, Building2, Database, Download, FileText, KeyRound,
  Monitor, Server, Settings as SettingsIcon, ShieldCheck, Tickets, User,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, auth, API_BASE_URL } from "@/lib/api";
import { errorMessage, queryKeys } from "@/lib/api-adapters";
import { useAuth } from "@/lib/auth";
import { towersCsv, ticketsCsv, timestampName, downloadText } from "@/lib/export";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ANTOSC TOWERCORE" },
      { property: "og:title", content: "Configurações — ANTOSC TOWERCORE" },
      { property: "og:description", content: "Configuração da plataforma, integrações, exportações de dados e auditoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

type SettingsTab = "geral" | "monitorizacao" | "integracoes" | "dados" | "auditoria";

const LS_MONITORING = "antosc.settings.monitoring";

interface MonitoringSettings {
  snmpVersion: "v2c" | "v3";
  snmpCommunity: string;
  collectIntervalMin: number;
  alertCriticalEmail: boolean;
  alertWarningEmail: boolean;
}

const DEFAULT_MONITORING: MonitoringSettings = {
  snmpVersion: "v2c",
  snmpCommunity: "",
  collectIntervalMin: 15,
  alertCriticalEmail: true,
  alertWarningEmail: false,
};

function loadMonitoring(): MonitoringSettings {
  try {
    const raw = localStorage.getItem(LS_MONITORING);
    if (raw) return { ...DEFAULT_MONITORING, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_MONITORING;
}

function ConfiguracoesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("geral");
  const [settings, setSettings] = useState<MonitoringSettings>(loadMonitoring);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => api.healthV1(),
    refetchInterval: 30_000,
  });
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => api.listAuditLogs({ limit: 200 }),
    enabled: tab === "auditoria",
  });

  const apiOnline = healthQuery.data?.status === "ok";
  const towers = towersQuery.data?.data ?? [];

  function saveMonitoring(next: MonitoringSettings) {
    setSettings(next);
    localStorage.setItem(LS_MONITORING, JSON.stringify(next));
    toast.success("Preferências guardadas neste navegador");
  }

  // ---- Exportações (dados reais já carregados; falhas aparecem como erro) ----
  async function exportTowersCsv() {
    try {
      const res = await api.listTowers({ limit: 500 });
      downloadText(towersCsv(res.data), timestampName("inventario-sites", "csv"));
      toast.success(`${res.data.length} sites exportados`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function exportTicketsCsv() {
    try {
      const all = await api.fetchAllTickets();
      downloadText(ticketsCsv(all as unknown as Array<Record<string, unknown>>), timestampName("tickets", "csv"));
      toast.success(`${all.length} tickets exportados`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function exportAuditCsvServer() {
    try {
      const res = await api.exportAuditLogsCsv();
      if (!res.ok) throw { code: String(res.status), message: res.statusText };
      const text = await res.text();
      downloadText(text, timestampName("auditoria", "csv"));
      toast.success("Registos de auditoria exportados");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-azul-2" /> Configurações
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Plataforma, monitorização, integrações, dados e auditoria
          </p>
        </div>
        <div className={`text-xs px-3 py-1.5 rounded-md font-mono ${apiOnline ? "bg-online-bg text-online" : "bg-offline-bg text-offline"}`}>
          API {apiOnline ? "OPERACIONAL" : "INDISPONÍVEL"}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
        <TabsList className="bg-card border border-border flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="monitorizacao">Monitorização</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="dados">Dados & Exportações</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        {/* GERAL */}
        <TabsContent value="geral" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4 text-azul-2" /> Sessão</h3>
            <dl className="text-xs grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Utilizador</dt><dd className="text-foreground">{user?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="font-mono text-foreground">{user?.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Autenticação</dt>
              <dd className="text-foreground">{auth.token ? "Token da API (towercore)" : "Modo demonstração"}</dd>
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Em modo demonstração os dados escritos não chegam ao backend; os exports continuam a usar apenas dados reais carregados.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-azul-2" /> Plataforma</h3>
            <dl className="text-xs grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Sistema</dt><dd className="text-foreground">ANTOSC TOWERCORE</dd>
              <dt className="text-muted-foreground">Versão UI</dt><dd className="font-mono text-foreground">v0.1.45</dd>
              <dt className="text-muted-foreground">API base</dt><dd className="font-mono text-foreground break-all">{API_BASE_URL}</dd>
              <dt className="text-muted-foreground">Fuso horário</dt><dd className="text-foreground">Africa/Luanda (UTC+1)</dd>
            </dl>
          </div>
        </TabsContent>

        {/* MONITORIZAÇÃO */}
        <TabsContent value="monitorizacao" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Monitor className="h-4 w-4 text-azul-2" /> Coleta SNMP (predefinições)</h3>
            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="text-muted-foreground">Versão SNMP por defeito</span>
                <select
                  value={settings.snmpVersion}
                  onChange={(e) => saveMonitoring({ ...settings, snmpVersion: e.target.value as "v2c" | "v3" })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded bg-background text-sm"
                >
                  <option value="v2c">v2c</option>
                  <option value="v3">v3</option>
                </select>
              </label>
              <label className="block">
                <span className="text-muted-foreground">Community (v2c) — fica só neste navegador</span>
                <input
                  type="password"
                  value={settings.snmpCommunity}
                  onChange={(e) => saveMonitoring({ ...settings, snmpCommunity: e.target.value })}
                  placeholder="—"
                  className="w-full mt-1 px-3 py-2 border border-border rounded bg-background text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Intervalo de coleta (minutos)</span>
                <input
                  type="number" min={1} max={1440}
                  value={settings.collectIntervalMin}
                  onChange={(e) => saveMonitoring({ ...settings, collectIntervalMin: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded bg-background text-sm font-mono"
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Preferências guardadas localmente. A configuração efectiva por site é feita em <span className="text-foreground">Sites → SNMP</span>; o towercore ainda não expõe endpoint para predefinições globais.
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-degraded" /> Notificações por email</h3>
              <label className="text-xs flex items-center justify-between gap-3">
                <span>Alarmes críticos</span>
                <input type="checkbox" checked={settings.alertCriticalEmail} onChange={(e) => saveMonitoring({ ...settings, alertCriticalEmail: e.target.checked })} className="h-4 w-4 accent-[#2A5298]" />
              </label>
              <label className="text-xs flex items-center justify-between gap-3">
                <span>Avisos (warning)</span>
                <input type="checkbox" checked={settings.alertWarningEmail} onChange={(e) => saveMonitoring({ ...settings, alertWarningEmail: e.target.checked })} className="h-4 w-4 accent-[#2A5298]" />
              </label>
              <p className="text-[11px] text-muted-foreground">
                O envio real de email depende de integração no backend; estas preferências guardam-se localmente enquanto isso não existe.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Database className="h-4 w-4 text-azul-2" /> Retenção de histórico</h3>
              <p className="text-xs text-muted-foreground">
                A retenção de métricas e eventos é gerida pelo towercore. A UI mostra exactamente o que o backend devolve: o que não estiver retido, não aparece nos gráficos nem nos exports.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* INTEGRAÇÕES */}
        <TabsContent value="integracoes" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Server className="h-4 w-4 text-azul-2" /> towercore API</h3>
            <dl className="text-xs grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Endpoint</dt><dd className="font-mono text-foreground break-all">/api/v1</dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className={apiOnline ? "text-online" : "text-offline"}>{apiOnline ? "Operacional" : "Indisponível"}</dd>
              <dt className="text-muted-foreground">Verificado</dt><dd className="font-mono text-foreground">{healthQuery.dataUpdatedAt ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString("pt-PT") : "—"}</dd>
            </dl>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-azul-2" /> Fontes de monitorização</h3>
            <ul className="text-xs space-y-2">
              <li className="flex items-center justify-between"><span>SNMP (multi-vendor)</span><span className="text-online">Activo</span></li>
              <li className="flex items-center justify-between"><span>Zabbix (legado)</span><span className="text-muted-foreground">Sem endpoint — migração em curso</span></li>
              <li className="flex items-center justify-between"><span>NetEco / Huawei (bateria & energia DC)</span><span className="text-muted-foreground">Campos por site (battery_soc, dc_output_voltage…)</span></li>
            </ul>
            <p className="text-[11px] text-muted-foreground">
              O objectivo é substituir a dependência do Zabbix pela coleta directa do towercore; os campos NetEco já são lidos quando o site os reporta.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 lg:col-span-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-degraded" /> Chaves de acesso</h3>
            <p className="text-xs text-muted-foreground">
              O token de sessão e a chave de API (X-API-Key) são geridos no login e ficam apenas neste navegador. A emissão de chaves de longo prazo para integrações externas ainda não tem endpoint no towercore.
            </p>
          </div>
        </TabsContent>

        {/* DADOS & EXPORTAÇÕES */}
        <TabsContent value="dados" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Archive className="h-4 w-4 text-azul-2" /> Exportações</h3>
              <p className="text-xs text-muted-foreground mt-1">CSV gerado a partir dos dados reais carregados da API — sem dados fabricated.</p>
            </div>
            <div className="divide-y divide-border">
              <ExportRow
                icon={<Building2 className="h-4 w-4 text-azul-2" />}
                title="Inventário de sites"
                desc="Todos os sites com estado, vendor, região, SNMP e disponibilidade."
                count={towers.length}
                onClick={exportTowersCsv}
                loading={towersQuery.isFetching}
                error={towersQuery.isError ? errorMessage(towersQuery.error) : undefined}
              />
              <ExportRow
                icon={<Tickets className="h-4 w-4 text-degraded" />}
                title="Tickets / alarmes"
                desc="Histórico completo de tickets (todas as páginas, incluindo fechados)."
                onClick={exportTicketsCsv}
              />
              <ExportRow
                icon={<FileText className="h-4 w-4 text-azul-2" />}
                title="Registos de auditoria (CSV do servidor)"
                desc="Export gerado pelo próprio towercore em /api/v1/audit-logs/export.csv."
                onClick={exportAuditCsvServer}
              />
              <HistoricalExportRow towers={towers} />
            </div>
          </div>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="auditoria" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-azul-2" /> Registo de auditoria</h3>
            <button
              onClick={exportAuditCsvServer}
              className="text-xs inline-flex items-center gap-1 px-3 py-1 bg-card border border-border rounded-md hover:bg-muted"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {auditQuery.isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">A carregar registos…</div>
            ) : auditQuery.isError ? (
              <div className="p-6 text-sm text-offline">{errorMessage(auditQuery.error)}</div>
            ) : (auditQuery.data?.data.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Sem registos de auditoria devolvidos pelo towercore.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 text-left">Data</th>
                      <th className="px-5 py-2 text-left">Utilizador</th>
                      <th className="px-5 py-2 text-left">Acção</th>
                      <th className="px-5 py-2 text-left">Detalhe</th>
                      <th className="px-5 py-2 text-left">Site</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditQuery.data!.data.map((log) => (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-5 py-2.5 font-mono text-xs">{new Date(log.created_at).toLocaleString("pt-PT")}</td>
                        <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{log.user_id}</td>
                        <td className="px-5 py-2.5 text-xs">{log.action}</td>
                        <td className="px-5 py-2.5 text-xs text-muted-foreground">{log.detail}</td>
                        <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{log.tower_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExportRow({
  icon, title, desc, onClick, loading, error, count,
}: {
  icon: React.ReactNode; title: string; desc: string;
  onClick: () => void; loading?: boolean; error?: string; count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {title}
            {count !== undefined && <span className="ml-2 text-xs text-muted-foreground">({count})</span>}
          </div>
          <div className="text-xs text-muted-foreground">{error ? <span className="text-offline">{error}</span> : desc}</div>
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={loading}
        className="shrink-0 text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2 disabled:opacity-50"
      >
        <Download className="h-3 w-3" /> {loading ? "A preparar…" : "CSV"}
      </button>
    </div>
  );
}

/** Export de histórico de métricas: exige escolher site + período. */
function HistoricalExportRow({ towers }: { towers: Array<{ tower_id: string; name: string }> }) {
  const [towerId, setTowerId] = useState("");
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!towerId) {
      toast.error("Escolha um site primeiro");
      return;
    }
    setBusy(true);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - Number(period) * 24 * 60 * 60 * 1000);
      const res = await api.listMetrics({
        tower_id: towerId,
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 500,
      });
      const keys = [...new Set(res.data.flatMap((m) => Object.keys(m.metrics ?? {})))].sort();
      const { metricsHistoryCsv } = await import("@/lib/export");
      downloadText(metricsHistoryCsv(res.data, keys), timestampName(`historico-metricas-${towerId}`, "csv"));
      toast.success(`${res.data.length} coletas exportadas`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        <Database className="h-4 w-4 text-azul-2 mt-0.5" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Histórico de métricas por site</div>
          <div className="text-xs text-muted-foreground">Uma coluna por métrica coletada, uma linha por coleta.</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={towerId} onChange={(e) => setTowerId(e.target.value)} className="text-xs px-2 py-1.5 border border-border rounded bg-background max-w-[220px]">
          <option value="">Escolher site…</option>
          {towers.map((t) => <option key={t.tower_id} value={t.tower_id}>{t.name}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as "7" | "30" | "90")} className="text-xs px-2 py-1.5 border border-border rounded bg-background">
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </select>
        <button onClick={run} disabled={busy} className="text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2 disabled:opacity-50">
          <Download className="h-3 w-3" /> {busy ? "A preparar…" : "CSV"}
        </button>
      </div>
    </div>
  );
}
