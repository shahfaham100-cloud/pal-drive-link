import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileDown, Search, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, todayISO } from "@/lib/domain";
import { buildInvoicePdf } from "@/lib/invoice";

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  component: FinalisePage,
});

async function signed(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from("job-photos").createSignedUrls(paths, 3600);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function FinalisePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<any | null>(null);

  const jobs = useQuery({
    queryKey: ["admin", "finalise"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "*, clients(id, name, address, suburb, client_categories(quantity, categories(label))), vans(name), profiles:driver_id(full_name, email)",
        )
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const filter = (list: any[], finalized: boolean) => {
    const q = search.trim().toLowerCase();
    return list
      .filter((j) => Boolean(j.finalized) === finalized)
      .filter((j) => (q ? (j.clients?.name ?? "").toLowerCase().includes(q) : true));
  };

  const pending = useMemo(() => filter(jobs.data ?? [], false), [jobs.data, search]);
  const done = useMemo(() => filter(jobs.data ?? [], true), [jobs.data, search]);

  const finalise = useMutation({
    mutationFn: async ({
      job,
      amount,
      invoiceNumber,
    }: {
      job: any;
      amount: number;
      invoiceNumber: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("jobs")
        .update({
          finalized: true,
          finalized_at: new Date().toISOString(),
          finalized_by: userRes.user?.id ?? null,
          invoice_number: invoiceNumber,
          invoice_amount: amount,
        })
        .eq("id", job.id);
      if (error) throw error;

      const urls = await signed(job.photo_urls ?? []);
      const photos: string[] = [];
      for (const u of urls) {
        try {
          photos.push(await toDataUrl(u));
        } catch {
          /* ignore */
        }
      }
      const doc = buildInvoicePdf({
        invoiceNumber,
        date: todayISO(),
        clientName: job.clients?.name ?? "Client",
        clientAddress: job.clients?.address ?? null,
        serviceDate: job.completed_at ?? job.scheduled_date,
        amount,
        notes: job.comments,
        lines: (job.clients?.client_categories ?? []).map((cc: any) => ({
          label: cc.categories?.label ?? "Filter",
          qty: cc.quantity,
        })),
        photos,
      });
      doc.save(`${invoiceNumber}-${(job.clients?.name ?? "client").replace(/\W+/g, "-")}.pdf`);
    },
    onSuccess: () => {
      toast.success("Approved — invoice PDF generated");
      setActive(null);
      qc.invalidateQueries({ queryKey: ["admin", "finalise"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Job Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review the driver's photos, then finalise the job to raise the client invoice.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Awaiting approval ({pending.length})</TabsTrigger>
          <TabsTrigger value="done">Finalised ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3 pt-4">
          {pending.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nothing waiting on approval.
              </CardContent>
            </Card>
          )}
          {pending.map((j) => (
            <JobCard key={j.id} job={j} onReview={() => setActive(j)} />
          ))}
        </TabsContent>
        <TabsContent value="done" className="space-y-3 pt-4">
          {done.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No finalised jobs yet.
              </CardContent>
            </Card>
          )}
          {done.map((j) => (
            <JobCard key={j.id} job={j} onReview={() => setActive(j)} />
          ))}
        </TabsContent>
      </Tabs>

      <ReviewDialog
        job={active}
        onClose={() => setActive(null)}
        onFinalise={(amount, invoiceNumber) =>
          finalise.mutate({ job: active, amount, invoiceNumber })
        }
        busy={finalise.isPending}
      />
    </div>
  );
}

function JobCard({ job, onReview }: { job: any; onReview: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{job.clients?.name ?? "—"}</span>
          {job.finalized ? (
            <Badge className="bg-emerald-600">Finalised {job.invoice_number ?? ""}</Badge>
          ) : (
            <Badge variant="secondary">{(job.photo_urls ?? []).length} photos</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4 pt-0 text-xs text-muted-foreground">
        <div>
          Completed {formatDate((job.completed_at ?? job.scheduled_date).slice(0, 10))} ·{" "}
          {job.vans?.name ?? "No van"} ·{" "}
          {job.profiles?.full_name || job.profiles?.email || "Driver"}
          {job.comments ? ` · ${job.comments}` : ""}
        </div>
        <Button size="sm" variant={job.finalized ? "outline" : "default"} onClick={onReview}>
          {job.finalized ? "View" : "Review"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
  job,
  onClose,
  onFinalise,
  busy,
}: {
  job: any | null;
  onClose: () => void;
  onFinalise: (amount: number, invoiceNumber: string) => void;
  busy: boolean;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  useEffect(() => {
    if (!job) return;
    setAmount(String(job.invoice_amount ?? job.payment_amount ?? ""));
    setInvoiceNumber(job.invoice_number ?? `INV-${String(job.id).slice(0, 6).toUpperCase()}`);
    signed(job.photo_urls ?? []).then(setUrls);
  }, [job]);

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{job?.clients?.name} — job review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {urls.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground justify-center">
              <ImageOff className="h-4 w-4" /> No photos attached
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {urls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img
                    src={u}
                    alt={`Service photo ${i + 1}`}
                    className="h-28 w-full rounded-md object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice number</Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Invoice amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={busy || !amount || !invoiceNumber}
            onClick={() => onFinalise(Number(amount), invoiceNumber)}
          >
            {job?.finalized ? (
              <>
                <FileDown className="mr-2 h-4 w-4" /> Re-download invoice
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & generate invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
