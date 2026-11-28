import {
  AddAdminMemberBodySchema,
  AddAdminMemberResponseSchema,
  AdminGroupSchema,
  AdminGroupsListResponseSchema,
  AdminMembersListResponseSchema,
  AdminMemberSchema,
  AdminUsersListResponseSchema,
  AuthResponseSchema,
  ChangePasswordBodySchema,
  ChatChannelsResponseSchema,
  ChatMessageSchema,
  ChatMessagesResponseSchema,
  ChatMessageUrlResponseSchema,
  ChatVoiceUploadBodySchema,
  ChatVoiceUploadResponseSchema,
  CompleteFileBodySchema,
  CreateAdminGroupBodySchema,
  CreateAdminUserBodySchema,
  CreateAdminUserResponseSchema,
  CreateChatTextBodySchema,
  CreateGroupBodySchema,
  CreateInviteBodySchema,
  CreateSessionBodySchema,
  CreateTextFileBodySchema,
  CreateTopicBodySchema,
  FileSchema,
  FileUrlResponseSchema,
  GroupFilesResponseSchema,
  GroupDetailSchema,
  GroupMembersResponseSchema,
  GroupsListResponseSchema,
  GroupSummarySchema,
  HealthResponseSchema,
  InviteSchema,
  InvitesListResponseSchema,
  JoinInviteResponseSchema,
  LoginBodySchema,
  LogoutBodySchema,
  MeResponseSchema,
  OkResponseSchema,
  BookmarkSchema,
  BookmarksListResponseSchema,
  CreateBookmarkBodySchema,
  UpdateBookmarkBodySchema,
  AddPlaylistItemsBodySchema,
  CreatePlaylistBodySchema,
  PlaylistDetailSchema,
  PlaylistResponseSchema,
  PlaylistsListResponseSchema,
  ReorderPlaylistBodySchema,
  UpdatePlaylistBodySchema,
  PublicInviteSchema,
  RefreshBodySchema,
  RegisterBodySchema,
  ResetAdminPasswordBodySchema,
  ResetAdminPasswordResponseSchema,
  SessionDetailSchema,
  SessionSummarySchema,
  SessionsListResponseSchema,
  SetAdminGroupTeacherBodySchema,
  TopicDetailSchema,
  TopicSummarySchema,
  UpdateAdminGroupBodySchema,
  UpdateAdminMemberBodySchema,
  UpdateGroupBodySchema,
  UpdateMemberRoleBodySchema,
  UpdateTitleBodySchema,
  UploadUrlBodySchema,
  UploadUrlResponseSchema,
  type AddAdminMemberBody,
  type AddAdminMemberResponse,
  type AdminGroup,
  type AdminGroupsListResponse,
  type AdminMembersListResponse,
  type AdminMember,
  type AdminUsersListResponse,
  type AuthResponse,
  type ChangePasswordBody,
  type ChatChannelsResponse,
  type ChatMessage,
  type ChatMessagesResponse,
  type ChatMessageUrlResponse,
  type ChatVoiceUploadBody,
  type ChatVoiceUploadResponse,
  type CompleteFileBody,
  type CreateAdminGroupBody,
  type CreateAdminUserBody,
  type CreateAdminUserResponse,
  type CreateChatTextBody,
  type CreateGroupBody,
  type CreateInviteBody,
  type CreateSessionBody,
  type CreateTextFileBody,
  type CreateTopicBody,
  type FileDto,
  type GroupFilesResponse,
  type FileKind,
  type FileUrlResponse,
  type GroupDetail,
  type GroupMembersResponse,
  type GroupsListResponse,
  type GroupSummary,
  type HealthResponse,
  type Invite,
  type InvitesListResponse,
  type JoinInviteResponse,
  type LoginBody,
  type MeResponse,
  type OkResponse,
  type Bookmark,
  type BookmarksListResponse,
  type CreateBookmarkBody,
  type UpdateBookmarkBody,
  type AddPlaylistItemsBody,
  type CreatePlaylistBody,
  type PlaylistDetail,
  type PlaylistResponse,
  type PlaylistsListResponse,
  type ReorderPlaylistBody,
  type UpdatePlaylistBody,
  type PublicInvite,
  type RegisterBody,
  type ResetAdminPasswordBody,
  type ResetAdminPasswordResponse,
  type SessionDetail,
  type SessionSummary,
  type SessionsListResponse,
  type SetAdminGroupTeacherBody,
  type TopicDetail,
  type TopicSummary,
  type UpdateAdminGroupBody,
  type UpdateAdminMemberBody,
  type UpdateGroupBody,
  type UpdateMemberRoleBody,
  type UpdateTitleBody,
  type UploadUrlBody,
  type UploadUrlResponse,
} from "@app/shared-types";
import { z } from "zod";

export type TokenStore = {
  getAccessToken: () => string | null | Promise<string | null>;
  getRefreshToken: () => string | null | Promise<string | null>;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void | Promise<void>;
  clear: () => void | Promise<void>;
};

export type ApiClientOptions = {
  tokenStore?: TokenStore;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

export type UploadFileInput = {
  sessionId: string;
  topicId?: string;
  file: Blob;
  fileName?: string;
  mimeType?: string;
  source?: "upload" | "recording";
  onProgress?: (progress: number) => void;
};

export type ApiClient = {
  health: () => Promise<HealthResponse>;
  register: (body: RegisterBody) => Promise<AuthResponse>;
  login: (body: LoginBody) => Promise<AuthResponse>;
  refresh: (refreshToken?: string) => Promise<AuthResponse>;
  logout: (refreshToken?: string) => Promise<OkResponse>;
  changePassword: (body: ChangePasswordBody) => Promise<void>;
  me: () => Promise<MeResponse>;
  admin: {
    users: {
      list: (query?: { q?: string; cursor?: string }) => Promise<AdminUsersListResponse>;
      create: (body: CreateAdminUserBody) => Promise<CreateAdminUserResponse>;
      resetPassword: (
        id: string,
        body?: ResetAdminPasswordBody,
      ) => Promise<ResetAdminPasswordResponse>;
    };
    groups: {
      list: (query?: { q?: string }) => Promise<AdminGroupsListResponse>;
      create: (body: CreateAdminGroupBody) => Promise<AdminGroup>;
      update: (id: string, body: UpdateAdminGroupBody) => Promise<AdminGroup>;
      setTeacher: (id: string, body: SetAdminGroupTeacherBody) => Promise<AdminGroup>;
    };
    members: {
      list: (groupId: string) => Promise<AdminMembersListResponse>;
      add: (groupId: string, body: AddAdminMemberBody) => Promise<AddAdminMemberResponse>;
      update: (
        groupId: string,
        userId: string,
        body: UpdateAdminMemberBody,
      ) => Promise<AdminMember>;
      remove: (groupId: string, userId: string) => Promise<void>;
    };
  };
  createGroup: (body: CreateGroupBody) => Promise<GroupSummary>;
  listGroups: () => Promise<GroupsListResponse>;
  getGroup: (id: string) => Promise<GroupDetail>;
  updateGroup: (id: string, body: UpdateGroupBody) => Promise<GroupDetail>;
  listMembers: (groupId: string) => Promise<GroupMembersResponse>;
  updateMemberRole: (
    groupId: string,
    userId: string,
    body: UpdateMemberRoleBody,
  ) => Promise<OkResponse>;
  removeMember: (groupId: string, userId: string) => Promise<OkResponse>;
  createInvite: (groupId: string, body?: CreateInviteBody) => Promise<Invite>;
  listInvites: (groupId: string) => Promise<InvitesListResponse>;
  revokeInvite: (groupId: string, inviteId: string) => Promise<OkResponse>;
  getInvite: (code: string) => Promise<PublicInvite>;
  joinInvite: (code: string) => Promise<JoinInviteResponse>;
  listSessions: (groupId: string) => Promise<SessionsListResponse>;
  listGroupFiles: (groupId: string) => Promise<GroupFilesResponse>;
  createSession: (groupId: string, body?: CreateSessionBody) => Promise<SessionSummary>;
  getSession: (id: string) => Promise<SessionDetail>;
  updateSession: (id: string, body: UpdateTitleBody) => Promise<SessionSummary>;
  deleteSession: (id: string) => Promise<OkResponse>;
  createTopic: (sessionId: string, body?: CreateTopicBody) => Promise<TopicSummary>;
  getTopic: (id: string) => Promise<TopicDetail>;
  updateTopic: (id: string, body: UpdateTitleBody) => Promise<TopicSummary>;
  deleteTopic: (id: string) => Promise<OkResponse>;
  createUploadUrl: (body: UploadUrlBody) => Promise<UploadUrlResponse>;
  completeFile: (id: string, body?: CompleteFileBody) => Promise<FileDto>;
  reprocessFile: (id: string) => Promise<FileDto>;
  createTextFile: (body: CreateTextFileBody) => Promise<FileDto>;
  getFileUrl: (id: string, download?: boolean) => Promise<FileUrlResponse>;
  updateFile: (id: string, body: UpdateTitleBody) => Promise<FileDto>;
  deleteFile: (id: string) => Promise<OkResponse>;
  getPlaylist: (sessionId: string) => Promise<PlaylistResponse>;
  playlists: {
    list: () => Promise<PlaylistsListResponse>;
    create: (body?: CreatePlaylistBody) => Promise<PlaylistDetail>;
    get: (id: string) => Promise<PlaylistDetail>;
    rename: (id: string, body: UpdatePlaylistBody) => Promise<PlaylistDetail>;
    remove: (id: string) => Promise<void>;
    addItems: (id: string, body: AddPlaylistItemsBody) => Promise<PlaylistDetail>;
    removeItem: (id: string, fileId: string) => Promise<PlaylistDetail>;
    reorder: (id: string, body: ReorderPlaylistBody) => Promise<PlaylistDetail>;
  };
  bookmarks: {
    list: (query?: { fileId?: string; kind?: FileKind }) => Promise<BookmarksListResponse>;
    create: (body: CreateBookmarkBody) => Promise<Bookmark>;
    update: (id: string, body: UpdateBookmarkBody) => Promise<Bookmark>;
    remove: (id: string) => Promise<void>;
  };
  uploadFile: (input: UploadFileInput) => Promise<FileDto>;
  listChats: (groupId: string) => Promise<ChatChannelsResponse>;
  listChatMessages: (
    channelId: string,
    query?: { before?: string; limit?: number },
  ) => Promise<ChatMessagesResponse>;
  sendChatText: (channelId: string, body: CreateChatTextBody) => Promise<ChatMessage>;
  createChatVoiceUploadUrl: (
    channelId: string,
    body: ChatVoiceUploadBody,
  ) => Promise<ChatVoiceUploadResponse>;
  completeChatVoice: (messageId: string) => Promise<ChatMessage>;
  getChatMessageUrl: (messageId: string) => Promise<ChatMessageUrlResponse>;
  deleteChatMessage: (messageId: string) => Promise<OkResponse>;
};

/** Bypass free-tunnel browser interstitial pages (Pinggy / localtunnel). */
export function tunnelBypassHeaders(url: string): Record<string, string> {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith(".pinggy.net") || host.endsWith(".pinggy-free.link") || host.endsWith(".loca.lt")) {
      return {
        "X-Pinggy-No-Screen": "true",
        "Bypass-Tunnel-Reminder": "true",
      };
    }
  } catch {
    // ignore invalid URL
  }
  return {};
}

function putWithProgress(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (n: number) => void,
) {
  const bypass = tunnelBypassHeaders(url);
  if (typeof XMLHttpRequest === "undefined" || !onProgress) {
    return fetch(url, {
      method: "PUT",
      headers: { "content-type": mimeType, ...bypass },
      body: blob,
    }).then((response) => {
      if (!response.ok) {
        throw new ApiClientError(response.status, "UPLOAD_FAILED", "Upload failed");
      }
    });
  }

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mimeType);
    for (const [key, value] of Object.entries(bypass)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiClientError(xhr.status, "UPLOAD_FAILED", "Upload failed"));
      }
    };
    xhr.onerror = () => reject(new ApiClientError(0, "UPLOAD_FAILED", "Upload failed"));
    xhr.send(blob);
  });
}

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}): ApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const tokenStore = options.tokenStore;
  let refreshPromise: Promise<AuthResponse> | null = null;

  async function parse<T>(schema: z.ZodType<T>, response: Response): Promise<T> {
    const json: unknown = await response.json();
    if (!response.ok) {
      const errorBody = z
        .object({
          error: z.object({
            code: z.string(),
            message: z.string(),
          }),
        })
        .safeParse(json);

      if (errorBody.success) {
        throw new ApiClientError(
          response.status,
          errorBody.data.error.code,
          errorBody.data.error.message,
        );
      }

      throw new ApiClientError(
        response.status,
        "HTTP_ERROR",
        `Request failed (${response.status})`,
      );
    }

    return schema.parse(json);
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...tunnelBypassHeaders(normalizedBaseUrl),
    };

    if (requestOptions.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (requestOptions.auth !== false && tokenStore) {
      const accessToken = await tokenStore.getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
    }

    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      method: requestOptions.method ?? (requestOptions.body !== undefined ? "POST" : "GET"),
      headers,
      body: requestOptions.body !== undefined ? JSON.stringify(requestOptions.body) : undefined,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    if (response.status === 401 && tokenStore && !requestOptions.skipRefresh) {
      const refreshed = await refreshFromStore();
      if (refreshed) {
        return request(path, schema, { ...requestOptions, skipRefresh: true });
      }
    }

    return parse(schema, response);
  }

  async function refreshFromStore(): Promise<boolean> {
    if (!tokenStore) {
      return false;
    }

    const currentRefresh = await tokenStore.getRefreshToken();
    if (!currentRefresh) {
      await tokenStore.clear();
      return false;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const response = await fetch(`${normalizedBaseUrl}/auth/refresh`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...tunnelBypassHeaders(normalizedBaseUrl),
          },
          body: JSON.stringify({ refreshToken: currentRefresh }),
        });

        if (!response.ok) {
          await tokenStore.clear();
          throw new ApiClientError(response.status, "REFRESH_FAILED", "Unable to refresh token");
        }

        const auth = AuthResponseSchema.parse(await response.json());
        await tokenStore.setTokens({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
        });
        return auth;
      })().finally(() => {
        refreshPromise = null;
      });
    }

    try {
      await refreshPromise;
      return true;
    } catch {
      return false;
    }
  }

  async function saveAuth(auth: AuthResponse): Promise<AuthResponse> {
    if (tokenStore) {
      await tokenStore.setTokens({
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
      });
    }
    return auth;
  }

  const client: ApiClient = {
    health: () => request("/health", HealthResponseSchema, { auth: false }),

    register: async (body) => {
      RegisterBodySchema.parse(body);
      return saveAuth(
        await request("/auth/register", AuthResponseSchema, {
          method: "POST",
          body,
          auth: false,
        }),
      );
    },

    login: async (body) => {
      LoginBodySchema.parse(body);
      return saveAuth(
        await request("/auth/login", AuthResponseSchema, {
          method: "POST",
          body,
          auth: false,
        }),
      );
    },

    refresh: async (refreshToken) => {
      const token = refreshToken ?? (await tokenStore?.getRefreshToken()) ?? null;
      if (!token) {
        throw new ApiClientError(401, "NO_REFRESH_TOKEN", "No refresh token available");
      }
      RefreshBodySchema.parse({ refreshToken: token });
      return saveAuth(
        await request("/auth/refresh", AuthResponseSchema, {
          method: "POST",
          body: { refreshToken: token },
          auth: false,
          skipRefresh: true,
        }),
      );
    },

    logout: async (refreshToken) => {
      const token = refreshToken ?? (await tokenStore?.getRefreshToken()) ?? null;
      if (!token) {
        await tokenStore?.clear();
        return { ok: true as const };
      }
      LogoutBodySchema.parse({ refreshToken: token });
      const result = await request("/auth/logout", OkResponseSchema, {
        method: "POST",
        body: { refreshToken: token },
        auth: false,
        skipRefresh: true,
      });
      await tokenStore?.clear();
      return result;
    },

    me: () => request("/me", MeResponseSchema),

    changePassword: async (body) => {
      ChangePasswordBodySchema.parse(body);
      await request<void>("/auth/change-password", z.void(), { method: "POST", body });
    },

    admin: {
      users: {
        list: (query = {}) => {
          const params = new URLSearchParams();
          if (query.q) params.set("q", query.q);
          if (query.cursor) params.set("cursor", query.cursor);
          const qs = params.toString();
          return request(`/admin/users${qs ? `?${qs}` : ""}`, AdminUsersListResponseSchema);
        },
        create: (body) => {
          CreateAdminUserBodySchema.parse(body);
          return request("/admin/users", CreateAdminUserResponseSchema, {
            method: "POST",
            body,
          });
        },
        resetPassword: (id, body = {}) => {
          ResetAdminPasswordBodySchema.parse(body);
          return request(`/admin/users/${id}/reset-password`, ResetAdminPasswordResponseSchema, {
            method: "POST",
            body,
          });
        },
      },
      groups: {
        list: (query = {}) => {
          const params = new URLSearchParams();
          if (query.q) params.set("q", query.q);
          const qs = params.toString();
          return request(`/admin/groups${qs ? `?${qs}` : ""}`, AdminGroupsListResponseSchema);
        },
        create: (body) => {
          CreateAdminGroupBodySchema.parse(body);
          return request("/admin/groups", AdminGroupSchema, { method: "POST", body });
        },
        update: (id, body) => {
          UpdateAdminGroupBodySchema.parse(body);
          return request(`/admin/groups/${id}`, AdminGroupSchema, { method: "PATCH", body });
        },
        setTeacher: (id, body) => {
          SetAdminGroupTeacherBodySchema.parse(body);
          return request(`/admin/groups/${id}/teacher`, AdminGroupSchema, {
            method: "PUT",
            body,
          });
        },
      },
      members: {
        list: (groupId) =>
          request(`/admin/groups/${groupId}/members`, AdminMembersListResponseSchema),
        add: (groupId, body) => {
          AddAdminMemberBodySchema.parse(body);
          return request(`/admin/groups/${groupId}/members`, AddAdminMemberResponseSchema, {
            method: "POST",
            body,
          });
        },
        update: (groupId, userId, body) => {
          UpdateAdminMemberBodySchema.parse(body);
          return request(`/admin/groups/${groupId}/members/${userId}`, AdminMemberSchema, {
            method: "PATCH",
            body,
          });
        },
        remove: (groupId, userId) =>
          request<void>(`/admin/groups/${groupId}/members/${userId}`, z.void(), {
            method: "DELETE",
          }),
      },
    },

    createGroup: (body) => {
      CreateGroupBodySchema.parse(body);
      return request("/groups", GroupSummarySchema, { method: "POST", body });
    },
    listGroups: () => request("/groups", GroupsListResponseSchema),
    getGroup: (id) => request(`/groups/${id}`, GroupDetailSchema),
    updateGroup: (id, body) => {
      UpdateGroupBodySchema.parse(body);
      return request(`/groups/${id}`, GroupDetailSchema, { method: "PATCH", body });
    },
    listMembers: (groupId) => request(`/groups/${groupId}/members`, GroupMembersResponseSchema),
    updateMemberRole: (groupId, userId, body) => {
      UpdateMemberRoleBodySchema.parse(body);
      return request(`/groups/${groupId}/members/${userId}`, OkResponseSchema, {
        method: "PATCH",
        body,
      });
    },
    removeMember: (groupId, userId) =>
      request(`/groups/${groupId}/members/${userId}`, OkResponseSchema, { method: "DELETE" }),
    createInvite: (groupId, body = {}) => {
      CreateInviteBodySchema.parse(body);
      return request(`/groups/${groupId}/invites`, InviteSchema, { method: "POST", body });
    },
    listInvites: (groupId) => request(`/groups/${groupId}/invites`, InvitesListResponseSchema),
    revokeInvite: (groupId, inviteId) =>
      request(`/groups/${groupId}/invites/${inviteId}`, OkResponseSchema, { method: "DELETE" }),
    getInvite: (code) => request(`/invites/${code}`, PublicInviteSchema, { auth: false }),
    joinInvite: (code) =>
      request(`/invites/${code}/join`, JoinInviteResponseSchema, { method: "POST" }),

    listSessions: (groupId) => request(`/groups/${groupId}/sessions`, SessionsListResponseSchema),
    listGroupFiles: (groupId) => request(`/groups/${groupId}/files`, GroupFilesResponseSchema),
    createSession: (groupId, body = {}) => {
      CreateSessionBodySchema.parse(body);
      return request(`/groups/${groupId}/sessions`, SessionSummarySchema, {
        method: "POST",
        body,
      });
    },
    getSession: (id) => request(`/sessions/${id}`, SessionDetailSchema),
    updateSession: (id, body) => {
      UpdateTitleBodySchema.parse(body);
      return request(`/sessions/${id}`, SessionSummarySchema, { method: "PATCH", body });
    },
    deleteSession: (id) => request(`/sessions/${id}`, OkResponseSchema, { method: "DELETE" }),

    createTopic: (sessionId, body = {}) => {
      CreateTopicBodySchema.parse(body);
      return request(`/sessions/${sessionId}/topics`, TopicSummarySchema, {
        method: "POST",
        body,
      });
    },
    getTopic: (id) => request(`/topics/${id}`, TopicDetailSchema),
    updateTopic: (id, body) => {
      UpdateTitleBodySchema.parse(body);
      return request(`/topics/${id}`, TopicSummarySchema, { method: "PATCH", body });
    },
    deleteTopic: (id) => request(`/topics/${id}`, OkResponseSchema, { method: "DELETE" }),

    createUploadUrl: (body) => {
      UploadUrlBodySchema.parse(body);
      return request("/files/upload-url", UploadUrlResponseSchema, { method: "POST", body });
    },
    completeFile: (id, body = {}) => {
      CompleteFileBodySchema.parse(body);
      return request(`/files/${id}/complete`, FileSchema, { method: "POST", body });
    },
    reprocessFile: (id) => request(`/files/${id}/reprocess`, FileSchema, { method: "POST" }),
    createTextFile: (body) => {
      CreateTextFileBodySchema.parse(body);
      return request("/files/text", FileSchema, { method: "POST", body });
    },
    getFileUrl: (id, download = false) =>
      request(`/files/${id}/url${download ? "?download=1" : ""}`, FileUrlResponseSchema),
    updateFile: (id, body) => {
      UpdateTitleBodySchema.parse(body);
      return request(`/files/${id}`, FileSchema, { method: "PATCH", body });
    },
    deleteFile: (id) => request(`/files/${id}`, OkResponseSchema, { method: "DELETE" }),
    getPlaylist: (sessionId) => request(`/sessions/${sessionId}/playlist`, PlaylistResponseSchema),

    playlists: {
      list: () => request("/me/playlists", PlaylistsListResponseSchema),
      create: (body = {}) => {
        CreatePlaylistBodySchema.parse(body);
        return request("/me/playlists", PlaylistDetailSchema, { method: "POST", body });
      },
      get: (id) => request(`/playlists/${id}`, PlaylistDetailSchema),
      rename: (id, body) => {
        UpdatePlaylistBodySchema.parse(body);
        return request(`/playlists/${id}`, PlaylistDetailSchema, { method: "PATCH", body });
      },
      remove: (id) => request<void>(`/playlists/${id}`, z.void(), { method: "DELETE" }),
      addItems: (id, body) => {
        AddPlaylistItemsBodySchema.parse(body);
        return request(`/playlists/${id}/items`, PlaylistDetailSchema, { method: "POST", body });
      },
      removeItem: (id, fileId) =>
        request(`/playlists/${id}/items/${fileId}`, PlaylistDetailSchema, { method: "DELETE" }),
      reorder: (id, body) => {
        ReorderPlaylistBodySchema.parse(body);
        return request(`/playlists/${id}/order`, PlaylistDetailSchema, { method: "PUT", body });
      },
    },

    bookmarks: {
      list: (query = {}) => {
        const params = new URLSearchParams();
        if (query.fileId) params.set("fileId", query.fileId);
        if (query.kind) params.set("kind", query.kind);
        const qs = params.toString();
        return request(`/me/bookmarks${qs ? `?${qs}` : ""}`, BookmarksListResponseSchema);
      },
      create: (body) => {
        CreateBookmarkBodySchema.parse(body);
        return request("/me/bookmarks", BookmarkSchema, { method: "POST", body });
      },
      update: (id, body) => {
        UpdateBookmarkBodySchema.parse(body);
        return request(`/bookmarks/${id}`, BookmarkSchema, { method: "PATCH", body });
      },
      remove: (id) => request<void>(`/bookmarks/${id}`, z.void(), { method: "DELETE" }),
    },

    listChats: (groupId) => request(`/groups/${groupId}/chats`, ChatChannelsResponseSchema),
    listChatMessages: (channelId, query = {}) => {
      const params = new URLSearchParams();
      if (query.before) params.set("before", query.before);
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      return request(
        `/chats/${channelId}/messages${qs ? `?${qs}` : ""}`,
        ChatMessagesResponseSchema,
      );
    },
    sendChatText: (channelId, body) => {
      CreateChatTextBodySchema.parse(body);
      return request(`/chats/${channelId}/messages`, ChatMessageSchema, {
        method: "POST",
        body,
      });
    },
    createChatVoiceUploadUrl: (channelId, body) => {
      ChatVoiceUploadBodySchema.parse(body);
      return request(`/chats/${channelId}/voice/upload-url`, ChatVoiceUploadResponseSchema, {
        method: "POST",
        body,
      });
    },
    completeChatVoice: (messageId) =>
      request(`/chat-messages/${messageId}/complete`, ChatMessageSchema, { method: "POST" }),
    getChatMessageUrl: (messageId) =>
      request(`/chat-messages/${messageId}/url`, ChatMessageUrlResponseSchema),
    deleteChatMessage: (messageId) =>
      request(`/chat-messages/${messageId}`, OkResponseSchema, { method: "DELETE" }),

    uploadFile: async (input) => {
      const mimeType = input.mimeType || input.file.type || "application/octet-stream";
      const fileName = input.fileName || "upload.bin";
      const prepared = await client.createUploadUrl({
        sessionId: input.sessionId,
        topicId: input.topicId,
        mimeType,
        sizeBytes: input.file.size,
        fileName,
        source: input.source,
      });

      await putWithProgress(prepared.uploadUrl, input.file, mimeType, input.onProgress);
      return client.completeFile(prepared.file.id, {});
    },
  };

  return client;
}
