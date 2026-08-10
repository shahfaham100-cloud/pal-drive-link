// Calendar + schedule helpers.

export const RUN_NUMBERS = [1, 2, 3, 4] as const;
export const MAX_RUNS_PER_DAY = 4;

export function toISO(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function parseISO(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** 6x7 grid of days covering the month, starting Monday. */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function suburbOf(client: {
  suburb?: string | null;
  address?: string | null;
}): string {
  if (client.suburb && client.suburb.trim()) return client.suburb.trim();
  const parts = (client.address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1] : "";
}

export function mapsUrl(address: string | null | undefined): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? "")}`;
}
