import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ScanPill } from "@/components/common/ScanPill";
import { TorreDetailModal } from "@/components/dashboard/TorreDetailModal";
import { fmtPct } from "@/lib/format";

export const Route = createFileRoute("/torres")({
  head: () => ({
    meta: [
      { title: "Sites — ANTOSC" },
      { name: "description", content: "Inventário e estado dos sites monitorizados." },
    ],
  }),
  component: TorresPage,
});

function TorresPage() {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const torres = useMemo(
    () => (towersQuery.data?.data ?? []).map((tower) => toUiTower(tower, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data })),
    [towersQuery.data, regionsQuery.data, operatorsQuery.data],
  );
  const rows = useMemo(
    () => torres.filter((t) => {
      const s = q.toLowerCase();
      return (
        t.id.toLowerCase().includes(s) ||
        t.local.toLowerCase().includes(s) ||
        (t.ip ?? "").toLowerCase().includes(s)
      );
    }),
    [q, torres],
  );

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <ScanPill />
        <p className="text-xs text-muted-foreground">{rows.length} de {torres.length} sites</p>
      </div>
      {towersQuery.isError && (
        <div className="bg-offline-bg text-offline border border-offline/20 rounded-lg px-4 py-3 text-sm">
          {errorMessage(towersQuery.error)}
        </div>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">Inventário de sites</h2>
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar id, local, ip…"
              className="pl-8 pr-3 py-1.5 text-xs bg-muted border border-border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-azul-claro"
            />
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
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">A carregar sites...</td></tr>
              )}
              {rows.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setModalOpen(true); }}
                  className="border-t border-border cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs">{t.id}</td>
                  <td className="px-5 py-3">{t.local}</td>
                  <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                  <td className={`px-5 py-3 font-mono text-xs ${t.status === "offline" ? "text-offline/70" : "text-muted-foreground"}`}>{t.ip ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-mono text-xs">{fmtPct(t.disp30d, 2)}</td>
                </tr>
              ))}
              {!towersQuery.isLoading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum site encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <TorreDetailModal torreId={selectedId} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
