const { Version, launch } = require('@xmcl/core');
const fs = require('node:fs/promises');
const os = require('node:os');
const { createWriteStream } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const {
  getFabricLoaderArtifact,
  getLoaderArtifactListFor,
  getQuiltLoaderVersionsByMinecraft,
  getPotentialJavaLocations,
  getVersionList,
  installFabric,
  installDependencies,
  installForge,
  installOptifine: installOptifineJar,
  installNeoForged,
  installQuiltVersion,
  install,
  resolveJava
} = require('@xmcl/installer');
const { parse: parseForgePage } = require('@xmcl/forge-site-parser');
const { installAdoptiumJava } = require('./java-runtime');
const { ensureAuthlibInjector } = require('./ely-auth');

async function listOfficialVersions() {
  const manifest = await getVersionList();
  return {
    latest: manifest.latest.release,
    versions: manifest.versions.map(({ id, type, releaseTime }) => ({ id, type, releaseTime }))
  };
}

async function installOfficialVersion(gameDirectory, versionId, onStatus = () => {}) {
  const manifest = await getVersionList();
  const version = manifest.versions.find((entry) => entry.id === versionId);
  if (!version) throw new Error(`Versi Minecraft ${versionId} tidak ditemukan di manifest resmi.`);

  onStatus(`Mengunduh file resmi Minecraft ${versionId}...`);
  const resolved = await install(version, gameDirectory, {
    assetsDownloadConcurrency: 8,
    librariesDownloadConcurrency: 6
  });

  return {
    version: resolved.id,
    javaMajor: resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId)
  };
}

async function getForgeVersions(minecraftVersion) {
  const response = await fetch(`https://files.minecraftforge.net/maven/net/minecraftforge/forge/index_${encodeURIComponent(minecraftVersion)}.html`);
  if (!response.ok) throw new Error(`Daftar Forge gagal dimuat (${response.status}).`);
  return parseForgePage(await response.text()).versions;
}

function parseOptifineVersions(html, minecraftVersion) {
  const prefix = `OptiFine_${minecraftVersion}_`;
  const previewPrefix = `preview_${prefix}`;
  const files = new Set(
    [...html.matchAll(/adloadx\?f=([^&"'<>]+\.jar)/gi)]
      .map((match) => decodeURIComponent(match[1]))
      .filter((filename) => filename.startsWith(prefix) || filename.startsWith(previewPrefix))
  );
  return [...files]
    .map((id) => ({
      id,
      label: id.replace(previewPrefix, 'Preview ').replace(prefix, '').replace(/\.jar$/i, ''),
      stable: !id.startsWith('preview_')
    }))
    .sort((first, second) => Number(second.stable) - Number(first.stable));
}

async function getOptifineVersions(minecraftVersion) {
  const response = await fetch('https://optifine.net/downloads');
  if (!response.ok) throw new Error(`Daftar OptiFine gagal dimuat (${response.status}).`);
  return parseOptifineVersions(await response.text(), minecraftVersion);
}

function compareVersionsDescending(first, second) {
  const a = first.split(/[.-]/).map((part) => Number(part) || 0);
  const b = second.split(/[.-]/).map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (b[index] || 0) - (a[index] || 0);
  }
  return 0;
}

async function listLoaderVersions(minecraftVersion, loader) {
  if (loader === 'Vanilla') return [];
  if (loader === 'Fabric') {
    const artifacts = await getLoaderArtifactListFor(minecraftVersion);
    return artifacts.map((artifact) => ({
      id: artifact.loader.version,
      stable: artifact.loader.stable
    }));
  }
  if (loader === 'Quilt') {
    const artifacts = await getQuiltLoaderVersionsByMinecraft({ minecraftVersion });
    return artifacts.map(({ loader: artifact }) => ({
      id: artifact.version,
      stable: !/(?:alpha|beta|rc)/i.test(artifact.version)
    }));
  }
  if (loader === 'OptiFine') return getOptifineVersions(minecraftVersion);
  if (loader === 'Forge') {
    const versions = await getForgeVersions(minecraftVersion);
    return versions.map((version) => ({ id: version.version, stable: version.type === 'recommended' }));
  }
  if (loader === 'NeoForge') {
    const [, minor, patch] = minecraftVersion.split('.').map(Number);
    const response = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    if (!response.ok) throw new Error(`Daftar NeoForge gagal dimuat (${response.status}).`);
    const { versions = [] } = await response.json();
    const prefix = `${minor}.${patch}.`;
    return versions.filter((version) => version.startsWith(prefix))
      .sort(compareVersionsDescending)
      .map((id) => ({ id, stable: true }));
  }
  throw new Error(`Loader ${loader} tidak didukung.`);
}

async function ensureJavaForVersion(gameDirectory, versionId, onStatus) {
  const resolved = await Version.parse(gameDirectory, versionId);
  const javaMajor = resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId);
  const java = await findJava(javaMajor);
  if (java) return java.path;
  return installAdoptiumJava(gameDirectory, javaMajor, onStatus);
}

async function installOfficialOptifine(gameDirectory, minecraftVersion, installerName, java, onStatus) {
  if (!/^(?:preview_)?OptiFine_[a-zA-Z0-9._-]+\.jar$/.test(installerName)) {
    throw new Error('Nama installer OptiFine resmi tidak valid.');
  }
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-optifine-'));
  const installerPath = path.join(temporaryDirectory, installerName);
  try {
    onStatus(`Mengambil unduhan OptiFine resmi untuk Minecraft ${minecraftVersion}...`);
    const landingUrl = new URL('https://optifine.net/adloadx');
    landingUrl.searchParams.set('f', installerName);
    const landingResponse = await fetch(landingUrl);
    const landingResponseUrl = new URL(landingResponse.url || landingUrl);
    if (!landingResponse.ok || landingResponseUrl.protocol !== 'https:' || landingResponseUrl.hostname !== 'optifine.net') {
      throw new Error('Halaman unduhan resmi OptiFine tidak dapat diakses.');
    }
    const landingHtml = await landingResponse.text();
    const [, href] = landingHtml.match(/href=["']([^"']*downloadx\?f=[^"']+)["']/i) || [];
    if (!href) throw new Error('Tautan unduhan resmi OptiFine tidak ditemukan.');

    const downloadUrl = new URL(href.replaceAll('&amp;', '&'), 'https://optifine.net/');
    if (downloadUrl.protocol !== 'https:' || downloadUrl.hostname !== 'optifine.net' || downloadUrl.searchParams.get('f') !== installerName) {
      throw new Error('Sumber unduhan OptiFine tidak tepercaya.');
    }
    const response = await fetch(downloadUrl);
    const responseUrl = new URL(response.url || downloadUrl);
    if (!response.ok || !response.body || responseUrl.protocol !== 'https:' || responseUrl.hostname !== 'optifine.net') {
      throw new Error(`Unduhan OptiFine gagal (${response.status}).`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('java-archive') && !contentType.toLowerCase().includes('octet-stream')) {
      throw new Error('Situs OptiFine tidak mengembalikan installer JAR.');
    }

    let downloadedSize = 0;
    const sizeGuard = new Transform({
      transform(chunk, _encoding, callback) {
        downloadedSize += chunk.length;
        if (downloadedSize > 150 * 1024 * 1024) {
          callback(new Error('Installer OptiFine melebihi batas ukuran 150 MB.'));
          return;
        }
        callback(null, chunk);
      }
    });
    onStatus('Mengunduh installer OptiFine resmi...');
    await pipeline(Readable.fromWeb(response.body), sizeGuard, createWriteStream(installerPath, { flags: 'wx' }));
    const handle = await fs.open(installerPath, 'r');
    try {
      const signature = Buffer.alloc(4);
      const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
      if (bytesRead !== signature.length || signature[0] !== 0x50 || signature[1] !== 0x4b) {
        throw new Error('Unduhan OptiFine bukan arsip JAR yang valid.');
      }
    } finally {
      await handle.close();
    }

    onStatus('Memasang OptiFine dengan Java yang cocok...');
    return installOptifineJar(installerPath, gameDirectory, { java });
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function installLoaderVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus = () => {}) {
  if (loader === 'Vanilla') return minecraftVersion;
  if (!loaderVersion) throw new Error(`Pilih versi ${loader} terlebih dahulu.`);

  const available = await listLoaderVersions(minecraftVersion, loader);
  if (!available.some((version) => version.id === loaderVersion)) {
    throw new Error(`Versi ${loader} tidak cocok dengan Minecraft ${minecraftVersion}.`);
  }

  onStatus(`Memasang ${loader} ${loaderVersion}...`);
  if (loader === 'Fabric') {
    const artifact = await getFabricLoaderArtifact(minecraftVersion, loaderVersion);
    return installFabric({ minecraftVersion, version: artifact.loader.version, minecraft: gameDirectory });
  }
  if (loader === 'Quilt') {
    return installQuiltVersion({ minecraftVersion, version: loaderVersion, minecraft: gameDirectory });
  }

  const java = await ensureJavaForVersion(gameDirectory, minecraftVersion, onStatus);
  if (loader === 'OptiFine') {
    const versions = await getOptifineVersions(minecraftVersion);
    if (!versions.some((version) => version.id === loaderVersion)) {
      throw new Error(`Versi OptiFine tidak ditemukan untuk Minecraft ${minecraftVersion}.`);
    }
    return installOfficialOptifine(gameDirectory, minecraftVersion, loaderVersion, java, onStatus);
  }
  if (loader === 'Forge') {
    const forgeVersion = (await getForgeVersions(minecraftVersion)).find((version) => version.version === loaderVersion);
    if (!forgeVersion?.installer?.path) throw new Error('Installer Forge tidak ditemukan.');
    return installForge({
      mcversion: minecraftVersion,
      version: forgeVersion.version,
      installer: { path: forgeVersion.installer.path, sha1: forgeVersion.installer.sha1 }
    }, gameDirectory, { java, mavenHost: 'https://maven.minecraftforge.net' });
  }

  return installNeoForged('neoforge', loaderVersion, gameDirectory, {
    java,
    mavenHost: 'https://maven.neoforged.net/releases'
  });
}

async function installSelectedVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus = () => {}) {
  const vanilla = await installOfficialVersion(gameDirectory, minecraftVersion, onStatus);
  if (loader === 'Vanilla') return { ...vanilla, loader, loaderVersion: '' };
  const version = await installLoaderVersion(gameDirectory, minecraftVersion, loader, loaderVersion, onStatus);
  onStatus(`Mengunduh library ${loader}...`);
  await installDependencies(await Version.parse(gameDirectory, version));
  return { ...vanilla, version, loader, loaderVersion };
}

function getRequiredJavaMajor(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (major >= 26) return 25;
  if (major > 1 || minor >= 21 || minor === 20 && patch >= 5) return 21;
  if (major === 1 && minor === 17) return 16;
  if (minor >= 18) return 17;
  return 8;
}

async function findJava(requiredMajor) {
  const locations = await getPotentialJavaLocations();
  const results = await Promise.all(locations.map((location) => resolveJava(location)));
  const available = results.filter(Boolean);
  return available.find((java) => java.majorVersion === requiredMajor);
}

async function getJavaRuntimeStatus(versionId) {
  const majorVersion = getRequiredJavaMajor(versionId);
  const java = await findJava(majorVersion);
  return {
    majorVersion,
    installed: Boolean(java),
    installAvailable: process.platform === 'win32'
  };
}

async function launchOfficialVersion({ gameDirectory, versionId, account, onStatus = () => {} }) {
  if (!account?.profile || !account.mcToken) {
    throw new Error('Login dengan akun Microsoft pemilik Minecraft Java Edition diperlukan.');
  }

  const resolved = await Version.parse(gameDirectory, versionId);
  const javaMajor = resolved.javaVersion?.majorVersion ?? getRequiredJavaMajor(versionId);
  onStatus(`Memeriksa library Minecraft ${versionId}...`);
  await installDependencies(resolved);
  onStatus(`Menyiapkan Java ${javaMajor}...`);
  const javaPath = await ensureJavaForVersion(gameDirectory, versionId);
  const yggdrasilAgent = account.provider === 'Ely.by'
    ? { jar: await ensureAuthlibInjector(gameDirectory), server: 'https://authserver.ely.by' }
    : undefined;

  const child = await launch({
    gamePath: gameDirectory,
    javaPath,
    version: resolved,
    gameProfile: { name: account.profile.name, id: account.profile.id },
    accessToken: account.mcToken,
    userType: account.provider === 'Ely.by' ? 'mojang' : 'msa',
    yggdrasilAgent,
    maxMemory: Math.max(768, Math.min(process.arch === 'ia32' ? 1024 : 4096, Math.floor(os.totalmem() / 1024 / 1024 * 0.5))),
    minMemory: 512
  });

  return { child, javaMajor };
}

module.exports = {
  getRequiredJavaMajor,
  installSelectedVersion,
  installOfficialVersion,
  listLoaderVersions,
  launchOfficialVersion,
  listOfficialVersions,
  getJavaRuntimeStatus,
  parseOptifineVersions
};