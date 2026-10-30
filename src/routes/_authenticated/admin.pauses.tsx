import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PauseCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, todayISO } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/pauses")({
  head: () => ({ meta: [
    { title: "Service Pauses \u2014 RunSheet" },
    { name: "description", content: "Review client service pause dates and reasons." },
    { property: "og:title", content: "Service Pauses \u2014 RunSheet" },
    { property: "og:description", content: "Review client service pause dates and reasons." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PausesPage,
});

function PausesPage() {
  const today = todayISO();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "upcoming">("all");

  const pauses = useQuery({
    queryKey: ["admin", "pauses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pauses")
        .select("*, clients(id, name, address)")
        .gte("end_date", today)
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (pauses.data ?? []).filter((p: any) => {
      const active = p.start_date <= today;
      if (statusFilter === "active") return active;
      if (statusFilter === "upcoming") return !active;
      return true;
    });
  }, [pauses.data, statusFilter, today]);

  const total = pauses.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Service pauses <span className="text-muted-foreground font-normal">({filtered.length}{filtered.length !== total ? ` of ${total}` : ""})</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Clients on vacation mode. They auto-resume after the end date.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Paused now</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-amber-600" /> Active & upcoming
            </span>
            <Badge variant="secondary">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {total === 0 ? "No active or upcoming pauses. Add one from a client's page." : "No pauses match your filter."}
            </div>
          )}
          {filtered.map((p: any) => {
            const c = p.clients as { id: string; name: string; address: string | null };
            const active = p.start_date <= today;
            return (
              <Link
                key={p.id}
                to="/admin/clients/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-6 px-6"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.address ?? "—"}</div>
                  {p.reason && (
                    <div className="text-xs mt-1 italic">{p.reason}</div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm">
                    {formatDate(p.start_date)} → {formatDate(p.end_date)}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      active
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-50 text-slate-700"
                    }
                  >
                    {active ? "Paused now" : "Upcoming"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
