import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/domain";
import { toISO } from "@/lib/schedule";

type ClientRow = { id: string; name: string; address?: string | null; van_id?: string | null };
type VanRow = { id: string; name: string };

type ParsedRow = {
  rowNumber: number;
  rawClient: string;
  rawDate: string;
  date: string | null;
  run: number;
  vanId: string | null;
  vanName: string;
  clientId: string | null;
  error: string | null;
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) return String(row[k] ?? "").trim();
  }
  return "";
}

function parseCsvRows(text: string): Record<string, string>[] {
  const grid: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      grid.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    grid.push(row);
  }
  const rows = grid.filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    head.forEach((h, i) => (rec[h] = (r[i] ?? "").trim()));
    return rec;
  });
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) return toISO(value);
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return toISO(new Date(year, Number(m) - 1, Number(d)));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : toISO(parsed);
}

export function ImportScheduleDialog({
  clients,
  vans,
  defaultDate,
  onImported,
}: {
  clients: ClientRow[];
  vans: VanRow[];
  defaultDate: string;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const matchClient = (raw: string) => {
    const n = norm(raw);
    if (!n) return null;
    const exact = clients.find((c) => norm(c.name) === n);
    if (exact) return exact;
    const partial = clients.filter(
      (c) => norm(c.name).includes(n) || n.includes(norm(c.name)) || norm(c.address).includes(n),
    );
    return partial.length === 1 ? partial[0] : null;
  };

  const matchVan = (raw: string) => {
    const n = norm(raw);
    if (!n) return null;
    return (
      vans.find((v) => norm(v.name) === n) ??
      vans.find((v) => norm(v.name).includes(n) || n.includes(norm(v.name))) ??
      null
    );
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      let raw: Record<string, unknown>[];
      if (isCsv) {
        raw = parseCsvRows(await file.text());
        if (!raw.length) throw new Error("That CSV has no data rows");
      } else {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!raw.length) throw new Error("The first sheet has no rows");
      }

      const parsed: ParsedRow[] = raw.map((r, i) => {
        const rawClient = pick(r, ["client", "client name", "customer", "name", "site"]);
        const dateCellKey = Object.keys(r).find((k) =>
          ["date", "service date", "scheduled date", "day"].includes(norm(k)),
        );
        const dateValue = dateCellKey ? r[dateCellKey] : "";
        const date = parseDate(dateValue) ?? (String(dateValue).trim() ? null : defaultDate);
        const runRaw = pick(r, ["run", "run number", "run #", "driver run"]);
        const runNum = Number(String(runRaw).replace(/[^\d]/g, ""));
        const run = runNum >= 1 && runNum <= 4 ? runNum : 1;
        const vanRaw = pick(r, ["van", "vehicle", "van name", "driver", "rego"]);
        const van = matchVan(vanRaw);
        const client = matchClient(rawClient);

        return {
          rowNumber: i + 2,
          rawClient,
          rawDate: dateValue instanceof Date ? toISO(dateValue) : String(dateValue ?? ""),
          date,
          run,
          vanId: van?.id ?? client?.van_id ?? null,
          vanName: van?.name ?? vanRaw,
          clientId: client?.id ?? null,
          error: !rawClient
            ? "Missing client name"
            : !client
              ? "No matching client"
              : !date
                ? "Unreadable date"
                : null,
        };
      });
      setRows(parsed);
      setFileName(file.name);
    } catch (e: any) {
      toast.error(e.message ?? "Could not read that file");
    } finally {
      setBusy(false);
    }
  };

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  const doImport = async () => {
    if (!valid.length) return;
    setBusy(true);
    try {
      const runCache = new Map<string, { id: string; van_id: string | null }>();
      const getRun = async (date: string, runNumber: number, vanId: string | null) => {
        const key = `${date}#${runNumber}`;
        const cached = runCache.get(key);
        if (cached) return cached;
        const { data: found } = await supabase
          .from("runs")
          .select("id, van_id")
          .eq("run_date", date)
          .eq("run_number", runNumber)
          .maybeSingle();
        let run = found as { id: string; van_id: string | null } | null;
        if (!run) {
          const { data, error } = await supabase
            .from("runs")
            .insert({ run_date: date, run_number: runNumber, van_id: vanId })
            .select("id, van_id")
            .single();
          if (error) throw error;
          run = data as any;
        } else if (vanId && !run.van_id) {
          await supabase.from("runs").update({ van_id: vanId }).eq("id", run.id);
          run = { ...run, van_id: vanId };
        }
        runCache.set(key, run!);
        return run!;
      };

      const payload: any[] = [];
      const positions = new Map<string, number>();
      for (const r of valid) {
        const run = await getRun(r.date!, r.run, r.vanId);
        const key = `${r.date}#${r.run}`;
        const pos = positions.get(key) ?? 0;
        positions.set(key, pos + 1);
        payload.push({
          client_id: r.clientId,
          scheduled_date: r.date,
          run_id: run.id,
          van_id: r.vanId ?? run.van_id ?? null,
          position: pos,
        });
      }

      const { error } = await supabase
        .from("schedule_entries")
        .upsert(payload, { onConflict: "client_id,scheduled_date" });
      if (error) throw error;

      toast.success(`Imported ${payload.length} scheduled job${payload.length === 1 ? "" : "s"}`);
      onImported();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const sampleRows = () =>
    (clients.slice(0, 6).length ? clients.slice(0, 6) : [{ name: "Client name", van_id: null }]).map(
      (c: any, i) => ({
        Client: c.name,
        Date: defaultDate,
        Run: (i % 4) + 1,
        Van: vans.find((v) => v.id === c.van_id)?.name ?? vans[i % Math.max(vans.length, 1)]?.name ?? "",
      }),
    );

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows()), "Schedule");
    XLSX.writeFile(wb, "schedule-template.xlsx");
  };

  const downloadCsvTemplate = () => {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = sampleRows();
    const csv = [
      "Client,Date,Run,Van",
      ...rows.map((r) => [r.Client, r.Date, r.Run, r.Van].map(esc).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schedule-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import daily schedule from Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload one sheet with all drivers' jobs. Columns:{" "}
            <span className="font-medium">Client</span>, <span className="font-medium">Date</span>,{" "}
            <span className="font-medium">Run</span> (1-4), <span className="font-medium">Van</span>{" "}
            (optional). Missing dates default to {formatDate(defaultDate)}.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="mr-2 h-4 w-4" /> Choose file
            </Button>
            <Button variant="ghost" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download template
            </Button>
            {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex gap-2">
                <Badge variant="secondary">{valid.length} ready</Badge>
                {invalid.length > 0 && <Badge variant="destructive">{invalid.length} skipped</Badge>}
              </div>
              <div className="max-h-[320px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr className="text-left">
                      <th className="p-2">Row</th>
                      <th className="p-2">Client</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Run</th>
                      <th className="p-2">Van</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                        <td className="p-2">{r.rawClient || "—"}</td>
                        <td className="p-2">{r.date ? formatDate(r.date) : r.rawDate || "—"}</td>
                        <td className="p-2">Run {r.run}</td>
                        <td className="p-2">{r.vanName || "—"}</td>
                        <td className="p-2">
                          {r.error ? (
                            <span className="text-destructive">{r.error}</span>
                          ) : (
                            <span className="text-emerald-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={doImport} disabled={busy || !valid.length}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {valid.length || ""} job{valid.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
