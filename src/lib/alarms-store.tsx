import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type ApiEvent, type ApiTicket } from "@/lib/api";
import { queryKeys, toAlarm, type Alarm } from "@/lib/api-adapters";

type Ctx = {
  alarms: Alarm[];
  active: Alarm[];
  tickets: ApiTicket[];
  ticketsLoading: boolean;
  ticketsError: boolean;
  ack: (id: string) => void;
  close: (id: string) => void;
};

const AlarmsCtx = createContext<Ctx | null>(null);

export function AlarmsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });

  // FIX: antes disto usava listTickets({ limit: 100 }), uma única página
  // sem paginação nem filtro de data — qualquer ticket fora dos 100 mais
  // recentes desaparecia silenciosamente dos exports (era a causa real do
  // "export só mostra alarmes abertos": tickets fechados de datas
  // anteriores caem fora da janela top-100 com mais frequência que os
  // abertos, que por definição são recentes). fetchAllTickets pagina até
  // trazer tudo.
  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: () => api.fetchAllTickets(),
  });

  /**
   * Towers
   */
  const towers = useMemo(() => {
    const raw = towersQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ("data" in raw && Array.isArray(raw.data)) return raw.data;
    return [];
  }, [towersQuery.data]);

  const towersById = useMemo(() => {
    return new Map(towers.map((tower) => [tower.tower_id, tower]));
  }, [towers]);

  /**
   * Tickets
   */
  const tickets = useMemo<ApiTicket[]>(() => ticketsQuery.data ?? [], [ticketsQuery.data]);

  /**
   * Events — os tickets não têm mensagem própria (a mensagem real vive em
   * ApiEvent.message, ligado via ticket.event_id). Como só existe
   * listTowerEvents(tower_id) (sem endpoint global de eventos), buscamos os
   * eventos de cada torre com ticket associado, em paralelo via useQueries
   * (nunca useQuery dentro de .map — quebra as Rules of Hooks).
   */
  const towerIdsWithTickets = useMemo(() => {
    return Array.from(new Set(tickets.map((t) => t.tower_id)));
  }, [tickets]);

  const eventsQueries = useQueries({
    queries: towerIdsWithTickets.map((towerId) => ({
      queryKey: queryKeys.events(towerId),
      queryFn: () => api.listTowerEvents(towerId, { limit: 200 }),
      enabled: !!towerId,
    })),
  });

  const eventsById = useMemo(() => {
    const map = new Map<string, ApiEvent>();
    for (const q of eventsQueries) {
      const data = q.data?.data ?? [];
      for (const event of data) {
        map.set(event.event_id, event);
      }
    }
    return map;
  }, [eventsQueries]);

  /**
   * Alarms
   */
  const alarms = useMemo(() => {
    return tickets.map((ticket) =>
      toAlarm(ticket, towersById.get(ticket.tower_id), eventsById.get(ticket.event_id))
    );
  }, [tickets, towersById, eventsById]);

  const invalidateTickets = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tickets });
  };

  const ackMutation = useMutation({
    mutationFn: api.ackTicket,
    onSuccess: () => {
      invalidateTickets();
      toast.success("Alarme confirmado");
    },
  });

  const closeMutation = useMutation({
    mutationFn: api.closeTicket,
    onSuccess: () => {
      invalidateTickets();
      toast.success("Alarme fechado");
    },
  });

  const ack = (id: string) => ackMutation.mutate(id);
  const close = (id: string) => closeMutation.mutate(id);

  const active = useMemo(
    () => alarms.filter((alarm) => alarm.status !== "closed"),
    [alarms]
  );

  return (
    <AlarmsCtx.Provider
      value={{
        alarms,
        active,
        tickets,
        ticketsLoading: ticketsQuery.isLoading,
        ticketsError: ticketsQuery.isError,
        ack,
        close,
      }}
    >
      {children}
    </AlarmsCtx.Provider>
  );
}

export function useAlarms() {
  const ctx = useContext(AlarmsCtx);
  if (!ctx) throw new Error("useAlarms fora do AlarmsProvider");
  return ctx;
}