import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { FREQUENCIES, todayISO } from "@/lib/domain";
import { AddressInput } from "@/components/AddressInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface ClientFormValue {
  name: string;
  phone: string;
  address: string;
  suburb: string;
  time_notes: string;
  comments: string;
  priority: "low" | "medium" | "high";
  frequency: string;
  custom_frequency_days: number | null;
  custom_frequency_label: string;
  van_id: string | null;
  next_service_date: string;
  active: boolean;
  categories: { category_id: string; quantity: number }[];
}

export const emptyClient: ClientFormValue = {
  name: "",
  phone: "",
  address: "",
  suburb: "",
  time_notes: "",
  comments: "",
  priority: "medium",
  frequency: "weekly",
  custom_frequency_days: null,
  custom_frequency_label: "",
  van_id: null,
  next_service_date: todayISO(),
  active: true,
  categories: [],
};

export function ClientForm({
  initial,
  onSubmit,
  submitLabel = "Save",
}: {
  initial: ClientFormValue;
  onSubmit: (v: ClientFormValue) => Promise<void>;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ClientFormValue>(initial);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  useEffect(() => setV(initial), [initial]);

  const vans = useQuery({
    queryKey: ["vans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vans").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("label");
      if (error) throw error;
      return data;
    },
  });

  const addCustomCategory = useMutation({
    mutationFn: async (v: { label: string; color: string }) => {
      const key = v.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + Date.now();
      const { error } = await supabase
        .from("categories")
        .insert({ key, label: v.label, color: v.color, is_custom: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const [newCat, setNewCat] = useState({ label: "", color: "#6366f1" });
  const [catDialogOpen, setCatDialogOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(v);
    } finally {
      setBusy(false);
    }
  };

  const addCat = () => {
    const first = categories.data?.[0];
    if (!first) return;
    if (v.categories.some((c) => c.category_id === first.id)) return;
    setV({ ...v, categories: [...v.categories, { category_id: first.id, quantity: 1 }] });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Restaurant / site name</Label>
              <Input
                required
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="space-y-2">
              <Label>Address</Label>
              <AddressInput
                value={v.address}
                onChange={(address) => setV((prev) => ({ ...prev, address }))}
                onSuburbChange={(suburb) => setV((prev) => ({ ...prev, suburb }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Suburb</Label>
              <Input
                value={v.suburb}
                placeholder="e.g. Parramatta"
                onChange={(e) => setV({ ...v, suburb: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time notes (e.g. "Early", "After 10:30am")</Label>
            <Input
              value={v.time_notes}
              onChange={(e) => setV({ ...v, time_notes: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Comments / instructions</Label>
            <Textarea
              rows={3}
              placeholder="e.g. Must be shiny. Contact 1 hour beforehand."
              value={v.comments}
              onChange={(e) => setV({ ...v, comments: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={v.priority}
                onValueChange={(x) => setV({ ...v, priority: x as ClientFormValue["priority"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to van</Label>
              <Select
                value={v.van_id ?? "none"}
                onValueChange={(x) => setV({ ...v, van_id: x === "none" ? null : x })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {vans.data?.map((van) => (
                    <SelectItem key={van.id} value={van.id}>
                      {van.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={v.frequency} onValueChange={(x) => setV({ ...v, frequency: x })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCIES).map(([k, def]) => (
                    <SelectItem key={k} value={k}>
                      {def.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Next service date</Label>
              <Input
                type="date"
                value={v.next_service_date}
                onChange={(e) => setV({ ...v, next_service_date: e.target.value })}
              />
            </div>
          </div>
          {v.frequency === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-md border bg-slate-50 p-3">
              <div className="space-y-2">
                <Label>Custom label</Label>
                <Input
                  placeholder="e.g. Every 5 weeks"
                  value={v.custom_frequency_label}
                  onChange={(e) => setV({ ...v, custom_frequency_label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Interval (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={v.custom_frequency_days ?? ""}
                  onChange={(e) =>
                    setV({
                      ...v,
                      custom_frequency_days: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters / categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {v.categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No filter categories added yet.
            </p>
          )}
          {v.categories.map((cc, i) => {
            const cat = categories.data?.find((x) => x.id === cc.category_id);
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: cat?.color ?? "#ccc" }}
                />
                <Select
                  value={cc.category_id}
                  onValueChange={(x) => {
                    const next = [...v.categories];
                    next[i] = { ...next[i], category_id: x };
                    setV({ ...v, categories: next });
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.data?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={cc.quantity}
                  onChange={(e) => {
                    const next = [...v.categories];
                    next[i] = { ...next[i], quantity: Number(e.target.value) };
                    setV({ ...v, categories: next });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setV({ ...v, categories: v.categories.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addCat}>
              <Plus className="mr-1 h-4 w-4" /> Add filter
            </Button>
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  + Custom category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New category</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={newCat.label}
                      onChange={(e) => setNewCat({ ...newCat, label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={newCat.color}
                      onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!newCat.label) return;
                      await addCustomCategory.mutateAsync(newCat);
                      toast.success("Category added");
                      setNewCat({ label: "", color: "#6366f1" });
                      setCatDialogOpen(false);
                    }}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
