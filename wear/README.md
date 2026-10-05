# DailyFlow · Wear OS (Kotlin, Compose for Wear OS)

Branch `feat/eh-horizon`. **Not compiled yet**: the build machine could not reach Google's Maven, so library versions in `gradle/libs.versions.toml` are the last stable ones known at writing time — open the folder in Android Studio and accept the upgrade suggestions if any.

## Build

1. Android Studio → Open `wear/` (it creates the Gradle wrapper).
2. Run on a Wear OS emulator or the watch (Developer options → ADB debugging / Wi-Fi).
3. On the web: Settings › Device › **Pair a device** → type the 8-character code on the watch.

## Surfaces (spec §83)

- **Tile** — NOW · WORK · until 11:00 / NEXT · MUSIC · 11:00 (refreshes ~10 min; tap opens the app).
- **Complication** — SHORT “42m · Maker”, LONG “Next 11:00 Music”, RANGED progress through the current block.
- **App** — now/next, start the current block / stop (`POST /api/quick`), next tasks, today's timeline, unpair.

All read `GET /api/snapshot` with the device token; nothing is stored on the watch except the token.

## Later (spec §84)

Watch face where the day's blocks are a ring: needs Watch Face Format; left for after the tile/complication prove useful.
