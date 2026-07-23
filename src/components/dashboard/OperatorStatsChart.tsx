import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { queryKeys, toUiTower } from "@/lib/api-adapters";

const OPERATOR_COLORS: Record<string, string> = {
  UNITEL: "#F97316", // Laranja
  AFRICELL: "#A855F7", // Lilás
  MOVICEL: "#EF4444", // Vermelho
  PUBLICO: "#22C55E", // Verde
  "PÚBLICO": "#22C55E", // Verde (com acento)
  ISP: "#d6d918", // Azul
};

const DEFAULT_COLOR = "#3B82F6"; // Azul, caso não haja cor definida para o operador

// Chave de cor: usa o code (ex. "UNITEL") quando existe — é estável e
// sempre em maiúsculas — com fallback para o nome normalizado.
function colorKeyFor(operator: { name: string; code?: string }): string {
  return (operator.code || operator.name).trim().toUpperCase();
}

function getOperatorColor(operator: { name: string; code?: string }): string {
  return OPERATOR_COLORS[colorKeyFor(operator)] ?? DEFAULT_COLOR;
}

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
    toUiTower(tower, {
      operators: operatorsQuery.data?.data,
    }),
  );

  // Agrupar torres por operador. Uma torre pode ter mais de um operador
  // (site partilhado, cada um com o seu equipamento/armário próprio) —
  // nesse caso conta +1 para cada operador presente na torre, mostrando
  // sempre o nome (nunca o UUID) e mantendo o code para a cor correta.
  const operatorStats = towers.reduce(
    (acc, tower) => {
      const operators =
         tower.operadores.length > 0
           ? tower.operadores
           : [{ id: tower.operadorId, name: "Sem operador", code: undefined }];

      for (const op of operators) {
        const name = op.name || "Sem operador";
        const existing = acc.find((o) => o.name === name);
        if (existing) {
          existing.value += 1;
        } else {
          acc.push({ name, value: 1, code: op.code });
        }
      }

      return acc;
    },
    [] as Array<{ name: string; value: number; code?: string }>,
  );

  if (towersQuery.isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Torres por Operador
        </h3>

        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          A carregar...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Sites por Operador
      </h3>

      {operatorStats.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={operatorStats}
              cx="50%"
              cy="50%"
              dataKey="value"
              outerRadius={80}
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {operatorStats.map((operator) => (
                <Cell
                  key={operator.name}
                  fill={getOperatorColor(operator)}
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Sem dados
        </div>
      )}
    </div>
  );
}