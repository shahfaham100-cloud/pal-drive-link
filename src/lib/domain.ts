// Domain constants and helpers shared across the app.

export const FREQUENCIES: Record<string, { label: string; days: number | null }> = {
  weekly: { label: "Weekly", days: 7 },
  fortnightly: { label: "Fortnightly", days: 14 },
  "3weekly": { label: "3 Weekly", days: 21 },
  monthly: { label: "Monthly / 4 Weekly", days: 28 },
  "6weekly": { label: "6 Weekly", days: 42 },
  "2monthly": { label: "2 Monthly", days: 60 },
  "3monthly": { label: "3 Monthly", days: 90 },
  oncall: { label: "On Call", days: null },
  custom: { label: "Custom", days: null },
};

export const PRIORITIES = {
  low: { label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "High", color: "bg-red-100 text-red-800 border-red-200" },
} as const;

export function frequencyDays(
  frequency: string,
  customDays: number | null | undefined,
): number | null {
  if (frequency === "custom") return customDays ?? null;
  return FREQUENCIES[frequency]?.days ?? null;
}

/** Adds days to a YYYY-MM-DD date using UTC arithmetic so the result never
 *  shifts by a day depending on the viewer's time zone. */
export function addDaysISO(date: string | Date, days: number): string {
  const iso =
    typeof date === "string"
      ? date.slice(0, 10)
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
          date.getDate(),
        ).padStart(2, "0")}`;
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date in the user's local time zone (not UTC). */
export function todayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

