import type { ApiClient, TokenStore } from "@app/api-client";
import type {
  AuthResponse,
  Bookmark,
  ChatMessage,
  FileDto,
  GroupDetail,
  GroupMember,
  GroupRole,
  GroupSummary,
  Invite,
  PlaylistDetail,
  PlaylistSummary,
  PlaylistTrack,
  PublicInvite,
  User,
} from "@app/shared-types";
import {
  fileDisplayName,
  playlistDisplayName,
  sessionDisplayName,
  topicDisplayName,
} from "@app/shared-types";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError, fromSupabaseError, requireAuthUserId } from "./errors";
import {
  mapChatMessage,
  mapFile,
  mapSessionDetailSession,
  mapSessionSummary,
  mapTopicDetailTopic,
  mapTopicSummary,
  mapUser,
} from "./mappers";
import { normalizePhone, phoneToAuthEmail } from "./phone";
import {
  CLASS_FILES_BUCKET,
  type DbBookmark,
  type DbChatChannel,
  type DbChatMessage,
  type DbFile,
  type DbGroup,
  type DbGroupMember,
  type DbInvite,
  type DbPlaylist,
  type DbPlaylistItem,
  type DbSession,
  type DbTopic,
  type DbUser,
} from "./types";

function iso(value: string | Date | null | undefined) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function baseMime(mimeType: string) {
  return mimeType.split(";")[0]!.trim().toLowerCase();
}

function mimeToKind(mimeType: string, source: "upload" | "recording" = "upload") {
  const mime = baseMime(mimeType);
  if (mime.startsWith("audio/") || source === "recording") return "audio" as const;
  if (mime === "application/pdf") return "pdf" as const;
  if (mime.startsWith("image/")) return "image" as const;
  if (mime.startsWith("video/")) return "video" as const;
  if (mime.startsWith("text/")) return "text" as const;
  throw new AppError(400, "INVALID_MIME", `Unsupported mime type: ${mime}`);
}

async function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress?: (progress: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new AppError(xhr.status, "UPLOAD_FAILED", "Upload failed"));
    };
    xhr.onerror = () => reject(new AppError(0, "UPLOAD_FAILED", "Upload failed"));
    xhr.send(body);
  });
}

export type CreateSupabaseApiClientOptions = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  tokenStore?: TokenStore;
  /** Browser/mobile client. If omitted, a new client is created. */
  supabase?: SupabaseClient;
  /** Base URL for Next.js admin routes that need the service role. */
  adminApiBaseUrl?: string;
  /** Public web origin for invite links (e.g. https://flc-landing.vercel.app). */
  webOrigin?: string;
};

export function createSupabaseApiClient(options: CreateSupabaseApiClientOptions): ApiClient {
  const supabase =
    options.supabase ??
    createClient(options.supabaseUrl, options.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

  const adminBase = (options.adminApiBaseUrl ?? "").replace(/\/$/, "");
  const webOrigin = (
    options.webOrigin ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://flc-landing.vercel.app"
  ).replace(/\/$/, "");

  async function currentUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  }

  async function loadProfile(userId: string): Promise<User> {
    const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
    if (error || !data) throw fromSupabaseError(error);
    return mapUser(data as DbUser);
  }

  async function authResponseFromSession(): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw fromSupabaseError(error);
    const session = data.session;
    if (!session?.user) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
    const user = await loadProfile(session.user.id);
    if (options.tokenStore) {
      await options.tokenStore.setTokens({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      });
    }
    return {
      user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };
  }

  async function nextNumber(
    table: "sessions" | "topics" | "playlists" | "files",
    filter: Record<string, string | null>,
  ) {
    let query = supabase.from(table).select("number").order("number", { ascending: false }).limit(1);
    for (const [key, value] of Object.entries(filter)) {
      if (value === null) query = query.is(key, null);
      else query = query.eq(key, value);
    }
    const { data } = await query;
    const current = (data?.[0] as { number?: number } | undefined)?.number ?? 0;
    return current + 1;
  }

  async function getSignedUrl(storageKey: string, downloadName?: string) {
    const { data, error } = await supabase.storage
      .from(CLASS_FILES_BUCKET)
      .createSignedUrl(storageKey, 3600, downloadName ? { download: downloadName } : undefined);
    if (error || !data?.signedUrl) throw fromSupabaseError(error);
    return data.signedUrl;
  }

  function mapInviteRow(row: DbInvite): Invite {
    return {
      id: row.id,
      code: row.code,
      url: `${webOrigin}/join/${row.code}`,
      expiresAt: row.expires_at ? iso(row.expires_at) : null,
      maxUses: row.max_uses,
      uses: row.uses,
      revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
      createdAt: iso(row.created_at),
    };
  }

  async function sessionCounts(sessionId: string) {
    const [topics, files] = await Promise.all([
      supabase.from("topics").select("*", { count: "exact", head: true }).eq("session_id", sessionId),
      supabase.from("files").select("*", { count: "exact", head: true }).eq("session_id", sessionId),
    ]);
    return { topicCount: topics.count ?? 0, fileCount: files.count ?? 0 };
  }

  async function topicFileCount(topicId: string) {
    const { count } = await supabase
      .from("files")
      .select("*", { count: "exact", head: true })
      .eq("topic_id", topicId);
    return count ?? 0;
  }

  async function memberRoleInGroup(groupId: string, userId: string): Promise<GroupRole> {
    const { data } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as GroupRole | undefined) ?? "student";
  }

  async function playlistSummaryRow(p: DbPlaylist): Promise<PlaylistSummary> {
    const { data: items } = await supabase
      .from("playlist_items")
      .select("file:files(duration_ms)")
      .eq("playlist_id", p.id);
    let totalDurationMs = 0;
    for (const row of items ?? []) {
      const file = row.file as { duration_ms?: number | null } | null;
      totalDurationMs += file?.duration_ms ?? 0;
    }
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      displayName: playlistDisplayName({ number: p.number, title: p.title }),
      itemCount: items?.length ?? 0,
      totalDurationMs,
      updatedAt: iso(p.updated_at),
    };
  }

  async function loadPlaylistDetail(playlistId: string): Promise<PlaylistDetail> {
    const uid = requireAuthUserId(await currentUserId());
    const { data: playlist, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();
    if (error || !playlist) throw fromSupabaseError(error);
    const p = playlist as DbPlaylist;

    const { data: itemRows } = await supabase
      .from("playlist_items")
      .select("*, file:files(*)")
      .eq("playlist_id", playlistId)
      .order("position");

    const tracks: PlaylistTrack[] = [];
    let totalDurationMs = 0;

    for (const row of itemRows ?? []) {
      const file = row.file as unknown as DbFile | null;
      if (!file) continue;
      totalDurationMs += file.duration_ms ?? 0;

      const { data: group } = await supabase.from("groups").select("name").eq("id", file.group_id).single();
      const groupName = (group as { name?: string } | null)?.name ?? "";

      let sessionLabel = "";
      if (file.session_id) {
        const { data: session } = await supabase
          .from("sessions")
          .select("number, title")
          .eq("id", file.session_id)
          .single();
        if (session) {
          const s = session as Pick<DbSession, "number" | "title">;
          sessionLabel = sessionDisplayName({ number: s.number, title: s.title });
        }
      }

      let topicLabel: string | undefined;
      if (file.topic_id) {
        const { data: topic } = await supabase
          .from("topics")
          .select("number, title")
          .eq("id", file.topic_id)
          .single();
        if (topic) {
          const t = topic as Pick<DbTopic, "number" | "title">;
          topicLabel = topicDisplayName({ number: t.number, title: t.title });
        }
      }

      const { data: membership } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", file.group_id)
        .eq("user_id", uid)
        .maybeSingle();
      const available =
        Boolean(membership) &&
        file.kind === "audio" &&
        file.status === "ready" &&
        Boolean(file.storage_key);

      const track: PlaylistTrack = {
        fileId: file.id,
        displayName: fileDisplayName(file) ?? "Voice",
        durationMs: file.duration_ms,
        groupId: file.group_id,
        groupDisplayName: groupName,
        sessionDisplayName: sessionLabel,
        available,
      };
      if (topicLabel) track.topicDisplayName = topicLabel;
      if (available && file.storage_key) {
        track.url = await getSignedUrl(file.storage_key);
      }
      tracks.push(track);
    }

    return {
      ...(await playlistSummaryRow(p)),
      itemCount: tracks.length,
      totalDurationMs,
      items: tracks,
    };
  }

  async function bookmarkToDto(
    b: DbBookmark,
    file: DbFile,
    userId: string,
  ): Promise<Bookmark> {
    const { data: group } = await supabase.from("groups").select("name").eq("id", file.group_id).single();
    const groupName = (group as { name?: string } | null)?.name ?? "";

    let sessionLabel = "";
    if (file.session_id) {
      const { data: session } = await supabase
        .from("sessions")
        .select("number, title")
        .eq("id", file.session_id)
        .single();
      if (session) {
        const s = session as Pick<DbSession, "number" | "title">;
        sessionLabel = sessionDisplayName({ number: s.number, title: s.title });
      }
    }

    let topicLabel: string | null = null;
    if (file.topic_id) {
      const { data: topic } = await supabase
        .from("topics")
        .select("number, title")
        .eq("id", file.topic_id)
        .single();
      if (topic) {
        const t = topic as Pick<DbTopic, "number" | "title">;
        topicLabel = topicDisplayName({ number: t.number, title: t.title });
      }
    }

    const { data: membership } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", file.group_id)
      .eq("user_id", userId)
      .maybeSingle();
    const available = Boolean(membership) && Boolean(file.storage_key);

    const bookmark: Bookmark = {
      id: b.id,
      fileId: b.file_id,
      kind: file.kind,
      positionMs: b.position_ms,
      note: b.note,
      createdAt: iso(b.created_at),
      available,
      file: {
        displayName: fileDisplayName(file) ?? "File",
        durationMs: file.duration_ms,
        mimeType: file.mime_type,
        groupId: file.group_id,
        groupDisplayName: groupName,
        sessionId: file.session_id,
        sessionDisplayName: sessionLabel,
        topicId: file.topic_id,
        topicDisplayName: topicLabel,
      },
    };
    if (available && file.storage_key) {
      bookmark.url = await getSignedUrl(file.storage_key);
    }
    return bookmark;
  }

  async function mapMessageWithSender(
    message: DbChatMessage & { sender?: DbUser | null },
    groupId: string,
  ): Promise<ChatMessage> {
    const senderRow = message.sender;
    const senderId = message.sender_id;
    const displayName = senderRow?.display_name ?? "User";
    const role = await memberRoleInGroup(groupId, senderId);
    return mapChatMessage(message, { id: senderId, displayName, role });
  }

  async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
    const res = await fetch(`${adminBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new AppError(
        res.status,
        body?.error?.code || "ADMIN_ERROR",
        body?.error?.message || res.statusText,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const client: ApiClient = {
    health: async () => ({
      status: "ok" as const,
      db: "ok" as const,
      storage: "ok" as const,
      ffmpeg: "missing" as const,
    }),

    register: async (body) => {
      const phone = normalizePhone(body.phone);
      const email = phoneToAuthEmail(phone);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: body.password,
        options: {
          data: { display_name: body.displayName },
        },
      });
      if (error) throw fromSupabaseError(error);
      if (!data.session) {
        // Email confirm may be enabled — force sign-in
        const login = await supabase.auth.signInWithPassword({ email, password: body.password });
        if (login.error) throw fromSupabaseError(login.error);
      }
      // Ensure profile exists (trigger should create it)
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (uid) {
        await supabase.from("users").upsert({
          id: uid,
          phone,
          display_name: body.displayName,
          password_hash: "",
          platform_role: "user",
        });
      }
      return authResponseFromSession();
    },

    login: async (body) => {
      const email = phoneToAuthEmail(body.phone);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: body.password,
      });
      if (error) throw fromSupabaseError(error);
      return authResponseFromSession();
    },

    refresh: async (refreshToken) => {
      const token =
        refreshToken ||
        (options.tokenStore ? await options.tokenStore.getRefreshToken() : null) ||
        undefined;
      if (token) {
        const { error } = await supabase.auth.refreshSession({ refresh_token: token });
        if (error) throw fromSupabaseError(error);
      } else {
        const { error } = await supabase.auth.refreshSession();
        if (error) throw fromSupabaseError(error);
      }
      return authResponseFromSession();
    },

    logout: async () => {
      await supabase.auth.signOut();
      if (options.tokenStore) await options.tokenStore.clear();
      return { ok: true };
    },

    changePassword: async (body) => {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
      const verify = await supabase.auth.signInWithPassword({
        email,
        password: body.currentPassword,
      });
      if (verify.error) throw new AppError(400, "INVALID_PASSWORD", "رمز فعلی نادرست است");
      const { error } = await supabase.auth.updateUser({ password: body.newPassword });
      if (error) throw fromSupabaseError(error);
      await supabase
        .from("users")
        .update({ must_change_password: false })
        .eq("id", requireAuthUserId(userData.user?.id));
    },

    me: async () => {
      const uid = requireAuthUserId(await currentUserId());
      return { user: await loadProfile(uid) };
    },

    admin: {
      users: {
        list: async (query) => adminFetch(`/api/admin/users${query?.q ? `?q=${encodeURIComponent(query.q)}` : ""}`),
        create: async (body) =>
          adminFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
        resetPassword: async (id, body = {}) =>
          adminFetch(`/api/admin/users/${id}/reset-password`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
      },
      groups: {
        list: async (query) =>
          adminFetch(`/api/admin/groups${query?.q ? `?q=${encodeURIComponent(query.q)}` : ""}`),
        create: async (body) =>
          adminFetch("/api/admin/groups", { method: "POST", body: JSON.stringify(body) }),
        update: async (id, body) =>
          adminFetch(`/api/admin/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
        setTeacher: async (id, body) =>
          adminFetch(`/api/admin/groups/${id}/teacher`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
      },
      members: {
        list: async (groupId) => adminFetch(`/api/admin/groups/${groupId}/members`),
        add: async (groupId, body) =>
          adminFetch(`/api/admin/groups/${groupId}/members`, {
            method: "POST",
            body: JSON.stringify(body),
          }),
        update: async (groupId, userId, body) =>
          adminFetch(`/api/admin/groups/${groupId}/members/${userId}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        remove: async (groupId, userId) =>
          adminFetch(`/api/admin/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
      },
    },

    createGroup: async (body) => {
      const uid = requireAuthUserId(await currentUserId());
      const { data, error } = await supabase
        .from("groups")
        .insert({ name: body.name, owner_id: uid })
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const group = data as DbGroup;
      await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: uid,
        role: "teacher",
      });
      return {
        id: group.id,
        name: group.name,
        ownerId: group.owner_id,
        myRole: "teacher" as const,
        memberCount: 1,
        createdAt: iso(group.created_at),
        updatedAt: iso(group.updated_at),
      } satisfies GroupSummary;
    },

    listGroups: async () => {
      const uid = requireAuthUserId(await currentUserId());
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("role, group:groups(*)")
        .eq("user_id", uid);
      if (error) throw fromSupabaseError(error);
      const groups = await Promise.all(
        (memberships ?? []).map(async (row) => {
          const group = row.group as unknown as DbGroup;
          const { count } = await supabase
            .from("group_members")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);
          return {
            id: group.id,
            name: group.name,
            ownerId: group.owner_id,
            myRole: row.role as GroupSummary["myRole"],
            memberCount: count ?? 0,
            createdAt: iso(group.created_at),
            updatedAt: iso(group.updated_at),
          };
        }),
      );
      return { groups };
    },

    getGroup: async (id) => {
      const uid = requireAuthUserId(await currentUserId());
      const { data, error } = await supabase.from("groups").select("*").eq("id", id).single();
      if (error || !data) throw fromSupabaseError(error);
      const group = data as DbGroup;
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", id)
        .eq("user_id", uid)
        .maybeSingle();
      return {
        id: group.id,
        name: group.name,
        ownerId: group.owner_id,
        myRole: (membership?.role as GroupDetail["myRole"] | undefined) ?? "student",
        createdAt: iso(group.created_at),
        updatedAt: iso(group.updated_at),
      };
    },

    updateGroup: async (id, body) => {
      const { error } = await supabase.from("groups").update({ name: body.name }).eq("id", id);
      if (error) throw fromSupabaseError(error);
      return client.getGroup(id);
    },

    listMembers: async (groupId) => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("role, joined_at, user:users(*)")
        .eq("group_id", groupId);
      if (error) throw fromSupabaseError(error);
      const members: GroupMember[] =
        memberships?.map((m) => {
          const user = m.user as unknown as DbUser;
          return {
            id: user.id,
            displayName: user.display_name,
            role: m.role as GroupMember["role"],
            joinedAt: iso((m as { joined_at?: string }).joined_at),
            phone: user.phone,
          };
        }) ?? [];
      return { members };
    },

    updateMemberRole: async (groupId, userId, body) => {
      const { error } = await supabase
        .from("group_members")
        .update({ role: body.role })
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    removeMember: async (groupId, userId) => {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    createInvite: async (groupId, body = {}) => {
      const uid = requireAuthUserId(await currentUserId());
      const code = randomCode(8);
      const expiresAt =
        body.expiresInHours != null
          ? new Date(Date.now() + body.expiresInHours * 3_600_000).toISOString()
          : null;
      const { data, error } = await supabase
        .from("group_invites")
        .insert({
          group_id: groupId,
          code,
          created_by: uid,
          expires_at: expiresAt,
          max_uses: body.maxUses ?? null,
        })
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      return mapInviteRow(data as DbInvite);
    },

    listInvites: async (groupId) => {
      const { data, error } = await supabase
        .from("group_invites")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw fromSupabaseError(error);
      return {
        invites: (data as DbInvite[]).map(mapInviteRow),
      };
    },

    revokeInvite: async (groupId, inviteId) => {
      const { error } = await supabase
        .from("group_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("group_id", groupId)
        .eq("id", inviteId);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    getInvite: async (code) => {
      const { data, error } = await supabase
        .from("group_invites")
        .select("*, group:groups(name, id)")
        .eq("code", code)
        .maybeSingle();
      if (error) throw fromSupabaseError(error);
      if (!data) throw new AppError(404, "NOT_FOUND", "Invite not found");
      const group = data.group as unknown as { name: string; id: string };
      const valid =
        !data.revoked_at &&
        (!data.expires_at || new Date(data.expires_at) > new Date()) &&
        (data.max_uses == null || data.uses < data.max_uses);
      const { data: teacherRow } = await supabase
        .from("group_members")
        .select("user:users(display_name)")
        .eq("group_id", group.id)
        .eq("role", "teacher")
        .limit(1)
        .maybeSingle();
      const teacherUser = teacherRow?.user as { display_name?: string } | null | undefined;
      return {
        valid,
        groupName: group.name,
        teacherName: teacherUser?.display_name ?? "",
      } satisfies PublicInvite;
    },

    joinInvite: async (code) => {
      const uid = requireAuthUserId(await currentUserId());
      const { data: invite, error } = await supabase
        .from("group_invites")
        .select("*")
        .eq("code", code)
        .single();
      if (error || !invite) throw fromSupabaseError(error);
      const row = invite as DbInvite;
      if (row.revoked_at) throw new AppError(400, "INVITE_REVOKED", "Invite revoked");
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        throw new AppError(400, "INVITE_EXPIRED", "Invite expired");
      }
      if (row.max_uses != null && row.uses >= row.max_uses) {
        throw new AppError(400, "INVITE_EXHAUSTED", "Invite max uses reached");
      }
      const { data: existing } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", row.group_id)
        .eq("user_id", uid)
        .maybeSingle();
      const alreadyMember = Boolean(existing);
      if (!alreadyMember) {
        await supabase.from("group_members").insert({
          group_id: row.group_id,
          user_id: uid,
          role: "student",
        });
        await supabase
          .from("group_invites")
          .update({ uses: row.uses + 1 })
          .eq("id", row.id);
      }
      return {
        groupId: row.group_id,
        role: (existing?.role as "student" | undefined) ?? "student",
        alreadyMember,
      };
    },

    listSessions: async (groupId) => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("group_id", groupId)
        .order("number", { ascending: true });
      if (error) throw fromSupabaseError(error);
      const sessions = await Promise.all(
        (data as DbSession[]).map(async (s) => {
          const counts = await sessionCounts(s.id);
          return mapSessionSummary(s, counts);
        }),
      );
      return { sessions };
    },

    listGroupFiles: async (groupId) => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw fromSupabaseError(error);
      return { files: (data as DbFile[]).map(mapFile) };
    },

    createSession: async (groupId, body = {}) => {
      const uid = requireAuthUserId(await currentUserId());
      const number = await nextNumber("sessions", { group_id: groupId });
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          group_id: groupId,
          number,
          title: body.title ?? null,
          created_by: uid,
        })
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const s = data as DbSession;
      return mapSessionSummary(s, { topicCount: 0, fileCount: 0 });
    },

    getSession: async (id) => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", id).single();
      if (error || !data) throw fromSupabaseError(error);
      const s = data as DbSession;
      const { data: topics } = await supabase
        .from("topics")
        .select("*")
        .eq("session_id", id)
        .order("number");
      const { data: files } = await supabase.from("files").select("*").eq("session_id", id);
      const topicRows = (topics as DbTopic[]) ?? [];
      const topicSummaries = await Promise.all(
        topicRows.map(async (t) => mapTopicSummary(t, await topicFileCount(t.id))),
      );
      return {
        session: mapSessionDetailSession(s),
        topics: topicSummaries,
        files: ((files as DbFile[]) ?? []).map(mapFile),
      };
    },

    updateSession: async (id, body) => {
      const { data, error } = await supabase
        .from("sessions")
        .update({ title: body.title ?? null })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const s = data as DbSession;
      const counts = await sessionCounts(id);
      return mapSessionSummary(s, counts);
    },

    deleteSession: async (id) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    createTopic: async (sessionId, body = {}) => {
      const uid = requireAuthUserId(await currentUserId());
      const number = await nextNumber("topics", { session_id: sessionId });
      const { data, error } = await supabase
        .from("topics")
        .insert({
          session_id: sessionId,
          number,
          title: body.title ?? null,
          created_by: uid,
        })
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const t = data as DbTopic;
      return mapTopicSummary(t, 0);
    },

    getTopic: async (id) => {
      const { data, error } = await supabase.from("topics").select("*").eq("id", id).single();
      if (error || !data) throw fromSupabaseError(error);
      const t = data as DbTopic;
      const { data: files } = await supabase.from("files").select("*").eq("topic_id", id);
      return {
        topic: mapTopicDetailTopic(t),
        files: ((files as DbFile[]) ?? []).map(mapFile),
      };
    },

    updateTopic: async (id, body) => {
      const { data, error } = await supabase
        .from("topics")
        .update({ title: body.title ?? null })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const t = data as DbTopic;
      return mapTopicSummary(t, await topicFileCount(id));
    },

    deleteTopic: async (id) => {
      const { error } = await supabase.from("topics").delete().eq("id", id);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    createUploadUrl: async (body) => {
      const uid = requireAuthUserId(await currentUserId());
      const kind = mimeToKind(body.mimeType, body.source ?? "upload");
      const { data: sessionRow } = await supabase
        .from("sessions")
        .select("group_id")
        .eq("id", body.sessionId)
        .single();
      const groupId = (sessionRow as { group_id: string } | null)?.group_id;
      if (!groupId) throw new AppError(400, "GROUP_REQUIRED", "sessionId required");
      const fileId = crypto.randomUUID();
      const safeName = (body.fileName || "file").replace(/[^\w.\-]+/g, "_");
      const storageKey = `${groupId}/${fileId}-${safeName}`;
      const number = await nextNumber("files", {
        session_id: body.sessionId,
      } as never);
      const { data: row, error } = await supabase
        .from("files")
        .insert({
          id: fileId,
          group_id: groupId,
          session_id: body.sessionId,
          topic_id: body.topicId ?? null,
          kind,
          number,
          title: body.fileName ?? null,
          storage_key: storageKey,
          mime_type: baseMime(body.mimeType),
          size_bytes: body.sizeBytes ?? 0,
          status: "pending",
          source: body.source ?? "upload",
          uploaded_by: uid,
        })
        .select("*")
        .single();
      if (error || !row) throw fromSupabaseError(error);
      const { data: signed, error: signError } = await supabase.storage
        .from(CLASS_FILES_BUCKET)
        .createSignedUploadUrl(storageKey);
      if (signError || !signed) throw fromSupabaseError(signError);
      return {
        file: mapFile(row as DbFile),
        uploadUrl: signed.signedUrl,
        expiresIn: 900 as const,
      };
    },

    completeFile: async (id) => {
      const { data: row, error } = await supabase.from("files").select("*").eq("id", id).single();
      if (error || !row) throw fromSupabaseError(error);
      const file = row as DbFile;
      if (!file.storage_key) throw new AppError(400, "NO_STORAGE", "Missing storage key");
      const { data: meta } = await supabase.storage
        .from(CLASS_FILES_BUCKET)
        .list(file.storage_key.split("/").slice(0, -1).join("/"), {
          search: file.storage_key.split("/").pop(),
        });
      const size = meta?.[0]?.metadata?.size ?? file.size_bytes;
      const { data: updated, error: updateError } = await supabase
        .from("files")
        .update({
          status: "ready",
          size_bytes: Number(size) || file.size_bytes,
        })
        .eq("id", id)
        .select("*")
        .single();
      if (updateError || !updated) throw fromSupabaseError(updateError);
      return mapFile(updated as DbFile);
    },

    reprocessFile: async (id) => client.completeFile(id),

    createTextFile: async (body) => {
      const uid = requireAuthUserId(await currentUserId());
      const content = "content" in body ? body.content : "";
      let groupId: string | undefined = "groupId" in body ? body.groupId : undefined;
      let sessionId: string | undefined = "sessionId" in body ? body.sessionId : undefined;
      let topicId: string | undefined = "topicId" in body ? body.topicId : undefined;
      if (!groupId && sessionId) {
        const { data } = await supabase
          .from("sessions")
          .select("group_id")
          .eq("id", sessionId)
          .single();
        groupId = (data as { group_id: string } | null)?.group_id ?? "";
      }
      if (!groupId) throw new AppError(400, "GROUP_REQUIRED", "groupId required");
      const { data, error } = await supabase
        .from("files")
        .insert({
          group_id: groupId,
          session_id: sessionId ?? null,
          topic_id: topicId ?? null,
          kind: "text",
          title: null,
          mime_type: "text/plain",
          size_bytes: new TextEncoder().encode(content).byteLength,
          text_content: content,
          status: "ready",
          source: "upload",
          uploaded_by: uid,
        })
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      return mapFile(data as DbFile);
    },

    getFileUrl: async (id, download) => {
      const { data, error } = await supabase.from("files").select("*").eq("id", id).single();
      if (error || !data) throw fromSupabaseError(error);
      const file = data as DbFile;
      if (!file.storage_key) {
        return { url: "https://invalid.local", expiresIn: 1, displayName: file.title || "file" };
      }
      const displayName = fileDisplayName(file) ?? file.storage_key.split("/").pop() ?? "file";
      const url = await getSignedUrl(file.storage_key, download ? displayName : undefined);
      return { url, expiresIn: 3600, displayName };
    },

    updateFile: async (id, body) => {
      const { data, error } = await supabase
        .from("files")
        .update({ title: body.title ?? null })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      return mapFile(data as DbFile);
    },

    deleteFile: async (id) => {
      const { data } = await supabase.from("files").select("storage_key").eq("id", id).single();
      const key = (data as { storage_key?: string } | null)?.storage_key;
      if (key) await supabase.storage.from(CLASS_FILES_BUCKET).remove([key]);
      const { error } = await supabase.from("files").delete().eq("id", id);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },

    getPlaylist: async (sessionId) => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("session_id", sessionId)
        .eq("kind", "audio")
        .eq("status", "ready")
        .order("number", { ascending: true });
      if (error) throw fromSupabaseError(error);
      const files = (data as DbFile[]) ?? [];
      const topicIds = [...new Set(files.map((f) => f.topic_id).filter(Boolean))] as string[];
      const topicMap = new Map<string, Pick<DbTopic, "number" | "title">>();
      if (topicIds.length > 0) {
        const { data: topics } = await supabase.from("topics").select("id, number, title").in("id", topicIds);
        for (const topic of (topics ?? []) as Pick<DbTopic, "id" | "number" | "title">[]) {
          topicMap.set(topic.id, topic);
        }
      }
      const items = await Promise.all(
        files.map(async (file) => {
          const topic = file.topic_id ? topicMap.get(file.topic_id) : undefined;
          const url = file.storage_key
            ? await getSignedUrl(file.storage_key)
            : "https://invalid.local";
          return {
            fileId: file.id,
            displayName: fileDisplayName(file) ?? "Voice",
            durationMs: file.duration_ms,
            url,
            ...(topic
              ? {
                  topicDisplayName: topicDisplayName({ number: topic.number, title: topic.title }),
                }
              : {}),
          };
        }),
      );
      return { items };
    },

    playlists: {
      list: async () => {
        const uid = requireAuthUserId(await currentUserId());
        const { data, error } = await supabase
          .from("playlists")
          .select("*")
          .eq("owner_id", uid)
          .order("updated_at", { ascending: false });
        if (error) throw fromSupabaseError(error);
        const items = await Promise.all((data as DbPlaylist[]).map((p) => playlistSummaryRow(p)));
        return { items };
      },
      create: async (body = {}) => {
        const uid = requireAuthUserId(await currentUserId());
        const number = await nextNumber("playlists", { owner_id: uid });
        const { data, error } = await supabase
          .from("playlists")
          .insert({ owner_id: uid, number, title: body.title ?? null })
          .select("*")
          .single();
        if (error || !data) throw fromSupabaseError(error);
        const playlistId = (data as DbPlaylist).id;
        if (body.fileIds?.length) {
          const rows = body.fileIds.map((fileId, index) => ({
            playlist_id: playlistId,
            file_id: fileId,
            position: index + 1,
          }));
          await supabase.from("playlist_items").insert(rows);
        }
        return loadPlaylistDetail(playlistId);
      },
      get: async (id) => loadPlaylistDetail(id),
      rename: async (id, body) => {
        const { error } = await supabase
          .from("playlists")
          .update({ title: body.title ?? null })
          .eq("id", id);
        if (error) throw fromSupabaseError(error);
        return loadPlaylistDetail(id);
      },
      remove: async (id) => {
        const { error } = await supabase.from("playlists").delete().eq("id", id);
        if (error) throw fromSupabaseError(error);
      },
      addItems: async (id, body) => {
        const { data: existing } = await supabase
          .from("playlist_items")
          .select("position")
          .eq("playlist_id", id)
          .order("position", { ascending: false })
          .limit(1);
        let position = ((existing?.[0] as { position?: number } | undefined)?.position ?? 0) + 1;
        const rows = body.fileIds.map((fileId) => ({
          playlist_id: id,
          file_id: fileId,
          position: position++,
        }));
        const { error } = await supabase.from("playlist_items").upsert(rows);
        if (error) throw fromSupabaseError(error);
        await supabase.from("playlists").update({ updated_at: new Date().toISOString() }).eq("id", id);
        return loadPlaylistDetail(id);
      },
      removeItem: async (id, fileId) => {
        const { error } = await supabase
          .from("playlist_items")
          .delete()
          .eq("playlist_id", id)
          .eq("file_id", fileId);
        if (error) throw fromSupabaseError(error);
        await supabase.from("playlists").update({ updated_at: new Date().toISOString() }).eq("id", id);
        return loadPlaylistDetail(id);
      },
      reorder: async (id, body) => {
        for (let i = 0; i < body.fileIds.length; i += 1) {
          await supabase
            .from("playlist_items")
            .update({ position: i + 1 })
            .eq("playlist_id", id)
            .eq("file_id", body.fileIds[i]!);
        }
        await supabase.from("playlists").update({ updated_at: new Date().toISOString() }).eq("id", id);
        return loadPlaylistDetail(id);
      },
    },

    bookmarks: {
      list: async (query) => {
        const uid = requireAuthUserId(await currentUserId());
        let q = supabase.from("bookmarks").select("*, file:files(*)").eq("user_id", uid);
        if (query?.fileId) q = q.eq("file_id", query.fileId);
        const { data, error } = await q.order("created_at", { ascending: false });
        if (error) throw fromSupabaseError(error);
        const items: Bookmark[] = [];
        for (const row of data ?? []) {
          const b = row as DbBookmark & { file: DbFile | null };
          if (!b.file) continue;
          if (query?.kind && b.file.kind !== query.kind) continue;
          items.push(await bookmarkToDto(b, b.file, uid));
        }
        return { items };
      },
      create: async (body) => {
        const uid = requireAuthUserId(await currentUserId());
        const { data, error } = await supabase
          .from("bookmarks")
          .insert({
            user_id: uid,
            file_id: body.fileId,
            position_ms: body.positionMs ?? null,
            note: body.note ?? null,
          })
          .select("*")
          .single();
        if (error || !data) throw fromSupabaseError(error);
        const { data: fileRow, error: fileError } = await supabase
          .from("files")
          .select("*")
          .eq("id", body.fileId)
          .single();
        if (fileError || !fileRow) throw fromSupabaseError(fileError);
        return bookmarkToDto(data as DbBookmark, fileRow as DbFile, uid);
      },
      update: async (id, body) => {
        const uid = requireAuthUserId(await currentUserId());
        const { data, error } = await supabase
          .from("bookmarks")
          .update({ note: body.note ?? null })
          .eq("id", id)
          .select("*")
          .single();
        if (error || !data) throw fromSupabaseError(error);
        const b = data as DbBookmark;
        const { data: fileRow, error: fileError } = await supabase
          .from("files")
          .select("*")
          .eq("id", b.file_id)
          .single();
        if (fileError || !fileRow) throw fromSupabaseError(fileError);
        return bookmarkToDto(b, fileRow as DbFile, uid);
      },
      remove: async (id) => {
        const { error } = await supabase.from("bookmarks").delete().eq("id", id);
        if (error) throw fromSupabaseError(error);
      },
    },

    uploadFile: async (input) => {
      const mimeType = input.mimeType || input.file.type || "application/octet-stream";
      const fileName = input.fileName || (input.file instanceof File ? input.file.name : "upload.bin");
      const prepared = await client.createUploadUrl({
        sessionId: input.sessionId,
        topicId: input.topicId,
        mimeType,
        sizeBytes: input.file.size,
        fileName,
        source: input.source ?? "upload",
      });
      await putWithProgress(
        prepared.uploadUrl,
        input.file,
        baseMime(mimeType),
        input.onProgress,
      );
      return client.completeFile(prepared.file.id);
    },

    listChats: async (groupId) => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("group_id", groupId);
      if (error) throw fromSupabaseError(error);
      const channels = await Promise.all(
        (data as DbChatChannel[]).map(async (c) => {
          const { data: lastRows } = await supabase
            .from("chat_messages")
            .select("*, sender:users(*)")
            .eq("channel_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastRow = lastRows?.[0] as (DbChatMessage & { sender?: DbUser | null }) | undefined;
          const lastMessage = lastRow
            ? await mapMessageWithSender(lastRow, c.group_id)
            : null;
          return {
            id: c.id,
            groupId: c.group_id,
            kind: c.kind,
            createdAt: iso(c.created_at),
            lastMessage,
          };
        }),
      );
      return { channels };
    },

    listChatMessages: async (channelId, query) => {
      const { data: channelRow } = await supabase
        .from("chat_channels")
        .select("group_id")
        .eq("id", channelId)
        .single();
      const groupId = (channelRow as { group_id?: string } | null)?.group_id;
      if (!groupId) throw new AppError(404, "NOT_FOUND", "Channel not found");

      let q = supabase
        .from("chat_messages")
        .select("*, sender:users(*)")
        .eq("channel_id", channelId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(query?.limit ?? 50);
      if (query?.before) q = q.lt("created_at", query.before);
      const { data, error } = await q;
      if (error) throw fromSupabaseError(error);
      const messages = await Promise.all(
        (data ?? []).map((row) =>
          mapMessageWithSender(row as DbChatMessage & { sender?: DbUser | null }, groupId),
        ),
      );
      messages.reverse();
      return { messages };
    },

    sendChatText: async (channelId, body) => {
      const uid = requireAuthUserId(await currentUserId());
      const { data: channelRow } = await supabase
        .from("chat_channels")
        .select("group_id")
        .eq("id", channelId)
        .single();
      const groupId = (channelRow as { group_id?: string } | null)?.group_id;
      if (!groupId) throw new AppError(404, "NOT_FOUND", "Channel not found");

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          channel_id: channelId,
          sender_id: uid,
          type: "text",
          text: body.text,
          status: "ready",
          reply_to_id: body.replyToId ?? null,
        })
        .select("*, sender:users(*)")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      return mapMessageWithSender(data as DbChatMessage & { sender?: DbUser | null }, groupId);
    },

    createChatVoiceUploadUrl: async (channelId, body) => {
      const uid = requireAuthUserId(await currentUserId());
      const { data: channel } = await supabase
        .from("chat_channels")
        .select("group_id")
        .eq("id", channelId)
        .single();
      const groupId = (channel as { group_id: string } | null)?.group_id;
      if (!groupId) throw new AppError(404, "NOT_FOUND", "Channel not found");
      const messageId = crypto.randomUUID();
      const storageKey = `${groupId}/chat/${messageId}.m4a`;
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          id: messageId,
          channel_id: channelId,
          sender_id: uid,
          type: "voice",
          storage_key: storageKey,
          mime_type: baseMime(body.mimeType),
          size_bytes: body.sizeBytes ?? 0,
          status: "pending",
          reply_to_id: null,
        })
        .select("*, sender:users(*)")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const { data: signed, error: signError } = await supabase.storage
        .from(CLASS_FILES_BUCKET)
        .createSignedUploadUrl(storageKey);
      if (signError || !signed) throw fromSupabaseError(signError);
      return {
        message: await mapMessageWithSender(data as DbChatMessage & { sender?: DbUser | null }, groupId),
        uploadUrl: signed.signedUrl,
        expiresIn: 900 as const,
      };
    },

    completeChatVoice: async (messageId) => {
      const { data: row, error: fetchError } = await supabase
        .from("chat_messages")
        .select("channel_id")
        .eq("id", messageId)
        .single();
      if (fetchError || !row) throw fromSupabaseError(fetchError);
      const { data: channelRow } = await supabase
        .from("chat_channels")
        .select("group_id")
        .eq("id", (row as { channel_id: string }).channel_id)
        .single();
      const groupId = (channelRow as { group_id?: string } | null)?.group_id;
      if (!groupId) throw new AppError(404, "NOT_FOUND", "Channel not found");

      const { data, error } = await supabase
        .from("chat_messages")
        .update({ status: "ready" })
        .eq("id", messageId)
        .select("*, sender:users(*)")
        .single();
      if (error || !data) throw fromSupabaseError(error);
      return mapMessageWithSender(data as DbChatMessage & { sender?: DbUser | null }, groupId);
    },

    getChatMessageUrl: async (messageId) => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("storage_key")
        .eq("id", messageId)
        .single();
      if (error || !data) throw fromSupabaseError(error);
      const key = (data as { storage_key: string | null }).storage_key;
      if (!key) return { url: "", expiresIn: 0 };
      return { url: await getSignedUrl(key), expiresIn: 3600 };
    },

    deleteChatMessage: async (messageId) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw fromSupabaseError(error);
      return { ok: true };
    },
  };

  return client;
}
