import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Truck, ClipboardList, AlertTriangle, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && role === "admin") navigate({ to: "/admin" });
    else if (user && role === "driver") navigate({ to: "/driver" });
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-slate-900 text-white">
              <Truck className="h-4 w-4" />
            </div>
            RunSheet
          </div>
          <Link to="/auth">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Kitchen filter service ops
          </div>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900">
            Turn the paper run sheet into a live dashboard.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Track every restaurant, filter, and van in one place. Drivers see today's stops.
            Admins see missed jobs, pauses, and totals.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">Get started</Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: "Multi-van runs", body: "Assign clients to Van 1, 2 or 3." },
            {
              icon: ClipboardList,
              title: "Daily run sheet",
              body: "Drivers see stops, filters, and notes.",
            },
            {
              icon: AlertTriangle,
              title: "Missed job alerts",
              body: "Uncompleted jobs surface automatically.",
            },
            {
              icon: CalendarClock,
              title: "Pause / vacation mode",
              body: "Auto-resume after the end date.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-white p-5 shadow-sm">
              <f.icon className="h-5 w-5 text-slate-700" />
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-slate-600">{f.body}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
