# Vannot Android Foundation

The Android application is a native Kotlin app authored for Vannot. It does not wrap the Windows Electron application and does not include another Minecraft launcher's APK or source.

## Build

```sh
cd android
./gradlew assembleDebug
```

The development APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

## Current scope

This is the original app shell and navigation foundation only. It cannot yet download, install, authenticate, or launch Minecraft Java. Android release publication stays paused until a compatible runtime, official account flow, game installation, and real-device launch tests are complete.
