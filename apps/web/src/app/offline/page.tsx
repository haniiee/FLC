export default function OfflinePage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-bold text-secondary">اتصال اینترنت برقرار نیست</h1>
      <p className="max-w-sm text-sm text-text-muted">
        لطفاً اتصال خود را بررسی کنید و دوباره تلاش کنید. صفحه‌های کش‌شده ممکن است هنوز در دسترس
        باشند.
      </p>
    </div>
  );
}
