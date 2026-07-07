import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { buildRegionStats, errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";

export function SlaCard() {
  const navigate = useNavigate();
  const slaQuery = useQuery({
    queryKey: queryKeys.sla,
    queryFn: api.getSlaGlobal,
  });
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });
  const uiTowers = (towersQuery.data?.data ?? []).map((tower) => toUiTower(tower, { regions: regionsQuery.data?.data }));
  const slaRegioes = buildRegionStats(uiTowers, regionsQuery.data?.data);
  const slaGlobal = slaQuery.data?.availability_percent ?? 0;
  const slaTorresAfetadas = slaQuery.data?.affected_towers ?? uiTowers.filter((tower) => tower.status !== "online").length;
  const slaStatus = slaGlobal >= 99.5 ? "critical" : slaGlobal >= 98 ? "ok" : "degraded";
  const slaColor = slaStatus === "critical" ? "text-online" : slaStatus === "ok" ? "text-azul-2" : "text-degraded";
  const slaBg = slaStatus === "critical" ? "bg-online-bg" : slaStatus === "ok" ? "bg-muted" : "bg-degraded-bg";

  return (
    <div className={`border border-border rounded-xl p-5 transition-colors ${slaBg}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">SLA por região</h3>
        <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${slaStatus === "critical" ? "bg-online/20 text-online" : slaStatus === "ok" ? "bg-azul-2/20 text-azul-2" : "bg-degraded/20 text-degraded"}`}>
          {slaStatus === "critical" ? "Excelente" : slaStatus === "ok" ? "Bom" : "Risco"}
        </span>
      </div>
      {slaQuery.isError && <p className="mb-3 text-xs text-offline">{errorMessage(slaQuery.error)}</p>}
      <div className="mb-5">
        <div className={`text-3xl font-semibold ${slaColor} leading-none`}>{slaGlobal.toFixed(2)}%</div>
        <div className="text-[11px] text-muted-foreground mt-1">{slaTorresAfetadas} torres afectadas</div>
      </div>
      <div className="flex flex-col gap-3">
        {slaRegioes.map((r) => {
          const ok = r.valor >= 98;
          return (
            <button
              key={r.regiao}
              onClick={() => navigate({ to: "/mapa", search: { regiao: r.regiaoId } as never })}
              className="text-left hover:opacity-80 transition-opacity"
            >
              <div className="flex justify-between text-xs mb-1">
                <span className="text-foreground">{r.regiao}</span>
                <span className={`font-mono ${ok ? "text-online" : "text-degraded"}`}>{r.valor.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${ok ? "bg-online" : "bg-degraded"}`} style={{ width: `${r.valor}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
