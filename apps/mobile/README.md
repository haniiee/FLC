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

### Presigned S3 / MinIO (emulator)

Upload URLs are signed for `S3_PUBLIC_ENDPOINT` (usually `http://localhost:9000`). Do **not** change that host for the emulator — signature verification fails if the host changes. Instead reverse the ports onto the emulator:

```bash
pnpm --filter @app/mobile android:reverse
# adb reverse tcp:8082 tcp:8082 && adb reverse tcp:9000 tcp:9000 && adb reverse tcp:4000 tcp:4000
```

On a **physical phone on LAN**, set both `EXPO_PUBLIC_API_URL` and the API’s `S3_PUBLIC_ENDPOINT` to the laptop’s LAN IP (e.g. `http://192.168.x.x:4000` / `http://192.168.x.x:9000`) so signed URLs match what the device can reach.

## اجرا (dev build)

از ریشهٔ monorepo:

```bash
pnpm install
pnpm --filter @app/mobile android
# یا بعد از نصب یک‌بار native:
pnpm --filter @app/mobile dev
```

اولین `android` یک dev client native می‌سازد و نصب می‌کند؛ بعد فقط Metro کافی است.

### Background audio / lock screen (6b-2)

`expo-audio` is configured with `enableBackgroundPlayback: true`. After changing that plugin option, **rebuild the native app**:

```bash
pnpm --filter @app/mobile android
# or: pnpm --filter @app/mobile ios
```

Metro reload alone is not enough for background playback / notification controls.

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
| `android:reverse` | `adb reverse` for Metro `:8082`, MinIO `:9000`, API `:4000` |
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
