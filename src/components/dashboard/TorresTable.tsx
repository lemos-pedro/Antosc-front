import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TowerStatus } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { StatusBadge } from "./StatusBadge";
import { TorreDetailModal } from "./TorreDetailModal";

type Filter = "todas" | "degraded" | "offline";

const tabs: { id: Filter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "degraded", label: "Degradadas" },
  { id: "offline", label: "Offline" },
];

export function TorresTable() {
  const [filter, setFilter] = useState<Filter>("todas");
  const [selectedTorreId, setSelectedTorreId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
  const torres = (towersQuery.data?.data ?? []).map((tower) =>
    toUiTower(tower, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data }),
  );
  const rows = filter === "todas" ? torres : torres.filter((t) => t.status === (filter as TowerStatus));

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Torres</h2>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={[
                "px-3 py-1 text-[11px] rounded-md transition-colors",
                filter === t.id ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="font-medium px-5 py-2">ID</th>
              <th className="font-medium px-5 py-2">Local</th>
              <th className="font-medium px-5 py-2">Estado</th>
              <th className="font-medium px-5 py-2">IP</th>
              <th className="font-medium px-5 py-2 text-right">Disp. 30d</th>
            </tr>
          </thead>
          <tbody>
            {towersQuery.isLoading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">A carregar torres...</td></tr>
            )}
            {towersQuery.isError && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-offline">{errorMessage(towersQuery.error)}</td></tr>
            )}
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => {
                  setSelectedTorreId(t.id);
                  setModalOpen(true);
                }}
                className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <td className="px-5 py-3 font-mono text-xs text-foreground">{t.id}</td>
                <td className="px-5 py-3 text-foreground">{t.local}</td>
                <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                <td className={`px-5 py-3 font-mono text-xs ${t.status === "offline" ? "text-offline/70" : "text-muted-foreground"}`}>
                  {t.ip}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs text-foreground">{t.disp30d.toFixed(2)}%</td>
              </tr>
            ))}
            {!towersQuery.isLoading && !towersQuery.isError && rows.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">Sem torres neste estado.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      <TorreDetailModal torreId={selectedTorreId} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
