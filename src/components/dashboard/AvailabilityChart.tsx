import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { queryKeys, toUiTower } from "@/lib/api-adapters";

export function AvailabilityChart() {
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });

  const operatorsQuery = useQuery({
    queryKey: queryKeys.operators,
    queryFn: () => api.listOperators({ limit: 500 }),
  });

  const towers = (towersQuery.data?.data ?? []).map((tower) =>
    toUiTower(tower, {
      regions: regionsQuery.data?.data,
      operators: operatorsQuery.data?.data,
    }),
  );

  // Agrupar por região
  const regionStats = towers.reduce(
    (acc, tower) => {
      const region = acc.find((r) => r.name === tower.regiao);
      if (region) {
        region.total += 1;
        region.online += tower.status === "online" ? 1 : 0;
        region.degraded += tower.status === "degraded" ? 1 : 0;
        region.offline += tower.status === "offline" ? 1 : 0;
      } else {
        acc.push({
          name: tower.regiao,
          total: 1,
          online: tower.status === "online" ? 1 : 0,
          degraded: tower.status === "degraded" ? 1 : 0,
          offline: tower.status === "offline" ? 1 : 0,
        });
      }
      return acc;
    },
    [] as Array<{ name: string; total: number; online: number; degraded: number; offline: number }>,
  );

  if (towersQuery.isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Disponibilidade por Região</h3>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">A carregar...</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Disponibilidade por Região</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={regionStats}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="online" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="degraded" fill="#eab308" radius={[4, 4, 0, 0]} />
          <Bar dataKey="offline" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
