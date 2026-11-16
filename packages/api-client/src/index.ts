import {
  AuthResponseSchema,
  CompleteFileBodySchema,
  CreateGroupBodySchema,
  CreateInviteBodySchema,
  CreateSessionBodySchema,
  CreateTextFileBodySchema,
  CreateTopicBodySchema,
  FileSchema,
  FileUrlResponseSchema,
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
  PlaylistResponseSchema,
  PublicInviteSchema,
  RefreshBodySchema,
  RegisterBodySchema,
  SessionDetailSchema,
  SessionSummarySchema,
  SessionsListResponseSchema,
  TopicDetailSchema,
  TopicSummarySchema,
  UpdateGroupBodySchema,
  UpdateMemberRoleBodySchema,
  UpdateTitleBodySchema,
  UploadUrlBodySchema,
  UploadUrlResponseSchema,
  type AuthResponse,
  type CompleteFileBody,
  type CreateGroupBody,
  type CreateInviteBody,
  type CreateSessionBody,
  type CreateTextFileBody,
  type CreateTopicBody,
  type FileDto,
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
  type PlaylistResponse,
  type PublicInvite,
  type RegisterBody,
  type SessionDetail,
  type SessionSummary,
  type SessionsListResponse,
  type TopicDetail,
  type TopicSummary,
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
  durationMs?: number;
  onProgress?: (progress: number) => void;
};

export type ApiClient = {
  health: () => Promise<HealthResponse>;
  register: (body: RegisterBody) => Promise<AuthResponse>;
  login: (body: LoginBody) => Promise<AuthResponse>;
  refresh: (refreshToken?: string) => Promise<AuthResponse>;
  logout: (refreshToken?: string) => Promise<OkResponse>;
  me: () => Promise<MeResponse>;
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
  createTextFile: (body: CreateTextFileBody) => Promise<FileDto>;
  getFileUrl: (id: string, download?: boolean) => Promise<FileUrlResponse>;
  updateFile: (id: string, body: UpdateTitleBody) => Promise<FileDto>;
  deleteFile: (id: string) => Promise<OkResponse>;
  getPlaylist: (sessionId: string) => Promise<PlaylistResponse>;
  uploadFile: (input: UploadFileInput) => Promise<FileDto>;
};

function putWithProgress(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (n: number) => void,
) {
  if (typeof XMLHttpRequest === "undefined" || !onProgress) {
    return fetch(url, {
      method: "PUT",
      headers: { "content-type": mimeType },
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

    uploadFile: async (input) => {
      const mimeType = input.mimeType || input.file.type || "application/octet-stream";
      const fileName = input.fileName || "upload.bin";
      const prepared = await client.createUploadUrl({
        sessionId: input.sessionId,
        topicId: input.topicId,
        mimeType,
        sizeBytes: input.file.size,
        fileName,
      });

      await putWithProgress(prepared.uploadUrl, input.file, mimeType, input.onProgress);
      return client.completeFile(prepared.file.id, {
        durationMs: input.durationMs,
      });
    },
  };

  return client;
}
