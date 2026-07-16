import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      if (!ids.length) return [] as { user_id: string; full_name: string | null; email: string | null }[];
      const { data: profs, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (e2) throw e2;
      return (profs ?? []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        email: p.email,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vans & drivers</h1>
        <p className="text-sm text-muted-foreground">Set up runs and assign a driver to each.</p>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vans.data?.map((van) => (
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
    </div>
  );
}
