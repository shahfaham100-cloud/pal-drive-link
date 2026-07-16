import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, todayISO } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/missed")({
  component: MissedPage,
});

function MissedPage() {
  const today = todayISO();

  const overdue = useQuery({
    queryKey: ["admin", "overdue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, next_service_date, address, vans(name)")
        .lt("next_service_date", today)
        .eq("active", true)
        .order("next_service_date");
      if (error) throw error;
      return data;
    },
  });

  const missedJobs = useQuery({
    queryKey: ["admin", "missed-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, clients(name, address), vans(name)")
        .eq("status", "missed")
        .order("scheduled_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Missed Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Clients not marked completed by the end of their cycle.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" /> Overdue clients
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {overdue.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No overdue clients. 🎉
            </div>
          )}
          {overdue.data?.map((c) => (
            <Link
              to="/admin/clients/$id"
              params={{ id: c.id }}
              key={c.id}
              className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-6 px-6"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.address ?? "—"} · {(c.vans as { name: string } | null)?.name ?? "No van"}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="destructive">Due {formatDate(c.next_service_date)}</Badge>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently flagged missed</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {missedJobs.data?.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No jobs flagged as missed yet.
            </div>
          )}
          {missedJobs.data?.map((j) => (
            <div key={j.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">
                  {(j.clients as { name: string } | null)?.name ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(j.scheduled_date)} ·{" "}
                  {(j.vans as { name: string } | null)?.name ?? "—"}
                </div>
                {j.comments && <div className="text-xs mt-1">{j.comments}</div>}
              </div>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Missed
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
