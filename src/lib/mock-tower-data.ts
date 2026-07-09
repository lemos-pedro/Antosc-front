import type { UiTower } from "./api-adapters";

/**
 * Gera dados mock realistas para uma torre específica.
 * Usa valores típicos de telecomunicações sem inventar dados onde a API é real.
 * Mantém coerência com os dados já retornados pela API.
 */
export function generateCompleteTowerData(baseTower: UiTower): UiTower {
  const id = parseInt(baseTower.id.replace(/\D/g, "") || "1", 10);

  // Dados derivados de forma determinística mas realista
  return {
    ...baseTower,
    // Energia
    current: 45 + (id % 20),
    batteryVoltage: 48.2 + (id % 5) * 0.1,
    batterySoh: 85 + (id % 15),
    batterySoc: 65 + (id % 30),
    batteryTemperature: 28 + (id % 8),
    batteryBackupEstimate: `${6 + (id % 4)}h 30m`,
    generatorStatus: id % 10 === 0 ? "ligado" : id % 15 === 0 ? "erro" : "desligado",
    generatorFuelLevel: 75 + (id % 25),
    generatorRuntimeHours: 120 + id * 10,
    mainsStatus: id % 20 === 0 ? "ausente" : "presente",
    rectifierStatus: id % 30 === 0 ? "alarme" : "ok",
    powerSourceActive: id % 3 === 0 ? "gerador" : "rede",

    // Rede
    backhaul: {
      type: ["Fibra", "Microonda", "4G"][id % 3],
      bandwidth: 1000 + (id % 500),
      latency: 5 + (id % 20),
      jitter: 1 + (id % 5),
      packetLoss: (id % 100) * 0.01,
    },
    ran: {
      cells: 2 + (id % 3),
      prb: 60 + (id % 35),
      rrc: 45 + (id % 40),
      cqi: 8 + (id % 6),
    },

    // Ambiente
    temperatura: 25 + (id % 15),
    humidity: 40 + (id % 40),
    airflow: 15 + (id % 10),
    shelter: {
      door: id % 25 === 0 ? "aberta" : "fechada",
      ac: id % 20 === 0 ? "desligado" : "ligado",
      acTemp: 20 + (id % 8),
    },

    // Segurança
    accessLog: {
      lastAccess: new Date(Date.now() - (id % 30) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      totalAccess: 5 + (id % 20),
    },
    camera: {
      count: 2 + (id % 2),
      recording: id % 10 !== 0,
    },
    motion: {
      detected: id % 50 === 0,
      count: id % 3,
    },

    // Sistema
    cpu: 25 + (id % 50),
    ram: 40 + (id % 40),
    storage: 30 + (id % 50),
    uptime: `${150 + (id % 200)} dias`,
  };
}

/**
 * Gera dados de série temporal para gráficos (últimas 24 horas)
 */
export function generateTimeSeriesData(torreId: string) {
  const id = parseInt(torreId.replace(/\D/g, "") || "1", 10);
  const now = Date.now();
  const data = [];

  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 60 * 1000);
    const hour = timestamp.getHours().toString().padStart(2, "0");

    data.push({
      time: `${hour}:00`,
      battery: 65 + (id % 30) - (i % 10) * 2,
      rectifier: 45 + (id % 20) + Math.sin(i / 4) * 5,
      generator: 0 + (id % 5) * 10 * (i % 6 === 0 ? 1 : 0),
      temperature: 25 + (id % 15) + Math.sin(i / 6) * 3,
    });
  }

  return data;
}

/**
 * Gera lista de operadores com métricas por torre
 */
export function generateOperatorMetrics(torreId: string) {
  const id = parseInt(torreId.replace(/\D/g, "") || "1", 10);

  return [
    {
      name: "Vodacom",
      occupancy: 85 + (id % 10),
      equipment: 90 + (id % 8),
      signal: 80 + (id % 15),
      color: "#EF4444",
    },
    {
      name: "MEO",
      occupancy: 75 + (id % 15),
      equipment: 85 + (id % 10),
      signal: 75 + (id % 20),
      color: "#F97316",
    },
    {
      name: "TMN",
      occupancy: 70 + (id % 20),
      equipment: 80 + (id % 15),
      signal: 70 + (id % 25),
      color: "#06B6D4",
    },
  ];
}
