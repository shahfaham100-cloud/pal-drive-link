import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/domain";
import { rescheduleClientFromFrequency } from "@/lib/reschedule";

export const Route = createFileRoute("/_authenticated/admin/clients/$id")({
  component: EditClientPage,
});

function EditClientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const client = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const [c, cc, pauses] = await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase.from("client_categories").select("*").eq("client_id", id),
        supabase
          .from("service_pauses")
          .select("*")
          .eq("client_id", id)
          .order("start_date", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      return { client: c.data, categories: cc.data ?? [], pauses: pauses.data ?? [] };
    },
  });

  const [pauseStart, setPauseStart] = useState("");
  const [pauseEnd, setPauseEnd] = useState("");
  const [pauseReason, setPauseReason] = useState("");

  if (client.isLoading) return <div>Loading…</div>;
  if (!client.data) return <div>Not found</div>;

  const c = client.data.client;

  const initial = {
    ...emptyClient,
    name: c.name,
    phone: c.phone ?? "",
    address: c.address ?? "",
    suburb: (c as { suburb?: string | null }).suburb ?? "",

    time_notes: c.time_notes ?? "",
    comments: c.comments ?? "",
    job_details: (c as { job_details?: string | null }).job_details ?? "",
    filters_no: (c as { filters_no?: number | null }).filters_no ?? null,
    priority: c.priority,
    frequency: c.frequency,
    custom_frequency_days: c.custom_frequency_days,
    custom_frequency_label: c.custom_frequency_label ?? "",
    
    next_service_date: c.next_service_date,
    active: c.active,
    categories: client.data.categories.map((x) => ({
      category_id: x.category_id,
      quantity: x.quantity,
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/admin/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
      </div>

      <ClientForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={async (v) => {
          const { categories, ...rest } = v;
          const { error } = await supabase
            .from("clients")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update(rest as any)
            .eq("id", id);
          if (error) {
            toast.error(error.message);
            return;
          }
          await supabase.from("client_categories").delete().eq("client_id", id);
          if (categories.length) {
            const { error: e2 } = await supabase.from("client_categories").insert(
              categories.map((cc) => ({
                client_id: id,
                category_id: cc.category_id,
                quantity: cc.quantity,
              })),
            );
            if (e2) {
              toast.error(e2.message);
              return;
            }
          }
          // Frequency changed → rebuild future visits for the next 3 months.
          const freqChanged =
            rest.frequency !== c.frequency ||
            (rest.custom_frequency_days ?? null) !== (c.custom_frequency_days ?? null);
          if (freqChanged) {
            try {
              const r = await rescheduleClientFromFrequency(
                supabase,
                id,
                rest.frequency,
                rest.custom_frequency_days ?? null,
                rest.next_service_date ?? c.next_service_date,
              );
              toast.success(
                r.created > 0
                  ? `Saved — schedule rebuilt: ${r.created} visits planned for the next 3 months`
                  : "Saved — future planned visits cleared (on-call frequency)",
              );
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Saved, but rescheduling failed");
            }
            qc.invalidateQueries({ queryKey: ["admin", "schedule"] });
            qc.invalidateQueries({ queryKey: ["client", id] });
            return;
          }
          toast.success("Saved");
          qc.invalidateQueries({ queryKey: ["client", id] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Service pauses (vacation mode)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={pauseStart}
                onChange={(e) => setPauseStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input type="date" value={pauseEnd} onChange={(e) => setPauseEnd(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason</Label>
              <Input
                placeholder="Optional"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={async () => {
              if (!pauseStart || !pauseEnd) return toast.error("Set start and end dates");
              const { error } = await supabase.from("service_pauses").insert({
                client_id: id,
                start_date: pauseStart,
                end_date: pauseEnd,
                reason: pauseReason || null,
              });
              if (error) return toast.error(error.message);
              toast.success("Pause added — client will auto-resume after end date");
              setPauseStart("");
              setPauseEnd("");
              setPauseReason("");
              qc.invalidateQueries({ queryKey: ["client", id] });
            }}
          >
            Add pause
          </Button>
          <div className="divide-y rounded-md border">
            {client.data.pauses.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No pauses.</div>
            )}
            {client.data.pauses.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {formatDate(p.start_date)} → {formatDate(p.end_date)}
                  </div>
                  {p.reason && (
                    <div className="text-xs text-muted-foreground">{p.reason}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await supabase.from("service_pauses").delete().eq("id", p.id);
                    qc.invalidateQueries({ queryKey: ["client", id] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!confirm("Delete this client permanently?")) return;
              const { error } = await supabase.from("clients").delete().eq("id", id);
              if (error) return toast.error(error.message);
              toast.success("Deleted");
              navigate({ to: "/admin/clients" });
            }}
          >
            Delete client
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
