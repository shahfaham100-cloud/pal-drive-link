import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  LogOut,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
  Truck,
  Camera,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PRIORITIES, addDaysISO, frequencyDays, todayISO, formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverPage,
});

interface StopClient {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  time_notes: string | null;
  comments: string | null;
  priority: "low" | "medium" | "high";
  frequency: string;
  custom_frequency_days: number | null;
  next_service_date: string;
  van_id: string;
  client_categories: {
    quantity: number;
    categories: { id: string; label: string; color: string } | null;
  }[];
}

function DriverPage() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();

  useEffect(() => {
    if (!loading && role && role !== "driver") navigate({ to: "/admin", replace: true });
  }, [role, loading, navigate]);

  const vanQuery = useQuery({
    queryKey: ["driver", "van", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vans")
        .select("*")
        .eq("driver_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const van = vanQuery.data;

  const runSheet = useQuery({
    queryKey: ["driver", "runsheet", van?.id, today],
    enabled: !!van,
    queryFn: async () => {
      // Clients due today, not currently paused
      const { data: clients, error } = await supabase
        .from("clients")
        .select(
          "id, name, phone, address, time_notes, comments, priority, frequency, custom_frequency_days, next_service_date, van_id, client_categories(quantity, categories(id, label, color))",
        )
        .eq("van_id", van!.id)
        .eq("active", true)
        .lte("next_service_date", today)
        .order("priority", { ascending: false })
        .order("next_service_date");
      if (error) throw error;

      // Filter paused
      const ids = clients?.map((c) => c.id) ?? [];
      let pausedIds = new Set<string>();
      if (ids.length) {
        const { data: pauses } = await supabase
          .from("service_pauses")
          .select("client_id")
          .in("client_id", ids)
          .lte("start_date", today)
          .gte("end_date", today);
        pausedIds = new Set(pauses?.map((p) => p.client_id) ?? []);
      }
      return (clients as unknown as StopClient[]).filter((c) => !pausedIds.has(c.id));
    },
  });

  const stops = runSheet.data ?? [];

  // Compute totals
  const totals = new Map<string, { label: string; color: string; qty: number }>();
  let totalFilters = 0;
  stops.forEach((s) => {
    s.client_categories?.forEach((cc) => {
      if (!cc.categories) return;
      totalFilters += cc.quantity;
      const cur = totals.get(cc.categories.id);
      if (cur) cur.qty += cc.quantity;
      else
        totals.set(cc.categories.id, {
          label: cc.categories.label,
          color: cc.categories.color,
          qty: cc.quantity,
        });
    });
  });

  const [activeStop, setActiveStop] = useState<StopClient | null>(null);
  const [mode, setMode] = useState<"complete" | "missed" | null>(null);
  const [payment, setPayment] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const openComplete = (s: StopClient) => {
    setActiveStop(s);
    setMode("complete");
    setPayment("");
    setComment("");
    setPhotos([]);
  };
  const openMissed = (s: StopClient) => {
    setActiveStop(s);
    setMode("missed");
    setPayment("");
    setComment("");
    setPhotos([]);
  };

  const submitUpdate = async () => {
    if (!activeStop || !mode || !van || !user) return;
    if (mode === "complete" && photos.length === 0) {
      toast.error("Please add at least one photo before completing");
      return;
    }
    setBusy(true);
    try {
      const nextDays = frequencyDays(activeStop.frequency, activeStop.custom_frequency_days);
      const nextDate =
        nextDays != null
          ? addDaysISO(today, nextDays)
          : mode === "missed"
            ? addDaysISO(today, 1)
            : activeStop.next_service_date;

      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          client_id: activeStop.id,
          van_id: van.id,
          driver_id: user.id,
          scheduled_date: activeStop.next_service_date,
          completed_at: mode === "complete" ? new Date().toISOString() : null,
          status: mode === "complete" ? "completed" : "missed",
          payment_amount: mode === "complete" && payment ? Number(payment) : null,
          comments: comment || null,
        })
        .select("id")
        .single();
      if (jobErr || !job) throw new Error(jobErr?.message ?? "Could not save job");

      if (photos.length) {
        const paths: string[] = [];
        for (const [i, file] of photos.entries()) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${job.id}/${Date.now()}-${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("job-photos")
            .upload(path, file, { contentType: file.type, upsert: true });
          if (upErr) throw new Error(upErr.message);
          paths.push(path);
        }
        await supabase.from("jobs").update({ photo_urls: paths }).eq("id", job.id);
      }

      // Close out the scheduled slot for today, if there is one.
      await supabase
        .from("schedule_entries")
        .update({ status: mode === "complete" ? "completed" : "missed", job_id: job.id })
        .eq("client_id", activeStop.id)
        .eq("scheduled_date", today);

      if (mode === "complete") {
        const { error: cErr } = await supabase
          .from("clients")
          .update({ next_service_date: nextDate })
          .eq("id", activeStop.id);
        if (cErr) throw new Error(cErr.message);
      }

      toast.success(
        mode === "complete"
          ? "Marked completed — sent to the office for approval"
          : "Flagged as missed",
      );
      setActiveStop(null);
      setMode(null);
      setPhotos([]);
      qc.invalidateQueries({ queryKey: ["driver"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return <div className="min-h-screen grid place-items-center">Loading…</div>;

  if (!van)
    return (
      <div className="min-h-screen bg-slate-50">
        <TopBar signOut={signOut} navigate={navigate} email={user?.email} />
        <div className="mx-auto max-w-2xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>No van assigned</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Your admin hasn't assigned a van to you yet. Ask them to open{" "}
              <span className="font-medium">Vans & drivers</span> and assign you.
            </CardContent>
          </Card>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <TopBar signOut={signOut} navigate={navigate} email={user?.email} vanName={van.name} />
      <div className="mx-auto max-w-4xl p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Today · {formatDate(today)}</span>
              <Badge variant="secondary">{stops.length} stops</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold mb-2">
              Total Filters Out: {totalFilters}
            </div>
            <div className="flex flex-wrap gap-2">
              {[...totals.values()].map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.label} × {t.qty}
                </span>
              ))}
              {totals.size === 0 && (
                <span className="text-xs text-muted-foreground">No filters loaded.</span>
              )}
            </div>
          </CardContent>
        </Card>

        {stops.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              All caught up. Nothing due today. 🎉
            </CardContent>
          </Card>
        )}

        {stops.map((s) => {
          const prio = PRIORITIES[s.priority];
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {s.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.address}
                        </span>
                      )}
                      {s.phone && (
                        <a
                          href={`tel:${s.phone}`}
                          className="inline-flex items-center gap-1 text-primary"
                        >
                          <Phone className="h-3 w-3" /> {s.phone}
                        </a>
                      )}
                      {s.time_notes && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {s.time_notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={prio.color}>
                    {prio.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.comments && (
                  <div className="flex gap-2 rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{s.comments}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {s.client_categories?.map((cc, i) =>
                    cc.categories ? (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium"
                        style={{
                          borderColor: cc.categories.color,
                          color: cc.categories.color,
                          backgroundColor: cc.categories.color + "15",
                        }}
                      >
                        {cc.quantity} × {cc.categories.label}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={() => openComplete(s)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Complete
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openMissed(s)}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Flag missed
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!activeStop} onOpenChange={(o) => !o && setActiveStop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "complete" ? "Mark completed" : "Flag as missed"} — {activeStop?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {mode === "complete" && (
              <div className="space-y-2">
                <Label>Payment amount (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 123.20"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                />
              </div>
            )}
            {mode === "complete" && (
              <div className="space-y-2">
                <Label>Photos (required)</Label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-6 text-sm text-muted-foreground hover:bg-slate-50">
                  <Camera className="h-4 w-4" /> Take or choose photos
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      setPhotos((p) => [...p, ...Array.from(e.target.files ?? [])])
                    }
                  />
                </label>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((f, i) => (
                      <div key={i} className="relative">
                        <img
                          src={URL.createObjectURL(f)}
                          alt={`Job photo ${i + 1}`}
                          className="h-16 w-16 rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea
                rows={3}
                placeholder={
                  mode === "missed"
                    ? "Reason (e.g. closed, no access)"
                    : "Optional notes"
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActiveStop(null)}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} disabled={busy}>
              {busy
                ? "Saving…"
                : mode === "complete"
                  ? "Confirm complete"
                  : "Confirm missed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TopBar({
  signOut,
  navigate,
  email,
  vanName,
}: {
  signOut: () => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
  email?: string | null;
  vanName?: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-white">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              {vanName ?? "RunSheet"}
            </div>
            <div className="text-xs text-muted-foreground leading-tight">{email}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
