import * as argon2 from "argon2";
import { badRequest } from "./errors";

export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw badRequest("WEAK_PASSWORD", "رمز عبور باید حداقل ۸ کاراکتر باشد");
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
