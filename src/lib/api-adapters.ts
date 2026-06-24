import type {
  AlarmSeverity,
  ApiEvent,
  ApiMetric,
  ApiOperator,
  ApiRegion,
  ApiTicket,
  ApiTower,
  EventType,
  TowerStatus,
} from "@/lib/api";

export type UiTower = {
  id: string;
  nome: string;
  local: string;
  status: TowerStatus;
  vendor: string;
  disp30d: number;
  ip: string;
  lat: number;
  lng: number;
  regiao: string;
  regiaoId: string;
  operador: string;
  operadorId: string;
  snmpVersion: "v2c" | "v3";
  ultimaManut: string;
  signalStrength: number;
  voltage: number;
  temperatura: number;
  uptime: string;
};

export type AlarmStatus = "active" | "ack" | "closed";

export type Alarm = {
  id: string;
  severity: AlarmSeverity;
  title: string;
  torre: string;
  vendor: string;
  time: string;
  date: string;
  status: AlarmStatus;
};

export type UiEvent = {
  id: string;
  tipo: EventType;
  title: string;
  date: string;
  time: string;
  severity?: AlarmSeverity;
};

export type RegionStat = {
  regiao: string;
  regiaoId: string;
  torres: number;
  online: number;
  degradadas: number;
  offline: number;
  valor: number;
};

const regionCentres: Record<string, [number, number]> = {
  luanda: [-8.839, 13.289],
  huambo: [-12.776, 15.739],
  bie: [-12.383, 16.933],
  "bié": [-12.383, 16.933],
  cabinda: [-5.56, 12.19],
  benguela: [-12.58, 13.41],
};

export const queryKeys = {
  towers: ["towers"] as const,
  tower: (id: string) => ["tower", id] as const,
  regions: ["regions"] as const,
  operators: ["operators"] as const,
  sla: ["sla"] as const,
  tickets: ["tickets"] as const,
  metrics: (towerId?: string) => ["metrics", towerId ?? "all"] as const,
  events: (towerId: string) => ["tower-events", towerId] as const,
};

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Não foi possível carregar dados da API.";
}

export function toUiTower(
  tower: ApiTower,
  refs: { regions?: ApiRegion[]; operators?: ApiOperator[]; latestMetric?: ApiMetric } = {},
): UiTower {
  const region = refs.regions?.find((r) => r.region_id === tower.region_id);
  const operator = refs.operators?.find((o) => o.operator_id === tower.operator_id);
  const regionName = region?.name ?? tower.region_id;
  const [lat, lng] = readCoords(tower, region, regionName);
  const latestMetric = refs.latestMetric;

  return {
    id: tower.tower_id,
    nome: tower.name,
    local: readString(tower, ["local", "location", "city"]) ?? tower.name,
    status: tower.status,
    vendor: tower.vendor,
    disp30d: tower.availability_30d,
    ip: tower.snmp_target || "—",
    lat,
    lng,
    regiao: regionName,
    regiaoId: tower.region_id,
    operador: operator?.name ?? operator?.code ?? tower.operator_id,
    operadorId: tower.operator_id,
    snmpVersion: tower.snmp_version,
    ultimaManut: formatDate(tower.updated_at),
    signalStrength: readNumber(latestMetric, ["signal_strength", "rssi"]) ?? readNumber(tower, ["signal_strength", "rssi"]) ?? 0,
    voltage: readNumber(latestMetric, ["voltage"]) ?? readNumber(tower, ["voltage"]) ?? 0,
    temperatura: readNumber(latestMetric, ["temperature", "temperatura"]) ?? readNumber(tower, ["temperature", "temperatura"]) ?? 0,
    uptime: readString(latestMetric, ["uptime"]) ?? readString(tower, ["uptime"]) ?? "—",
  };
}

export function toAlarm(ticket: ApiTicket, tower?: ApiTower): Alarm {
  const created = splitDateTime(ticket.created_at);
  return {
    id: ticket.ticket_id,
    severity: inferSeverity(ticket.message, tower?.status),
    title: ticket.message,
    torre: ticket.tower_id,
    vendor: tower?.vendor ?? "—",
    date: created.date,
    time: created.time,
    status: ticket.status === "closed" ? "closed" : ticket.status === "acknowledged" ? "ack" : "active",
  };
}

export function toEvent(event: ApiEvent): UiEvent {
  const occurred = splitDateTime(event.occurred_at);
  return {
    id: event.event_id,
    tipo: event.type,
    title: event.message,
    date: occurred.date,
    time: occurred.time,
    severity: event.severity,
  };
}

export function buildRegionStats(towers: UiTower[], regions: ApiRegion[] = []): RegionStat[] {
  const regionNames = new Map(regions.map((r) => [r.region_id, r.name]));
  const byRegion = new Map<string, RegionStat>();

  for (const tower of towers) {
    const current = byRegion.get(tower.regiaoId) ?? {
      regiao: regionNames.get(tower.regiaoId) ?? tower.regiao,
      regiaoId: tower.regiaoId,
      torres: 0,
      online: 0,
      degradadas: 0,
      offline: 0,
      valor: 0,
    };
    current.torres += 1;
    current.online += tower.status === "online" ? 1 : 0;
    current.degradadas += tower.status === "degraded" ? 1 : 0;
    current.offline += tower.status === "offline" ? 1 : 0;
    current.valor += tower.disp30d;
    byRegion.set(tower.regiaoId, current);
  }

  return Array.from(byRegion.values()).map((r) => ({
    ...r,
    valor: r.torres ? r.valor / r.torres : 0,
  }));
}

export function splitDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value || "—", time: "—" };
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toISOString().slice(0, 10);
}

function inferSeverity(message: string, status?: TowerStatus): AlarmSeverity {
  const text = message.toLowerCase();
  if (status === "offline" || /critical|crítico|falha|offline|down|unreachable/.test(text)) return "critical";
  if (status === "degraded" || /warning|aviso|degrad|baixo|fora/.test(text)) return "warning";
  return "info";
}

function readCoords(tower: ApiTower, region: ApiRegion | undefined, regionName: string): [number, number] {
  const lat = readNumber(tower, ["lat", "latitude"]) ?? readNumber(region, ["lat", "latitude"]);
  const lng = readNumber(tower, ["lng", "lon", "longitude"]) ?? readNumber(region, ["lng", "lon", "longitude"]);
  if (lat !== undefined && lng !== undefined) return [lat, lng];

  const key = normalize(regionName);
  return regionCentres[key] ?? [-11.2, 17.8];
}

function readString(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
