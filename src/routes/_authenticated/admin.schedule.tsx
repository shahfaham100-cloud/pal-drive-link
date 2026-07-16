import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { FREQUENCIES, PRIORITIES, formatDate, todayISO } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const today = todayISO();
  const [vanFilter, setVanFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");

  const upcoming = useQuery({
    queryKey: ["admin", "schedule"],
    queryFn: async () => {
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(id, name)")
        .eq("active", true)
        .lte("next_service_date", in30.toISOString().slice(0, 10))
        .order("next_service_date");
      if (error) throw error;
      return data;
    },
  });

  const vans = useQuery({
    queryKey: ["admin", "vans-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vans").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (upcoming.data ?? []).filter((c: any) => {
      if (vanFilter !== "all") {
        const vid = (c.vans as { id: string } | null)?.id ?? "none";
        if (vanFilter === "none" ? vid !== "none" : vid !== vanFilter) return false;
      }
      if (prioFilter !== "all" && c.priority !== prioFilter) return false;
      return true;
    });
  }, [upcoming.data, vanFilter, prioFilter]);

  const groups = new Map<string, any[]>();
  filtered.forEach((c: any) => {
    const key = c.next_service_date < today ? "Overdue" : c.next_service_date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  });

  const total = upcoming.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Schedule <span className="text-muted-foreground font-normal">({filtered.length}{filtered.length !== total ? ` of ${total}` : ""})</span>
        </h1>
        <p className="text-sm text-muted-foreground">Upcoming jobs by service date.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={vanFilter} onValueChange={setVanFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Van" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vans</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {vans.data?.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      {filtered.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          {total === 0 ? "Nothing scheduled in the next 30 days." : "No jobs match your filters."}
        </div>
      )}
    </div>
  );
}
