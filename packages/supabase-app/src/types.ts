export type DbUser = {
  id: string;
  phone: string;
  display_name: string;
  platform_role: "teacher" | "user" | "admin";
  must_change_password: boolean;
  created_at: string;
};

export type DbGroup = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type DbGroupMember = {
  group_id: string;
  user_id: string;
  role: "teacher" | "assistant" | "student";
  joined_at: string;
};

export type DbSession = {
  id: string;
  group_id: string;
  number: number;
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DbTopic = {
  id: string;
  session_id: string;
  number: number;
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DbFile = {
  id: string;
  group_id: string;
  session_id: string | null;
  topic_id: string | null;
  kind: "audio" | "pdf" | "image" | "video" | "text";
  number: number | null;
  title: string | null;
  storage_key: string | null;
  mime_type: string;
  size_bytes: number;
  duration_ms: number | null;
  text_content: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  processing_error: string | null;
  source: "upload" | "recording";
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

export type DbPlaylist = {
  id: string;
  owner_id: string;
  number: number;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPlaylistItem = {
  id: string;
  playlist_id: string;
  file_id: string;
  position: number;
  added_at: string;
};

export type DbBookmark = {
  id: string;
  user_id: string;
  file_id: string;
  position_ms: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type DbInvite = {
  id: string;
  group_id: string;
  code: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  created_at: string;
};

export type DbChatChannel = {
  id: string;
  group_id: string;
  kind: "all" | "students";
  created_at: string;
};

export type DbChatMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  type: "text" | "voice";
  text?: string | null;
  body?: string | null;
  storage_key: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  status: "pending" | "processing" | "ready" | "failed" | null;
  processing_error: string | null;
  reply_to_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at?: string;
};

export const CLASS_FILES_BUCKET = "class-files";
