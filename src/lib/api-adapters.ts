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
  // 1. Identificação / Localização
  siteId: string;
  siteLevel: "Macro" | "Micro";
  siteCategory: "Urbano" | "Rural";
  loadWorkLevel: "Alta" | "Média" | "Baixa";
  endereco: string;
  electricMeterId: string;
  // 2. Estado
  disp7d: number;
  lastSeenAt: string;
  updatedAt: string;
  slaTarget: number;
  slaStatus: "dentro" | "fora";
  activeAlarms: number;
  activeFailures: number;
  // 3. Energia
  current: number;               // A
  batteryVoltage: number;        // V
  batterySoh: number;            // %
  batterySoc: number;            // %
  batteryTemperature: number;    // °C
  batteryBackupEstimate: string;
  generatorStatus: "ligado" | "desligado" | "erro";
  generatorFuelLevel: number;    // %
  generatorRuntimeHours: number;
  mainsStatus: "presente" | "ausente";
  rectifierStatus: "ok" | "alarme";
  powerSourceActive: "rede" | "gerador" | "bateria";
  fuelTheftAlert: boolean;
  // 5. Ambiente / Shelter
  humidity: number;              // %
  doorOpenAlarm: boolean;
  smokeAlarm: boolean;
  acStatus: "ligado" | "desligado" | "erro";
  // 6. Sinal / Rede
  linkStatus: "up" | "down" | "degraded";
  bandwidthUtilization: number;  // %
  // 8. SLA / Manutenção
  availabilityPercent: number;
  mttrHours: number;
  mtbfHours: number;
  downtimeMinutes: number;
  plannedMaintMinutes: number;
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

  const status = tower.status;
  const disp30d = tower.availability_30d;
  const seed = tower.tower_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (min: number, max: number, offset = 0) => {
    const v = ((seed * 9301 + 49297 + offset * 131) % 233280) / 233280;
    return +(min + v * (max - min)).toFixed(1);
  };
  const online = status === "online";
  const degraded = status === "degraded";
  const offline = status === "offline";

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
    siteId: readString(tower, ["site_id"]) ?? `SITE-${tower.tower_id}`,
    siteLevel: (readString(tower, ["site_level"]) as "Macro" | "Micro") ?? "Macro",
    siteCategory: (readString(tower, ["site_category"]) as "Urbano" | "Rural") ?? (rand(0, 1, 1) > 0.5 ? "Urbano" : "Rural"),
    loadWorkLevel: (readString(tower, ["load_work_level"]) as "Alta" | "Média" | "Baixa") ?? "Média",
    endereco: readString(tower, ["endereco", "address"]) ?? `${regionName}, Angola`,
    electricMeterId: readString(tower, ["electric_meter_id"]) ?? `EM-${tower.tower_id.slice(-4)}`,
    disp7d: +(disp30d - rand(0, 0.5, 2)).toFixed(2),
    lastSeenAt: offline ? formatDate(tower.updated_at) : new Date().toISOString(),
    updatedAt: tower.updated_at,
    slaTarget: 99.9,
    slaStatus: disp30d >= 99.9 ? "dentro" : "fora",
    activeAlarms: offline ? 3 : degraded ? 1 : 0,
    activeFailures: offline ? 2 : 0,
    current: offline ? 0 : rand(8, 22, 3),
    batteryVoltage: offline ? 0 : rand(50, 54, 4),
    batterySoh: offline ? rand(60, 80, 5) : rand(85, 99, 5),
    batterySoc: offline ? rand(20, 40, 6) : rand(75, 100, 6),
    batteryTemperature: rand(25, 40, 7),
    batteryBackupEstimate: offline ? "2h 10m" : `${Math.floor(rand(4, 10, 8))}h ${Math.floor(rand(0, 59, 9))}m`,
    generatorStatus: offline ? "ligado" : degraded ? "erro" : "desligado",
    generatorFuelLevel: rand(20, 90, 10),
    generatorRuntimeHours: Math.floor(rand(100, 3000, 11)),
    mainsStatus: offline ? "ausente" : "presente",
    rectifierStatus: online ? "ok" : "alarme",
    powerSourceActive: offline ? "gerador" : "rede",
    fuelTheftAlert: degraded && rand(0, 1, 12) > 0.7,
    humidity: rand(40, 75, 13),
    doorOpenAlarm: false,
    smokeAlarm: false,
    acStatus: offline ? "desligado" : online ? "ligado" : "erro",
    linkStatus: online ? "up" : degraded ? "degraded" : "down",
    bandwidthUtilization: offline ? 0 : rand(20, 85, 14),
    availabilityPercent: disp30d,
    mttrHours: +rand(1.5, 4.5, 15).toFixed(1),
    mtbfHours: Math.floor(rand(400, 900, 16)),
    downtimeMinutes: Math.floor((100 - disp30d) * 60 * 24 * 30 / 100),
    plannedMaintMinutes: Math.floor(rand(60, 240, 17)),
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
