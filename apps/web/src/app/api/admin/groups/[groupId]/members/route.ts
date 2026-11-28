import { normalizePhone, phoneToAuthEmail } from "@app/supabase-app";
import { isAdminError, requireAdmin } from "../../../_auth";

type MemberRow = {
  role: string;
  joined_at: string;
  user: {
    id: string;
    display_name: string;
    phone: string;
    platform_role: string;
  };
};

export async function GET(_request: Request, context: { params: Promise<{ groupId: string }> }) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { groupId } = await context.params;
  const { data, error } = await admin
    .from("group_members")
    .select("role, joined_at, user:users(*)")
    .eq("group_id", groupId);
  if (error) {
    return Response.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 400 });
  }
  return Response.json({
    members: ((data ?? []) as unknown as MemberRow[]).map((m) => ({
      userId: m.user.id,
      displayName: m.user.display_name,
      phone: m.user.phone,
      role: m.role,
      joinedAt: m.joined_at,
      platformRole: m.user.platform_role,
    })),
  });
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin, user } = auth;
  const { groupId } = await context.params;
  const body = await request.json();
  let userId = body.userId as string | undefined;
  let temporaryPassword: string | undefined;
  if (!userId && body.newUser) {
    const phone = normalizePhone(body.newUser.phone);
    temporaryPassword = `Tmp-${Math.random().toString(36).slice(2, 10)}a1`;
    const created = await admin.auth.admin.createUser({
      email: phoneToAuthEmail(phone),
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: body.newUser.displayName },
      app_metadata: { platform_role: "user" },
    });
    if (created.error || !created.data.user) {
      return Response.json(
        { error: { code: "CREATE_FAILED", message: created.error?.message || "failed" } },
        { status: 400 },
      );
    }
    userId = created.data.user.id;
    await admin.from("users").upsert({
      id: userId,
      phone,
      display_name: body.newUser.displayName,
      password_hash: "",
      platform_role: "user",
      must_change_password: true,
      created_by: user.id,
    });
  }
  if (!userId) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "userId required" } },
      { status: 400 },
    );
  }
  await admin.from("group_members").upsert({
    group_id: groupId,
    user_id: userId,
    role: body.role || "student",
  });
  const { data: profile } = await admin.from("users").select("*").eq("id", userId).single();
  return Response.json({
    member: {
      userId,
      displayName: profile?.display_name,
      phone: profile?.phone,
      role: body.role || "student",
      joinedAt: new Date().toISOString(),
    },
    temporaryPassword,
  });
}
