import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/admin";

export type AdminContext = {
  user: User;
  admin: SupabaseClient;
};

export async function requireAdmin(): Promise<AdminContext | { error: Response }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      error: Response.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      ),
    };
  }
  const admin = createServiceSupabaseClient();
  const { data: profile } = await admin
    .from("users")
    .select("platform_role")
    .eq("id", user.id)
    .single();
  if (profile?.platform_role !== "admin") {
    return {
      error: Response.json(
        { error: { code: "FORBIDDEN", message: "Admin only" } },
        { status: 403 },
      ),
    };
  }
  return { user, admin };
}

export function isAdminError(
  value: AdminContext | { error: Response },
): value is { error: Response } {
  return "error" in value;
}
