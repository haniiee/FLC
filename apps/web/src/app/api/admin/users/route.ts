import { phoneToAuthEmail, normalizePhone } from "@app/supabase-app";
import { isAdminError, requireAdmin } from "../_auth";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const q = new URL(request.url).searchParams.get("q")?.trim();
  let query = admin.from("users").select("*").order("created_at", { ascending: false }).limit(100);
  if (q) query = query.or(`phone.ilike.%${q}%,display_name.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) {
    return Response.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 400 });
  }
  return Response.json({
    users: (data ?? []).map((u: Record<string, unknown>) => ({
      id: u.id,
      phone: u.phone,
      displayName: u.display_name,
      platformRole: u.platform_role,
      mustChangePassword: u.must_change_password,
      createdAt: u.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin, user } = auth;
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  const password = body.password || `Tmp-${Math.random().toString(36).slice(2, 10)}a1`;
  const email = phoneToAuthEmail(phone);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: body.displayName },
    app_metadata: { platform_role: body.platformRole || "user" },
  });
  if (created.error || !created.data.user) {
    return Response.json(
      { error: { code: "CREATE_FAILED", message: created.error?.message || "create failed" } },
      { status: 400 },
    );
  }
  await admin.from("users").upsert({
    id: created.data.user.id,
    phone,
    display_name: body.displayName,
    password_hash: "",
    platform_role: body.platformRole || "user",
    must_change_password: true,
    created_by: user.id,
  });
  return Response.json({
    user: {
      id: created.data.user.id,
      phone,
      displayName: body.displayName,
      platformRole: body.platformRole || "user",
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    },
    temporaryPassword: password,
  });
}
