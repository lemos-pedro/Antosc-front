import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { queryKeys, toUiTower } from "@/lib/api-adapters";

const COLORS = ["#2A5298", "#00B4D8", "#90E0EF", "#CAF0F8", "#E0F8FF"];

export function OperatorStatsChart() {
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  const operatorsQuery = useQuery({
    queryKey: queryKeys.operators,
    queryFn: () => api.listOperators({ limit: 500 }),
  });

  const towers = (towersQuery.data?.data ?? []).map((tower) =>
    toUiTower(tower, { operators: operatorsQuery.data?.data }),
  );

  // Agrupar por operador
  const operatorStats = towers.reduce(
    (acc, tower) => {
      const existing = acc.find((o) => o.name === tower.operador);
      if (existing) {
        existing.value += 1;
      } else {
        acc.push({ name: tower.operador, value: 1 });
      }
      return acc;
    },
    [] as Array<{ name: string; value: number }>,
  );

  if (towersQuery.isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Torres por Operador</h3>
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">A carregar...</div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Torres por Operador</h3>
      {operatorStats.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={operatorStats} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#2A5298" dataKey="value">
              {operatorStats.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
      )}
    </div>
  );
}
