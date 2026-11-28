import { isAdminError, requireAdmin } from "../../../_auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const { id } = await context.params;
  const body = await request.json();
  const teacherUserId = body.teacherUserId as string;
  await admin.from("groups").update({ owner_id: teacherUserId }).eq("id", id);
  await admin.from("group_members").upsert({
    group_id: id,
    user_id: teacherUserId,
    role: "teacher",
  });
  const { data } = await admin.from("groups").select("*").eq("id", id).single();
  return Response.json({
    id: data?.id,
    name: data?.name,
    ownerId: data?.owner_id,
    memberCount: 0,
    createdAt: data?.created_at,
  });
}
