import type { TowerStatus } from "@/lib/api";

const map: Record<TowerStatus, { label: string; cls: string }> = {
  online:   { label: "Online",    cls: "bg-online-bg text-online" },
  degraded: { label: "Fim de vida", cls: "bg-degraded-bg text-degraded" },
  offline:  { label: "Offline",   cls: "bg-offline-bg text-offline" },
};

export function StatusBadge({ status }: { status: TowerStatus }) {
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${status === "online" ? "dot-live" : ""}`} />
      {label}
    </span>
  );
}
