# Vannot Android Preview

The Android application uses a Vannot-authored native Kotlin UI and Rust core. It does not wrap the Windows Electron application and does not include another Minecraft launcher's APK, source, or branding.

The current preview targets Minecraft Java 26.3 only and includes a Modrinth catalog search filtered to mods declaring compatibility with 26.3.

## Build

```sh
rustup target add aarch64-linux-android x86_64-linux-android
cargo install cargo-ndk --locked
cargo test --locked --manifest-path android/rust-core/Cargo.toml
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
cargo ndk -t arm64-v8a -t x86_64 -P 24 -o android/app/build/generated/jniLibs build --locked --manifest-path android/rust-core/Cargo.toml --release
cd android
./gradlew testDebugUnitTest assembleDebug
```

The development APK is written to `app/build/outputs/apk/debug/app-debug.apk` and supports 64-bit ARM and x86_64 devices.

## Current scope

This preview can browse Modrinth's catalog for 26.3-compatible mods. It cannot yet download or install mods, install Minecraft, authenticate accounts, or launch the game. Android release publication stays paused until a compatible runtime, official account flow, game and mod installation, and real-device launch tests are complete.
