/**
 * ANTOSC — towercore API v0
 * Single source of truth for ALL backend endpoints.
 * Spec: http://<host>:8000 — see api.md
 *
 * REVISÃO (conformidade frontend/backend):
 *  - FIX: login migrado de {username,password} para {email,password}
 *    (backend já usa coluna `email` em `users` e login por email).
 *  - FIX: parsing de erro agora desembrulha o envelope { "error": {...} }
 *    definido em api.md (antes tratava o body inteiro como ApiError).
 *  - FIX: ApiTower.operators — torre pode ter mais de um operador
 *    (relação N:N via site_operators). operator_id/operator continuam
 *    a existir como legado (operador "principal"), mas a lista completa
 *    de operadores presentes na torre vem em `operators[]`.
 *  - FIX: listTowerEvents agora aceita `status` ("open"|"resolved") — o
 *    backend já suporta esse filtro via EventFilter.Status. Sem isto, a
 *    UI de "Alarmes" continuava a mostrar eventos já resolvidos.
 *  - TODO: confirmar com o handler real (não está em api.md v0):
 *      * shape exato da resposta de /api/v1/auth/login (mantém "username"?
 *        passou a "email"? outro campo de perfil?)
 *      * payload de createTower / configureSnmp
 *      * se GET /towers (lista) devolve availability_30d ou só o detalhe
 *  - GAP: não existe nenhum endpoint para Users (roadmap menciona
 *    UserHandler / POST /api/v1/users a ligar ao router — falta aqui).
 *  - GAP: ApiTower não tem campo de localização (lat/lng) — necessário
 *    para o mapa pequeno no dashboard pedido pelo Evaristo.
 */

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
  "https://careless-deplored-lure.ngrok-free.dev";
  //"localhost:8000";

// ------------------------------------------------------------------
// Types (mirror backend payloads)
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
  operator_id: string;
  operators?: ApiTowerOperator[];
  region_id: string;
  vendor: string;
  snmp_enabled: boolean;
  snmp_version: "v2c" | "v3";
  snmp_target: string;
  latitude?: number;
  longitude?: number;

  // NetEco (Huawei) — bateria e energia DC. Ausentes quando
  // neteco_enabled=false ou o site não reporta o valor (nunca fabricar).
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
  // availability e outras métricas agregadas vêm no GET /{region_id}
  [k: string]: unknown;
}

export interface ApiTicket {
  ticket_id: string;
  tower_id: string;
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
  // TODO: confirmar com o handler real se ainda devolve "username"
  // depois da migração para login por email, ou se passou a "email".
  username: string;
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


// Backend ainda não devolve {data, meta} no body dos endpoints de listagem —
// manda o array diretamente e o total no header X-Total-Count (ver api.md
// vs comportamento real). Reconstruímos aqui o shape que o resto do
// frontend espera, sem tocar no Go.
async function requestPaginated<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<Paginated<T>> {
  const url = new URL(path, API_BASE_URL);

  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.protected) {
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
    if (auth.apiKey) headers["X-API-Key"] = auth.apiKey;
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let err: ApiError;

    try {
      const body = await res.json();

      err =
        body && typeof body === "object" && "error" in body
          ? body.error
          : body;
    } catch {
      err = {
        code: String(res.status),
        message: res.statusText,
      };
    }

    throw err;
  }

  const body = await res.json();


  if (
    body &&
    typeof body === "object" &&
    Array.isArray(body.data)
  ) {
    return {
      data: body.data,
      meta: body.meta ?? {
        limit: body.data.length,
        offset: 0,
        total: body.data.length,
      },
    };
  }

  // backend devolve apenas um array
  if (Array.isArray(body)) {
    const totalHeader = res.headers.get("X-Total-Count");

    const total = totalHeader
      ? Number(totalHeader)
      : body.length;

    return {
      data: body,
      meta: {
        limit: Number(opts.query?.limit ?? body.length),
        offset: Number(opts.query?.offset ?? 0),
        total,
      },
    };
  }

  throw new Error("Resposta inesperada da API.");
}

// ------------------------------------------------------------------
// Auth state (token + api key kept in memory + localStorage)
// ------------------------------------------------------------------
const TOKEN_KEY = "antosc.api.token";
const APIKEY_KEY = "antosc.api.key";

export const auth = {
  get token() {
    return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  },
  set token(v: string | null) {
    if (typeof localStorage === "undefined") return;
    if (v) localStorage.setItem(TOKEN_KEY, v);
    else localStorage.removeItem(TOKEN_KEY);
  },
  get apiKey() {
    return typeof localStorage !== "undefined" ? localStorage.getItem(APIKEY_KEY) : null;
  },
  set apiKey(v: string | null) {
    if (typeof localStorage === "undefined") return;
    if (v) localStorage.setItem(APIKEY_KEY, v);
    else localStorage.removeItem(APIKEY_KEY);
  },
};

// ------------------------------------------------------------------
// Fetch wrapper
// ------------------------------------------------------------------
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOpts {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  protected?: boolean;
  raw?: boolean; // retorna Response (ex: CSV export)
}

async function request<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const url = new URL(path, API_BASE_URL);

  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });
  }

  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (opts.protected) {
    if (auth.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }

    if (auth.apiKey) {
      headers["X-API-Key"] = auth.apiKey;
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined
      ? JSON.stringify(opts.body)
      : undefined,
  });

  if (opts.raw) {
    return res as unknown as T;
  }

  if (!res.ok) {
    let err: ApiError;

    try {
      const body = await res.json();

      err =
        body &&
        typeof body === "object" &&
        "error" in body
          ? (body.error as ApiError)
          : (body as ApiError);
    } catch {
      err = {
        code: String(res.status),
        message: res.statusText,
      };
    }

    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ------------------------------------------------------------------
// API surface
// ------------------------------------------------------------------
export const api = {
  // ---- Health & observability ----
  health: () =>
    request<{ status: string; service: string; time: string }>("/health"),
  healthV1: () =>
    request<{ status: string; service: string; time: string }>("/api/v1/health"),
  metricsPrometheus: () =>
    request<Response>("/metrics", { raw: true }),

  // ---- Auth ----
  login: async (email: string, password: string) => {
    const res = await request<ApiLoginResponse>("/api/v1/auth/login", {
      method: "POST",
      // FIX: backend migrou para login por email (coluna users.email).
      // Body antigo era { username, password }.
      body: { email, password },
    });
    auth.token = res.access_token;
    return res;
  },
  logout: () => {
    auth.token = null;
  },

  // ---- Towers ----
  listTowers: (q?: {
    status?: TowerStatus;
    operator_id?: string;
    region_id?: string;
    limit?: number;
    offset?: number;
  }) =>
    requestPaginated<ApiTower>("/api/v1/towers", { query: q }),

  getTower: (id: string) =>
    request<ApiTower>(`/api/v1/towers/${id}`),

  createTower: (body: {
    name: string;
    operator_id: string;
    region_id: string;
    vendor: string;
    snmp_version: "v2c" | "v3";
  }) =>
    // TODO: não consta em api.md v0 — confirmar payload exato com o handler real.
    request<ApiTower>("/api/v1/towers", { method: "POST", body, protected: true }),

  configureSnmp: (
    id: string,
    body: {
      snmp_enabled: boolean;
      snmp_version: "v2c" | "v3";
      snmp_target: string;
      snmp_community?: string;
      snmp_port?: number;
    }
  ) =>
    // TODO: não consta em api.md v0 — confirmar payload exato com o handler real.
    request<ApiTower>(`/api/v1/towers/${id}/snmp`, {
      method: "PATCH",
      body,
      protected: true,
    }),

  // ---- Tower <-> Operators (N:N via site_operators) ----
  addTowerOperator: (tower_id: string, operator_id: string) =>
    request<void>(`/api/v1/towers/${tower_id}/operators`, {
      method: "POST",
      body: { operator_id },
      protected: true,
    }),

  removeTowerOperator: (tower_id: string, operator_id: string) =>
    request<void>(`/api/v1/towers/${tower_id}/operators/${operator_id}`, {
      method: "DELETE",
      protected: true,
    }),

  // ---- Tower events (histórico de alarmes/falhas por torre) ----
  listTowerEvents: (
    tower_id: string,
    q?: {
      from?: string;
      to?: string;
      severity?: AlarmSeverity;
      // ADICIONADO: fecha o filtro de status ativo/resolvido — o backend
      // já suporta ?status= em GET /towers/{id}/events (ver EventFilter.Status
      // no towercore). Sem isto, a UI de "Alarmes" continuava a mostrar
      // eventos já resolvidos junto com os ativos.
      status?: "open" | "resolved";
      limit?: number;
      offset?: number;
    }
  ) =>
    requestPaginated<ApiEvent>(`/api/v1/towers/${tower_id}/events`, { query: q }),

  // ---- SLA ----
  getSlaGlobal: () =>
    request<ApiSlaGlobal>("/api/v1/sla/global"),

  // ---- Operators ----
  listOperators: (q?: { limit?: number; offset?: number }) =>
    requestPaginated<ApiOperator>("/api/v1/operators", { query: q }),

  getOperator: (id: string) =>
    request<ApiOperator>(`/api/v1/operators/${id}`),

  createOperator: (body: { name: string; code: string }) =>
    request<ApiOperator>("/api/v1/operators", {
      method: "POST",
      body,
      protected: true,
    }),

  updateOperator: (id: string, body: { name: string; code: string }) =>
    request<ApiOperator>(`/api/v1/operators/${id}`, {
      method: "PUT",
      body,
      protected: true,
    }),

  deleteOperator: (id: string) =>
    request<void>(`/api/v1/operators/${id}`, {
      method: "DELETE",
      protected: true,
    }),

  // ---- Regions ----
  listRegions: (q?: { limit?: number; offset?: number }) =>
    requestPaginated<ApiRegion>("/api/v1/regions", { query: q }),

  getRegion: (id: string) =>
    request<ApiRegion>(`/api/v1/regions/${id}`),

  // ---- Tickets ----
  listTickets: (q?: {
    status?: TicketStatus;
    tower_id?: string;
    limit?: number;
    offset?: number;
  }) =>
    // FIX: GET /api/v1/tickets está dentro do writeChain no router.go,
    // ou seja exige auth — por isso o 401 que viste nos logs.
    requestPaginated<ApiTicket>("/api/v1/tickets", { query: q, protected: true }),

  // Pagina até trazer TODOS os tickets, não só os primeiros N. Antes disto,
  // o AlarmsProvider chamava listTickets({ limit: 100 }) uma única vez —
  // qualquer ticket fora dos 100 mais recentes (created_at desc) ficava
  // silenciosamente de fora dos exports e do feed de alarmes, incluindo
  // tickets fechados de períodos anteriores. api.md define limit máximo
  // de 200 por página, por isso paginamos em vez de pedir tudo de uma vez.
  fetchAllTickets: async (opts?: { status?: TicketStatus; tower_id?: string }) => {
    const pageSize = 200;
    let offset = 0;
    let all: ApiTicket[] = [];
    for (;;) {
      const page = await requestPaginated<ApiTicket>("/api/v1/tickets", {
        query: { ...opts, limit: pageSize, offset },
        protected: true,
      });
      all = all.concat(page.data);
      offset += page.data.length;
      if (page.data.length === 0 || offset >= page.meta.total) break;
    }
    return all;
  },

  ackTicket: (ticket_id: string) =>
    request<ApiTicket>(`/api/v1/tickets/${ticket_id}/ack`, {
      method: "POST",
      protected: true,
    }),

  closeTicket: (ticket_id: string) =>
    request<ApiTicket>(`/api/v1/tickets/${ticket_id}/close`, {
      method: "POST",
      protected: true,
    }),

  // ---- Metrics ----
  listMetrics: (q?: {
    tower_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) =>
    requestPaginated<ApiMetric>("/api/v1/metrics", { query: q }),

  ingestMetric: (body: {
    tower_id: string;
    collected_at: string;
    metrics: Record<string, number>;
  }) =>
    request<ApiMetric>("/api/v1/metrics", {
      method: "POST",
      body,
      protected: true,
    }),

  // ---- Energy: Generator (não no contrato v0 — endpoint extra do backend) ----
  getTowerGenerator: (tower_id: string) =>
    request<ApiGeneratorReading>(`/api/v1/towers/${tower_id}/energy/generator`),
  
  // ---- SNMP collection (não no contrato v0 — endpoint extra do backend) ----
  triggerSnmpCollect: (tower_id: string) =>
    request<{ message: string }>("/api/v1/collect/snmp", {
      method: "POST",
      body: { tower_id },
      protected: true,
    }),

  // ---- Audit logs (não no contrato v0 — endpoint extra do backend) ----
  listAuditLogs: (q?: {
    tower_id?: string;
    user_id?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) =>
    requestPaginated<ApiAuditLog>("/api/v1/audit-logs", { query: q, protected: true }),

  getAuditLog: (id: string) =>
    request<ApiAuditLog>(`/api/v1/audit-logs/${id}`, { protected: true }),

  exportAuditLogsCsv: () =>
    request<Response>("/api/v1/audit-logs/export.csv", {
      protected: true,
      raw: true,
    }),

  // ---- Users (GAP) ----
  // TODO: roadmap menciona UserHandler / POST /api/v1/users a ligar ao
  // router, mas não há nenhum método aqui ainda. Falta:
  //   - createUser(body)
  //   - listUsers(q?)
  //   - getUser(id) / updateUser(id, body) / deleteUser(id), se existirem
  // Preciso da assinatura real do handler para implementar sem adivinhar.
};

export default api;