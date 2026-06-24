import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { queryKeys, toAlarm, type Alarm } from "@/lib/api-adapters";

type Ctx = {
  alarms: Alarm[];
  active: Alarm[];
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
  const ticketsQuery = useQuery({
    queryKey: queryKeys.tickets,
    queryFn: () => api.listTickets({ limit: 100 }),
  });

  const towersById = useMemo(
    () => new Map((towersQuery.data?.data ?? []).map((tower) => [tower.tower_id, tower])),
    [towersQuery.data],
  );

  const alarms = useMemo(
    () => (ticketsQuery.data?.data ?? []).map((ticket) => toAlarm(ticket, towersById.get(ticket.tower_id))),
    [ticketsQuery.data, towersById],
  );

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

  const ack = (id: string) => {
    ackMutation.mutate(id);
  };
  const close = (id: string) => {
    closeMutation.mutate(id);
  };

  const active = useMemo(() => alarms.filter((a) => a.status !== "closed"), [alarms]);

  return <AlarmsCtx.Provider value={{ alarms, active, ack, close }}>{children}</AlarmsCtx.Provider>;
}

export function useAlarms() {
  const c = useContext(AlarmsCtx);
  if (!c) throw new Error("useAlarms fora do AlarmsProvider");
  return c;
}
