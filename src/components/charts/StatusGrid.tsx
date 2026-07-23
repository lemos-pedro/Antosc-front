interface StatusItem {
  label: string;
  value: string;
  status?: "online" | "degraded" | "offline" | "info";
  icon?: React.ReactNode;
}

interface StatusGridProps {
  items: StatusItem[];
  columns?: number;
}

const statusColors = {
  online: "bg-online-bg text-online border-online/20",
  degraded: "bg-degraded-bg text-degraded border-degraded/20",
  offline: "bg-offline-bg text-offline border-offline/20",
  info: "bg-muted text-foreground border-border",
};

export function StatusGrid({ items, columns = 2 }: StatusGridProps) {
  return (
    <div className={`grid gap-3 grid-cols-${columns} md:grid-cols-3 lg:grid-cols-4`}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`p-3 rounded-lg border transition-all ${
            item.status ? statusColors[item.status] : statusColors.info
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {item.icon && <span className="text-lg">{item.icon}</span>}
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
              {item.label}
            </span>
          </div>
          <div className="text-lg font-semibold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
