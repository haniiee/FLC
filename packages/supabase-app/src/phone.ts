const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(digit);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(digit);
    return String(arabicIndex);
  });
}

/** Normalize Iranian mobile numbers to `09xxxxxxxxx`. */
export function normalizePhone(input: string): string {
  const ascii = toAsciiDigits(input.trim());
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
    throw new Error("شماره موبایل نامعتبر است");
  }

  return normalized;
}

/** Synthetic email accepted by Supabase Auth validation. */
export function phoneToAuthEmail(phone: string): string {
  return `u${normalizePhone(phone)}@users.flc.app`;
}

export function phoneFromAuthEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const phone = local.startsWith("u") ? local.slice(1) : local;
  return /^09\d{9}$/.test(phone) ? phone : null;
}
