import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Upload, Download, Trash2, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/domain";

const CSV_HEADERS = [
  "name",
  "phone",
  "address",
  "suburb",
  "frequency",
  "priority",
  "next_service_date",
  "time_notes",
  "comments",
] as const;

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

import { FREQUENCIES, PRIORITIES, formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  component: ClientsList,
});

function ClientsList() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ van_id: "", frequency: "", priority: "", next_service_date: "" });
  const [csvText, setCsvText] = useState("");
  const [search, setSearch] = useState("");
  const [vanFilter, setVanFilter] = useState<string>("all");
  const [freqFilter, setFreqFilter] = useState<string>("all");
  const [prioFilter, setPrioFilter] = useState<string>("all");

  const clients = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(id, name)")
        .order("name");
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
    const q = search.trim().toLowerCase();
    return (clients.data ?? []).filter((c: any) => {
      if (q && !(`${c.name} ${c.address ?? ""}`.toLowerCase().includes(q))) return false;
      if (vanFilter !== "all") {
        const vid = (c.vans as { id: string } | null)?.id ?? "none";
        if (vanFilter === "none" ? vid !== "none" : vid !== vanFilter) return false;
      }
      if (freqFilter !== "all" && c.frequency !== freqFilter) return false;
      if (prioFilter !== "all" && c.priority !== prioFilter) return false;
      return true;
    });
  }, [clients.data, search, vanFilter, freqFilter, prioFilter]);

  const total = clients.data?.length ?? 0;

  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const toggleAll = () =>
    setSelected(allSelected ? [] : filtered.map((c: any) => c.id));
  const toggleOne = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const exportCsv = () => {
    const lines = [CSV_HEADERS.join(",")];
    (selected.length ? filtered.filter((c: any) => selected.includes(c.id)) : filtered).forEach(
      (c: any) => lines.push(CSV_HEADERS.map((h) => csvEscape(c[h])).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clients-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().in("id", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Removed ${selected.length} client(s)`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkEdit = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {};
      if (edit.van_id) patch.van_id = edit.van_id === "none" ? null : edit.van_id;
      if (edit.frequency) patch.frequency = edit.frequency;
      if (edit.priority) patch.priority = edit.priority;
      if (edit.next_service_date) patch.next_service_date = edit.next_service_date;
      if (Object.keys(patch).length === 0) throw new Error("Choose at least one field to change");
      const { error } = await supabase.from("clients").update(patch as never).in("id", selected);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Updated ${selected.length} client(s)`);
      setEditOpen(false);
      setEdit({ van_id: "", frequency: "", priority: "", next_service_date: "" });
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkImport = useMutation({
    mutationFn: async () => {
      const rows = parseCsv(csvText);
      if (rows.length < 2) throw new Error("Paste a header row plus at least one client");
      const head = rows[0].map((h) => h.trim().toLowerCase());
      const payload = rows.slice(1).map((r) => {
        const rec: Record<string, any> = {};
        head.forEach((h, i) => {
          const v = (r[i] ?? "").trim();
          if (CSV_HEADERS.includes(h as any) && v !== "") rec[h] = v;
        });
        if (!rec.name) throw new Error("Every row needs a name");
        rec.frequency ??= "weekly";
        rec.priority ??= "medium";
        rec.next_service_date ??= todayISO();
        return rec;
      });
      const { error } = await supabase.from("clients").insert(payload as any);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} client(s)`);
      setImportOpen(false);
      setCsvText("");
      qc.invalidateQueries({ queryKey: ["admin", "clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Clients <span className="text-muted-foreground font-normal">({filtered.length}{filtered.length !== total ? ` of ${total}` : ""})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Restaurants and other sites on your run sheet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Bulk import
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Link to="/admin/clients/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New client
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
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
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Frequency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
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

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-white px-4 py-2 text-sm">
          <span>{selected.length} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Bulk edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDelete.isPending}
              onClick={() => bulkDelete.mutate()}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete clients
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Van</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Next service</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {total === 0 ? (
                    <>No clients yet. <Link to="/admin/clients/new" className="text-primary underline">Add your first client</Link>.</>
                  ) : (
                    "No clients match your filters."
                  )}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c: any) => {
              const prio = PRIORITIES[c.priority as keyof typeof PRIORITIES];
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={`Select ${c.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.address ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(c.vans as { name: string } | null)?.name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.frequency === "custom"
                      ? c.custom_frequency_label || `Every ${c.custom_frequency_days ?? "?"}d`
                      : FREQUENCIES[c.frequency]?.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prio.color}>
                      {prio.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.next_service_date)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/admin/clients/$id" params={{ id: c.id }}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import clients</DialogTitle>
            <DialogDescription>
              Upload or paste CSV with these columns: {CSV_HEADERS.join(", ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCsvText(await f.text());
              }}
            />
            <Textarea
              rows={8}
              placeholder={CSV_HEADERS.join(",")}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!csvText.trim() || bulkImport.isPending} onClick={() => bulkImport.mutate()}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk edit {selected.length} client(s)</DialogTitle>
            <DialogDescription>
              Only the fields you set below will be changed. Leave a field on "No change" to keep it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Van</Label>
              <Select value={edit.van_id} onValueChange={(v) => setEdit({ ...edit, van_id: v })}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {vans.data?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={edit.frequency} onValueChange={(v) => setEdit({ ...edit, frequency: v })}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={edit.priority} onValueChange={(v) => setEdit({ ...edit, priority: v })}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next service date</Label>
              <Input
                type="date"
                value={edit.next_service_date}
                onChange={(e) => setEdit({ ...edit, next_service_date: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEdit({ van_id: "", frequency: "", priority: "", next_service_date: "" })}
            >
              Reset fields
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button disabled={bulkEdit.isPending} onClick={() => bulkEdit.mutate()}>
              Apply to {selected.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
