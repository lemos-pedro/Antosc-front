import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface MetricGaugeProps {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  color?: string;
  size?: number;
}

export function MetricGauge({
  value,
  max = 100,
  label,
  unit = "%",
  color = "#3B82F6",
  size = 120,
}: MetricGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const data = [
    { name: "filled", value: percentage },
    { name: "empty", value: 100 - percentage },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.35}
              outerRadius={size * 0.5}
              startAngle={180}
              endAngle={0}
              dataKey="value"
            >
              <Cell fill={color} />
              <Cell fill="#E5E7EB" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center">
        <div className="text-2xl font-semibold" style={{ color }}>
          {value.toFixed(1)}{unit}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
