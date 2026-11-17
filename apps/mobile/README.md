# FLC Mobile (`@app/mobile`)

اپ اندروید Expo (SDK 58) با **expo-dev-client** — نه Expo Go (فاز 6b به native module نیاز دارد).

## پیش‌نیاز

- JDK 17+ و Android SDK / emulator یا گوشی با USB debugging
- API روی `0.0.0.0:4000` در حال اجرا

## اتصال به API

روی گوشی واقعی `localhost` کار نمی‌کند.

| محیط | `EXPO_PUBLIC_API_URL` |
|------|----------------------|
| Android emulator | `http://10.0.2.2:4000` |
| گوشی روی همان LAN | `http://192.168.x.x:4000` (IP لپ‌تاپ) |
| iOS simulator | `http://127.0.0.1:4000` |

```bash
cp apps/mobile/.env.example apps/mobile/.env
# آدرس را ویرایش کنید
```

برای HTTP لوکال، `expo-build-properties` با `usesCleartextTraffic: true` فقط وقتی `APP_ENV` برابر `production` نباشد فعال است.

## اجرا (dev build)

از ریشهٔ monorepo:

```bash
pnpm install
pnpm --filter @app/mobile android
# یا بعد از نصب یک‌بار native:
pnpm --filter @app/mobile dev
```

اولین `android` یک dev client native می‌سازد و نصب می‌کند؛ بعد فقط Metro کافی است.

## RTL / فونت

- `I18nManager.allowRTL(true)` و `forceRTL(true)` در root layout
- فونت **Vazirmatn** از `@expo-google-fonts/vazirmatn`
- روی Android بعد از اولین نصب ممکن است یک‌بار **بستن کامل اپ و باز کردن دوباره** لازم باشد تا RTL اعمال شود (تغییر `I18nManager` تا restart بعدی اثر کامل ندارد)

## Deep link دعوت

- سفارشی: `flc://join/CODE`
- وب (اگر App Link / Intent Filter با host ست شود): `https://<web>/join/CODE`
- بازنویسی مسیر در `src/app/+native-intent.tsx`
- صفحهٔ دستی: «پیوستن با کد دعوت»

## Monorepo / Metro

طبق [مستند Expo monorepos](https://docs.expo.dev/guides/monorepos/)، از SDK 52+ با `expo/metro-config` تنظیم `watchFolders` دستی لازم نیست. فایل `metro.config.cjs` فقط default config را می‌گیرد. ریشهٔ `.npmrc` عوض نشده (SDK 54+ با isolated deps سازگار است).

## اسکریپت‌ها

| Script | کار |
|--------|-----|
| `dev` | `expo start --dev-client` |
| `android` | `expo run:android` |
| `lint` / `typecheck` / `test` | کیفیت |

## ساختار

```
apps/mobile/
  app.config.ts
  metro.config.cjs         # expo/metro-config (monorepo خودکار SDK 52+)
  babel.config.cjs
  src/app/(auth)           # login / register
  src/app/(app)            # groups, join
  src/app/+native-intent.tsx
  src/lib                  # api, token-store, deep-link
  src/providers
```
