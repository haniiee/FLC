import { isAdminError, requireAdmin } from "../../_auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { id } = await context.params;
  const body = await request.json();
  const { data, error } = await admin
    .from("groups")
    .update({ name: body.name })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    return Response.json({ error: { code: "DB_ERROR", message: error?.message } }, { status: 400 });
  }
  return Response.json({
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    memberCount: 0,
    createdAt: data.created_at,
  });
}
