import { isAdminError, requireAdmin } from "../_auth";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin } = auth;
  const q = new URL(request.url).searchParams.get("q")?.trim();
  let query = admin.from("groups").select("*, members:group_members(count)").order("created_at", {
    ascending: false,
  });
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  if (error) {
    return Response.json({ error: { code: "DB_ERROR", message: error.message } }, { status: 400 });
  }
  return Response.json({
    groups: (data ?? []).map((g: Record<string, unknown>) => {
      const members = g.members as Array<{ count: number }> | undefined;
      return {
        id: g.id,
        name: g.name,
        ownerId: g.owner_id,
        memberCount: Array.isArray(members) ? (members[0]?.count ?? 0) : 0,
        createdAt: g.created_at,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth.error;
  const { admin, user } = auth;
  const body = await request.json();
  const teacherId = body.teacherUserId || user.id;
  const { data, error } = await admin
    .from("groups")
    .insert({ name: body.name, owner_id: teacherId })
    .select("*")
    .single();
  if (error || !data) {
    return Response.json({ error: { code: "DB_ERROR", message: error?.message } }, { status: 400 });
  }
  await admin.from("group_members").upsert({
    group_id: data.id,
    user_id: teacherId,
    role: "teacher",
  });
  return Response.json({
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    memberCount: 1,
    createdAt: data.created_at,
  });
}
