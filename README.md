# Vannot Launcher

Vannot Launcher is a Minecraft Java Edition launcher project. Native game runtime code is built from pinned upstream launcher projects; the React/Vite application in `src/` is a web preview and does not install or launch Minecraft.

## Current status

The Vannot rebrand and release workflows are being prepared. **There is no public Vannot installer yet.** The earlier public Windows beta was released with Moon Launcher branding and must not be presented as a Vannot build. The download portal intentionally links to this source repository instead of that older installer.

Vannot keeps the native XMCL runtime approach and applies a new Vannot identity and dashboard. The source adaptations are made with permission from the Moon Launcher developer. Minecraft and Mojang are not affiliated with this project.

## Native builds

- **Windows and Linux:** built from pinned XMCL source by the Windows and Linux GitHub Actions workflows. The runtime source is pinned in `windows/rebrand-xmcl.mjs`.
- **Android:** the standalone Android workflow builds its pinned Zalith Launcher runtime. A Vannot-branded Android build has not been published.
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

Native release workflows publish artifacts when invoked with their platform release tags. Do not publish a Vannot release until its branding, installer contents, checksum, and platform-specific launch flows have been verified. Stable Windows releases also require the signing secrets described in [Windows code signing](windows/CODE_SIGNING.md).
