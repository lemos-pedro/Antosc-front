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

/**
 * UiTower
 *
 * Campos obrigatórios: cobertos pelo contrato api.md (GET /towers, GET /towers/{id})
 * ou derivados de referências já disponíveis (regions, operators, metrics).
 *
 * Campos opcionais (`?:`): NÃO existem ainda no contrato api.md. Ficam `undefined`
 * até o backend expor os endpoints/campos correspondentes. NUNCA preencher com
 * valores gerados artificialmente (rand/seed) — isso mistura dados reais com
 * fictícios sem qualquer sinalização visual, o que é inaceitável num sistema
 * de monitorização operacional.
 *
 * Quando o backend expuser cada bloco, mover o campo para a secção obrigatória
 * e ligar a fonte real (latestMetric, novo endpoint, etc.) — ver TODOs abaixo.
 */
export type UiTower = {
  id: string;
  name: string;
  local: string;
  status: TowerStatus;
  vendor: string;
  /**
   * Disponibilidade 30d: `null` quando o backend não sabe. NUNCA usar `0`
   * ou `100` como fallback — camuflaria o gap de dados. A UI formata via
   * `fmtPct` (mostra "—") em vez de `.toFixed()` cru.
   */
  disp30d: number | null;
  ip?: string;
  latitude: number;
  longitude: number;
  regiao: string;
  regiaoId: string;
  /**
   * Lista de operadores presentes na torre (N:N via site_operators).
   * Um site pode ter mais de um operador, cada um com o seu
   * armário/equipamento próprio. Fonte real: tower.operators do backend,
   * com fallback para o operador legado (tower.operator_id) enquanto
   * nem todas as torres tiverem sido migradas para site_operators.
   */
  operadores: { id: string; name: string; code: string }[];
  operadorId: string;
  snmpVersion: "v2c" | "v3";
  ultimaManut: string;
  signalStrength?: number;
  voltage?: number;
  temperatura?: number;
  uptime?: string;

  // --- Abaixo: sem cobertura em api.md hoje. Todos opcionais. ---

  // 1. Identificação / Localização — pendente: sem endpoint/campo dedicado
  siteId?: string;
  siteLevel?: "Macro" | "Micro";
  siteCategory?: "Urbano" | "Rural";
  loadWorkLevel?: "Alta" | "Média" | "Baixa";
  endereco?: string;
  electricMeterId?: string;

  // 2. Estado — pendente: schema `towers` não tem colunas de SLA por torre
  disp7d?: number;
  lastSeenAt?: string;
  updatedAt: string; // já vem de tower.updated_at, mantido obrigatório
  slaTarget?: number; // pendente: sem coluna no schema
  slaStatus?: "dentro" | "fora";
  activeAlarms?: number; // pendente: agregação de GET /towers/{id}/events
  activeFailures?: number;

  // 3. Energia — vem de ApiMetric.metrics (ver toUiTower)
  current?: number;
  batteryVoltage?: number;
  batterySoh?: number;
  batterySoc?: number;
  batteryTemperature?: number;
  batteryBackupEstimate?: string;
  generatorStatus?: "ligado" | "desligado" | "erro";
  generatorFuelLevel?: number;
  generatorRuntimeHours?: number;
  mainsStatus?: "presente" | "ausente";
  rectifierStatus?: "ok" | "alarme";
  powerSourceActive?: "rede" | "gerador" | "bateria";
  fuelTheftAlert?: boolean;

  // 5. Ambiente / Shelter — pendente: sem sensores mapeados no payload de métricas
  humidity?: number;
  doorOpenAlarm?: boolean;
  smokeAlarm?: boolean;
  acStatus?: "ligado" | "desligado" | "erro";

  // 6. Sinal / Rede — pendente: sem campo dedicado no payload de métricas
  linkStatus?: "up" | "down" | "degraded";
  bandwidthUtilization?: number;

  // 8. SLA / Manutenção — pendente: schema `towers` só tem availability_30d
  // (valor escalar), não há colunas de MTTR/MTBF/downtime por torre
  availabilityPercent?: number | null;
  mttrHours?: number;
  mtbfHours?: number;
  downtimeMinutes?: number;
  plannedMaintMinutes?: number;
};

export type AlarmStatus = "active" | "ack" | "closed";

export type Alarm = {
  id: string;
  eventId: string;
  towerId: string;
  towerName: string;
  severity: AlarmSeverity;
  title: string;
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
  /**
   * Média de availability_30d nas torres elegíveis da região.
   * `null` quando nenhuma torre da região tem dado real — evita 0%/NaN%.
   */
  valor: number | null;
  elegiveis: number;
};

const regionCentres: Record<string, [number, number]> = {
  luanda: [-8.839, 13.289],
  huambo: [-12.776, 15.739],
  bie: [-12.383, 16.933],
  "biÃ©": [-12.383, 16.933],
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
  generator: (towerId: string) => ["tower-generator", towerId] as const,
};

export function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Não foi possível carregar dados da API.";
}


export function formatGenerator(g?: import("@/lib/api").ApiGeneratorReading) {
  if (!g) return undefined;
  return {
    fuelLiters: g.FuelLiters,
    fuelPercent: g.FuelPercent,
    batteryVoltage: g.BatteryVoltageV,
    runHoursTotal: g.RunHoursTotal,
    collectedAt: g.CollectedAt,
  };
}

/**
 * Mapeia ApiTower (+ referências reais já carregadas) para UiTower.
 *
 * Importante: nenhum campo é inventado. Se o dado não vier da API, o campo
 * fica undefined e a UI é responsável por mostrar um estado "sem dados"
 * explícito (ex.: "—", ícone de indisponível), nunca um valor plausível.
 *
 * Regra de leitura:
 * - Campos vindos de ApiTower (dados estáticos da torre) → readNumber / readString / readBoolean
 * - Campos vindos de ApiMetric.metrics (métricas SNMP)    → readMetricNumber / readMetricString / readMetricBoolean
 * Nunca misturar as duas estruturas.
 */
export function toUiTower(
  tower: ApiTower,
  refs: {
    regions?: ApiRegion[];
    operators?: ApiOperator[];
    latestMetric?: ApiMetric;
  } = {},
): UiTower {
  const region = refs.regions?.find((r) => r.region_id === tower.region_id);
  const operator = refs.operators?.find((o) => o.operator_id === tower.operator_id);
  const regionName = region?.name ?? tower.region_id;
  const [lat, lng] = readCoords(tower, region, regionName);
  const latestMetric = refs.latestMetric;

  return {
    id: tower.tower_id,
    name: tower.name,
    local: readString(tower, ["local", "location", "city"]) ?? tower.name,
    status: tower.status,
    vendor: tower.vendor,
    disp30d: tower.availability_30d,
    ip: tower.snmp_target || undefined,
    latitude: lat,
    longitude: lng,
    regiao: regionName,
    regiaoId: tower.region_id,
    operadorId: tower.operator_id,

    operadores: tower.operators?.length
      ? tower.operators.map((o) => ({
          id: o.operator_id,
          name: o.name,
          code: o.code,
        }))
      : operator
        ? [{
            id: operator.operator_id,
            name: operator.name,
            code: operator.code,
          }]
        : [],

    snmpVersion: tower.snmp_version,
    ultimaManut: formatDate(tower.updated_at),
    updatedAt: tower.updated_at,

    // Atualmente o backend não fornece RSSI
    signalStrength: undefined,

    // ======== MÉTRICAS SNMP (ApiMetric.metrics) ========

    // "voltage" alimenta o campo rotulado "Tensão AC" no TorreDetailModal.
    // CORRIGIDO (2026-07-09): lia battery_voltage_v (barramento DC,
    // ~52-58V) em vez da tensão de rede real. Confirmado por SNMP walk
    // empírico contra site LDVIA015/192.168.203.5: mains_voltage_l1_v
    // devolveu ~220V, consistente com rede AC ; battery_voltage_v
    // é uma grandeza completamente diferente. Fallback para L2/L3 caso L1
    // não venha nesse ciclo (ex.: falha isolada na fase 1).
    voltage:
      tower.dc_output_voltage ??
      readMetricNumber(latestMetric, [
        "mains_voltage_l1_v",
        "mains_voltage_l2_v",
        "mains_voltage_l3_v",
      ]),

    temperatura:
      readMetricNumber(latestMetric, ["controller_temperature_c"]) ??
      readMetricNumber(latestMetric, ["battery_temperature_c"]),

    uptime: readMetricString(latestMetric, ["uptime"]),

    // ---------- Dados do Site (ApiTower) ----------
    siteId: readString(tower, ["site_id"]),
    siteLevel: readString(tower, ["site_level"]) as UiTower["siteLevel"],
    siteCategory: readString(tower, ["site_category"]) as UiTower["siteCategory"],
    loadWorkLevel: readString(tower, ["load_work_level"]) as UiTower["loadWorkLevel"],
    endereco: readString(tower, ["endereco", "address"]),
    electricMeterId: readString(tower, ["electric_meter_id"]),

    // ---------- SLA (ApiTower) — sem colunas no schema hoje, fica undefined ----------
    disp7d: readNumber(tower, ["disp7d", "availability_7d"]),
    lastSeenAt: readString(tower, ["last_seen_at"]),
    slaTarget: readNumber(tower, ["sla_target"]),
    slaStatus: readString(tower, ["sla_status"]) as UiTower["slaStatus"],
    activeAlarms: readNumber(tower, ["active_alarms"]),
    activeFailures: readNumber(tower, ["active_failures"]),

    // ---------- Energia (ApiMetric.metrics) ----------
    current: tower.dc_load_current ?? readMetricNumber(latestMetric, ["load_current_a"]),

    // batteryVoltage continua a ler battery_voltage_v corretamente — este
    // campo é para isso mesmo (tensão de bateria), diferente de "voltage"
    // acima, que é tensão AC de rede. Não confundir os dois no futuro.
  batteryVoltage: readMetricNumber(latestMetric, ["battery_voltage_v"]),
  
    batterySoh: tower.battery_soh,

    batterySoc: tower.battery_soc ?? computeBatterySoc(latestMetric),


    batteryTemperature: readMetricNumber(latestMetric, ["battery_temperature_c"]),

      batteryBackupEstimate:
      tower.battery_backup_time_h !== undefined
        ? `${tower.battery_backup_time_h.toFixed(2)}h`
        : undefined,

    generatorStatus: undefined,
    generatorFuelLevel: undefined,
    generatorRuntimeHours: undefined,

   mainsStatus:
    readMetricNumber(latestMetric, ["mains_status"]) === 1
      ? "presente"
      : "ausente",
      
    rectifierStatus: [
      readMetricNumber(latestMetric, ["rectifier_1_status"]),
      readMetricNumber(latestMetric, ["rectifier_2_status"]),
      readMetricNumber(latestMetric, ["rectifier_3_status"]),
    ].every((s) => s === 1 || s === undefined)
      ? "ok"
      : "alarme",

    powerSourceActive: undefined,
    fuelTheftAlert: undefined,

    // ---------- Ambiente / Shelter — sem sensores no payload de métricas ----------
    humidity: undefined,
    doorOpenAlarm: undefined,
    smokeAlarm: undefined,
    acStatus: undefined,

    // ---------- Sinal / Rede — sem campo dedicado no payload de métricas ----------
    linkStatus: undefined,
    bandwidthUtilization: undefined,

    // ---------- SLA / Manutenção (ApiTower) — sem colunas no schema hoje ----------
    availabilityPercent: tower.availability_30d,
    mttrHours: readNumber(tower, ["mttr_hours"]),
    mtbfHours: readNumber(tower, ["mtbf_hours"]),
    downtimeMinutes: readNumber(tower, ["downtime_minutes"]),
    plannedMaintMinutes: readNumber(tower, ["planned_maint_minutes"]),
  };
}

// mappers.ts
export function toAlarm(ticket: ApiTicket, tower?: ApiTower, event?: ApiEvent): Alarm {
  const created = splitDateTime(ticket.created_at);
  return {
    id: ticket.ticket_id,
    eventId: ticket.event_id,
    towerId: ticket.tower_id,                                          // adicionado
    towerName: ticket.tower_name || tower?.name || ticket.tower_id,     // renomeado de "torre"
    severity: event?.severity ?? "info",
    title: event?.message ?? "Sem descrição do evento associado",
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
      elegiveis: 0,
    };
    current.torres += 1;
    current.online += tower.status === "online" ? 1 : 0;
    current.degradadas += tower.status === "degraded" ? 1 : 0;
    current.offline += tower.status === "offline" ? 1 : 0;
    if (tower.disp30d != null && !Number.isNaN(tower.disp30d)) {
      current.valor = (current.valor ?? 0) + tower.disp30d;
      current.elegiveis += 1;
    }
    byRegion.set(tower.regiaoId, current);
  }

  return Array.from(byRegion.values()).map((r) => ({
    ...r,
    // valor null quando nenhuma torre da região tem availability_30d — evita
    // NaN% / 0% inventado. UI formata via fmtPct.
    valor: r.elegiveis > 0 && r.valor != null ? r.valor / r.elegiveis : null,
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

function inferSeverity(message?: string, status?: TowerStatus): AlarmSeverity {
  const text = (message ?? "").toLowerCase();

  if (!text && !status) return "info";

  if (status === "offline" || /critical|crítico|falha|offline|down|unreachable/.test(text)) {
    return "critical";
  }

  if (status === "degraded" || /warning|aviso|degrad|baixo|fora/.test(text)) {
    return "warning";
  }

  return "info";
}

function readCoords(tower: ApiTower, region: ApiRegion | undefined, regionName: string): [number, number] {
  const lat = readNumber(tower, ["lat", "latitude"]) ?? readNumber(region, ["lat", "latitude"]);
  const lng = readNumber(tower, ["lng", "lon", "longitude"]) ?? readNumber(region, ["lng", "lon", "longitude"]);
  if (lat !== undefined && lng !== undefined) return [lat, lng];

  const key = normalize(regionName);
  return regionCentres[key] ?? [-11.2, 17.8];
}

/**
 * Cálculo derivado de SoC (state of charge) a partir das métricas SNMP.
 * Mantido fora de toUiTower para que o mapeador não carregue lógica de negócio.
 */
function computeBatterySoc(metric: ApiMetric | undefined): number | undefined {
  const total = readMetricNumber(metric, ["battery_total_ah"]);
  const remaining = readMetricNumber(metric, ["battery_remaining_ah"]);

  if (total && remaining !== undefined) {
    return (remaining / total) * 100;
  }

  return undefined;
}

// ========================================================================
// Leitoras de ApiTower / objetos genéricos (tower, region)
// ========================================================================

function readNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && !isNaN(Number(value))) return Number(value);
  }
  return undefined;
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

function readBoolean(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

// ========================================================================
// Leitoras de ApiMetric (exclusivas para metric.metrics — métricas SNMP)
// ========================================================================

function readMetricNumber(metric: ApiMetric | undefined, keys: string[]) {
  if (!metric?.metrics) return undefined;
  for (const key of keys) {
    const value = metric.metrics[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && !isNaN(Number(value))) return Number(value);
  }
  return undefined;
}

function readMetricString(metric: ApiMetric | undefined, keys: string[]) {
  if (!metric?.metrics) return undefined;
  for (const key of keys) {
    const value = metric.metrics[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function readMetricBoolean(metric: ApiMetric | undefined, keys: string[]) {
  if (!metric?.metrics) return undefined;
  for (const key of keys) {
    const value = metric.metrics[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}