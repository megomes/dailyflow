# DailyFlow · Android (Expo)

Branch `feat/eh-horizon`. Not built or run yet in CI — written to work the first time, then fixed when we run it together.

## Run (development build — widgets need native code, Expo Go is not enough)

```sh
cd mobile
npm install
npx expo prebuild --platform android --clean
npx expo run:android            # phone connected with USB debugging, or an emulator
```

Pair: on the web, Settings › Device › **Pair a device** → scan the QR in the app (or type the code).

## What is here

- **Today** (Now with Start/Stop/Switch, quick switch by area, Next, tasks of the block, plan with the real beside it), **Tasks** (fast capture, today, inbox), **Focus** (same sessions as the web), **More** (sync, lock-screen notification, unpair).
- Same records and rules as the web: domain logic is imported from `web/src/lib` (`time`, `dayLogic`, `seed`, `snapshot`) through the `@shared` alias; sync uses `/api/sync` with a device token (Bearer).
- **Widgets** (react-native-android-widget, rendered headless from `/api/snapshot`): Now, Timeline, Tasks (tap cycles Today → In progress → High priority), Next tasks, Day (now + next).
- **Lock screen / Always-On**: a silent ongoing notification “WORK until 11:00 · Next: Music” — Samsung shows it on AOD; refreshed by the app and every ~15 min in the background.

## Known gaps to check on the device

- Background refresh frequency is decided by Android (`expo-background-task`, minimum ~15 min).
- Widget preview images are the app icon for now (`assets/widget-*.png`).
