import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { buildRegionStats, errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";

export const Route = createFileRoute("/mapa")({
  validateSearch: (s: Record<string, unknown>) => ({ regiao: typeof s.regiao === "string" ? s.regiao : undefined }),
  head: () => ({ meta: [{ title: "Mapa — ANTOSC" }] }),
  component: MapaPage,
});

const statusColor = { online: "#16A34A", degraded: "#D97706", offline: "#DC2626" } as const;

function MapaPage() {
  const { regiao } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [Comp, setComp] = useState<any>(null);
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });
  const torres = useMemo(
    () => (towersQuery.data?.data ?? []).map((tower) => toUiTower(tower, { regions: regionsQuery.data?.data })),
    [towersQuery.data, regionsQuery.data],
  );
  const regioes = useMemo(() => buildRegionStats(torres, regionsQuery.data?.data), [torres, regionsQuery.data]);
  const filteredTorres = useMemo(() => (regiao ? torres.filter((t) => t.regiaoId === regiao) : torres), [regiao, torres]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const L = await import("leaflet");
      const rl = await import("react-leaflet");
      const makeIcon = (s: keyof typeof statusColor) =>
        L.divIcon({
          className: "",
          html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${statusColor[s]};border:3px solid white;box-shadow:0 0 0 2px ${statusColor[s]}66"></span>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
      if (mounted) setComp({ rl, makeIcon });
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden relative" style={{ minHeight: 460 }}>
        {towersQuery.isError ? (
          <div className="h-[460px] flex items-center justify-center text-xs text-offline px-6 text-center">{errorMessage(towersQuery.error)}</div>
        ) : towersQuery.isLoading || !Comp ? (
          <div className="h-[460px] flex items-center justify-center text-xs text-muted-foreground">A carregar mapa…</div>
        ) : (
          <Comp.rl.MapContainer
            center={regiao && filteredTorres[0] ? [filteredTorres[0].lat, filteredTorres[0].lng] : [-11.2, 17.8]}
            zoom={regiao ? 8 : 6}
            style={{ height: 460, width: "100%" }}
          >
            <Comp.rl.TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredTorres.map((t) => (
              <Comp.rl.Marker key={t.id} position={[t.lat, t.lng]} icon={Comp.makeIcon(t.status)}>
                <Comp.rl.Popup>
                  <strong>{t.id}</strong><br />
                  {t.local}<br />
                  Estado: {t.status} · Disp: {t.disp30d.toFixed(2)}%<br />
                  <a href={`/torres/${t.id}`}>Abrir detalhe</a>
                </Comp.rl.Popup>
              </Comp.rl.Marker>
            ))}
          </Comp.rl.MapContainer>
        )}
        <div className="absolute bottom-3 left-3 bg-card/95 backdrop-blur border border-border rounded-md p-2 text-[11px] space-y-1 z-[400]">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-online" /> Online</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-degraded" /> Degradada</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-offline" /> Offline</div>
        </div>
        {regiao && (
          <button onClick={() => navigate({ search: { regiao: undefined } as never })} className="absolute top-3 right-3 z-[400] text-[11px] px-3 py-1 bg-card border border-border rounded-md hover:bg-muted">
            × {regiao}
          </button>
        )}
      </div>
      <div className="bg-card border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Por região</h3></div>
        <ul className="divide-y divide-border">
          {regioes.map((r) => (
            <li key={r.regiao}>
              <button
                onClick={() => navigate({ search: { regiao: regiao === r.regiaoId ? undefined : r.regiaoId } as never })}
                className={`w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/40 ${regiao === r.regiaoId ? "bg-muted/60" : ""}`}
              >
                <MapPin className="h-4 w-4 text-azul-2 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{r.regiao}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    <span className="text-online">{r.online}</span> · <span className="text-degraded">{r.degradadas}</span> · <span className="text-offline">{r.offline}</span>
                  </div>
                </div>
                <div className="text-sm font-semibold">{r.torres}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
