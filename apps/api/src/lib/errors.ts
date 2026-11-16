export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function badRequest(code: string, message: string) {
  return new AppError(400, code, message);
}

export function unauthorized(code = "UNAUTHORIZED", message = "Unauthorized") {
  return new AppError(401, code, message);
}

export function forbidden(code = "FORBIDDEN", message = "Forbidden") {
  return new AppError(403, code, message);
}

export function notFound(code = "NOT_FOUND", message = "Not found") {
  return new AppError(404, code, message);
}

export function conflict(code: string, message: string) {
  return new AppError(409, code, message);
}

export function payloadTooLarge(code: string, message: string) {
  return new AppError(413, code, message);
}
