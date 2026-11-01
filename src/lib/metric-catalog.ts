import type { ApiMetric } from "@/lib/api";

/**
 * Catálogo de métricas SNMP conhecidas pelo towercore.
 * Chaves presentes no payload de ApiMetric.metrics; qualquer chave fora do
 * catálogo é apresentada com o nome técnico (underscores → espaços) — nunca
 * escondida nem traduzida à força.
 */
export interface MetricDef {
  label: string;
  unit: string;
  decimals: number;
}

export const METRIC_CATALOG: Record<string, MetricDef> = {
  mains_voltage_l1_v: { label: "Tensão rede — fase L1", unit: "V", decimals: 1 },
  mains_voltage_l2_v: { label: "Tensão rede — fase L2", unit: "V", decimals: 1 },
  mains_voltage_l3_v: { label: "Tensão rede — fase L3", unit: "V", decimals: 1 },
  mains_status: { label: "Rede eléctrica presente (1=sim)", unit: "", decimals: 0 },
  load_current_a: { label: "Corrente de carga DC", unit: "A", decimals: 2 },
  battery_voltage_v: { label: "Tensão bateria", unit: "V", decimals: 2 },
  battery_soc: { label: "Bateria — estado de carga (SoC)", unit: "%", decimals: 1 },
  battery_soc_pct: { label: "Bateria — estado de carga (SoC)", unit: "%", decimals: 1 },
  battery_total_ah: { label: "Bateria — capacidade total", unit: "Ah", decimals: 0 },
  battery_remaining_ah: { label: "Bateria — carga restante", unit: "Ah", decimals: 0 },
  battery_temperature_c: { label: "Temperatura bateria", unit: "°C", decimals: 1 },
  controller_temperature_c: { label: "Temperatura controlador", unit: "°C", decimals: 1 },
  rectifier_1_input_v: { label: "Rectificador 1 — tensão entrada", unit: "V", decimals: 1 },
  rectifier_2_input_v: { label: "Rectificador 2 — tensão entrada", unit: "V", decimals: 1 },
  rectifier_3_input_v: { label: "Rectificador 3 — tensão entrada", unit: "V", decimals: 1 },
  rectifier_1_status: { label: "Rectificador 1 — estado (1=OK)", unit: "", decimals: 0 },
  rectifier_2_status: { label: "Rectificador 2 — estado (1=OK)", unit: "", decimals: 0 },
  rectifier_3_status: { label: "Rectificador 3 — estado (1=OK)", unit: "", decimals: 0 },
};

export function metricDef(key: string): MetricDef {
  const known = METRIC_CATALOG[key];
  if (known) return known;
  return {
    label: key.replace(/_/g, " "),
    unit: "",
    decimals: 1,
  };
}

/**
 * Chaves métricas realmente presentes nos dados coletados (com pelo menos
 * um valor numérico). A ordem segue o catálogo, depois as desconhecidas
 * por ordem alfabética — para o selector de histórico ficar estável.
 */
export function metricKeysOf(metrics: ApiMetric[]): string[] {
  const numeric = new Set<string>();
  for (const m of metrics) {
    for (const [k, v] of Object.entries(m.metrics ?? {})) {
      if (typeof v === "number" && !Number.isNaN(v)) numeric.add(k);
    }
  }
  const catalogOrder = Object.keys(METRIC_CATALOG).filter((k) => numeric.has(k));
  const rest = [...numeric].filter((k) => !METRIC_CATALOG[k]).sort();
  return [...catalogOrder, ...rest];
}

export type MetricPoint = { t: string; label: string; valor: number | null };

/** Série temporal de uma métrica (valores não numéricos ficam null). */
export function seriesForKey(metrics: ApiMetric[], key: string): MetricPoint[] {
  return metrics
    .slice()
    .sort((a, b) => new Date(a.collected_at).getTime() - new Date(b.collected_at).getTime())
    .map((m) => {
      const v = (m.metrics ?? {})[key];
      return {
        t: new Date(m.collected_at).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        label: m.collected_at,
        valor: typeof v === "number" && !Number.isNaN(v) ? v : null,
      };
    });
}

export interface MetricStats {
  count: number;
  latest: number | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  /** Primeira e última coleta com valor real, para mostrar a janela efectiva. */
  firstAt?: string;
  lastAt?: string;
}

export function statsForPoint(points: MetricPoint[]): MetricStats {
  const vals = points.filter((p) => p.valor !== null) as Array<MetricPoint & { valor: number }>;
  if (vals.length === 0) return { count: 0, latest: null, min: null, max: null, avg: null };
  const numbers = vals.map((p) => p.valor);
  const sum = numbers.reduce((a, b) => a + b, 0);
  return {
    count: vals.length,
    latest: numbers[numbers.length - 1],
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    avg: sum / numbers.length,
    firstAt: vals[0].label,
    lastAt: vals[vals.length - 1].label,
  };
}
