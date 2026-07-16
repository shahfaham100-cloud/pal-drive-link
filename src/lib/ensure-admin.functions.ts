import { createServerFn } from "@tanstack/react-start";

const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin@admin.com";

export const ensureAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look up by email via listUsers (paginated). For a fresh project, first page is fine.
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;

  let user = list.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);

  if (!user) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Administrator" },
    });
    if (createErr) throw createErr;
    user = created.user ?? undefined;
  }

  if (!user) throw new Error("Failed to ensure admin user");

  // Ensure admin role row
  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!existingRole) {
    await supabaseAdmin.from("user_roles").insert({ user_id: user.id, role: "admin" });
  }

  // Ensure the admin profile is marked approved
  await supabaseAdmin
    .from("profiles")
    .update({ approved: true } as never)
    .eq("id", user.id);

  return { ok: true };
});
