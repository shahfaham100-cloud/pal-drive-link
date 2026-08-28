import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, X, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, todayISO } from "@/lib/domain";
import { suburbOf } from "@/lib/schedule";

export const Route = createFileRoute("/_authenticated/admin/missed")({
  component: MissedPage,
});

function MissedPage() {
  const today = todayISO();
  const qc = useQueryClient();
  const [vanFilter, setVanFilter] = useState("all");
  
  const [search, setSearch] = useState("");

  const overdue = useQuery({
    queryKey: ["admin", "missed", "overdue", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, next_service_date, address, suburb, vans(id, name)")
        .lt("next_service_date", today)
        .eq("active", true)
        .order("next_service_date");
      if (error) throw error;
      return data as any[];
    },
  });

  // Clients already booked onto an upcoming (or today's) schedule slot.
  const scheduled = useQuery({
    queryKey: ["admin", "missed", "scheduled", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("client_id, scheduled_date")
        .gte("scheduled_date", today)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as { client_id: string; scheduled_date: string }[];
    },
  });

  const scheduledMap = useMemo(() => {
    const m = new Map<string, string>();
    (scheduled.data ?? []).forEach((s) => {
      const cur = m.get(s.client_id);
      if (!cur || s.scheduled_date < cur) m.set(s.client_id, s.scheduled_date);
    });
    return m;
  }, [scheduled.data]);

  const missedJobs = useQuery({
    queryKey: ["admin", "missed", "jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, clients(name, address, suburb), vans(id, name)")
        .eq("status", "missed")
        .eq("resolved", false)
        .order("scheduled_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
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

  const clients = useQuery({
    queryKey: ["admin", "clients-schedulable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(id, name)")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "missed"] });
    qc.invalidateQueries({ queryKey: ["admin", "schedule-entries"] });
  };

  const resolveJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").update({ resolved: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from missed jobs");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMissed = useMutation({
    mutationFn: async (v: { client_id: string; scheduled_date: string; comments: string }) => {
      const client = (clients.data ?? []).find((c) => c.id === v.client_id);
      const { error } = await supabase.from("jobs").insert({
        client_id: v.client_id,
        van_id: client?.van_id ?? null,
        scheduled_date: v.scheduled_date,
        status: "missed",
        comments: v.comments || null,
        manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Missed job added");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const scheduleClients = useMutation({
    mutationFn: async ({ ids, date }: { ids: string[]; date: string }) => {
      const rows = ids.map((id, i) => {
        const c = (clients.data ?? []).find((x) => x.id === id) ?? (overdue.data ?? []).find((x) => x.id === id);
        return {
          client_id: id,
          scheduled_date: date,
          van_id: c?.van_id ?? null,
          position: i,
        };
      });
      const { error } = await supabase
        .from("schedule_entries")
        .upsert(rows, { onConflict: "client_id,scheduled_date" });
      if (error) throw error;
      // Clear any outstanding missed flags for those clients
      await supabase
        .from("jobs")
        .update({ resolved: true })
        .in("client_id", ids)
        .eq("status", "missed")
        .eq("resolved", false);
    },
    onSuccess: () => {
      toast.success("Scheduled — cleared from missed jobs");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const matches = (row: any, client: any) => {
    if (vanFilter !== "all") {
      const vid = (row.vans as { id: string } | null)?.id ?? "none";
      if (vanFilter === "none" ? vid !== "none" : vid !== vanFilter) return false;
    }
    const q = search.trim().toLowerCase();
    if (
      q &&
      !`${client?.name ?? ""} ${client?.address ?? ""} ${suburbOf(client ?? {})}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  };

  const overdueFiltered = useMemo(
    () =>
      (overdue.data ?? [])
        .filter((c) => !scheduledMap.has(c.id))
        .filter((c) => matches(c, c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overdue.data, scheduledMap, vanFilter, search],
  );

  const overdueScheduled = useMemo(
    () => (overdue.data ?? []).filter((c) => scheduledMap.has(c.id)),
    [overdue.data, scheduledMap],
  );

  const missedFiltered = useMemo(
    () => (missedJobs.data ?? []).filter((j) => !scheduledMap.has(j.client_id)).filter((j) => matches(j, j.clients)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [missedJobs.data, scheduledMap, vanFilter, search],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missed Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Clients not serviced by the end of their cycle. Anything booked into the schedule
            clears automatically.
          </p>
        </div>
        <AddMissedDialog
          clients={clients.data ?? []}
          onAdd={(v) => addMissed.mutate(v)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search client, address or suburb..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={vanFilter} onValueChange={setVanFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Van" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vans</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {vans.data?.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Overdue clients
            </span>
            <span className="flex items-center gap-2">
              {overdueScheduled.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  {overdueScheduled.length} already scheduled
                </span>
              )}
              <Badge variant="secondary">{overdueFiltered.length}</Badge>
              <ScheduleDialog
                title="Schedule overdue clients"
                options={overdueFiltered}
                onConfirm={(ids, date) => scheduleClients.mutate({ ids, date })}
              />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {overdueFiltered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No overdue clients. 🎉
            </div>
          )}
          {overdueFiltered.map((c) => (
            <div key={c.id} className="-mx-6 flex items-center justify-between px-6 py-3">
              <Link to="/admin/clients/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {suburbOf(c) || c.address || "—"} ·{" "}
                  {(c.vans as { name: string } | null)?.name ?? "No van"}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="destructive">Due {formatDate(c.next_service_date)}</Badge>
                <ScheduleDialog
                  title={`Schedule ${c.name}`}
                  options={[c]}
                  preselect
                  onConfirm={(ids, date) => scheduleClients.mutate({ ids, date })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Flagged missed</span>
            <Badge variant="secondary">{missedFiltered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {missedFiltered.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No jobs flagged as missed.
            </div>
          )}
          {missedFiltered.map((j) => (
            <div key={j.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {(j.clients as { name: string } | null)?.name ?? "—"}
                  {j.manual && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      added manually
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(j.scheduled_date)} ·{" "}
                  {(j.vans as { name: string } | null)?.name ?? "—"}
                </div>
                {j.comments && <div className="mt-1 text-xs">{j.comments}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  Missed
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resolveJob.mutate(j.id)}
                  title="Remove from missed jobs"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AddMissedDialog({
  clients,
  onAdd,
}: {
  clients: any[];
  onAdd: (v: { client_id: string; scheduled_date: string; comments: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [comments, setComments] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Add missed job
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a missed job manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date missed</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Reason / notes</Label>
            <Textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="e.g. Site closed on arrival"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!clientId}
            onClick={() => {
              onAdd({ client_id: clientId, scheduled_date: date, comments });
              setOpen(false);
              setClientId("");
              setComments("");
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  title,
  options,
  preselect,
  onConfirm,
}: {
  title: string;
  options: any[];
  preselect?: boolean;
  onConfirm: (ids: string[], date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [picked, setPicked] = useState<string[]>(preselect ? options.map((o) => o.id) : []);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPicked(preselect ? options.map((x) => x.id) : []);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={options.length === 0}>
          <CalendarPlus className="mr-2 h-4 w-4" /> Schedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!preselect && (
          <div className="max-h-[40vh] divide-y overflow-y-auto rounded-md border">
            {options.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2">
                <Checkbox checked={picked.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          {!preselect && (
            <Button variant="outline" onClick={() => setPicked(options.map((c) => c.id))}>
              Select all ({options.length})
            </Button>
          )}
          <Button
            disabled={!picked.length}
            onClick={() => {
              onConfirm(picked, date);
              setOpen(false);
            }}
          >
            Add to schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
