import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only the admin can manage drivers");
}

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { full_name: string; email: string; password: string }) => {
    if (!d.email?.trim() || !d.password || d.password.length < 6)
      throw new Error("Email and a password of at least 6 characters are required");
    return { full_name: d.full_name?.trim() ?? "", email: d.email.trim().toLowerCase(), password: d.password };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name || data.email },
    });
    if (error) throw new Error(error.message);
    const id = created.user!.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "driver" });
    await supabaseAdmin
      .from("profiles")
      .update({ approved: true, full_name: data.full_name || data.email } as never)
      .eq("id", id);
    return { id };
  });

export const updateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; full_name: string; email: string; password?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const attrs: Record<string, unknown> = { email, user_metadata: { full_name: data.full_name } };
    if (data.password) {
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
      attrs.password = data.password;
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, attrs);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name.trim(), email } as never)
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("vans").update({ driver_id: null }).eq("driver_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
