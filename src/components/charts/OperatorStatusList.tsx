import { MetricGauge } from "./MetricGauge";

export interface OperatorStatus {
  name: string;
  occupancy: number;
  equipment: number;
  signal: number;
  color: string;
}

interface OperatorStatusListProps {
  operators: OperatorStatus[];
}

export function OperatorStatusList({ operators }: OperatorStatusListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {operators.map((op) => (
        <div key={op.name} className="bg-muted/30 rounded-lg p-4 border border-border">
          <h4 className="text-sm font-semibold text-foreground mb-4">{op.name}</h4>
          <div className="grid grid-cols-3 gap-4">
            <MetricGauge
              value={op.occupancy}
              label="Ocupação"
              unit="%"
              color={op.color}
              size={80}
            />
            <MetricGauge
              value={op.equipment}
              label="Equipamento"
              unit="%"
              color={op.color}
              size={80}
            />
            <MetricGauge
              value={op.signal}
              label="Sinal"
              unit="%"
              color={op.color}
              size={80}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
