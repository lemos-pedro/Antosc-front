/**
 * ANTOSC — towercore API v0
 * Fonte única para todos os endpoints do backend. Spec: api.md
 *
 * Alterações desta revisão:
 *  - Um único `core()` de fetch (antes havia request + requestPaginated duplicados).
 *  - Endpoints protegidos por DEFAULT (`protected: false` só em health/login).
 *    Antes, `listTowers`, `listMetrics`, etc. iam sem token -> 401 em loop.
 *  - Sem token válido, o pedido protegido NÃO sai para a rede: falha logo com 401.
 *  - 401 tratado num só sítio: limpa sessão, emite evento e redireciona para /login uma vez.
 *  - Erros são `ApiHttpError` (Error com code/status/request_id) — `err.message` funciona.
 *  - Token com expiração (`expires_at`) e opção "Lembrar-me" (local vs session storage).
 *  - Removido o bloco duplicado de Users.
 */

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "https://careless-deplored-lure.ngrok-free.dev";
// "http://localhost:8000";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export type TowerStatus = "online" | "degraded" | "offline";
export type AlarmSeverity = "info" | "warning" | "critical";
export type EventType = "failure" | "alarm" | "maintenance" | "recovery";
export type TicketStatus = "open" | "acknowledged" | "closed";

export interface ApiTowerOperator {
  operator_id: string;
  name: string;
  code: string;
}

export interface ApiTower {
  tower_id: string;
  name: string;
  status: TowerStatus;
  operator_id: string; // legado: operador "principal"
  operators?: ApiTowerOperator[]; // N:N via site_operators
  region_id: string;
  vendor: string;
  snmp_enabled: boolean;
  snmp_version: "v2c" | "v3";
  snmp_target: string;
  latitude?: number;
  longitude?: number;

  // NetEco (Huawei) — ausentes quando o site não reporta (nunca fabricar).
  dc_output_voltage?: number;
  dc_load_current?: number;
  rectifier_current?: number;
  battery_soc?: number;
  battery_soh?: number;
  battery_backup_time_h?: number;
  battery_updated_at?: string;

  availability_30d: number;
  availability_7d?: number;

  updated_at: string;
  created_at: string;
}

export interface ApiGeneratorReading {
  TowerID: string;
  FuelLiters: number;
  FuelPercent: number;
  BatteryVoltageV: number;
  RunHoursTotal: number;
  CollectedAt: string;
}

export interface ApiEvent {
  event_id: string;
  tower_id: string;
  type: EventType;
  severity: AlarmSeverity;
  message: string;
  occurred_at: string;
  created_at: string;
}

export interface ApiMetric {
  metric_id: string;
  tower_id: string;
  collected_at: string;
  created_at: string;
  metrics: Record<string, number | string | boolean>;
}

export interface ApiOperator {
  operator_id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface ApiRegion {
  region_id: string;
  name: string;
  [k: string]: unknown; // métricas agregadas vêm no GET /{region_id}
}

export interface ApiTicket {
  ticket_id: string;
  tower_id: string;
  tower_name?: string; // opcional; senão o frontend resolve via towersById
  event_id: string;
  status: TicketStatus;
  acknowledged_at?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiSlaGlobal {
  window_days: number;
  availability_percent: number;
  affected_towers: number;
}

export interface ApiAuditLog {
  id: string;
  tower_id?: string;
  user_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface ApiLoginResponse {
  token_type: "Bearer";
  access_token: string;
  expires_at: string;
  user_id: string;
  username: string; // TODO: confirmar se passou a "email" no handler real
  role: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { limit: number; offset: number; total: number };
}

export interface ApiError {
  code: string;
  message: string;
  request_id?: string;
}

export type UserRole =
  | "admin"
  | "director_tecnico"
  | "pca"
  | "operacoes"
  | "manutencao"
  | "engenharia"
  | "controller_financeiro"
  | "tecnico_manutencao";

export interface ApiUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
  updated_at?: string;
}

// ------------------------------------------------------------------
// Erro tipado
// ------------------------------------------------------------------
export class ApiHttpError extends Error implements ApiError {
  code: string;
  status: number;
  request_id?: string;

  constructor(status: number, code: string, message: string, request_id?: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.request_id = request_id;
  }
}

export const isUnauthorized = (e: unknown): boolean =>
  e instanceof ApiHttpError && e.status === 401;

// ------------------------------------------------------------------
// Auth (token + api key + expiração)
// ------------------------------------------------------------------
const TOKEN_KEY = "antosc.api.token";
const EXPIRES_KEY = "antosc.api.expires_at";
const APIKEY_KEY = "antosc.api.key";
export const UNAUTHORIZED_EVENT = "antosc:unauthorized";

const hasStorage = typeof localStorage !== "undefined";

function readStore(key: string): string | null {
  if (!hasStorage) return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

function clearStore(key: string) {
  if (!hasStorage) return;
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export const auth = {
  /** Token só é devolvido se existir E não tiver expirado. */
  get token(): string | null {
    const t = readStore(TOKEN_KEY);
    if (!t) return null;
    const exp = readStore(EXPIRES_KEY);
    if (exp && Date.parse(exp) <= Date.now()) {
      auth.clear();
      return null;
    }
    return t;
  },
  get apiKey(): string | null {
    return readStore(APIKEY_KEY);
  },
  set apiKey(v: string | null) {
    if (!hasStorage) return;
    if (v) localStorage.setItem(APIKEY_KEY, v);
    else localStorage.removeItem(APIKEY_KEY);
  },
  get isAuthenticated(): boolean {
    return !!auth.token;
  },
  /** remember=true -> localStorage; false -> sessionStorage (some ao fechar o separador). */
  save(token: string, expiresAt?: string, remember = true) {
    if (!hasStorage) return;
    auth.clear();
    const store = remember ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    if (expiresAt) store.setItem(EXPIRES_KEY, expiresAt);
  },
  clear() {
    clearStore(TOKEN_KEY);
    clearStore(EXPIRES_KEY);
  },
};

let redirecting = false;

/** Ponto único de tratamento de sessão inválida. */
function handleUnauthorized() {
  auth.clear();
  if (typeof window === "undefined") return;

  // Deixa a app limpar o cache do React Query: window.addEventListener(UNAUTHORIZED_EVENT, ...)
  window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));

  if (!redirecting && !window.location.pathname.startsWith("/login")) {
    redirecting = true;
    window.location.replace("/login");
  }
}

// ------------------------------------------------------------------
// Fetch core
// ------------------------------------------------------------------
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOpts {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Default: true. Usar `false` apenas em health e login. */
  protected?: boolean;
  raw?: boolean; // devolve Response (ex.: CSV, /metrics)
}

async function core(path: string, opts: RequestOpts = {}): Promise<Response> {
  const isProtected = opts.protected !== false;

  // Sem sessão: não gasta rede, não gera 401 em loop.
  if (isProtected && !auth.token) {
    handleUnauthorized();
    throw new ApiHttpError(401, "UNAUTHORIZED", "Sessão expirada. Inicie sessão novamente.");
  }

  const url = new URL(path, API_BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (isProtected) {
    const token = auth.token;
    if (token) headers.Authorization = `Bearer ${token}`;
    const key = auth.apiKey;
    if (key) headers["X-API-Key"] = key;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.ok) return res;

  // Desembrulha o envelope { "error": {...} } de api.md
  let code = String(res.status);
  let message = res.statusText || "Erro de pedido";
  let request_id = res.headers.get("X-Request-Id") ?? undefined;
  try {
    const body = await res.json();
    const e = body && typeof body === "object" && "error" in body ? body.error : body;
    if (e?.code) code = String(e.code);
    if (e?.message) message = String(e.message);
    if (e?.request_id) request_id = String(e.request_id);
  } catch {
    /* corpo sem JSON: mantém defaults */
  }

  // 401 num pedido protegido = sessão inválida. No login (public) é só "credenciais erradas".
  if (res.status === 401 && isProtected) handleUnauthorized();

  throw new ApiHttpError(res.status, code, message, request_id);
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await core(path, opts);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Backend pode devolver {data, meta} ou um array simples (+ X-Total-Count).
// Normaliza para Paginated<T> sem tocar no Go.
async function requestPaginated<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<Paginated<T>> {
  const res = await core(path, opts);
  const body = await res.json();

  if (body && typeof body === "object" && Array.isArray(body.data)) {
    return {
      data: body.data,
      meta: body.meta ?? { limit: body.data.length, offset: 0, total: body.data.length },
    };
  }

  if (Array.isArray(body)) {
    const header = res.headers.get("X-Total-Count");
    return {
      data: body,
      meta: {
        limit: Number(opts.query?.limit ?? body.length),
        offset: Number(opts.query?.offset ?? 0),
        total: header ? Number(header) : body.length,
      },
    };
  }

  throw new ApiHttpError(res.status, "UNEXPECTED_RESPONSE", "Resposta inesperada da API.");
}

// ------------------------------------------------------------------
// API surface
// ------------------------------------------------------------------
export const api = {
  // ---- Health & observability (públicos) ----
  health: () =>
    request<{ status: string; service: string; time: string }>("/health", { protected: false }),
  healthV1: () =>
    request<{ status: string; service: string; time: string }>("/api/v1/health", {
      protected: false,
    }),
  metricsPrometheus: () =>
    request<Response>("/metrics", { raw: true, protected: false }),

  // ---- Auth ----
  login: async (email: string, password: string, remember = true) => {
    const res = await request<ApiLoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
      protected: false,
    });
    auth.save(res.access_token, res.expires_at, remember);
    redirecting = false;
    return res;
  },
  logout: () => {
    auth.clear();
  },

  // ---- Towers ----
  listTowers: (q?: {
    status?: TowerStatus;
    operator_id?: string;
    region_id?: string;
    limit?: number;
    offset?: number;
  }) => requestPaginated<ApiTower>("/api/v1/towers", { query: q }),

  getTower: (id: string) => request<ApiTower>(`/api/v1/towers/${id}`),

  createTower: (body: {
    name: string;
    operator_id: string;
    region_id: string;
    vendor: string;
    snmp_version: "v2c" | "v3";
  }) =>
    // TODO: confirmar payload com o handler real (não está em api.md v0).
    request<ApiTower>("/api/v1/towers", { method: "POST", body }),

  configureSnmp: (
    id: string,
    body: {
      snmp_enabled: boolean;
      snmp_version: "v2c" | "v3";
      snmp_target: string;
      snmp_community?: string;
      snmp_port?: number;
    },
  ) =>
    // TODO: confirmar payload com o handler real.
    request<ApiTower>(`/api/v1/towers/${id}/snmp`, { method: "PATCH", body }),

  // ---- Tower <-> Operators (N:N) ----
  addTowerOperator: (tower_id: string, operator_id: string) =>
    request<void>(`/api/v1/towers/${tower_id}/operators`, {
      method: "POST",
      body: { operator_id },
    }),

  removeTowerOperator: (tower_id: string, operator_id: string) =>
    request<void>(`/api/v1/towers/${tower_id}/operators/${operator_id}`, {
      method: "DELETE",
    }),

  // ---- Tower events ----
  listTowerEvents: (
    tower_id: string,
    q?: {
      from?: string;
      to?: string;
      severity?: AlarmSeverity;
      status?: "open" | "resolved";
      limit?: number;
      offset?: number;
    },
  ) => requestPaginated<ApiEvent>(`/api/v1/towers/${tower_id}/events`, { query: q }),

  // ---- SLA ----
  getSlaGlobal: () => request<ApiSlaGlobal>("/api/v1/sla/global"),

  // ---- Operators ----
  listOperators: (q?: { limit?: number; offset?: number }) =>
    requestPaginated<ApiOperator>("/api/v1/operators", { query: q }),

  getOperator: (id: string) => request<ApiOperator>(`/api/v1/operators/${id}`),

  createOperator: (body: { name: string; code: string }) =>
    request<ApiOperator>("/api/v1/operators", { method: "POST", body }),

  updateOperator: (id: string, body: { name: string; code: string }) =>
    request<ApiOperator>(`/api/v1/operators/${id}`, { method: "PUT", body }),

  deleteOperator: (id: string) =>
    request<void>(`/api/v1/operators/${id}`, { method: "DELETE" }),

  // ---- Regions ----
  listRegions: (q?: { limit?: number; offset?: number }) =>
    requestPaginated<ApiRegion>("/api/v1/regions", { query: q }),

  getRegion: (id: string) => request<ApiRegion>(`/api/v1/regions/${id}`),

  // ---- Tickets ----
  listTickets: (q?: {
    status?: TicketStatus;
    tower_id?: string;
    limit?: number;
    offset?: number;
  }) => requestPaginated<ApiTicket>("/api/v1/tickets", { query: q }),

  // Pagina até trazer TODOS os tickets (limite máximo por página: 200, ver api.md).
  fetchAllTickets: async (opts?: { status?: TicketStatus; tower_id?: string }) => {
    const pageSize = 200;
    let offset = 0;
    let all: ApiTicket[] = [];
    for (;;) {
      const page = await requestPaginated<ApiTicket>("/api/v1/tickets", {
        query: { ...opts, limit: pageSize, offset },
      });
      all = all.concat(page.data);
      offset += page.data.length;
      if (page.data.length === 0 || offset >= page.meta.total) break;
    }
    return all;
  },

  ackTicket: (ticket_id: string) =>
    request<ApiTicket>(`/api/v1/tickets/${ticket_id}/ack`, { method: "POST" }),

  closeTicket: (ticket_id: string) =>
    request<ApiTicket>(`/api/v1/tickets/${ticket_id}/close`, { method: "POST" }),

  // ---- Metrics ----
  listMetrics: (q?: {
    tower_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => requestPaginated<ApiMetric>("/api/v1/metrics", { query: q }),

  ingestMetric: (body: {
    tower_id: string;
    collected_at: string;
    metrics: Record<string, number>;
  }) => request<ApiMetric>("/api/v1/metrics", { method: "POST", body }),

  // ---- Energy: Generator (extra, fora do contrato v0) ----
  getTowerGenerator: (tower_id: string) =>
    request<ApiGeneratorReading>(`/api/v1/towers/${tower_id}/energy/generator`),

  createGenerator: (
    tower_id: string,
    body: { name: string; fuel_capacity_l?: number; rated_power_kw?: number },
  ) =>
    // TODO: payload por confirmar com o handler real.
    request<{ message?: string }>(`/api/v1/towers/${tower_id}/energy/generator`, {
      method: "POST",
      body,
    }),

  // ---- Users (GAP no contrato v0) ----
  listUsers: (q?: { limit?: number; offset?: number }) =>
    requestPaginated<ApiUser>("/api/v1/users", { query: q }),

  createUser: (body: { name: string; email: string; password: string; role: UserRole }) =>
    request<ApiUser>("/api/v1/users", { method: "POST", body }),
  // Falta (precisa da assinatura real do handler): getUser, updateUser, deleteUser.

  // ---- SNMP collection (extra) ----
  triggerSnmpCollect: (tower_id: string) =>
    request<{ message: string }>("/api/v1/collect/snmp", {
      method: "POST",
      body: { tower_id },
    }),

  // ---- Audit logs (extra) ----
  listAuditLogs: (q?: {
    tower_id?: string;
    user_id?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => requestPaginated<ApiAuditLog>("/api/v1/audit-logs", { query: q }),

  getAuditLog: (id: string) => request<ApiAuditLog>(`/api/v1/audit-logs/${id}`),

  exportAuditLogsCsv: () =>
    request<Response>("/api/v1/audit-logs/export.csv", { raw: true }),
};

export default api;
