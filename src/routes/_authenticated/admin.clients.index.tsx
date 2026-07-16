import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { FREQUENCIES, PRIORITIES, formatDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  component: ClientsList,
});

function ClientsList() {
  const clients = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, vans(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
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
            {clients.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No clients yet.{" "}
                  <Link to="/admin/clients/new" className="text-primary underline">
                    Add your first client
                  </Link>
                  .
                </TableCell>
              </TableRow>
            )}
            {clients.data?.map((c) => {
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
