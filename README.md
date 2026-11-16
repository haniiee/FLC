# FLC

اپ کلاسی **آکادمی فروغ ماه تابان** — monorepo اسکلت (api + web + packages).

## پیش‌نیاز

- Node.js 20 LTS (`.nvmrc`)
- [pnpm](https://pnpm.io/) 9+
- Docker + Docker Compose

## راه‌اندازی

```bash
# 1) وابستگی‌ها
pnpm install

# 2) env
cp .env.example .env
# وب Next از apps/web/.env می‌خواند (symlink به ریشه)
ln -sfn ../../.env apps/web/.env

# 3) زیرساخت لوکال (Postgres + MinIO + bucket class-files)
docker compose up -d

# 4) توسعه
pnpm dev
```

- API: http://localhost:4000  
- Web: http://localhost:3000  
- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)

## دستورهای مفید

```bash
pnpm typecheck
pnpm lint
pnpm --filter @app/api db:migrate
pnpm --filter @app/api test
pnpm --filter @app/api db:seed-teacher -- --phone 09121234567 --name "معلم" --password "password1"
curl http://localhost:4000/health
```

برای تست‌ها دیتابیس `flc_test` و `DATABASE_URL_TEST` لازم است.

```bash
pnpm --filter @app/api storage:cors
```

## ساختار

```
apps/api        Fastify + Drizzle
apps/web        Next.js (App Router) + Tailwind
apps/mobile     فاز ۶ (Expo)
packages/brand  design tokens + assets
packages/shared-types
packages/api-client
packages/tsconfig
packages/eslint-config
```

## برند

فایل‌های نهایی را در `packages/brand/assets/` جایگزین کنید:

- `flc-logo.svg`
- `icon-1024.png` / `icon-512.png` / `icon-192.png`

برای favicon وب، `icon-192.png` را در `apps/web/public/icon-192.png` هم قرار دهید.
