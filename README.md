# Vannot Launcher

Vannot Launcher **v1.0.0 stabil** adalah launcher desktop Windows untuk Minecraft Java Edition. Launcher memasang dan menjalankan game Vanilla serta loader yang tersedia untuk versi Minecraft pilihan. Identitas visualnya memakai logo Vannot orisinal dan gaya launcher mod modern; bukan salinan aset atau merek Modrinth.

## Menjalankan

Perlu Node.js 24 atau lebih baru. Runtime game tetap Minecraft Java Edition resmi; launcher bukan pengganti atau salinan client Minecraft.

```sh
npm install
npm start
```

Dashboard mengambil daftar semua versi langsung dari manifest Mojang—rilis, snapshot, dan versi legacy—dengan filter kategori serta penanda rilis/snapshot terbaru. Latar dashboard memakai animasi CSS ringan dan menghormati preferensi reduced motion sistem. Daftar Fabric, Quilt, Forge, NeoForge, serta OptiFine diambil dari layanan resminya. Login Microsoft memeriksa kepemilikan Minecraft Java Edition. Login Ely.by memakai endpoint Yggdrasil HTTPS resmi dan authlib-injector; password tidak disimpan. Launcher memasang file, library, dan Java yang cocok sebelum menjalankan game. Data Vanilla disimpan di `%APPDATA%/.minecraft`; loader memakai direktori instance terpisah. OptiFine adalah instalasi terpisah dan bisa tidak kompatibel dengan mod tertentu.

Katalog Mod, Modpacks, Resource packs, dan Shaders mencari konten kompatibel di Modrinth; Mod, Resource packs, dan Shaders juga dapat dicari di CurseForge. Modrinth dapat dipakai langsung; CurseForge mensyaratkan API key resmi yang disimpan terenkripsi oleh OS. Unduhan diverifikasi dengan HTTPS dan checksum. Modpack Modrinth memasang file client dan konfigurasi yang didukung ke instance terpilih setelah memasang versi Minecraft dan loader yang cocok.

## Status fitur

- Berfungsi: instalasi/launch Vanilla, Fabric, Quilt, Forge, NeoForge, dan OptiFine; login Microsoft dan Ely.by; runtime Java yang sesuai untuk versi game (dipasang otomatis di Windows bila diperlukan); katalog/download mod, modpack Modrinth, resource pack, dan shader.
- Belum tersedia: login offline, provider Yggdrasil yang dapat dikonfigurasi, skin/cape, download world, dan pengaturan performa.
- Windows 32-bit dapat menjalankan versi lama dengan Java 8. Minecraft modern memerlukan Java 64-bit dan Windows x64.
- Klaim unduhan 90% lebih cepat atau FPS tertentu tidak dijanjikan; hasil bergantung jaringan dan perangkat.

## Rilis stabil Windows

```sh
npm run dist:win
```

Perintah ini menghasilkan installer NSIS Windows x64 dengan ikon Vannot. Untuk merilis versi stabil, kirim tag versi tanpa akhiran prerelease; GitHub Actions menguji aplikasi dan mengunggah installer Windows sebagai release stabil. Tag yang mengandung `-` (misalnya `-beta`) tidak menerbitkan release.

```sh
git tag v1.0.0
git push origin v1.0.0
```