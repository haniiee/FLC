# FLC Mobile (`@app/mobile`)

اپ اندروید Expo (SDK 58) با **expo-dev-client**.

## بک‌اند (Supabase-native)

پروداکشن و توسعهٔ پیشنهادی بدون Fastify:

```bash
cp apps/mobile/.env.example apps/mobile/.env
# EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
```

`app.config.ts` برای پروژهٔ فعلی `flc` مقدار پیش‌فرض URL/anon دارد؛ env آن‌ها را override می‌کند.

آپلود فایل و چت زنده مستقیم به Supabase Storage / Realtime می‌روند — `EXPO_PUBLIC_API_URL` لازم نیست.

## Fallback لوکال Fastify (اختیاری)

اگر Supabase env خالی باشد، کلاینت به `EXPO_PUBLIC_API_URL` برمی‌گردد:

| محیط | `EXPO_PUBLIC_API_URL` |
|------|----------------------|
| Android emulator | `http://10.0.2.2:4000` |
| گوشی روی همان LAN | `http://192.168.x.x:4000` |
| iOS simulator | `http://127.0.0.1:4000` |

```bash
pnpm --filter @app/mobile android:reverse
```

## اجرا

```bash
pnpm --filter @app/mobile dev
```
