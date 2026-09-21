// Rebuilds a client's future planned schedule entries when their frequency changes.
// Keeps the nearest upcoming visit as the anchor (date, run, van, driver), wipes all
// future planned entries, then recreates visits at the new frequency for 3 months.

import { addDaysISO, frequencyDays, todayISO } from "@/lib/domain";

const HORIZON_DAYS = 92;

export async function rescheduleClientFromFrequency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  clientId: string,
  frequency: string,
  customFrequencyDays: number | null | undefined,
  nextServiceDate: string | null | undefined,
): Promise<{ created: number; removed: number }> {
  const today = todayISO();

  // Find future planned entries for this client.
  const { data: future, error: fErr } = await supabase
    .from("schedule_entries")
    .select("id, scheduled_date, run_id, van_id, driver_id, position")
    .eq("client_id", clientId)
    .eq("status", "planned")
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true });
  if (fErr) throw fErr;

  const entries = (future ?? []) as Array<{
    id: string;
    scheduled_date: string;
    run_id: string | null;
    van_id: string | null;
    driver_id: string | null;
    position: number;
  }>;

  const anchor = entries[0] ?? null;
  const startDate = anchor?.scheduled_date ?? nextServiceDate ?? today;

  // Wipe all future planned entries for this client.
  const { error: dErr } = await supabase
    .from("schedule_entries")
    .delete()
    .eq("client_id", clientId)
    .eq("status", "planned")
    .gte("scheduled_date", today);
  if (dErr) throw dErr;

  const days = frequencyDays(frequency, customFrequencyDays);
  if (!days) return { created: 0, removed: entries.length }; // on-call / no interval

  // Recreate at the new frequency for ~3 months from the anchor date.
  const rows: Array<Record<string, unknown>> = [];
  for (let d = startDate; d <= addDaysISO(startDate, HORIZON_DAYS); d = addDaysISO(d, days)) {
    rows.push({
      client_id: clientId,
      scheduled_date: d,
      run_id: anchor?.run_id ?? null,
      van_id: anchor?.van_id ?? null,
      driver_id: anchor?.driver_id ?? null,
      position: anchor?.position ?? 0,
      status: "planned",
      notes: "Auto-scheduled (recurring)",
    });
  }
  const { error: iErr } = await supabase
    .from("schedule_entries")
    .upsert(rows as never, { onConflict: "client_id,scheduled_date", ignoreDuplicates: true });
  if (iErr) throw iErr;

  return { created: rows.length, removed: entries.length };
}
