import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PendingDriver = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export function PendingDrivers() {
  const qc = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["pending-drivers"],
    queryFn: async () => {
      // Profiles that are not approved AND have a driver role
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");
      if (rErr) throw rErr;
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, approved" as never)
        .in("id", ids)
        .eq("approved" as never, false as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingDriver[];
    },
    refetchInterval: 30000,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ approved: true } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Driver approved");
      qc.invalidateQueries({ queryKey: ["pending-drivers"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      // Remove driver role; profile stays but has no role so they can't access anything
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", id)
        .eq("role", "driver");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Driver rejected");
      qc.invalidateQueries({ queryKey: ["pending-drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Pending driver approvals</CardTitle>
        </div>
        {pending.length > 0 && (
          <Badge variant="destructive">{pending.length}</Badge>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="text-sm text-muted-foreground">No drivers awaiting approval.</div>
        ) : (
          <ul className="divide-y">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.full_name || "Unnamed driver"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => approve.mutate(p.id)}
                    disabled={approve.isPending}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject.mutate(p.id)}
                    disabled={reject.isPending}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
