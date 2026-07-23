import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Users, Plus, X, UserPlus, Crown, MapPin, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage, queryKeys } from "@/lib/api-adapters";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/equipas")({
  head: () => ({ meta: [{ title: "Gestão de Equipas — ANTOSC" }] }),
  component: EquipasPage,
});

interface EquipaState {
  id: string;
  nome: string;
  lider: string;
  regiao: string;
  intervencoes30d: number;
  members: string[];
}

function initials(name: string) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

function EquipasPage() {
  const queryClient = useQueryClient();
  const operatorsQuery = useQuery({
    queryKey: queryKeys.operators,
    queryFn: () => api.listOperators({ limit: 500 }),
  });
  const regionsQuery = useQuery({
    queryKey: queryKeys.regions,
    queryFn: () => api.listRegions({ limit: 500 }),
  });
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const [overrides, setOverrides] = useState<Record<string, Partial<EquipaState>>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ nome: "", code: "" });

  const createMutation = useMutation({
    mutationFn: api.createOperator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.operators });
      setDraft({ nome: "", code: "" });
      setNewOpen(false);
      toast.success("Operador criado");
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; code: string } }) => api.updateOperator(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.operators });
      toast.success("Operador actualizado");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteOperator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.operators });
      toast.success("Operador apagado");
    },
  });

  const defaultRegion = regionsQuery.data?.data[0]?.name ?? "—";
  const list = useMemo(
    () => (operatorsQuery.data?.data ?? []).map((operator) => {
      const base: EquipaState = {
        id: operator.operator_id,
        nome: operator.name,
        lider: operator.code,
        regiao: defaultRegion,
        intervencoes30d: 0,
        members: [operator.code],
      };
      return { ...base, ...overrides[operator.operator_id] };
    }),
    [operatorsQuery.data, defaultRegion, overrides],
  );

  const updateTeam = (id: string, fn: (t: EquipaState) => EquipaState) =>
    setOverrides((current) => {
      const team = list.find((t) => t.id === id);
      if (!team) return current;
      return { ...current, [id]: fn(team) };
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-azul text-white rounded-md hover:bg-azul-2">
              <Plus className="h-3 w-3" /> Nova equipa
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova equipa</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div><label className="text-xs text-muted-foreground">Nome</label><input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></div>
              <div><label className="text-xs text-muted-foreground">Código</label><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Código do operador" className="w-full mt-1 px-3 py-2 border border-border rounded bg-background" /></div>
            </div>
            <DialogFooter>
              <button
                disabled={!draft.nome || !draft.code || createMutation.isPending}
                onClick={() => {
                  createMutation.mutate({ name: draft.nome, code: draft.code });
                }}
                className="px-4 py-2 bg-azul text-white rounded text-sm disabled:opacity-50"
              >Criar</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {operatorsQuery.isError && <div className="bg-offline-bg text-offline border border-offline/20 rounded-lg px-4 py-3 text-sm">{errorMessage(operatorsQuery.error)}</div>}
      {operatorsQuery.isLoading && <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">A carregar operadores...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((e) => (
          <TeamCard
            key={e.id}
            team={e}
            regions={regionsQuery.data?.data.map((r) => r.name) ?? []}
            towerCount={(regionName) => {
              const regionId = regionsQuery.data?.data.find((r) => r.name === regionName)?.region_id;
              return towersQuery.data?.data.filter((t) => t.region_id === regionId).length ?? 0;
            }}
            onPersist={(next) => updateMutation.mutate({ id: e.id, body: { name: next.nome, code: next.lider } })}
            onUpdate={(fn) => updateTeam(e.id, fn)}
            onDelete={() => deleteMutation.mutate(e.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  regions,
  towerCount,
  onPersist,
  onUpdate,
  onDelete,
}: {
  team: EquipaState;
  regions: string[];
  towerCount: (regionName: string) => number;
  onPersist: (team: EquipaState) => void;
  onUpdate: (fn: (t: EquipaState) => EquipaState) => void;
  onDelete: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [ledOpen, setLedOpen] = useState(false);
  const [memName, setMemName] = useState("");
  const [newRegiao, setNewRegiao] = useState(team.regiao);
  const [newLider, setNewLider] = useState<string | null>(null);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-10 w-10 rounded-lg bg-azul text-white flex items-center justify-center"><Users className="h-5 w-5" /></div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="p-1.5 text-muted-foreground hover:text-offline rounded"><Trash2 className="h-4 w-4" /></button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar equipa {team.nome}?</AlertDialogTitle>
              <AlertDialogDescription>Esta acção não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Apagar</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <h3 className="text-base font-semibold text-foreground">Equipa {team.nome}</h3>
      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{team.id} · {team.regiao}</p>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs">
          <div className="h-7 w-7 rounded-full bg-muted text-azul-2 font-semibold flex items-center justify-center text-[11px]">{initials(team.lider)}</div>
          <div>
            <div className="text-foreground font-medium">{team.lider}</div>
            <div className="text-muted-foreground">Líder · {team.members.length} membros</div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Membros</p>
        <ul className="space-y-1.5">
          {team.members.map((m) => (
            <li key={m} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{m}{m === team.lider && <span className="ml-1 text-azul-2">(líder)</span>}</span>
              {m !== team.lider && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-muted-foreground hover:text-offline"><X className="h-3 w-3" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remover {m}?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { onUpdate((t) => ({ ...t, members: t.members.filter((x) => x !== m) })); toast.success("Membro removido"); }}>Remover</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><button className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-azul hover:text-white"><UserPlus className="h-3 w-3" /> Membro</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar membro</DialogTitle></DialogHeader>
            <input value={memName} onChange={(e) => setMemName(e.target.value)} placeholder="Nome do utilizador" className="w-full mt-2 px-3 py-2 border border-border rounded bg-background text-sm" />
            <DialogFooter><button disabled={!memName} onClick={() => { onUpdate((t) => ({ ...t, members: [...t.members, memName] })); setMemName(""); setAddOpen(false); toast.success("Membro adicionado"); }} className="px-4 py-2 bg-azul text-white rounded text-sm disabled:opacity-50">Adicionar</button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={ledOpen} onOpenChange={setLedOpen}>
          <DialogTrigger asChild><button className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-azul hover:text-white"><Crown className="h-3 w-3" /> Trocar líder</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Trocar líder de {team.nome}</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Líder actual: <strong className="text-foreground">{team.lider}</strong></p>
            <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
              {team.members.filter((m) => m !== team.lider).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm p-2 border border-border rounded hover:bg-muted cursor-pointer">
                  <input type="radio" name="lider" checked={newLider === m} onChange={() => setNewLider(m)} />
                  {m}
                </label>
              ))}
              {team.members.length <= 1 && <p className="text-xs text-muted-foreground">Sem outros membros para promover.</p>}
            </div>
            <DialogFooter>
              <button disabled={!newLider} onClick={() => {
                const next = { ...team, lider: newLider! };
                onUpdate(() => next);
                onPersist(next);
                setNewLider(null);
                setLedOpen(false);
              }} className="px-4 py-2 bg-azul text-white rounded text-sm disabled:opacity-50">Confirmar</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={regOpen} onOpenChange={setRegOpen}>
          <DialogTrigger asChild><button className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded bg-muted hover:bg-azul hover:text-white"><MapPin className="h-3 w-3" /> Região</button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Atribuir região</DialogTitle></DialogHeader>
            <select value={newRegiao} onChange={(e) => setNewRegiao(e.target.value)} className="w-full mt-2 px-3 py-2 border border-border rounded bg-background text-sm">
              {regions.map((r) => <option key={r}>{r}</option>)}
              {regions.length === 0 && <option>—</option>}
            </select>
            <p className="text-[11px] text-muted-foreground mt-3">Torres disponíveis: {towerCount(newRegiao)}</p>
            <DialogFooter><button onClick={() => { onUpdate((t) => ({ ...t, regiao: newRegiao })); setRegOpen(false); toast.success("Região atribuída"); }} className="px-4 py-2 bg-azul text-white rounded text-sm">Guardar</button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="mt-3 text-xs text-muted-foreground"><span className="font-mono text-foreground">{team.intervencoes30d}</span> intervenções (30d)</p>
    </div>
  );
}
