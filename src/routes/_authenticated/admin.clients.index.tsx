import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { FREQUENCIES, PRIORITIES, formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  component: ClientsList,
});

function ClientsList() {
  const [search, setSearch] = useState("");
  const [vanFilter, setVanFilter] = useState<string>("all");
  const [freqFilter, setFreqFilter] = useState<string>("all");
  const [prioFilter, setPrioFilter] = useState<string>("all");

  const clients = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(id, name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const vans = useQuery({
    queryKey: ["admin", "vans-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vans").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients.data ?? []).filter((c: any) => {
      if (q && !(`${c.name} ${c.address ?? ""}`.toLowerCase().includes(q))) return false;
      if (vanFilter !== "all") {
        const vid = (c.vans as { id: string } | null)?.id ?? "none";
        if (vanFilter === "none" ? vid !== "none" : vid !== vanFilter) return false;
      }
      if (freqFilter !== "all" && c.frequency !== freqFilter) return false;
      if (prioFilter !== "all" && c.priority !== prioFilter) return false;
      return true;
    });
  }, [clients.data, search, vanFilter, freqFilter, prioFilter]);

  const total = clients.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Clients <span className="text-muted-foreground font-normal">({filtered.length}{filtered.length !== total ? ` of ${total}` : ""})</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Restaurants and other sites on your run sheet.
          </p>
        </div>
        <Link to="/admin/clients/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New client
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={vanFilter} onValueChange={setVanFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Van" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vans</SelectItem>
            <SelectItem value="none">Unassigned</SelectItem>
            {vans.data?.map((v) => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={freqFilter} onValueChange={setFreqFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Frequency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {Object.entries(FREQUENCIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={prioFilter} onValueChange={setPrioFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Van</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Next service</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {total === 0 ? (
                    <>No clients yet. <Link to="/admin/clients/new" className="text-primary underline">Add your first client</Link>.</>
                  ) : (
                    "No clients match your filters."
                  )}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c: any) => {
              const prio = PRIORITIES[c.priority as keyof typeof PRIORITIES];
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.address ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {(c.vans as { name: string } | null)?.name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.frequency === "custom"
                      ? c.custom_frequency_label || `Every ${c.custom_frequency_days ?? "?"}d`
                      : FREQUENCIES[c.frequency]?.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prio.color}>
                      {prio.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.next_service_date)}</TableCell>
                  <TableCell className="text-right">
                    <Link to="/admin/clients/$id" params={{ id: c.id }}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
