export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function fromSupabaseError(error: { message?: string; code?: string; status?: number } | null) {
  if (!error) return new AppError(500, "UNKNOWN", "Unknown error");
  const message = error.message || "Request failed";
  const status = error.status ?? (error.code === "PGRST116" ? 404 : 400);
  return new AppError(status, error.code || "SUPABASE_ERROR", message);
}

export function requireAuthUserId(userId: string | undefined): string {
  if (!userId) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return userId;
}
