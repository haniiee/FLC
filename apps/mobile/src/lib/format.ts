import { ApiClientError } from "@app/api-client";
import type { GroupRole } from "@app/shared-types";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "شماره یا رمز عبور نادرست است",
  PHONE_TAKEN: "این شماره قبلاً ثبت شده است",
  VALIDATION_ERROR: "اطلاعات واردشده معتبر نیست",
  UNAUTHORIZED: "نشست شما منقضی شده؛ دوباره وارد شوید",
  FORBIDDEN: "دسترسی مجاز نیست",
  NOT_FOUND: "مورد خواسته‌شده پیدا نشد",
  INVITE_NOT_FOUND: "کد دعوت معتبر نیست",
  INVITE_EXPIRED: "کد دعوت منقضی شده است",
  INVITE_REVOKED: "کد دعوت باطل شده است",
  INVITE_EXHAUSTED: "ظرفیت دعوت‌نامه تکمیل شده است",
  ALREADY_MEMBER: "شما از قبل عضو این کلاس هستید",
  RATE_LIMITED: "تعداد درخواست‌ها زیاد است؛ کمی بعد تلاش کنید",
  REFRESH_FAILED: "نشست منقضی شده؛ دوباره وارد شوید",
  NO_REFRESH_TOKEN: "نشست منقضی شده؛ دوباره وارد شوید",
};

export function roleLabel(role: GroupRole): string {
  switch (role) {
    case "teacher":
      return "معلم";
    case "assistant":
      return "دستیار";
    case "student":
      return "دانشجو";
  }
}

export function apiErrorMessage(error: unknown, fallback = "خطایی رخ داد"): string {
  if (error instanceof ApiClientError) {
    return ERROR_MESSAGES[error.code] ?? error.message ?? fallback;
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}
