# Change auto-scheduling horizon from 3 months to 1 year

## What changes

All automatic recurring scheduling currently plans visits 92 days (~3 months) ahead. Extend this to 1 year (365 days) everywhere:

1. **Scheduling a job (Schedule page)** — when a job is added, recurring visits are auto-created up to the horizon. Change the horizon from 92 days to 365 days from the selected date.
2. **Frequency change (client edit page + bulk edit)** — when a client's frequency changes, future visits are rebuilt. Change the same horizon from 92 to 365 days.

## Files

- `src/lib/reschedule.ts` — `HORIZON_DAYS` 92 → 365; update the "3 months" comments.
- `src/routes/_authenticated/admin.schedule.tsx` — `addClients` loop end date `addDaysISO(selected, 92)` → `365`; update the success toast to say "the next 1 year".
- `src/routes/_authenticated/admin.clients.$id.tsx` — toast text "next 3 months" → "next 1 year" (and comment).
- `src/routes/_authenticated/admin.clients.index.tsx` — bulk-edit toast text "next 3 months" → "next 1 year" (and comment).

## Notes

- No database or server changes — dates stay computed in the fixed UTC-safe way already in place, so the timezone fix is unaffected.
- A weekly job will now create ~52 visits instead of ~13; the existing batched insert handles this (one save per client), so scheduling stays fast.
- Duplicate prevention is unchanged: existing entries on the same date are kept, not overwritten.
- After edits, verify the build is OK and confirm via a quick browser check that a weekly job added on a date now schedules every following week for a full year.
