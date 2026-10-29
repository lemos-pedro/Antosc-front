/**
 * Site3DPanel — carregamento só-de-cliente da cena 3D.
 *
 * A rota /torres/$torreId é SSR: importar three/fiber/drei estaticamente
 * partiria a renderização no servidor. O import dinâmico acontece apenas
 * no useEffect, por isso o bundle do servidor nunca avalia a cena.
 * Enquanto carrega mostra um placeholder honesto.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { SiteSceneData } from "./SiteScene";

export function Site3DPanel({ data }: { data: SiteSceneData }) {
  const [Scene, setScene] = useState<ComponentType<{ data: SiteSceneData }> | null>(null);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("./SiteScene")
      .then((mod) => {
        if (!cancelled) setScene(() => mod.default);
      })
      .catch((err) => {
        console.error("Falha ao carregar cena 3D", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Scene && hostRef.current) {
      hostRef.current.setAttribute("data-scene-ready", "");
    }
  }, [Scene]);

  return (
    <div
      ref={hostRef}
      className="relative w-full h-[440px] rounded-xl overflow-hidden border border-border bg-[#10141b]"
    >
      {Scene ? (
        <Scene data={data} />
      ) : failed ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Não foi possível carregar a vista 3D neste dispositivo.
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          A preparar a maquete 3D do site…
        </div>
      )}
      <div className="absolute bottom-2 right-3 text-[10px] text-white/40 font-mono">
        Arrastar para rodar · scroll para aproximar
      </div>
    </div>
  );
}
