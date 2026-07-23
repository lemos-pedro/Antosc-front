import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAlarms } from "@/lib/alarms-store";
import { api, type AlarmSeverity } from "@/lib/api";
import { queryKeys, toUiTower, type Alarm } from "@/lib/api-adapters";
import { fmtStr, fmtNum, NO_DATA } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AlertTriangle, AlertOctagon, Info, MapPin, Server, Activity, Clock } from "lucide-react";

const sevMeta: Record<AlarmSeverity, { label: string; cls: string; Icon: typeof Info; desc: string }> = {
  critical: { label: "Crítico", cls: "bg-offline/15 text-offline border-offline/30", Icon: AlertOctagon, desc: "Impacto severo — requer intervenção imediata da equipa de O&M." },
  warning:  { label: "Aviso",   cls: "bg-degraded/15 text-degraded border-degraded/30", Icon: AlertTriangle, desc: "Degradação detectada — monitorizar e planear acção correctiva." },
  info:     { label: "Info",    cls: "bg-azul-claro/15 text-azul-2 border-azul-claro/30", Icon: Info,         desc: "Evento informativo registado pelo sistema." },
};

export function AlarmDetailDialog({ alarm, open, onOpenChange }: { alarm: Alarm | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { ack, close } = useAlarms();

  const towerQuery = useQuery({
    queryKey: queryKeys.tower(alarm?.torre ?? ""),
    queryFn: () => api.getTower(alarm!.torre),
    enabled: !!alarm && open,
  });
  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
    enabled: !!alarm && open,
  });
  const operatorsQuery = useQuery({
    queryKey: queryKeys.operators,
    queryFn: () => api.listOperators({ limit: 500 }),
    enabled: !!alarm && open,
  });

  if (!alarm) return null;
  const meta = sevMeta[alarm.severity];
  const torre = towerQuery.data
    ? toUiTower(towerQuery.data, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data })
    : null;
  const Icon = meta.Icon;

  const operadoresLabel = torre?.operadores.length
    ? torre.operadores.map((o) => o.name).join(", ")
    : NO_DATA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className={`inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full border text-[11px] font-semibold ${meta.cls}`}>
            <Icon className="h-4 w-4" /> {meta.label}
          </div>
          {/* alarm.title agora vem do evento real (ApiEvent.message via join),
              não de uma mensagem genérica por severidade */}
          <DialogTitle className="mt-2">{alarm.title}</DialogTitle>
          <DialogDescription>{meta.desc}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="ID" value={alarm.id} mono />
          <Field label="Vendor" value={fmtStr(alarm.vendor)} />
          <Field label="Data" value={alarm.date} mono />
          <Field label="Hora" value={alarm.time} mono />
          <Field label="Estado" value={alarm.status === "active" ? "Activo" : alarm.status === "ack" ? "Confirmado" : "Fechado"} />
          <Field label="Torre" value={alarm.torre} mono />
        </div>

        {towerQuery.isLoading && (
          <div className="mt-2 text-xs text-muted-foreground">A carregar dados da torre...</div>
        )}

        {torre && (
          <div className="mt-2 rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Torre afectada</p>
                <p className="text-sm font-semibold text-foreground">{torre.nome}</p>
              </div>
              <StatusBadge status={torre.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Row Icon={MapPin}   label={`${fmtStr(torre.local)} · ${torre.regiao}`} />
              <Row Icon={Server}   label={`${operadoresLabel} · ${torre.vendor}`} />
              <Row Icon={Activity} label={`RSSI ${fmtNum(torre.signalStrength, 0, " dBm")}`} />
              <Row Icon={Clock}    label={`Uptime ${fmtStr(torre.uptime)}`} />
            </div>
            <Link
              to="/torres/$torreId"
              params={{ torreId: torre.id }}
              hash="alarms"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center text-[11px] font-medium text-azul-2 hover:underline"
            >
              Ver detalhes completos da torre →
            </Link>
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            onClick={() => { ack(alarm.id); onOpenChange(false); }}
            disabled={alarm.status !== "active"}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-azul hover:text-white hover:border-azul disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-azul-2 outline-none"
          >
            Confirmar (Ack)
          </button>
          <button
            onClick={() => { close(alarm.id); onOpenChange(false); }}
            disabled={alarm.status === "closed"}
            className="px-3 py-1.5 text-xs rounded-md bg-offline text-white hover:bg-offline/90 disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-offline/40 outline-none"
          >
            Fechar alarme
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Row({ Icon, label }: { Icon: typeof Info; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}