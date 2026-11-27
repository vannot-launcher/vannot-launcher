# Vannot Launcher

Vannot Launcher is a Minecraft Java Edition launcher project. Native game runtime code is built from pinned upstream launcher projects; the React/Vite application in `src/` is a web preview and does not install or launch Minecraft.

## Current status

The latest public Windows beta is [Vannot Launcher v1.0.4-beta.1](https://github.com/vannot-launcher/vannot-launcher/releases/tag/windows-v1.0.4-beta.1). It is an unsigned preview build; Windows may show an unrecognized-app warning. The latest stable Vannot release is v1.0.2. Do not present older Moon-branded beta artifacts as Vannot releases.

Vannot keeps the native XMCL runtime approach and applies a new Vannot identity and dashboard. The source adaptations are made with permission from the Moon Launcher developer. Minecraft and Mojang are not affiliated with this project.

## Native builds

- **Windows and Linux:** built from pinned XMCL source by the Windows and Linux GitHub Actions workflows. The runtime source is pinned in `windows/rebrand-xmcl.mjs`.
- **Android:** no independent Vannot Minecraft launcher APK has been released. The former Android workflow rebadged Zalith Launcher and is now paused; a new native Kotlin app and Android-compatible Minecraft runtime must be implemented and device-tested before publishing.
- Third-party notices and required upstream licenses are included in [Windows notices](windows/THIRD_PARTY_NOTICES.md) and [Android notices](android/THIRD_PARTY_NOTICES.md).

Do not treat a successful CI build as proof that account login or Minecraft gameplay has been interactively tested. Validate those flows on the target platform before publishing a release.

## Web preview

```sh
npm ci
npm run dev
npm run build
```

This builds the web preview only. It is not a Minecraft runtime.

## Release requirements

Native release workflows publish artifacts when invoked with their platform release tags. Verify branding, installer contents, checksum, and platform-specific launch flows before publishing. Stable Windows releases require the signing secrets described in [Windows code signing](windows/CODE_SIGNING.md).

Do not embed private API credentials in a public desktop build. CurseForge's API key is currently passed to the XMCL Windows build, where the Electron bundle can include it; configure a secure server-side proxy before using a private production key in a public release.

The Android launcher is being developed as an independent Vannot implementation. It may use properly licensed platform/runtime libraries, but it will not publish a fork or rebrand of another launcher as a Vannot release.
