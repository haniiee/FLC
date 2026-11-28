import { isAdminError, requireAdmin } from "../../../../_auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> },
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { groupId, userId } = await context.params;
  const body = await request.json();
  const { error } = await admin
    .from("group_members")
    .update({ role: body.role })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    return Response.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 400 });
  }
  const { data: profile } = await admin.from("users").select("*").eq("id", userId).single();
  return Response.json({
    userId,
    displayName: profile?.display_name,
    phone: profile?.phone,
    role: body.role,
    joinedAt: new Date().toISOString(),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ groupId: string; userId: string }> },
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { groupId, userId } = await context.params;
  await admin.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  return new Response(null, { status: 204 });
}
