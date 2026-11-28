# FLC

اپ کلاسی **آکادمی فروغ ماه تابان** — monorepo (web + mobile + packages).

## Production stack (گزینه ۲ — بومی Supabase)

- **وب:** Vercel (`apps/web`) — فقط `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (+ `SUPABASE_SERVICE_ROLE_KEY` سرور برای ادمین)
- **بک‌اند:** Supabase Auth + Postgres/RLS + Storage + Realtime
- **موبایل:** Expo با همان کلیدهای anon
- **بدون** Render / Fastify در پروداکشن (`apps/api` فقط برای توسعهٔ لوکال اختیاری)

## پیش‌نیاز

- Node.js 20+ (`.nvmrc`)
- [pnpm](https://pnpm.io/) 9+

## راه‌اندازی وب (Supabase)

```bash
pnpm install
cp .env.example .env
# پر کردن NEXT_PUBLIC_SUPABASE_* و در صورت نیاز SUPABASE_SERVICE_ROLE_KEY
ln -sfn ../../.env apps/web/.env
pnpm --filter @app/web dev
```

Web: http://localhost:3000

## توسعه لوکال با Fastify (اختیاری)

```bash
docker compose up -d
pnpm --filter @app/api db:migrate
pnpm dev
```

- API: http://localhost:4000  
- MinIO: http://localhost:9001 (`minioadmin` / `minioadmin`)

برای fallback لوکال، `NEXT_PUBLIC_SUPABASE_URL` را خالی بگذار و `NEXT_PUBLIC_API_URL` را ست کن.

## دستورهای مفید

```bash
pnpm typecheck
pnpm lint
pnpm --filter @app/supabase-app typecheck
pnpm --filter @app/web build
```

## ساختار

```
apps/web           Next.js (App Router) — کلاینت Supabase
apps/mobile        Expo — همان مدل Auth/Storage/Realtime
apps/api           Fastify (legacy / local only)
packages/supabase-app   ApiClient روی @supabase/supabase-js
packages/api-client     کلاینت HTTP به Fastify
packages/shared-types
packages/brand
supabase/migrations    یادداشت/اسکریپت‌های RLS روی پروژهٔ Supabase
```

## Env پروداکشن (Vercel)

| Key | کجا |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | همه محیط‌ها |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | همه محیط‌ها |
| `SUPABASE_SERVICE_ROLE_KEY` | فقط سرور (admin routes) — از Dashboard → Settings → API |
| `NEXT_PUBLIC_LANDING_AUDIO_URL` | اختیاری |
| `NEXT_PUBLIC_API_URL` | **ست نکن** در پروداکشن |

## برند

فایل‌های نهایی را در `packages/brand/assets/` جایگزین کنید:

- `flc-logo.svg`
- `icon-1024.png` / `icon-512.png` / `icon-192.png`
