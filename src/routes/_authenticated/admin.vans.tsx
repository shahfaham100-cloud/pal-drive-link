import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Truck, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/vans")({
  component: VansPage,
});

function VansPage() {
  const qc = useQueryClient();
  const [newVan, setNewVan] = useState("");
  const [vanSearch, setVanSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [driverStatus, setDriverStatus] = useState<"all" | "assigned" | "unassigned">("all");

  const vans = useQuery({
    queryKey: ["admin", "vans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vans").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const drivers = useQuery({
    queryKey: ["admin", "drivers"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "driver");
      if (error) throw error;
      const ids = roles?.map((r) => r.user_id) ?? [];
      if (!ids.length) return [] as { user_id: string; full_name: string | null; email: string | null; approved: boolean }[];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name, email, approved" as never)
        .in("id", ids);
      if (e2) throw e2;
      return ((profs ?? []) as any[]).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
        approved: !!p.approved,
      }));
    },
  });

  const addVan = async () => {
    if (!newVan) return;
    const { error } = await supabase.from("vans").insert({ name: newVan });
    if (error) return toast.error(error.message);
    setNewVan("");
    qc.invalidateQueries({ queryKey: ["admin", "vans"] });
  };

  // Driver id -> assigned van
  const driverAssignments = useMemo(() => {
    const map = new Map<string, string>();
    vans.data?.forEach((v: any) => {
      if (v.driver_id) map.set(v.driver_id, v.name);
    });
    return map;
  }, [vans.data]);

  const filteredVans = useMemo(() => {
    const q = vanSearch.trim().toLowerCase();
    return (vans.data ?? []).filter((v: any) =>
      !q || v.name.toLowerCase().includes(q),
    );
  }, [vans.data, vanSearch]);

  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    return (drivers.data ?? []).filter((d) => {
      if (q && !`${d.full_name ?? ""} ${d.email ?? ""}`.toLowerCase().includes(q)) return false;
      const assigned = driverAssignments.has(d.user_id);
      if (driverStatus === "assigned" && !assigned) return false;
      if (driverStatus === "unassigned" && assigned) return false;
      return true;
    });
  }, [drivers.data, driverSearch, driverStatus, driverAssignments]);

  const totalVans = vans.data?.length ?? 0;
  const totalDrivers = drivers.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vans & drivers</h1>
        <p className="text-sm text-muted-foreground">Set up runs and assign a driver to each.</p>
      </div>

      <Tabs defaultValue="vans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vans" className="gap-2">
            <Truck className="h-4 w-4" /> Vans
            <Badge variant="secondary" className="ml-1">{totalVans}</Badge>
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-2">
            <Users className="h-4 w-4" /> Drivers
            <Badge variant="secondary" className="ml-1">{totalDrivers}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add a van</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Van 1"
                  value={newVan}
                  onChange={(e) => setNewVan(e.target.value)}
                />
                <Button onClick={addVan}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">
              Showing {filteredVans.length}{filteredVans.length !== totalVans ? ` of ${totalVans}` : ""} van{totalVans === 1 ? "" : "s"}
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vans..."
                value={vanSearch}
                onChange={(e) => setVanSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVans.length === 0 && (
              <div className="text-sm text-muted-foreground col-span-full text-center py-8">
                {totalVans === 0 ? "No vans yet." : "No vans match your search."}
              </div>
            )}
            {filteredVans.map((van: any) => (
              <Card key={van.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>{van.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm(`Delete ${van.name}?`)) return;
                      await supabase.from("vans").delete().eq("id", van.id);
                      qc.invalidateQueries({ queryKey: ["admin", "vans"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label>Driver</Label>
                  <Select
                    value={van.driver_id ?? "none"}
                    onValueChange={async (v) => {
                      const { error } = await supabase
                        .from("vans")
                        .update({ driver_id: v === "none" ? null : v })
                        .eq("id", van.id);
                      if (error) toast.error(error.message);
                      else toast.success("Driver updated");
                      qc.invalidateQueries({ queryKey: ["admin", "vans"] });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {drivers.data?.map((d) => (
                        <SelectItem key={d.user_id} value={d.user_id}>
                          {d.full_name || d.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">
              Showing {filteredDrivers.length}{filteredDrivers.length !== totalDrivers ? ` of ${totalDrivers}` : ""} driver{totalDrivers === 1 ? "" : "s"}
            </div>
            <div className="flex gap-2">
              <Select value={driverStatus} onValueChange={(v) => setDriverStatus(v as any)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All drivers</SelectItem>
                  <SelectItem value="assigned">Assigned to a van</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="divide-y p-0">
              {filteredDrivers.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {totalDrivers === 0 ? "No drivers yet." : "No drivers match your filters."}
                </div>
              )}
              {filteredDrivers.map((d) => {
                const van = driverAssignments.get(d.user_id);
                return (
                  <div key={d.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {d.full_name || "Unnamed driver"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{d.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!d.approved && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          Pending
                        </Badge>
                      )}
                      {van ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {van}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600">
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
