import { isAdminError, requireAdmin } from "../../../_auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const password = body.password || `Tmp-${Math.random().toString(36).slice(2, 10)}a1`;
  const updated = await admin.auth.admin.updateUserById(id, { password });
  if (updated.error) {
    return Response.json(
      { error: { code: "RESET_FAILED", message: updated.error.message } },
      { status: 400 },
    );
  }
  await admin.from("users").update({ must_change_password: true }).eq("id", id);
  return Response.json({ temporaryPassword: password });
}
