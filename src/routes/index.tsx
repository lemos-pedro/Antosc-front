import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RadioTower, CheckCircle2, AlertTriangle, AlertCircle, Clock, Activity } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TorresTable } from "@/components/dashboard/TorresTable";
import { SlaCard } from "@/components/dashboard/SlaCard";
import { AlarmsCard } from "@/components/dashboard/AlarmsCard";
import { AvailabilityChart } from "@/components/dashboard/AvailabilityChart";
import { StatusSummaryCard } from "@/components/dashboard/StatusSummaryCard";
import { EventsTimelineCard } from "@/components/dashboard/EventsTimelineCard";
import { OperatorStatsChart } from "@/components/dashboard/OperatorStatsChart";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/api-adapters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ANTOSC" },
      { name: "description", content: "Visão geral em tempo real do parque de torres ANTOSC." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const towersQuery = useQuery({
    queryKey: queryKeys.towers,
    queryFn: () => api.listTowers({ limit: 500 }),
  });
  const towers = towersQuery.data?.data ?? [];
  const total = towersQuery.data?.meta.total ?? towers.length;
  const online = towers.filter((tower) => tower.status === "online").length;
  const degradadas = towers.filter((tower) => tower.status === "degraded").length;
  const offline = towers.filter((tower) => tower.status === "offline").length;
  const onlinePct = total ? (online / total) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <MetricCard
          icon={<RadioTower className="h-[18px] w-[18px]" style={{ color: "#2A5298" }} strokeWidth={2} />}
          iconBg="#EFF6FF" label="Torres totais" value={total}
          sub={towersQuery.isLoading ? "A carregar..." : "Inventário da API"}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-[18px] w-[18px] text-online" strokeWidth={2} />}
          iconBg="#DCFCE7" label="Online" value={online} valueClass="text-online"
          sub={<><span className="text-online">{onlinePct.toFixed(1)}%</span> do parque</>}
        />
        <MetricCard
          icon={<AlertTriangle className="h-[18px] w-[18px] text-degraded" strokeWidth={2} />}
          iconBg="#FEF3C7" label="Degradadas" value={degradadas} valueClass="text-degraded"
          sub="Estado reportado pela API"
        />
        <MetricCard
          icon={<AlertCircle className="h-[18px] w-[18px] text-offline" strokeWidth={2} />}
          iconBg="#FEE2E2" label="Offline" value={offline} valueClass="text-offline"
          sub="Sem conectividade"
        />
        <MetricCard
          icon={<Clock className="h-[18px] w-[18px] text-azul-2" strokeWidth={2} />}
          iconBg="#EFF6FF" label="Tickets abertos" value={degradadas + offline}
          sub="Sites com atenção operacional"
        />
        <MetricCard
          icon={<Activity className="h-[18px] w-[18px] text-azul-2" strokeWidth={2} />}
          iconBg="#EFF6FF" label="Cobertura" value={`${onlinePct.toFixed(1)}%`}
          sub="Sites online"
        />
      </div>

      <StatusSummaryCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AvailabilityChart />
        <OperatorStatsChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <TorresTable />
        <div className="flex flex-col gap-4">
          <SlaCard />
          <AlarmsCard />
        </div>
      </div>

      <EventsTimelineCard />
    </>
  );
}
