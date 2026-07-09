import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface TimeSeriesDataPoint {
  time: string;
  [key: string]: string | number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  lines?: Array<{ key: string; name: string; color: string }>;
  areas?: Array<{ key: string; name: string; color: string }>;
  height?: number;
}

export function TimeSeriesChart({
  data,
  title,
  lines = [],
  areas = [],
  height = 300,
}: TimeSeriesChartProps) {
  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="time" stroke="#9CA3AF" style={{ fontSize: "12px" }} />
          <YAxis stroke="#9CA3AF" style={{ fontSize: "12px" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "#F3F4F6" }}
          />
          <Legend />
          {areas.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              name={area.name}
              fill={area.color}
              stroke={area.color}
              fillOpacity={0.3}
            />
          ))}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
