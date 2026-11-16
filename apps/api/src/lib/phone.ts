import { badRequest } from "./errors";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex >= 0) {
      return String(persianIndex);
    }
    const arabicIndex = ARABIC_DIGITS.indexOf(digit);
    return String(arabicIndex);
  });
}

/** Normalize Iranian mobile numbers to `09xxxxxxxxx`. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const ascii = toAsciiDigits(trimmed);
  const digitsOnly = ascii.replace(/[^\d+]/g, "");

  let normalized = digitsOnly;

  if (normalized.startsWith("+98")) {
    normalized = `0${normalized.slice(3)}`;
  } else if (normalized.startsWith("98")) {
    normalized = `0${normalized.slice(2)}`;
  } else if (normalized.startsWith("9") && normalized.length === 10) {
    normalized = `0${normalized}`;
  }

  if (!/^09\d{9}$/.test(normalized)) {
    throw badRequest("INVALID_PHONE", "شماره موبایل نامعتبر است");
  }

  return normalized;
}
