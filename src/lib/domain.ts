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

export function addDaysISO(date: string | Date, days: number): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
