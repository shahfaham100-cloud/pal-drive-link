import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FREQUENCIES, PRIORITIES, formatDate, todayISO } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const today = todayISO();
  const upcoming = useQuery({
    queryKey: ["admin", "schedule"],
    queryFn: async () => {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(name)")
        .eq("active", true)
        .lte("next_service_date", in30.toISOString().slice(0, 10))
        .order("next_service_date");
      if (error) throw error;
      return data;
    },
  });

  const groups = new Map<string, typeof upcoming.data extends Array<infer T> ? T[] : never[]>();
  upcoming.data?.forEach((c) => {
    const key = c.next_service_date < today ? "Overdue" : c.next_service_date;
    if (!groups.has(key)) groups.set(key, [] as any);
    (groups.get(key) as any[]).push(c);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">Upcoming jobs by service date.</p>
      </div>
      {[...groups.entries()].map(([date, list]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{date === "Overdue" ? "Overdue" : formatDate(date)}</span>
              <Badge variant="secondary">{list.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {list.map((c: any) => {
              const prio = PRIORITIES[c.priority as keyof typeof PRIORITIES];
              return (
                <div key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(c.vans as { name: string } | null)?.name ?? "No van"} ·{" "}
                      {c.frequency === "custom"
                        ? c.custom_frequency_label || "Custom"
                        : FREQUENCIES[c.frequency]?.label}
                    </div>
                  </div>
                  <Badge variant="outline" className={prio.color}>
                    {prio.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
      {upcoming.data?.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          Nothing scheduled in the next 30 days.
        </div>
      )}
    </div>
  );
}
