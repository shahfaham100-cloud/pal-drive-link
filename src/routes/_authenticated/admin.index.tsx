import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Users, AlertTriangle, CheckCircle2, PauseCircle } from "lucide-react";
import { todayISO } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const today = todayISO();

  const stats = useQuery({
    queryKey: ["admin", "stats", today],
    queryFn: async () => {
      const [vans, clients, todayJobs, missed, pauses, completedToday] = await Promise.all([
        supabase.from("vans").select("id", { count: "exact", head: true }),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .lte("next_service_date", today)
          .eq("active", true),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .lt("next_service_date", today)
          .eq("active", true),
        supabase
          .from("service_pauses")
          .select("id", { count: "exact", head: true })
          .lte("start_date", today)
          .gte("end_date", today),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("scheduled_date", today),
      ]);
      return {
        vans: vans.count ?? 0,
        clients: clients.count ?? 0,
        due: todayJobs.count ?? 0,
        missed: missed.count ?? 0,
        pauses: pauses.count ?? 0,
        completed: completedToday.count ?? 0,
      };
    },
  });

  const s = stats.data;

  const cards = [
    { title: "Active clients", value: s?.clients ?? "—", icon: Users, color: "text-blue-600" },
    { title: "Vans", value: s?.vans ?? "—", icon: Truck, color: "text-slate-700" },
    { title: "Due today", value: s?.due ?? "—", icon: CheckCircle2, color: "text-emerald-600" },
    {
      title: "Missed / overdue",
      value: s?.missed ?? "—",
      icon: AlertTriangle,
      color: "text-red-600",
    },
    { title: "Completed today", value: s?.completed ?? "—", icon: CheckCircle2, color: "text-emerald-700" },
    { title: "On pause", value: s?.pauses ?? "—", icon: PauseCircle, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PendingDrivers />
    </div>
  );
}
