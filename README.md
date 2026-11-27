# Vannot Launcher

Vannot Launcher **v1.0.1 stabil** adalah launcher desktop Windows untuk Minecraft Java Edition. Launcher memasang dan menjalankan game Vanilla serta loader yang tersedia untuk versi Minecraft pilihan. Identitas visualnya memakai logo Vannot orisinal dan gaya launcher mod modern; bukan salinan aset atau merek Modrinth.

## Menjalankan

Perlu Node.js 24 atau lebih baru. Runtime game tetap Minecraft Java Edition resmi; launcher bukan pengganti atau salinan client Minecraft.

```sh
npm install
npm start
```

Dashboard mengambil daftar semua versi langsung dari manifest Mojang—rilis, snapshot, dan versi legacy—dengan filter kategori serta penanda rilis/snapshot terbaru. Latar dashboard memakai animasi CSS ringan dan menghormati preferensi reduced motion sistem. Daftar Fabric, Quilt, Forge, NeoForge, serta OptiFine diambil dari layanan resminya. Login Microsoft memeriksa kepemilikan Minecraft Java Edition. Login Ely.by memakai endpoint Yggdrasil HTTPS resmi dan authlib-injector; password tidak disimpan. Launcher memasang file, library, dan Java yang cocok sebelum menjalankan game. Data Vanilla disimpan di `%APPDATA%/.minecraft`; loader memakai direktori instance terpisah. OptiFine adalah instalasi terpisah dan bisa tidak kompatibel dengan mod tertentu.

Katalog Mod, Modpacks, Resource packs, dan Shaders mencari konten kompatibel di Modrinth; Mod, Resource packs, dan Shaders juga dapat dicari di CurseForge. Modrinth dapat dipakai langsung; CurseForge mensyaratkan API key resmi yang disimpan terenkripsi oleh OS. Unduhan diverifikasi dengan HTTPS, ukuran, dan checksum. Sebelum konten dipasang, launcher meminta izin Administrator Windows untuk memindai satu batch dengan Microsoft Defender; konten ditahan di staging sampai pemindaian berhasil. Modpack Modrinth memasang file client dan konfigurasi yang didukung ke instance terpilih setelah memasang versi Minecraft dan loader yang cocok.

## Keamanan dan batas perlindungan

- Microsoft Defender harus aktif dan diperbarui. Jika Defender tidak tersedia, pemindaian gagal, atau permintaan UAC ditolak, konten pihak ketiga tidak dipasang.
- Mod dan modpack pihak ketiga menjalankan kode di dalam Minecraft. HTTPS/checksum memverifikasi jalur unduhan dan integritas file, bukan bahwa pembuat konten dapat dipercaya.
- Antivirus tidak dapat menjamin deteksi semua ancaman. Tidak ada cara untuk menjanjikan launcher 100% bebas virus; tetap gunakan perlindungan Windows yang aktif dan unduh konten dari pembuat yang tepercaya.
- Versi installer resmi dapat diverifikasi memakai `SHA256SUMS.txt` yang disertakan pada halaman GitHub Releases.
- Pemindaian memakai [Microsoft Defender MpCmdRun](https://learn.microsoft.com/en-us/defender-endpoint/command-line-arguments-microsoft-defender-antivirus); persetujuan UAC hanya dipakai untuk menjalankan pemindaian khusus.

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
git tag v1.0.1
git push origin v1.0.1
```