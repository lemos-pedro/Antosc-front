export const NO_DATA = "—";

export function fmtNum(value: number | undefined, decimals = 1, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${value.toFixed(decimals)}${unit}`;
}

export function fmtInt(value: number | undefined, unit = ""): string {
  if (value === undefined || value === null || Number.isNaN(value)) return NO_DATA;
  return `${Math.round(value)}${unit}`;
}

export function fmtStr(value: string | undefined | null): string {
  return value && value.trim() ? value : NO_DATA;
}

export function fmtBool(value: boolean | undefined, yes = "Sim", no = "Não"): string {
  if (value === undefined) return NO_DATA;
  return value ? yes : no;
}

export function fmtDateTime(value: string | undefined): string {
  if (!value) return NO_DATA;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return NO_DATA;
  return d.toLocaleString("pt-PT");
}

/**
 * fmtPct — formata percentagens sem inventar valores.
 * Devolve "—" para null / undefined / NaN em vez de 0% ou 100% falsos.
 */
export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_DATA;
  return `${value.toFixed(decimals)}%`;
}