import type { ApiEvent, ApiMetric, ApiTower } from "@/lib/api";

function formatDateTimeUtc(value: string | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

/**
 * Exportação de dados — geração 100% client-side a partir dos dados já
 * carregados da API. Nada é inventado: uma coluna sem valor sai vazia no
 * CSV (nunca "0" nem "N/A" fingido).
 *
 * Regra de entrega (user activation): os dados são gerados ANTES do clique
 * ficar pronto (queries React) e o clique chama deliverFile sincronamente —
 * necessário para iOS/Safari, que perdem a user activation após um await.
 */

export function timestampName(base: string, ext: string): string {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("") + "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
  return `${base}-${stamp}.${ext}`;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  // Aspas apenas quando necessário; dentro do valor, duplica aspas.
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(";")];
  for (const row of rows) lines.push(row.map(csvCell).join(";"));
  // BOM para o Excel reconhecer UTF-8 (pt-PT tem acentos).
  return "\uFEFF" + lines.join("\r\n");
}

export function downloadText(content: string, filename: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** CSV de histórico de métricas: uma linha por coleta, uma coluna por métrica. */
export function metricsHistoryCsv(metrics: ApiMetric[], metricKeys: string[]): string {
  const headers = ["coletado_em", ...metricKeys];
  const rows = metrics
    .slice()
    .sort((a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime())
    .map((m) => [
      formatDateTimeUtc(m.collected_at),
      ...metricKeys.map((k) => (m.metrics ?? {})[k] ?? ""),
    ]);
  return toCsv(headers, rows);
}

/** CSV de eventos/alarmes de uma torre (ou feed global). */
export function eventsCsv(events: ApiEvent[]): string {
  const headers = ["ocorrido_em", "tipo", "severidade", "mensagem", "torre_id", "evento_id"];
  const rows = events
    .slice()
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .map((e) => [formatDateTimeUtc(e.occurred_at), e.type, e.severity, e.message, e.tower_id, e.event_id]);
  return toCsv(headers, rows);
}

/** CSV do inventário de sites. */
export function towersCsv(towers: ApiTower[]): string {
  const headers = [
    "tower_id", "nome", "estado", "vendor", "regiao_id", "operador_id",
    "snmp_habilitado", "snmp_version", "snmp_target",
    "latitude", "longitude", "disponibilidade_30d", "disponibilidade_7d",
    "criado_em", "actualizado_em",
  ];
  const rows = towers.map((t) => [
    t.tower_id, t.name, t.status, t.vendor, t.region_id, t.operator_id,
    t.snmp_enabled, t.snmp_version, t.snmp_target,
    t.latitude ?? "", t.longitude ?? "",
    t.availability_30d ?? "", t.availability_7d ?? "",
    formatDateTimeUtc(t.created_at), formatDateTimeUtc(t.updated_at),
  ]);
  return toCsv(headers, rows);
}

export function ticketsCsv(tickets: Array<Record<string, unknown>>): string {
  const headers = ["ticket_id", "torre_id", "evento_id", "estado", "criado_em", "acked_em", "fechado_em"];
  const rows = tickets.map((t) => [
    t.ticket_id, t.tower_id, t.event_id, t.status,
    formatDateTimeUtc(t.created_at as string | undefined),
    formatDateTimeUtc(t.acknowledged_at as string | undefined),
    formatDateTimeUtc(t.closed_at as string | undefined),
  ]);
  return toCsv(headers, rows);
}
