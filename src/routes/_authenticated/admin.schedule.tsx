import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Search,
  Trash2,
  Wand2,
  MapPin,
  ArrowUp,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FREQUENCIES, PRIORITIES, formatDate, todayISO } from "@/lib/domain";
import {
  RUN_NUMBERS,
  WEEKDAYS,
  addMonths,
  mapsUrl,
  monthGrid,
  monthLabel,
  startOfMonth,
  suburbOf,
  toISO,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/schedule")({
  component: SchedulePage,
});

const NONE = "__none__";

function SchedulePage() {
  const qc = useQueryClient();
  const today = todayISO();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(today);
  const [search, setSearch] = useState("");
  const [vanFilter, setVanFilter] = useState("all");
  const [prioFilter, setPrioFilter] = useState("all");
  const [suburbFilter, setSuburbFilter] = useState("all");
  const [freqFilter, setFreqFilter] = useState("all");

  const grid = useMemo(() => monthGrid(month), [month]);
  const rangeStart = toISO(grid[0]);
  const rangeEnd = toISO(grid[grid.length - 1]);

  const entries = useQuery({
    queryKey: ["admin", "schedule-entries", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select(
          "*, runs(run_number, van_id, driver_id), clients(id, name, address, suburb, phone, time_notes, priority, frequency, custom_frequency_label, van_id, vans(id, name))",
        )
        .gte("scheduled_date", rangeStart)
        .lte("scheduled_date", rangeEnd)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  const runs = useQuery({
    queryKey: ["admin", "runs", selected],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runs")
        .select("*")
        .eq("run_date", selected)
        .order("run_number");
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

  const drivers = useQuery({
    queryKey: ["admin", "drivers-list"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");
      if (error) throw error;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      return profs ?? [];
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

  const suburbs = useMemo(() => {
    const set = new Set<string>();
    (clients.data ?? []).forEach((c) => {
      const s = suburbOf(c);
      if (s) set.add(s);
    });
    return [...set].sort();
  }, [clients.data]);

  const matchesFilters = (c: any) => {
    const q = search.trim().toLowerCase();
    if (q && !`${c.name} ${c.address ?? ""} ${suburbOf(c)}`.toLowerCase().includes(q))
      return false;
    if (vanFilter !== "all") {
      const vid = c.van_id ?? NONE;
      if (vanFilter === NONE ? vid !== NONE : vid !== vanFilter) return false;
    }
    if (prioFilter !== "all" && c.priority !== prioFilter) return false;
    if (freqFilter !== "all" && c.frequency !== freqFilter) return false;
    if (suburbFilter !== "all" && suburbOf(c) !== suburbFilter) return false;
    return true;
  };

  const countsByDay = useMemo(() => {
    const m = new Map<string, number>();
    (entries.data ?? []).forEach((e) => {
      if (!matchesFilters(e.clients ?? {})) return;
      m.set(e.scheduled_date, (m.get(e.scheduled_date) ?? 0) + 1);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.data, search, vanFilter, prioFilter, suburbFilter, freqFilter]);

  const dayEntries = useMemo(
    () =>
      (entries.data ?? [])
        .filter((e) => e.scheduled_date === selected)
        .filter((e) => matchesFilters(e.clients ?? {})),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries.data, selected, search, vanFilter, prioFilter, suburbFilter, freqFilter],
  );

  const runByNumber = useMemo(() => {
    const m = new Map<number, any>();
    (runs.data ?? []).forEach((r) => m.set(r.run_number, r));
    return m;
  }, [runs.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "schedule-entries"] });
    qc.invalidateQueries({ queryKey: ["admin", "runs"] });
    qc.invalidateQueries({ queryKey: ["admin", "missed"] });
  };

  const ensureRun = async (runNumber: number) => {
    const existing = runByNumber.get(runNumber);
    if (existing) return existing;
    const { data, error } = await supabase
      .from("runs")
      .insert({ run_date: selected, run_number: runNumber })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const addClients = useMutation({
    mutationFn: async ({ ids, runNumber }: { ids: string[]; runNumber: number | null }) => {
      const run = runNumber ? await ensureRun(runNumber) : null;
      const rows = ids.map((id, i) => {
        const c = (clients.data ?? []).find((x) => x.id === id);
        return {
          client_id: id,
          scheduled_date: selected,
          run_id: run?.id ?? null,
          van_id: run?.van_id ?? c?.van_id ?? null,
          position: i,
        };
      });
      const { error } = await supabase
        .from("schedule_entries")
        .upsert(rows, { onConflict: "client_id,scheduled_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to schedule");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from schedule");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveEntry = useMutation({
    mutationFn: async ({ id, runNumber }: { id: string; runNumber: number | null }) => {
      const run = runNumber ? await ensureRun(runNumber) : null;
      const { error } = await supabase
        .from("schedule_entries")
        .update({ run_id: run?.id ?? null, ...(run?.van_id ? { van_id: run.van_id } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const updateRun = useMutation({
    mutationFn: async ({
      runNumber,
      patch,
    }: {
      runNumber: number;
      patch: { van_id?: string | null; driver_id?: string | null };
    }) => {
      const run = await ensureRun(runNumber);
      const { error } = await supabase.from("runs").update(patch).eq("id", run.id);
      if (error) throw error;
      if (patch.van_id !== undefined) {
        await supabase
          .from("schedule_entries")
          .update({ van_id: patch.van_id })
          .eq("run_id", run.id);
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const autoFill = useMutation({
    mutationFn: async () => {
      const scheduledAnywhere = new Set(
        (entries.data ?? []).map((e) => `${e.client_id}`),
      );
      const due = (clients.data ?? []).filter(
        (c) => c.next_service_date <= selected && !scheduledAnywhere.has(c.id),
      );
      if (!due.length) throw new Error("Nothing due to add for this date");
      const rows = due.map((c, i) => ({
        client_id: c.id,
        scheduled_date: selected,
        van_id: c.van_id,
        position: i,
      }));
      const { error } = await supabase
        .from("schedule_entries")
        .upsert(rows, { onConflict: "client_id,scheduled_date" });
      if (error) throw error;
      return due.length;
    },
    onSuccess: (n) => {
      toast.success(`Added ${n} due clients`);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = (runNumber: number | null) =>
    dayEntries.filter((e) =>
      runNumber === null
        ? !e.run_id
        : (e.runs as { run_number: number } | null)?.run_number === runNumber,
    );

  const scheduledIdsForDay = new Set(dayEntries.map((e) => e.client_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Schedule{" "}
            <span className="font-normal text-muted-foreground">
              ({dayEntries.length} on {formatDate(selected)})
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan jobs day by day across up to 4 driver runs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => autoFill.mutate()}>
            <Wand2 className="mr-2 h-4 w-4" /> Auto-fill due
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, address or suburb..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={suburbFilter} onValueChange={setSuburbFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Suburb" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suburbs</SelectItem>
            {suburbs.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={vanFilter} onValueChange={setVanFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Van" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vans</SelectItem>
            <SelectItem value={NONE}>Unassigned</SelectItem>
            {vans.data?.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar */}
      <Card className="print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>{monthLabel(month)}</span>
            <span className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMonth(startOfMonth(new Date()));
                  setSelected(today);
                }}
              >
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d) => {
              const iso = toISO(d);
              const inMonth = d.getMonth() === month.getMonth();
              const count = countsByDay.get(iso) ?? 0;
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  className={cn(
                    "flex h-16 flex-col items-start rounded-md border p-1.5 text-left text-xs transition-colors",
                    inMonth ? "bg-white" : "bg-slate-50 text-muted-foreground",
                    iso === today && "ring-1 ring-primary",
                    iso === selected && "border-primary bg-primary/5",
                  )}
                >
                  <span className={cn("font-medium", iso === today && "text-primary")}>
                    {d.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="mt-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {count} job{count > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail */}
      <div className="space-y-4 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{formatDate(selected)}</h2>
          <AddClientsDialog
            clients={(clients.data ?? []).filter(
              (c) => matchesFilters(c) && !scheduledIdsForDay.has(c.id),
            )}
            date={selected}
            onAdd={(ids, runNumber) => addClients.mutate({ ids, runNumber })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {RUN_NUMBERS.map((n) => {
            const run = runByNumber.get(n);
            const list = grouped(n);
            return (
              <Card key={n}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Run {n}</span>
                    <Badge variant="secondary">{list.length}</Badge>
                  </CardTitle>
                  <div className="flex gap-2 pt-2">
                    <Select
                      value={run?.van_id ?? NONE}
                      onValueChange={(v) =>
                        updateRun.mutate({
                          runNumber: n,
                          patch: { van_id: v === NONE ? null : v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Van" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No van</SelectItem>
                        {vans.data?.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={run?.driver_id ?? NONE}
                      onValueChange={(v) =>
                        updateRun.mutate({
                          runNumber: n,
                          patch: { driver_id: v === NONE ? null : v },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Driver" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No driver</SelectItem>
                        {drivers.data?.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.full_name || d.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {list.length === 0 && (
                    <div className="px-6 py-6 text-center text-xs text-muted-foreground">
                      No jobs in this run.
                    </div>
                  )}
                  {list.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      currentRun={n}
                      onMove={(rn) => moveEntry.mutate({ id: e.id, runNumber: rn })}
                      onRemove={() => removeEntry.mutate(e.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {grouped(null).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Unassigned to a run</span>
                <Badge variant="secondary">{grouped(null).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {grouped(null).map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  currentRun={null}
                  onMove={(rn) => moveEntry.mutate({ id: e.id, runNumber: rn })}
                  onRemove={() => removeEntry.mutate(e.id)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Printable sheet */}
      <PrintSheet
        date={selected}
        runs={RUN_NUMBERS.map((n) => ({
          number: n,
          run: runByNumber.get(n),
          entries: grouped(n),
          van: vans.data?.find((v) => v.id === runByNumber.get(n)?.van_id)?.name ?? null,
          driver:
            (drivers.data as any[] | undefined)?.find(
              (d) => d.id === runByNumber.get(n)?.driver_id,
            ) ?? null,
        }))}
        unassigned={grouped(null)}
      />
    </div>
  );
}

function EntryRow({
  entry,
  currentRun,
  onMove,
  onRemove,
}: {
  entry: any;
  currentRun: number | null;
  onMove: (runNumber: number | null) => void;
  onRemove: () => void;
}) {
  const c = entry.clients ?? {};
  const prio = PRIORITIES[(c.priority ?? "medium") as keyof typeof PRIORITIES];
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {suburbOf(c) || c.address || "—"}
          {c.time_notes ? ` · ${c.time_notes}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant="outline" className={prio.color}>
          {prio.label}
        </Badge>
        {c.address && (
          <a
            href={mapsUrl(c.address)}
            target="_blank"
            rel="noreferrer"
            className="rounded p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
            title="Open in Google Maps"
          >
            <MapPin className="h-4 w-4" />
          </a>
        )}
        <Select
          value={currentRun ? String(currentRun) : NONE}
          onValueChange={(v) => onMove(v === NONE ? null : Number(v))}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No run</SelectItem>
            {RUN_NUMBERS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Run {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AddClientsDialog({
  clients,
  date,
  onAdd,
}: {
  clients: any[];
  date: string;
  onAdd: (ids: string[], runNumber: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [run, setRun] = useState<string>(NONE);
  const [q, setQ] = useState("");

  const list = clients.filter((c) =>
    q ? `${c.name} ${c.address ?? ""}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPicked([]);
          setQ("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add to schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add clients to {formatDate(date)}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Search clients..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={run} onValueChange={setRun}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No run</SelectItem>
              {RUN_NUMBERS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Run {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
          {list.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No clients available.
            </div>
          )}
          {list.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2">
              <Checkbox checked={picked.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {suburbOf(c) || c.address || "—"} ·{" "}
                  {c.frequency === "custom"
                    ? c.custom_frequency_label || "Custom"
                    : FREQUENCIES[c.frequency]?.label}{" "}
                  · due {formatDate(c.next_service_date)}
                </span>
              </span>
              <Badge
                variant="outline"
                className={PRIORITIES[c.priority as keyof typeof PRIORITIES].color}
              >
                {PRIORITIES[c.priority as keyof typeof PRIORITIES].label}
              </Badge>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPicked(list.map((c) => c.id))}>
            Select all ({list.length})
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onAdd(picked, run === NONE ? null : Number(run));
              setOpen(false);
              setPicked([]);
            }}
          >
            Add {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrintSheet({
  date,
  runs,
  unassigned,
}: {
  date: string;
  runs: { number: number; run: any; entries: any[]; van: string | null; driver: any }[];
  unassigned: any[];
}) {
  const sections = [
    ...runs.filter((r) => r.entries.length > 0),
    ...(unassigned.length
      ? [{ number: 0, run: null, entries: unassigned, van: null, driver: null }]
      : []),
  ];
  return (
    <div className="hidden print:block">
      <div className="mb-4 border-b-2 border-black pb-2">
        <h1 className="text-xl font-bold">RunSheet — Daily Schedule</h1>
        <div className="text-sm">{formatDate(date)}</div>
      </div>
      {sections.length === 0 && <div className="text-sm">No jobs scheduled.</div>}
      {sections.map((s) => (
        <div key={s.number} className="mb-6 break-inside-avoid">
          <div className="mb-1 flex items-baseline justify-between border-b border-black">
            <h2 className="text-base font-bold">
              {s.number === 0 ? "Unassigned" : `Run ${s.number}`}
              {s.van ? ` — ${s.van}` : ""}
              {s.driver ? ` — ${s.driver.full_name || s.driver.email}` : ""}
            </h2>
            <span className="text-xs">{s.entries.length} jobs</span>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="w-6 py-1">#</th>
                <th className="py-1">Client</th>
                <th className="py-1">Suburb</th>
                <th className="py-1">Address</th>
                <th className="py-1">Phone</th>
                <th className="py-1">Time</th>
                <th className="py-1">Priority</th>
                <th className="w-16 py-1">Done</th>
              </tr>
            </thead>
            <tbody>
              {s.entries.map((e, i) => {
                const c = e.clients ?? {};
                return (
                  <tr key={e.id} className="border-b border-slate-300">
                    <td className="py-1">{i + 1}</td>
                    <td className="py-1 font-semibold">{c.name}</td>
                    <td className="py-1">{suburbOf(c)}</td>
                    <td className="py-1">{c.address ?? ""}</td>
                    <td className="py-1">{c.phone ?? ""}</td>
                    <td className="py-1">{c.time_notes ?? ""}</td>
                    <td className="py-1 font-bold uppercase">
                      {c.priority === "high" ? "HIGH" : c.priority === "low" ? "Low" : "Med"}
                    </td>
                    <td className="py-1">☐</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
