// Driver login management runs through admin-checked database functions,
// so it works on any host (e.g. GoDaddy) without the private service key.
import { supabase } from "@/integrations/supabase/client";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createDriver({ data }: { data: { full_name: string; email: string; password: string } }) {
  const { data: id, error } = await supabase.rpc("admin_create_driver", {
    _email: data.email,
    _password: data.password,
    _full_name: data.full_name,
  });
  fail(error);
  return { id };
}

export async function updateDriver({
  data,
}: {
  data: { id: string; full_name: string; email: string; password?: string };
}) {
  const { error } = await supabase.rpc("admin_update_driver", {
    _id: data.id,
    _email: data.email,
    _full_name: data.full_name,
    _password: data.password || undefined,
  });
  fail(error);
  return { ok: true };
}

export async function deleteDriver({ data }: { data: { id: string } }) {
  const { error } = await supabase.rpc("admin_delete_driver", { _id: data.id });
  fail(error);
  return { ok: true };
}
