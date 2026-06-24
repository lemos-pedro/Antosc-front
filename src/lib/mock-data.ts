export type TorreStatus = "online" | "degraded" | "offline";

export interface Torre {
  id: string;
  nome: string;
  local: string;
  status: TorreStatus;
  vendor: string;
  disp30d: number;
  ip: string;
  lat: number;
  lng: number;
  regiao: string;
  operador: string;
  snmpVersion: "v2c" | "v3";
  ultimaManut: string;
  signalStrength: number; // dBm
  voltage: number;        // V
  temperatura: number;    // °C
  uptime: string;
}

export const torres: Torre[] = [
  { id: "TWR-LDA-001", nome: "Torre Luanda Norte", local: "Luanda Norte", status: "online",   vendor: "Eltek",   disp30d: 99.97, ip: "10.12.0.11",  lat: -8.778,  lng: 13.235, regiao: "Luanda",   operador: "Unitel",    snmpVersion: "v2c", ultimaManut: "2026-05-12", signalStrength: -68, voltage: 53.4, temperatura: 32, uptime: "92d 14h" },
  { id: "TWR-LDA-002", nome: "Torre Viana",        local: "Viana",        status: "degraded", vendor: "Huawei",  disp30d: 98.10, ip: "10.12.0.22",  lat: -8.902,  lng: 13.376, regiao: "Luanda",   operador: "Movicel",   snmpVersion: "v3",  ultimaManut: "2026-04-28", signalStrength: -82, voltage: 52.1, temperatura: 38, uptime: "41d 02h" },
  { id: "TWR-LDA-003", nome: "Torre Cacuaco",      local: "Cacuaco",      status: "offline",  vendor: "Enetek",  disp30d: 93.42, ip: "10.12.0.33",  lat: -8.776,  lng: 13.367, regiao: "Luanda",   operador: "Africell",  snmpVersion: "v2c", ultimaManut: "2026-03-10", signalStrength: -105, voltage: 0,   temperatura: 0,  uptime: "0d 00h" },
  { id: "TWR-HGO-001", nome: "Torre Huambo Centro",local: "Huambo",       status: "online",   vendor: "Eltek",   disp30d: 99.50, ip: "10.14.0.11",  lat: -12.776, lng: 15.739, regiao: "Huambo",   operador: "Unitel",    snmpVersion: "v2c", ultimaManut: "2026-05-02", signalStrength: -71, voltage: 53.7, temperatura: 29, uptime: "120d 08h" },
  { id: "TWR-BIE-001", nome: "Torre Kuito",        local: "Bié",          status: "degraded", vendor: "Huawei",  disp30d: 97.30, ip: "10.16.0.11",  lat: -12.383, lng: 16.933, regiao: "Bié",      operador: "Movicel",   snmpVersion: "v3",  ultimaManut: "2026-04-15", signalStrength: -85, voltage: 51.8, temperatura: 41, uptime: "33d 17h" },
  { id: "TWR-CAB-001", nome: "Torre Cabinda Sul",  local: "Cabinda",      status: "online",   vendor: "Eltek",   disp30d: 99.40, ip: "10.18.0.11",  lat: -5.555,  lng: 12.193, regiao: "Cabinda",  operador: "Unitel",    snmpVersion: "v2c", ultimaManut: "2026-05-08", signalStrength: -70, voltage: 53.5, temperatura: 31, uptime: "85d 03h" },
  { id: "TWR-BEN-001", nome: "Torre Benguela",     local: "Benguela",     status: "online",   vendor: "Huawei",  disp30d: 99.10, ip: "10.20.0.11",  lat: -12.578, lng: 13.407, regiao: "Benguela", operador: "Africell",  snmpVersion: "v3",  ultimaManut: "2026-04-30", signalStrength: -72, voltage: 53.2, temperatura: 30, uptime: "67d 11h" },
];

export type AlarmSev = "critical" | "warning" | "info";

export interface Alarm {
  id: string;
  severity: AlarmSev;
  title: string;
  torre: string;
  vendor: string;
  time: string;
  date: string;
  status: "active" | "ack" | "closed";
}

export const initialAlarms: Alarm[] = [
  { id: "AL-001", severity: "critical", title: "Power module unreachable",   torre: "TWR-LDA-003", vendor: "Enetek", time: "08:40", date: "2026-05-17", status: "active" },
  { id: "AL-002", severity: "warning",  title: "Signal degraded — RSSI baixo", torre: "TWR-LDA-002", vendor: "Huawei", time: "07:15", date: "2026-05-17", status: "active" },
  { id: "AL-003", severity: "warning",  title: "Voltage fora do intervalo",  torre: "TWR-BIE-001", vendor: "Huawei", time: "06:02", date: "2026-05-17", status: "active" },
  { id: "AL-004", severity: "info",     title: "Bateria em modo standby",    torre: "TWR-HGO-001", vendor: "Eltek",  time: "05:11", date: "2026-05-17", status: "active" },
  { id: "AL-005", severity: "info",     title: "Reset agendado concluído",   torre: "TWR-CAB-001", vendor: "Eltek",  time: "02:30", date: "2026-05-16", status: "closed" },
];

// MTTR / MTBF globais (horas)
export const mttrMedio = 2.4;
export const mtbfMedio = 720;

// Série diária de disponibilidade (30 dias) — gerada por torre
export function dispSeries(torreId: string) {
  let seed = torreId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  return Array.from({ length: 30 }).map((_, i) => ({
    dia: `D-${30 - i}`,
    valor: +(96 + rand() * 4).toFixed(2),
  }));
}

export type EventTipo = "failure" | "alarm" | "maintenance" | "recovery";
export interface TorreEvent {
  id: string; tipo: EventTipo; title: string; date: string; time: string; severity?: AlarmSev;
}
export const eventosPorTorre: Record<string, TorreEvent[]> = {
  default: [
    { id: "EV-1", tipo: "alarm",      title: "Alarme RSSI baixo",          date: "2026-05-17", time: "08:40", severity: "warning" },
    { id: "EV-2", tipo: "recovery",   title: "Sinal recuperado",           date: "2026-05-17", time: "09:12" },
    { id: "EV-3", tipo: "maintenance",title: "Substituição de bateria",    date: "2026-05-15", time: "14:00" },
    { id: "EV-4", tipo: "failure",    title: "Falha de energia primária",  date: "2026-05-10", time: "03:25", severity: "critical" },
  ],
};

export type ManutEstado = "Agendada" | "Em curso" | "Concluída";
export type ManutTipo = "Preventiva" | "Correctiva";
export interface Manutencao {
  id: string; tipo: ManutTipo; equipa: string; tecnico: string; data: string;
  descricao: string; duracao: string; estado: ManutEstado;
}
export const manutencoesPorTorre: Record<string, Manutencao[]> = {
  default: [
    { id: "M-001", tipo: "Preventiva", equipa: "Alpha",   tecnico: "A. Lopes",  data: "2026-05-12", descricao: "Inspecção trimestral",         duracao: "2h30",  estado: "Concluída" },
    { id: "M-002", tipo: "Correctiva", equipa: "Bravo",   tecnico: "M. Sousa",  data: "2026-05-20", descricao: "Substituição de rectificador", duracao: "—",     estado: "Agendada" },
    { id: "M-003", tipo: "Preventiva", equipa: "Charlie", tecnico: "J. Cabral", data: "2026-05-18", descricao: "Limpeza de painéis solares",   duracao: "1h45",  estado: "Em curso" },
  ],
};

export interface SlaRegion { regiao: string; valor: number; }

export const slaRegioes: SlaRegion[] = [
  { regiao: "Luanda", valor: 99.9 },
  { regiao: "Huambo", valor: 99.2 },
  { regiao: "Bié",    valor: 97.3 },
  { regiao: "Cabinda",valor: 98.8 },
];

export const slaGlobal = 99.85;
export const slaTorresAfetadas = 12;

export const metrics = {
  totais: 214,
  online: 198,
  degradadas: 12,
  offline: 4,
};

// Extra mock data for the secondary pages

export interface Equipamento {
  id: string;
  tipo: "Rectificador" | "Bateria" | "Gerador" | "Climatização" | "Antena";
  torre: string;
  vendor: string;
  status: TorreStatus;
  ultimaManut: string;
  ip: string;
}

export const equipamentos: Equipamento[] = [
  { id: "EQ-1001", tipo: "Rectificador", torre: "TWR-LDA-001", vendor: "Eltek",   status: "online",   ultimaManut: "2025-03-12", ip: "10.12.0.110" },
  { id: "EQ-1002", tipo: "Bateria",      torre: "TWR-LDA-002", vendor: "Huawei",  status: "degraded", ultimaManut: "2025-02-28", ip: "10.12.0.121" },
  { id: "EQ-1003", tipo: "Gerador",      torre: "TWR-LDA-003", vendor: "Cummins", status: "offline",  ultimaManut: "2024-11-04", ip: "10.12.0.133" },
  { id: "EQ-1004", tipo: "Climatização", torre: "TWR-HGO-001", vendor: "Daikin",  status: "online",   ultimaManut: "2025-04-19", ip: "10.14.0.140" },
  { id: "EQ-1005", tipo: "Antena",       torre: "TWR-BIE-001", vendor: "Kathrein",status: "degraded", ultimaManut: "2025-01-15", ip: "10.16.0.150" },
  { id: "EQ-1006", tipo: "Rectificador", torre: "TWR-HGO-001", vendor: "Eltek",   status: "online",   ultimaManut: "2025-05-02", ip: "10.14.0.160" },
];

export interface Relatorio {
  id: string;
  titulo: string;
  tipo: "SLA" | "Alarmes" | "Manutenção" | "Operação";
  data: string;
  autor: string;
}

export const relatorios: Relatorio[] = [
  { id: "R-2025-04", titulo: "SLA mensal — Abril 2025",            tipo: "SLA",         data: "2025-05-02", autor: "Sistema" },
  { id: "R-2025-03", titulo: "Resumo de alarmes — Semana 18",      tipo: "Alarmes",     data: "2025-05-05", autor: "A. Lopes" },
  { id: "R-2025-02", titulo: "Manutenção preventiva — Luanda",     tipo: "Manutenção",  data: "2025-04-28", autor: "M. Sousa" },
  { id: "R-2025-01", titulo: "Operação Q1 2025",                   tipo: "Operação",    data: "2025-04-10", autor: "Sistema" },
];

export interface RegiaoStat {
  regiao: string;
  torres: number;
  online: number;
  degradadas: number;
  offline: number;
}

export const regioes: RegiaoStat[] = [
  { regiao: "Luanda",  torres: 92, online: 86, degradadas: 4, offline: 2 },
  { regiao: "Huambo",  torres: 41, online: 39, degradadas: 2, offline: 0 },
  { regiao: "Bié",     torres: 28, online: 25, degradadas: 2, offline: 1 },
  { regiao: "Cabinda", torres: 33, online: 31, degradadas: 1, offline: 1 },
  { regiao: "Benguela",torres: 20, online: 17, degradadas: 3, offline: 0 },
];

export interface Equipa {
  id: string;
  nome: string;
  lider: string;
  membros: number;
  regiao: string;
  intervencoes30d: number;
}

export const equipas: Equipa[] = [
  { id: "EQP-01", nome: "Alpha",   lider: "A. Lopes",  membros: 5, regiao: "Luanda",  intervencoes30d: 23 },
  { id: "EQP-02", nome: "Bravo",   lider: "M. Sousa",  membros: 4, regiao: "Huambo",  intervencoes30d: 14 },
  { id: "EQP-03", nome: "Charlie", lider: "J. Cabral", membros: 3, regiao: "Bié",     intervencoes30d: 9  },
  { id: "EQP-04", nome: "Delta",   lider: "P. Neves",  membros: 4, regiao: "Cabinda", intervencoes30d: 17 },
];