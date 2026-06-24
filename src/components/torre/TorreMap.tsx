import { useEffect, useState } from "react";
import type { UiTower } from "@/lib/api-adapters";

const statusColor = { online: "#16A34A", degraded: "#D97706", offline: "#DC2626" } as const;

export function TorreMap({ torre }: { torre: UiTower }) {
  const [Comp, setComp] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const L = await import("leaflet");
      const rl = await import("react-leaflet");
      // fix default icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${statusColor[torre.status]};border:3px solid white;box-shadow:0 0 0 2px ${statusColor[torre.status]}66"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      if (mounted) setComp({ L, rl, icon });
    })();
    return () => { mounted = false; };
  }, [torre.status]);

  if (!Comp) return <div className="h-[360px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground">A carregar mapa…</div>;
  const { rl, icon } = Comp;
  const { MapContainer, TileLayer, Marker, Popup } = rl;

  return (
    <MapContainer center={[torre.lat, torre.lng]} zoom={11} style={{ height: 360, width: "100%", borderRadius: 12 }}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[torre.lat, torre.lng]} icon={icon}>
        <Popup>
          <strong>{torre.id}</strong><br />
          {torre.local}<br />
          Estado: {torre.status}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
