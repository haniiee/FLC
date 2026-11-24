import { randomInt } from "node:crypto";
import * as argon2 from "argon2";
import { badRequest } from "./errors";

/** Letters and digits without 0/O/1/l to avoid ambiguous passwords. */
const INITIAL_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function assertPasswordPolicy(password: string): void {
  if (password.length < 8) {
    throw badRequest("WEAK_PASSWORD", "رمز عبور باید حداقل ۸ کاراکتر باشد");
  }
}

export function generateInitialPassword(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += INITIAL_PASSWORD_ALPHABET[randomInt(INITIAL_PASSWORD_ALPHABET.length)]!;
  }
  return result;
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
