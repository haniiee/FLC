const PERSIAN_RE = /[\u0600-\u06FF]/;

/** True when the string contains Arabic/Persian script characters. */
export function hasPersian(text: string): boolean {
  return PERSIAN_RE.test(text);
}
