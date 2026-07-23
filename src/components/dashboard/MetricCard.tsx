import type { ReactNode } from "react";

export function MetricCard({
  icon, iconBg, label, value, valueClass, sub,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: ReactNode;
  valueClass?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-border/80 hover:shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        <span
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-300 hover:scale-110"
          style={{ background: iconBg }}
        >
          {icon}
        </span>
      </div>
      <div className={`text-3xl font-semibold leading-none tabular-nums ${value === "—" ? "text-muted-foreground" : (valueClass ?? "text-foreground")}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground leading-relaxed">{sub}</div>}
    </div>
  );
}
