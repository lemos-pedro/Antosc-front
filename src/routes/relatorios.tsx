import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage, queryKeys } from "@/lib/api-adapters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — ANTOSC" }] }),
  component: RelatoriosPage,
});

const tipoColor: Record<string, string> = {
  SLA: "bg-online-bg text-online",
  Alarmes: "bg-offline-bg text-offline",
  Manutenção: "bg-degraded-bg text-degraded",
  Operação: "bg-muted text-azul-2",
};
const filtros = ["Todos", "SLA", "Alarmes", "Manutenção", "Operação"] as const;
type Relatorio = {
  id: string;
  titulo: string;
  tipo: "SLA" | "Alarmes" | "Manutenção" | "Operação";
  data: string;
  autor: string;
};

function RelatoriosPage() {
  const [filtro, setFiltro] = useState<typeof filtros[number]>("Todos");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ tipo: "SLA", from: "", to: "", escopo: "all", torre: "", regiao: "", formato: "CSV" });

  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });
  const slaQuery = useQuery({
    queryKey: queryKeys.sla,
    queryFn: api.getSlaGlobal,
  });
  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: () => api.listTickets({ limit: 100 }),
  });
  const metricsQuery = useQuery({
    queryKey: queryKeys.metrics(),
    queryFn: () => api.listMetrics({ limit: 100 }),
  });
  const relatorios: Relatorio[] = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [
      { id: "R-SLA-GLOBAL", titulo: `SLA global ${slaQuery.data?.availability_percent?.toFixed(2) ?? "—"}%`, tipo: "SLA", data: today, autor: "API /sla/global" },
      { id: "R-TICKETS", titulo: `${ticketsQuery.data?.meta.total ?? ticketsQuery.data?.data.length ?? 0} tickets registados`, tipo: "Alarmes", data: today, autor: "API /tickets" },
      { id: "R-METRICS", titulo: `${metricsQuery.data?.meta.total ?? metricsQuery.data?.data.length ?? 0} métricas recentes`, tipo: "Operação", data: today, autor: "API /metrics" },
      { id: "R-AUDIT", titulo: "Exportação CSV de auditoria", tipo: "Operação", data: today, autor: "API /audit-logs/export.csv" },
    ];
  }, [slaQuery.data, ticketsQuery.data, metricsQuery.data]);
  const rows = filtro === "Todos" ? relatorios : relatorios.filter((r) => r.tipo === filtro);
  const downloadAuditCsv = async () => {
    const response = await api.exportAuditLogsCsv();
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-logs.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {filtros.map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1 text-[11px] rounded-md ${filtro === f ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2"><Plus className="h-3 w-3" /> Novo relatório</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Gerar novo relatório</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs text-muted-foreground">Tipo</label>
                <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">
                  <option>SLA</option><option>Alarmes</option><option>Manutenção</option><option>Operação</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-muted-foreground">De</label><input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Até</label><input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground">Escopo</label>
                <select value={draft.escopo} onChange={(e) => setDraft({ ...draft, escopo: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">
                  <option value="all">Todas as torres</option><option value="region">Por região</option><option value="tower">Por torre</option>
                </select>
              </div>
              {draft.escopo === "region" && (
                <select value={draft.regiao} onChange={(e) => setDraft({ ...draft, regiao: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background">
                  {regionsQuery.data?.data.map((r) => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}
                </select>
              )}
              {draft.escopo === "tower" && (
                <select value={draft.torre} onChange={(e) => setDraft({ ...draft, torre: e.target.value })} className="w-full px-3 py-2 border border-border rounded bg-background">
                  {towersQuery.data?.data.map((t) => <option key={t.tower_id}>{t.tower_id}</option>)}
                </select>
              )}
              <div><label className="text-xs text-muted-foreground">Formato</label>
                <select value={draft.formato} onChange={(e) => setDraft({ ...draft, formato: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">
                  <option>CSV</option><option>PDF</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <button onClick={async () => {
                if (draft.formato === "CSV") await downloadAuditCsv();
                setOpen(false);
                toast.success(`Relatório ${draft.tipo} gerado em ${draft.formato}`);
              }} className="px-4 py-2 bg-azul text-white rounded text-sm">Gerar e descarregar</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {(slaQuery.isError || ticketsQuery.isError || metricsQuery.isError) && (
        <div className="bg-offline-bg text-offline border border-offline/20 rounded-lg px-4 py-3 text-sm">
          {errorMessage(slaQuery.error ?? ticketsQuery.error ?? metricsQuery.error)}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-4 flex items-center gap-4">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><FileText className="h-4 w-4 text-azul-2" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{r.titulo}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${tipoColor[r.tipo]}`}>{r.tipo}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{r.id} · {r.data} · {r.autor}</div>
              </div>
              <button onClick={async () => {
                if (r.id === "R-AUDIT") await downloadAuditCsv();
                else toast.success(`Relatório ${r.id} preparado pelos dados da API`);
              }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Sem relatórios neste filtro.</li>}
        </ul>
      </div>
    </div>
  );
}
