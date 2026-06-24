import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ScanPill() {
  const [last, setLast] = useState(new Date(Date.now() - 2 * 60_000));
  const [busy, setBusy] = useState(false);

  const scan = () => {
    if (busy) return;
    setBusy(true);
    toast.info("Varredura SNMP iniciada…");
    setTimeout(() => {
      setLast(new Date());
      setBusy(false);
      toast.success("Varredura concluída");
    }, 1200);
  };

  const mins = Math.max(0, Math.round((Date.now() - last.getTime()) / 60_000));
  const txt = mins < 1 ? "agora" : `há ${mins} min`;

  return (
    <button
      onClick={scan}
      className="inline-flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground hover:bg-azul hover:text-white transition-colors"
    >
      <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
      Última varredura: {txt}
    </button>
  );
}
