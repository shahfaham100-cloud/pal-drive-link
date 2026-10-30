import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient } from "@/components/ClientForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/clients/new")({
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/admin/clients">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New client</h1>
      </div>
      <ClientForm
        initial={emptyClient}
        submitLabel="Create client"
        onSubmit={async (v) => {
          const { categories, ...rest } = v;
          const { data, error } = await supabase
            .from("clients")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert(rest as any)
            .select("id")
            .single();
          if (error) {
            toast.error(friendlyClientError(error, v.name));
            return;
          }
          if (categories.length) {
            const { error: e2 } = await supabase.from("client_categories").insert(
              categories.map((c) => ({
                client_id: data.id,
                category_id: c.category_id,
                quantity: c.quantity,
              })),
            );
            if (e2) {
              toast.error(e2.message);
              return;
            }
          }
          toast.success("Client created");
          navigate({ to: "/admin/clients" });
        }}
      />
    </div>
  );
}
