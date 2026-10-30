import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDaysISO, todayISO } from "@/lib/domain";
import { PendingDrivers } from "@/components/PendingDrivers";
import { ClientMapPanel } from "@/components/ClientMapPanel";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [
    { title: "Operations Dashboard \u2014 RunSheet" },
    { name: "description", content: "View clients, daily jobs, fleet assignments and service alerts." },
    { property: "og:title", content: "Operations Dashboard \u2014 RunSheet" },
    { property: "og:description", content: "View clients, daily jobs, fleet assignments and service alerts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminDashboard,
});

function countOf(r: { count: number | null }) {
  return r.count ?? 0;
}

function AdminDashboard() {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  const stats = useQuery({
    queryKey: ["admin", "stats", today],
    queryFn: async () => {
      const [
        vans,
        clients,
        inactive,
        due,
        missed,
        pauses,
        completedToday,
        schedToday,
        schedTomorrow,
        drivers,
        pendingDrivers,
      ] = await Promise.all([
        supabase.from("vans").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("active", false),
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
        supabase
          .from("schedule_entries")
          .select("id", { count: "exact", head: true })
          .eq("scheduled_date", today),
        supabase
          .from("schedule_entries")
          .select("id", { count: "exact", head: true })
          .eq("scheduled_date", tomorrow),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approved", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("approved", false),
      ]);
      return {
        vans: countOf(vans),
        clients: countOf(clients),
        inactive: countOf(inactive),
        due: countOf(due),
        missed: countOf(missed),
        pauses: countOf(pauses),
        completed: countOf(completedToday),
        schedToday: countOf(schedToday),
        schedTomorrow: countOf(schedTomorrow),
        drivers: countOf(drivers),
        pendingDrivers: countOf(pendingDrivers),
      };
    },
  });

  const s = stats.data;
  const v = (n?: number) => (s ? n ?? 0 : "—");

  const panels: { title: string; rows: { label: string; value: number | string; tone?: string }[] }[] =
    [
      {
        title: "Clients",
        rows: [
          { label: "ACTIVE", value: v(s?.clients), tone: "bg-primary/10 text-primary" },
          { label: "ON PAUSE", value: v(s?.pauses), tone: "bg-amber-100 text-amber-700" },
          { label: "OVERDUE", value: v(s?.missed), tone: "bg-destructive/10 text-destructive" },
          { label: "INACTIVE", value: v(s?.inactive), tone: "bg-muted text-muted-foreground" },
        ],
      },
      {
        title: "Today",
        rows: [
          { label: "DUE FOR SERVICE", value: v(s?.due), tone: "bg-primary/10 text-primary" },
          { label: "SCHEDULED", value: v(s?.schedToday), tone: "bg-blue-100 text-blue-700" },
          { label: "COMPLETED", value: v(s?.completed), tone: "bg-emerald-100 text-emerald-700" },
          {
            label: "REMAINING",
            value: s ? Math.max(0, s.schedToday - s.completed) : "—",
            tone: "bg-amber-100 text-amber-700",
          },
        ],
      },
      {
        title: "Fleet",
        rows: [
          { label: "VANS", value: v(s?.vans), tone: "bg-muted text-foreground" },
          { label: "APPROVED DRIVERS", value: v(s?.drivers), tone: "bg-emerald-100 text-emerald-700" },
          { label: "PENDING DRIVERS", value: v(s?.pendingDrivers), tone: "bg-amber-100 text-amber-700" },
        ],
      },
      {
        title: "Alerts",
        rows: [
          { label: "MISSED JOBS", value: v(s?.missed), tone: "bg-destructive/10 text-destructive" },
          { label: "PAUSES ACTIVE", value: v(s?.pauses), tone: "bg-amber-100 text-amber-700" },
          {
            label: "APPROVALS WAITING",
            value: v(s?.pendingDrivers),
            tone: "bg-blue-100 text-blue-700",
          },
        ],
      },
    ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="h-[380px] lg:col-span-3">
          <ClientMapPanel />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-lg bg-primary p-5 text-primary-foreground shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Jobs today
            </div>
            <div className="mt-2 text-4xl font-bold">{v(s?.schedToday)}</div>
            <div className="mt-3 h-px bg-primary-foreground/30" />
            <div className="mt-2 text-xs opacity-90">{v(s?.completed)} completed</div>
          </div>
          <div className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
              Jobs tomorrow
            </div>
            <div className="mt-2 text-4xl font-bold">{v(s?.schedTomorrow)}</div>
            <div className="mt-3 h-px bg-white/25" />
            <div className="mt-2 text-xs opacity-80">{v(s?.due)} due for service</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {panels.map((p) => (
          <Card key={p.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {p.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {p.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between border-b py-2 text-xs last:border-b-0"
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.tone ?? "bg-muted"}`}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <PendingDrivers />
    </div>
  );
}
