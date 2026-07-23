import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api, type TowerStatus } from "@/lib/api";
import { errorMessage, queryKeys, toUiTower } from "@/lib/api-adapters";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Server, Battery, Fuel, Snowflake, Antenna, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/equipamentos")({
  head: () => ({ meta: [{ title: "Equipamentos — ANTOSC" }] }),
  component: EquipamentosPage,
});

const tipoIcon = { Rectificador: Server, Bateria: Battery, Gerador: Fuel, Climatização: Snowflake, Antena: Antenna } as const;
const tipos = Object.keys(tipoIcon) as Array<keyof typeof tipoIcon>;
type Equipamento = {
  id: string;
  tipo: keyof typeof tipoIcon;
  torre: string;
  vendor: string;
  status: TowerStatus;
  ultimaManut: string;
  ip: string;
};

function EquipamentosPage() {
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState("all");
  const [torre, setTorre] = useState("all");
  const [vendor, setVendor] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ nome: "", operator_id: "", region_id: "", vendor: "", snmp_version: "v2c" as "v2c" | "v3" });
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
  const createMutation = useMutation({
    mutationFn: api.createTower,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.towers });
      setOpen(false);
      toast.success("Torre adicionada ao inventário");
    },
  });

  const torres = useMemo(
    () => (towersQuery.data?.data ?? []).map((tower) => toUiTower(tower, { regions: regionsQuery.data?.data, operators: operatorsQuery.data?.data })),
    [towersQuery.data, regionsQuery.data, operatorsQuery.data],
  );
  const items: Equipamento[] = useMemo(
    () => torres.map((t) => ({
      id: `${t.id}-snmp`,
      tipo: "Rectificador",
      torre: t.name,
      vendor: t.vendor,
      status: t.status,
      ultimaManut: t.ultimaManut,
      ip: t.ip ?? "",
    })),
    [torres],
  );

  const vendors = useMemo(() => Array.from(new Set(items.map((i) => i.vendor))), [items]);
  const rows = items.filter(
    (i) =>
      (tipo === "all" || i.tipo === tipo) &&
      (torre === "all" || i.torre === torre) &&
      (vendor === "all" || i.vendor === vendor) &&
      (status === "all" || i.status === status),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Sel value={tipo} onChange={setTipo} options={[["all","Todos os tipos"], ...tipos.map((t) => [t,t] as [string,string])]} />
          <Sel value={torre} onChange={setTorre} options={[["all","Todas as torres"], ...torres.map((t) => [t.id,t.id] as [string,string])]} />
          <Sel value={vendor} onChange={setVendor} options={[["all","Todos os vendors"], ...vendors.map((v) => [v,v] as [string,string])]} />
          <Sel value={status} onChange={setStatus} options={[["all","Todos os estados"],["online","Online"],["degraded","Degradadas"],["offline","Offline"]]} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2">
              <Plus className="h-3 w-3" /> Novo equipamento
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo equipamento</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <Field label="Nome da torre"><input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></Field>
              <Field label="Operador"><select value={draft.operator_id} onChange={(e) => setDraft({ ...draft, operator_id: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">{operatorsQuery.data?.data.map((o) => <option key={o.operator_id} value={o.operator_id}>{o.name}</option>)}</select></Field>
              <Field label="Região"><select value={draft.region_id} onChange={(e) => setDraft({ ...draft, region_id: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background">{regionsQuery.data?.data.map((r) => <option key={r.region_id} value={r.region_id}>{r.name}</option>)}</select></Field>
              <Field label="Vendor"><input value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></Field>
              <Field label="SNMP"><select value={draft.snmp_version} onChange={(e) => setDraft({ ...draft, snmp_version: e.target.value as "v2c" | "v3" })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background"><option value="v2c">v2c</option><option value="v3">v3</option></select></Field>
            </div>
            <DialogFooter>
              <button onClick={() => {
                const operator_id = draft.operator_id || operatorsQuery.data?.data[0]?.operator_id;
                const region_id = draft.region_id || regionsQuery.data?.data[0]?.region_id;
                if (!operator_id || !region_id) {
                  toast.error("Operador e região são obrigatórios");
                  return;
                }
                createMutation.mutate({
                  name: draft.nome,
                  operator_id,
                  region_id,
                  vendor: draft.vendor,
                  snmp_version: draft.snmp_version,
                });
              }} disabled={!draft.nome || !draft.vendor || createMutation.isPending} className="px-4 py-2 bg-azul text-white rounded text-sm disabled:opacity-50">Adicionar</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {towersQuery.isError && <div className="bg-offline-bg text-offline border border-offline/20 rounded-lg px-4 py-3 text-sm">{errorMessage(towersQuery.error)}</div>}
      {towersQuery.isLoading && <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">A carregar equipamentos...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((e) => {
          const Icon = tipoIcon[e.tipo];
          return (
            <div key={e.id} className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-4 w-4 text-azul-2" />
                </div>
                <StatusBadge status={e.status} />
              </div>
              <div className="text-sm font-semibold text-foreground">{e.tipo}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{e.id}</div>
              <div className="border-t border-border mt-4 pt-3 text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between"><span>site</span><span className="font-mono text-foreground">{e.torre}</span></div>
                <div className="flex justify-between"><span>Vendor</span><span className="text-foreground">{e.vendor}</span></div>
                <div className="flex justify-between"><span>IP</span><span className="font-mono text-foreground">{e.ip}</span></div>
                <div className="flex justify-between"><span>Última manut.</span><span className="font-mono">{e.ultimaManut}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">Nenhum equipamento corresponde aos filtros.</div>}
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string,string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-xs px-3 py-1.5 bg-card border border-border rounded-md">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-muted-foreground">{label}</label>{children}</div>;
}
