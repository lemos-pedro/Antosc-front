import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, Info, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
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
      existing.sites.add(a.towerName);
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
        sites: new Set([a.towerName]),
        vendors: new Set([a.vendor]),
      });
    }
  }
  const sevOrder: Record<AlarmSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return Array.from(map.values()).sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.ocorrencias.length - a.ocorrencias.length,
  );
}

// ---------- Export por período, resumido por site ----------

type SiteExportRow = {
  site: string;
  ip: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  open: number;
  ack: number;
  closed: number;
};

function buildSiteExportRows(
  alarms: Alarm[],
  towersById: Map<string, { name: string; ip?: string }>,
  fromDate: string,
  toDate: string,
): SiteExportRow[] {
  // fromDate/toDate no formato yyyy-mm-dd (comparação por string funciona
  // porque Alarm.date já vem nesse formato via splitDateTime).
  const inRange = alarms.filter((a) => {
    if (fromDate && a.date < fromDate) return false;
    if (toDate && a.date > toDate) return false;
    return true;
  });

  const bySite = new Map<string, SiteExportRow>();

  for (const a of inRange) {
    const towerInfo = towersById.get(a.towerId);
    const siteName = towerInfo?.name || a.towerName || a.towerId;
    const ip = towerInfo?.ip || "—";

    const row = bySite.get(a.towerId) ?? {
      site: siteName,
      ip,
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      open: 0,
      ack: 0,
      closed: 0,
    };

    row.total += 1;
    row[a.severity] += 1;
    if (a.status === "active") row.open += 1;
    else if (a.status === "ack") row.ack += 1;
    else row.closed += 1;

    bySite.set(a.towerId, row);
  }

  return Array.from(bySite.values()).sort((a, b) => b.total - a.total);
}

function severityLabel(row: SiteExportRow): string {
  const parts: string[] = [];
  if (row.critical > 0) parts.push(`${row.critical} crítico${row.critical > 1 ? "s" : ""}`);
  if (row.warning > 0) parts.push(`${row.warning} aviso${row.warning > 1 ? "s" : ""}`);
  if (row.info > 0) parts.push(`${row.info} info`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function statusLabel(row: SiteExportRow): string {
  const parts: string[] = [];
  if (row.open > 0) parts.push(`${row.open} aberto${row.open > 1 ? "s" : ""}`);
  if (row.ack > 0) parts.push(`${row.ack} confirmado${row.ack > 1 ? "s" : ""}`);
  if (row.closed > 0) parts.push(`${row.closed} fechado${row.closed > 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function exportRowsToSheetData(rows: SiteExportRow[]) {
  return rows.map((r) => ({
    "Nome do Site": r.site,
    "IP": r.ip,
    "Número de Alarmes": r.total,
    "Severidade": severityLabel(r),
    "Estado": statusLabel(r),
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isDateInRange(
  date: string,
  fromDate: string,
  toDate: string,
): boolean {
  const day = date.slice(0, 10);

  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;

  return true;
}

function buildTicketSummary(
  tickets: any[],
  fromDate: string,
  toDate: string,
) {
  const filtered = tickets.filter((ticket) =>
    isDateInRange(ticket.created_at, fromDate, toDate),
  );

  const open = filtered.filter((t) => t.status === "open").length;

  const acknowledged = filtered.filter(
    (t) => t.status === "acknowledged",
  ).length;

  const closed = filtered.filter(
    (t) => t.status === "closed",
  ).length;

  return [
    {
      "Período": `${fromDate || "Início"} até ${toDate || "Hoje"}`,
      "Total de Tickets": filtered.length,
      "Tickets Abertos": open,
      "Tickets Confirmados": acknowledged,
      "Tickets Fechados": closed,
    },
  ];
}

function exportAlarmRows(alarms: Alarm[]) {
  return alarms.map((a) => ({
    "ID": a.id,
    "Data": a.date,
    "Hora": a.time,
    "Torre": a.towerName,
    "Tower ID": a.towerId,
    "Vendor": a.vendor,
    "Título": a.title,
    "Severidade": a.severity,
    "Estado": a.status,
  }));
}

function exportToXlsx(
  rows: SiteExportRow[],
  alarms: Alarm[],
  tickets: any[],
  fromDate: string,
  toDate: string,
) {
  const workbook = XLSX.utils.book_new();

  // =====================================================
  // ABA 1 — RESUMO POR SITE
  // =====================================================

  const siteData = exportRowsToSheetData(rows);
  const siteWorksheet = XLSX.utils.json_to_sheet(siteData);

  siteWorksheet["!cols"] = [
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 30 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    siteWorksheet,
    "Alarmes por Site",
  );

  // =====================================================
  // ABA 2 — RESUMO DE TICKETS
  // =====================================================

  const ticketSummary = buildTicketSummary(
    tickets,
    fromDate,
    toDate,
  );

  const ticketWorksheet = XLSX.utils.json_to_sheet(ticketSummary);

  ticketWorksheet["!cols"] = [
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    ticketWorksheet,
    "Resumo de Tickets",
  );

  // =====================================================
  // ABA 3 — TODOS OS ALARMES
  // =====================================================

  const filteredAlarms = alarms.filter((a) =>
    isDateInRange(a.date, fromDate, toDate),
  );

  const alarmData = exportAlarmRows(filteredAlarms);
  const alarmWorksheet = XLSX.utils.json_to_sheet(alarmData);

  alarmWorksheet["!cols"] = [
    { wch: 38 },
    { wch: 14 },
    { wch: 10 },
    { wch: 24 },
    { wch: 38 },
    { wch: 14 },
    { wch: 60 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    alarmWorksheet,
    "Todos os Alarmes",
  );

  // =====================================================
  // DOWNLOAD
  // =====================================================

  const wbout = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([wbout], {
    type: "application/octet-stream",
  });

  downloadBlob(
    blob,
    `relatorio_${fromDate || "inicio"}_a_${toDate || "hoje"}.xlsx`,
  );
}

function exportToCsv(
  rows: SiteExportRow[],
  alarms: Alarm[],
  tickets: any[],
  fromDate: string,
  toDate: string,
) {
  const suffix = `${fromDate || "inicio"}_a_${toDate || "hoje"}`;

  // =====================================================
  // 1. RESUMO DE TICKETS
  // =====================================================

  const ticketSummary = buildTicketSummary(
    tickets,
    fromDate,
    toDate,
  );

  const ticketWorksheet = XLSX.utils.json_to_sheet(ticketSummary);
  const ticketCsv = XLSX.utils.sheet_to_csv(ticketWorksheet);

  downloadBlob(
    new Blob(["\uFEFF" + ticketCsv], {
      type: "text/csv;charset=utf-8;",
    }),
    `relatorio_${suffix}_resumo_tickets.csv`,
  );

  // =====================================================
  // 2. ALARMES POR SITE
  // =====================================================

  const siteData = exportRowsToSheetData(rows);
  const siteWorksheet = XLSX.utils.json_to_sheet(siteData);
  const siteCsv = XLSX.utils.sheet_to_csv(siteWorksheet);

  downloadBlob(
    new Blob(["\uFEFF" + siteCsv], {
      type: "text/csv;charset=utf-8;",
    }),
    `relatorio_${suffix}_alarmes_por_site.csv`,
  );

  // =====================================================
  // 3. TODOS OS ALARMES
  // =====================================================

  const filteredAlarms = alarms.filter((a) =>
    isDateInRange(a.date, fromDate, toDate),
  );

  const alarmData = exportAlarmRows(filteredAlarms);
  const alarmWorksheet = XLSX.utils.json_to_sheet(alarmData);
  const alarmCsv = XLSX.utils.sheet_to_csv(alarmWorksheet);

  downloadBlob(
    new Blob(["\uFEFF" + alarmCsv], {
      type: "text/csv;charset=utf-8;",
    }),
    `relatorio_${suffix}_todos_os_alarmes.csv`,
  );
}

function AlarmesPage() {
  const { alarms, active, tickets, ticketsLoading, ticketsError } = useAlarms();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Alarm | null>(null);
  const [filter, setFilter] = useState<"all" | AlarmSeverity>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const grupos = useMemo(() => {
    const source = filter === "all" ? active : active.filter((a) => a.severity === filter);
    return groupByKey(source);
  }, [active, filter]);

  // Torres carregadas só para o export (nome + IP) — não duplica o que já
  // existe no AlarmsProvider porque este não expõe a lista de towers.
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  const towersById = useMemo(() => {
    const raw = towersQuery.data;
    const list = raw && "data" in raw ? raw.data : Array.isArray(raw) ? raw : [];
    return new Map(list.map((t) => [t.tower_id, { name: t.name, ip: t.snmp_target || undefined }]));
  }, [towersQuery.data]);

  const exportRows = useMemo(
    () => buildSiteExportRows(alarms, towersById, fromDate, toDate),
    [alarms, towersById, fromDate, toDate],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Alarmes & Tickets</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {active.length} alarmes activos · {grupos.length} agrupados por assinatura
          </p>
        </div>
      </div>

      {/* Export por período — resumo por site, para enviar ao NOC */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Exportar alarmes por período</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">De</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Até</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs bg-muted/30 border border-border rounded-md px-2 py-1.5"
            />
          </div>
          <button
            onClick={() => exportToCsv(exportRows, alarms, tickets, fromDate, toDate)}
            disabled={exportRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-card border border-border text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <button
            onClick={() =>
                exportToXlsx(
                  exportRows,
                  alarms,
                  tickets,
                  fromDate,
                  toDate,
                )
              }
            disabled={exportRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-azul text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <span className="text-[11px] text-muted-foreground">
            {exportRows.length === 0
              ? "Sem alarmes no período selecionado"
              : `${exportRows.length} sites · ${exportRows.reduce((s, r) => s + r.total, 0)} alarmes`}
          </span>
        </div>
        {!fromDate && !toDate && (
          <p className="text-[11px] text-muted-foreground">
            Sem período definido, exporta o histórico completo disponível.
          </p>
        )}
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
                            <span className="font-mono">{a.towerName}</span>
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
            {ticketsLoading && <div className="p-8 text-center text-xs text-muted-foreground">A carregar tickets...</div>}
            {ticketsError && <div className="p-8 text-center text-xs text-offline">Sem acesso aos tickets (auth necessária).</div>}
            {!ticketsLoading && tickets.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">Sem tickets registados.</div>
            )}
            {tickets.length > 0 && (
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
                  {tickets.map((t) => (
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