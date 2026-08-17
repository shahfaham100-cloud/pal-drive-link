import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Truck,
  AlertTriangle,
  PauseCircle,
  LogOut,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/approvals", label: "Driver Approvals", icon: UserCheck },
  
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/schedule", label: "Schedule", icon: ClipboardList },
  { to: "/admin/vans", label: "Vans & Drivers", icon: Truck },
  { to: "/admin/pauses", label: "Pauses", icon: PauseCircle },
  { to: "/admin/missed", label: "Missed Jobs", icon: AlertTriangle },
];

function AdminLayout() {
  const { role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && role && role !== "admin") navigate({ to: "/driver", replace: true });
  }, [role, loading, navigate]);

  if (loading || role !== "admin")
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-white">
            <Truck className="h-3.5 w-3.5" />
          </div>
          RunSheet
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <div className="truncate">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-10 flex items-center justify-between border-b bg-slate-900 px-4 py-3 text-white">
        <div className="font-semibold">RunSheet Admin</div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="md:hidden flex gap-1 overflow-x-auto border-b bg-white px-2 py-2">
        {nav.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                active ? "bg-slate-900 text-white" : "text-slate-700",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <main className="md:pl-60">
        <div className="hidden md:flex sticky top-0 z-10 items-center justify-end gap-2 border-b bg-slate-900 px-6 py-2.5 text-white">
          <NotificationsBell />
        </div>
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
