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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  RUN_NUMBERS,
  WEEKDAYS,
  addMonths,
  mapsUrl,
  monthGrid,
  monthLabel,
  parseISO,
  startOfMonth,
  suburbOf,
  toISO,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { ImportScheduleDialog } from "@/components/ImportScheduleDialog";


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
  const dayRef = useRef<HTMLDivElement | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveRun, setMoveRun] = useState("1");
  const [clearOpen, setClearOpen] = useState(false);



  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setPicked([]);
  }, [selected]);


  const selectDay = (iso: string) => {
    setSelected(iso);
    requestAnimationFrame(() => {
      dayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });



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
      const { data, error } = await supabase
        .from("vans")
        .select("id, name, driver_id")
        .order("name");
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

  const ensureRunFor = async (date: string, runNumber: number) => {
    const { data: found } = await supabase
      .from("runs")
      .select("*")
      .eq("run_date", date)
      .eq("run_number", runNumber)
      .maybeSingle();
    if (found) return found;
    const { data, error } = await supabase
      .from("runs")
      .insert({ run_date: date, run_number: runNumber })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const ensureRun = async (runNumber: number) => {
    const existing = runByNumber.get(runNumber);
    if (existing) return existing;
    return ensureRunFor(selected, runNumber);
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

  const moveToDate = useMutation({
    mutationFn: async ({ ids, date, runNumber }: { ids: string[]; date: string; runNumber: number }) => {
      const run = await ensureRunFor(date, runNumber);
      const { error } = await supabase
        .from("schedule_entries")
        .update({
          scheduled_date: date,
          run_id: run.id,
          ...(run.van_id ? { van_id: run.van_id } : {}),
        })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Moved ${v.ids.length} job${v.ids.length === 1 ? "" : "s"} to ${formatDate(v.date)}`);
      setPicked([]);
      setMoveOpen(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkRemove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("schedule_entries").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed from schedule");
      setPicked([]);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearDay = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.from("schedule_entries").delete().eq("scheduled_date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Day schedule cleared");
      setPicked([]);
      setClearOpen(false);
      invalidate();
    },
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

  // Entries with no run are shown under Run 1 so nothing is hidden.
  const grouped = (runNumber: number) =>
    dayEntries.filter((e) => {
      const rn = (e.runs as { run_number: number } | null)?.run_number ?? null;
      return runNumber === 1 ? rn === 1 || rn === null : rn === runNumber;
    });


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
          <ImportScheduleDialog
            clients={(clients.data ?? []) as any}
            vans={(vans.data ?? []) as any}
            defaultDate={selected}
            onImported={invalidate}
          />
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
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{monthLabel(month)}</span>
            <span className="flex flex-wrap gap-1">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Jump to date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={parseISO(selected)}
                    defaultMonth={month}
                    onSelect={(d) => {
                      if (!d) return;
                      setMonth(startOfMonth(d));
                      setPickerOpen(false);
                      selectDay(toISO(d));
                    }}
                    className="pointer-events-auto p-3"
                  />
                </PopoverContent>
              </Popover>
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
              const past = iso < today;
              return (
                <button
                  key={iso}
                  onClick={() => selectDay(iso)}
                  className={cn(
                    "flex h-16 flex-col items-start rounded-md border p-1.5 text-left text-xs transition-colors",
                    inMonth ? "bg-white" : "bg-slate-50 text-muted-foreground",
                    past && "bg-slate-50/80 text-muted-foreground",
                    iso === today && "ring-1 ring-primary",
                    iso === selected &&
                      "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1",
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
      <div ref={dayRef} className="scroll-mt-4 space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-primary bg-primary/10 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Scheduling for
              </p>
              <h2 className="text-lg font-bold leading-tight">{formatDate(selected)}</h2>
            </div>
            <Badge variant="secondary">
              {dayEntries.length} job{dayEntries.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={dayEntries.length === 0}
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Clear schedules
            </Button>
            <AddClientsDialog
              clients={(clients.data ?? []).filter(
                (c) => matchesFilters(c) && !scheduledIdsForDay.has(c.id),
              )}
              vans={vans.data ?? []}
              suburbs={suburbs}
              date={selected}
              onAdd={(ids, runNumber) => addClients.mutate({ ids, runNumber })}
              onDateChange={(iso) => {
                setMonth(startOfMonth(parseISO(iso)));
                setSelected(iso);
              }}
            />
          </div>
        </div>

        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear all schedules for {formatDate(selected)}?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will remove all {dayEntries.length} scheduled job{dayEntries.length === 1 ? "" : "s"} for this day. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => clearDay.mutate(selected)}
                disabled={clearDay.isPending}
              >
                {clearDay.isPending ? "Clearing..." : "Clear schedules"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk selection bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <Checkbox
            checked={dayEntries.length > 0 && picked.length === dayEntries.length}
            onCheckedChange={(v) =>
              setPicked(v ? dayEntries.map((e) => e.id) : [])
            }
          />
          <span className="text-sm font-medium">
            {picked.length > 0 ? `${picked.length} selected` : "Select jobs to move"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={moveRun} onValueChange={setMoveRun}>
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RUN_NUMBERS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Run {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover open={moveOpen} onOpenChange={setMoveOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" disabled={!picked.length}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Move to date
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={parseISO(selected)}
                  defaultMonth={month}
                  onSelect={(d) => {
                    if (!d) return;
                    moveToDate.mutate({
                      ids: picked,
                      date: toISO(d),
                      runNumber: Number(moveRun),
                    });
                  }}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant="outline"
              disabled={!picked.length}
              onClick={() => bulkRemove.mutate(picked)}
            >
              <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remove
            </Button>
          </div>
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
                      selected={picked.includes(e.id)}
                      onSelect={(v) =>
                        setPicked((p) =>
                          v ? [...p, e.id] : p.filter((x) => x !== e.id),
                        )
                      }
                      onMove={(rn) => moveEntry.mutate({ id: e.id, runNumber: rn })}
                      onRemove={() => removeEntry.mutate(e.id)}
                    />

                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>

      {/* Printable sheets — one page per driver/van */}
      <PrintSheet
        date={selected}
        entries={dayEntries}
        vans={(vans.data ?? []) as any[]}
        drivers={(drivers.data ?? []) as any[]}
        runByNumber={runByNumber}
      />



      {showTop && (
        <Button
          size="sm"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 shadow-lg print:hidden"
        >
          <ArrowUp className="mr-2 h-4 w-4" /> Back to calendar
        </Button>
      )}
    </div>

  );
}

function EntryRow({
  entry,
  currentRun,
  selected,
  onSelect,
  onMove,
  onRemove,
}: {
  entry: any;
  currentRun: number;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onMove: (runNumber: number) => void;

  onRemove: () => void;
}) {
  const c = entry.clients ?? {};
  const prio = PRIORITIES[(c.priority ?? "medium") as keyof typeof PRIORITIES];
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-4 py-2.5",
        selected && "bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Checkbox checked={selected} onCheckedChange={(v) => onSelect(!!v)} />
        <div className="min-w-0">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[suburbOf(c) || c.address || "—", c.vans?.name].filter(Boolean).join(", ")}
          {c.time_notes ? ` · ${c.time_notes}` : ""}
        </div>
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
          value={String(currentRun ?? 1)}
          onValueChange={(v) => onMove(Number(v))}
        >
          <SelectTrigger className="h-8 w-[92px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>

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
  vans,
  suburbs,
  date,
  onAdd,
  onDateChange,
}: {
  clients: any[];
  vans: { id: string; name: string }[];
  suburbs: string[];
  date: string;
  onAdd: (ids: string[], runNumber: number) => void;
  onDateChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [run, setRun] = useState<string>("1");
  const [q, setQ] = useState("");
  const [van, setVan] = useState("all");
  const [suburb, setSuburb] = useState("all");
  const [prio, setPrio] = useState("all");
  const [freq, setFreq] = useState("all");

  const list = clients.filter((c) => {
    if (q && !`${c.name} ${c.address ?? ""} ${suburbOf(c)}`.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (van !== "all") {
      const vid = c.van_id ?? NONE;
      if (van === NONE ? vid !== NONE : vid !== van) return false;
    }
    if (suburb !== "all" && suburbOf(c) !== suburb) return false;
    if (prio !== "all" && c.priority !== prio) return false;
    if (freq !== "all" && c.frequency !== freq) return false;
    return true;
  });

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
          <DialogTitle>Add clients to schedule</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
          <span className="text-xs font-medium text-muted-foreground">Scheduled date</span>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="font-normal">
                <CalendarDays className="mr-2 h-4 w-4" />
                {formatDate(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(date)}
                defaultMonth={parseISO(date)}
                onSelect={(d) => {
                  if (!d) return;
                  onDateChange(toISO(d));
                  setDatePickerOpen(false);
                }}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Search clients..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={run} onValueChange={setRun}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RUN_NUMBERS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Run {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={suburb} onValueChange={setSuburb}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
          <Select value={van} onValueChange={setVan}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Van" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vans</SelectItem>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {vans.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prio} onValueChange={setPrio}>
            <SelectTrigger className="h-8 w-[135px] text-xs">
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
          <Select value={freq} onValueChange={setFreq}>
            <SelectTrigger className="h-8 w-[155px] text-xs">
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
          <Button
            variant="outline"
            onClick={() =>
              setPicked(picked.length === list.length ? [] : list.map((c) => c.id))
            }
          >
            {picked.length === list.length && list.length > 0
              ? "Deselect all"
              : `Select all (${list.length})`}
          </Button>
          <Button
            disabled={!picked.length}
            onClick={() => {
              onAdd(picked, Number(run));
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
  entries,
  vans,
  drivers,
  runByNumber,
}: {
  date: string;
  entries: any[];
  vans: any[];
  drivers: any[];
  runByNumber: Map<number, any>;
}) {
  // Group every job for the day by the van (driver) it belongs to.
  const groups = new Map<string, { vanId: string | null; entries: any[] }>();
  entries.forEach((e) => {
    const c = e.clients ?? {};
    const rn = (e.runs as { run_number: number } | null)?.run_number ?? 1;
    const vanId: string | null =
      c.van_id ?? e.van_id ?? runByNumber.get(rn)?.van_id ?? null;
    const key = vanId ?? "__none__";
    if (!groups.has(key)) groups.set(key, { vanId, entries: [] });
    groups.get(key)!.entries.push(e);
  });

  const vanName = (id: string | null) =>
    id ? (vans.find((v) => v.id === id)?.name ?? "Van") : "Unassigned van";
  const driverName = (id: string | null) => {
    const van = id ? vans.find((v) => v.id === id) : null;
    const d = van?.driver_id ? drivers.find((x) => x.id === van.driver_id) : null;
    return d ? d.full_name || d.email : null;
  };

  const sheets = [...groups.values()].sort((a, b) =>
    vanName(a.vanId).localeCompare(vanName(b.vanId)),
  );

  const runNo = (e: any) => (e.runs as { run_number: number } | null)?.run_number ?? 1;

  return (
    <div className="hidden print:block">
      {sheets.length === 0 && (
        <div className="text-sm">No jobs scheduled for {formatDate(date)}.</div>
      )}
      {sheets.map((sheet, si) => {
        const runNumbers = RUN_NUMBERS.filter((n) =>
          sheet.entries.some((e) => runNo(e) === n),
        );
        const driver = driverName(sheet.vanId);
        return (
          <div
            key={sheet.vanId ?? "none"}
            style={si < sheets.length - 1 ? { breakAfter: "page", pageBreakAfter: "always" } : undefined}
          >
            <div className="mb-4 border-b-2 border-black pb-2">
              <h1 className="text-xl font-bold">
                Run Sheet — {vanName(sheet.vanId)}
                {driver ? ` — ${driver}` : ""}
              </h1>
              <div className="text-sm">
                {formatDate(date)} · {sheet.entries.length} job
                {sheet.entries.length === 1 ? "" : "s"}
              </div>
            </div>
            {runNumbers.map((n) => {
              const rows = sheet.entries.filter((e) => runNo(e) === n);
              return (
                <div key={n} className="mb-6 break-inside-avoid">
                  <div className="mb-1 flex items-baseline justify-between border-b border-black">
                    <h2 className="text-base font-bold">Run {n}</h2>
                    <span className="text-xs">{rows.length} jobs</span>
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
                      {rows.map((e, i) => {
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
                              {c.priority === "high"
                                ? "HIGH"
                                : c.priority === "low"
                                  ? "Low"
                                  : "Med"}
                            </td>
                            <td className="py-1">☐</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
