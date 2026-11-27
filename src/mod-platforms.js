const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWriteStream } = require('node:fs');
const os = require('node:os');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { open, openEntryReadStream, readEntry, walkEntriesGenerator } = require('@xmcl/unzip');

const MODRINTH_API = 'https://api.modrinth.com/v2';
const CURSEFORGE_API = 'https://api.curseforge.com/v1';
const CURSEFORGE_GAME_ID = 432;
const CURSEFORGE_CLASS_ID = { mod: 6, modpack: 4471, resourcepack: 12, shader: 6552 };
const CURSEFORGE_LOADER_ID = { Vanilla: 0, Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 };
const CONTENT_EXTENSIONS = { mod: '.jar', resourcepack: '.zip', shader: '.zip' };
const MODRINTH_LOADER_KEYS = { Fabric: 'fabric-loader', Quilt: 'quilt-loader', Forge: 'forge', NeoForge: 'neoforge' };
const MODPACK_ROOTS = new Set([
  'config', 'defaultconfigs', 'kubejs', 'mods', 'resourcepacks', 'scripts', 'shaderpacks',
  'global_packs', 'journeymap', 'xaero'
]);
const MODPACK_ROOT_FILES = new Set(['options.txt', 'optionsof.txt', 'optionsshaders.txt']);
const MAX_MODPACK_FILES = 2000;
const MAX_MODPACK_FILE_SIZE = 200 * 1024 * 1024;
const MAX_MODPACK_TOTAL_SIZE = 2 * 1024 * 1024 * 1024;
const LAUNCHER_VERSION = require('../package.json').version;

async function readJson(response, source) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `${source} gagal (${response.status}).`);
  return body;
}

function modrinthParams(selection, query = '', projectType = 'mod') {
  const facets = [[`project_type:${projectType}`], [`versions:${selection.minecraftVersion}`]];
  if (projectType === 'mod' && selection.loader && selection.loader !== 'Vanilla') facets.push([`categories:${selection.loader.toLowerCase()}`]);
  const params = new URLSearchParams({ limit: '30', facets: JSON.stringify(facets) });
  if (query.trim()) params.set('query', query.trim());
  return params;
}

async function searchModrinthContent(query, selection, projectType = 'mod') {
  const response = await fetch(`${MODRINTH_API}/search?${modrinthParams(selection, query, projectType)}`, {
    headers: { 'User-Agent': `VannotLauncher/${LAUNCHER_VERSION} (launcher)` }
  });
  const body = await readJson(response, 'Pencarian Modrinth');
  return body.hits.map((hit) => ({
    source: 'Modrinth',
    projectType,
    id: hit.project_id,
    title: hit.title,
    description: hit.description,
    icon: hit.icon_url,
    downloads: hit.downloads,
    slug: hit.slug
  }));
}

async function searchModrinthMods(query, selection) {
  return searchModrinthContent(query, selection, 'mod');
}

async function curseForgeRequest(url, apiKey) {
  if (!apiKey) throw new Error('API key CurseForge belum diatur di Pengaturan.');
  const response = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
  const body = await readJson(response, 'CurseForge');
  return body.data;
}

async function searchCurseForgeContent(query, selection, apiKey, projectType = 'mod') {
  const loader = CURSEFORGE_LOADER_ID[selection.loader];
  if (!CURSEFORGE_CLASS_ID[projectType]) throw new Error(`Jenis konten CurseForge ${projectType} tidak didukung.`);
  if (projectType === 'mod' && (loader === undefined || loader === 0)) throw new Error('Loader ini belum didukung untuk pencarian mod CurseForge.');
  const params = new URLSearchParams({
    gameId: String(CURSEFORGE_GAME_ID),
    classId: String(CURSEFORGE_CLASS_ID[projectType]),
    gameVersion: selection.minecraftVersion,
    pageSize: '30',
    index: '0'
  });
  if (projectType === 'mod') params.set('modLoaderType', String(loader));
  if (query.trim()) params.set('searchFilter', query.trim());

  const data = await curseForgeRequest(`${CURSEFORGE_API}/mods/search?${params}`, apiKey);
  return data.map((mod) => ({
    source: 'CurseForge',
    projectType,
    id: String(mod.id),
    title: mod.name,
    description: mod.summary,
    icon: mod.logo?.url,
    downloads: mod.downloadCount,
    slug: mod.slug
  }));
}

async function searchCurseForgeMods(query, selection, apiKey) {
  return searchCurseForgeContent(query, selection, apiKey, 'mod');
}

function safeModFilename(filename, expectedExtension = '.jar') {
  const basename = path.basename(filename);
  if (basename !== filename || !/^[a-zA-Z0-9 _().+\-[\]]+\.(jar|zip|mrpack)$/i.test(basename) || path.extname(basename).toLowerCase() !== expectedExtension) {
    throw new Error('Nama file konten tidak valid.');
  }
  return basename;
}

function validateModpackManifest(manifest, selection) {
  if (manifest?.formatVersion !== 1 || manifest.game !== 'minecraft' || !manifest.dependencies?.minecraft) {
    throw new Error('Format modpack Modrinth tidak didukung.');
  }
  if (manifest.dependencies.minecraft !== selection.minecraftVersion) {
    throw new Error(`Modpack ini memerlukan Minecraft ${manifest.dependencies.minecraft}.`);
  }

  const requiredLoaders = Object.entries(MODRINTH_LOADER_KEYS)
    .filter(([, key]) => manifest.dependencies[key])
    .map(([loader, key]) => ({ loader, version: String(manifest.dependencies[key]) }));
  if (requiredLoaders.length > 1) throw new Error('Modpack mencantumkan lebih dari satu loader yang tidak kompatibel.');
  if (!requiredLoaders.length) {
    if (selection.loader !== 'Vanilla') throw new Error('Modpack ini memerlukan Minecraft Vanilla.');
    return;
  }

  const [required] = requiredLoaders;
  if (selection.loader !== required.loader) {
    throw new Error(`Modpack ini memerlukan loader ${required.loader}.`);
  }
  if (selection.loaderVersion !== required.version) {
    throw new Error(`Modpack ini memerlukan ${required.loader} ${required.version}. Pilih versi loader tersebut di dashboard.`);
  }
}

function validateModpackPath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\\') || relativePath.startsWith('/') || /^[a-zA-Z]:/.test(relativePath)) {
    throw new Error('Modpack berisi jalur file yang tidak valid.');
  }
  const parts = relativePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[<>:"|?*\u0000-\u001f]/.test(part))) {
    throw new Error('Modpack berisi jalur file yang tidak valid.');
  }
  if (parts.some((part) => part.endsWith('.') || part.endsWith(' ') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('Modpack berisi nama file yang tidak didukung Windows.');
  }
  if (parts.length === 1 ? !MODPACK_ROOT_FILES.has(parts[0].toLowerCase()) : !MODPACK_ROOTS.has(parts[0].toLowerCase())) {
    throw new Error(`Modpack mencoba memasang file di lokasi yang tidak didukung: ${parts[0]}.`);
  }
  return parts;
}

async function getModpackDestination(root, relativePath) {
  const parts = validateModpackPath(relativePath);
  await fs.mkdir(root, { recursive: true });
  const realRoot = await fs.realpath(root);
  let directory = realRoot;
  for (const part of parts.slice(0, -1)) {
    directory = path.join(directory, part);
    await fs.mkdir(directory, { recursive: true });
    const stats = await fs.lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('Modpack tidak dapat dipasang ke folder yang tidak aman.');
    }
  }
  const target = path.join(directory, parts.at(-1));
  try {
    const stats = await fs.lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error('Modpack tidak dapat menimpa folder atau tautan simbolis.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return target;
}

async function downloadVerifiedFile(url, destination, expectedHash, algorithm, expectedSize) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:') throw new Error('Mod harus diunduh melalui HTTPS.');
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > 200 * 1024 * 1024) {
    throw new Error('Ukuran mod tidak valid atau melebihi batas 200 MB.');
  }

  const response = await fetch(parsedUrl);
  if (!response.ok || !response.body) throw new Error(`Unduhan mod gagal (${response.status}).`);
  if (new URL(response.url || parsedUrl).protocol !== 'https:') throw new Error('Pengalihan unduhan harus tetap menggunakan HTTPS.');
  const hash = crypto.createHash(algorithm);
  let downloadedSize = 0;
  const digestStream = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedSize += chunk.length;
      if (downloadedSize > expectedSize || downloadedSize > 200 * 1024 * 1024) {
        callback(new Error('Unduhan mod melebihi ukuran resmi.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    }
  });
  const temporaryPath = `${destination}.${process.pid}.${crypto.randomUUID()}.download`;
  try {
    await pipeline(Readable.fromWeb(response.body), digestStream, createWriteStream(temporaryPath, { flags: 'wx' }));
    if (downloadedSize !== expectedSize || hash.digest('hex').toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error('Checksum mod tidak cocok; file unduhan ditolak.');
    }
    await fs.rm(destination, { force: true });
    await fs.rename(temporaryPath, destination);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function installModrinthModpack(projectId, selection, instanceDirectory, onStatus = () => {}) {
  const version = await getModrinthVersion(projectId, selection, 'modpack');
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file?.hashes?.sha512) throw new Error('File modpack Modrinth tidak memiliki checksum SHA-512.');
  const filename = safeModFilename(file.filename, '.mrpack');
  const archiveUrl = new URL(file.url);
  if (archiveUrl.protocol !== 'https:') throw new Error('Modpack harus diunduh melalui HTTPS.');
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-modpack-'));
  const archivePath = path.join(temporaryDirectory, filename);
  let zip;

  try {
    onStatus(`Mengunduh modpack ${version.name} dari Modrinth...`);
    await downloadVerifiedFile(archiveUrl, archivePath, file.hashes.sha512, 'sha512', file.size);
    zip = await open(archivePath);

    let indexEntry;
    let entryCount = 0;
    let archiveSize = 0;
    const entries = [];
    const entryNames = new Set();
    for await (const entry of walkEntriesGenerator(zip)) {
      entryCount += 1;
      if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entryNames.has(entry.fileName)) {
        throw new Error('Modpack berisi entri arsip yang tidak valid.');
      }
      const fileType = (entry.externalFileAttributes >>> 16) & 0xf000;
      if (fileType === 0xa000) throw new Error('Modpack tidak boleh berisi tautan simbolis.');
      entryNames.add(entry.fileName);
      archiveSize += entry.uncompressedSize;
      if (entryCount > MAX_MODPACK_FILES + 1 || archiveSize > MAX_MODPACK_TOTAL_SIZE) {
        throw new Error('Modpack melebihi batas ukuran atau jumlah file yang didukung.');
      }
      if (entry.fileName === 'modrinth.index.json') indexEntry = entry;
      entries.push(entry);
    }
    if (!indexEntry || indexEntry.uncompressedSize > 2 * 1024 * 1024) {
      throw new Error('Manifest modpack Modrinth tidak ditemukan atau terlalu besar.');
    }

    let manifest;
    try {
      manifest = JSON.parse((await readEntry(zip, indexEntry)).toString('utf8'));
    } catch (error) {
      throw new Error(`Manifest modpack tidak valid: ${error.message}`);
    }
    validateModpackManifest(manifest, selection);
    if (!Array.isArray(manifest.files) || manifest.files.length > MAX_MODPACK_FILES) {
      throw new Error('Daftar file modpack tidak valid atau terlalu besar.');
    }

    const selectedFiles = manifest.files.filter((item) => item.env?.client !== 'unsupported');
    let totalSize = selectedFiles.reduce((sum, item) => sum + (Number(item.fileSize) || 0), 0);
    if (totalSize > MAX_MODPACK_TOTAL_SIZE) throw new Error('Ukuran total modpack melebihi batas 2 GB.');

    const filePaths = new Set();
    const downloadUrls = [];
    for (const item of selectedFiles) {
      validateModpackPath(item.path);
      if (filePaths.has(item.path)) throw new Error('Modpack memiliki jalur file yang berulang.');
      filePaths.add(item.path);
      if (!Array.isArray(item.downloads) || !item.downloads.length || !/^[a-f\d]{128}$/i.test(item.hashes?.sha512 || '')) {
        throw new Error('File modpack tidak memiliki URL atau checksum SHA-512 yang valid.');
      }
      if (!Number.isSafeInteger(item.fileSize) || item.fileSize < 1 || item.fileSize > MAX_MODPACK_FILE_SIZE) {
        throw new Error('Ukuran file dalam modpack tidak valid.');
      }
      const downloadUrl = new URL(item.downloads[0]);
      if (downloadUrl.protocol !== 'https:') throw new Error('File modpack harus diunduh melalui HTTPS.');
      downloadUrls.push(downloadUrl);
    }

    const overridePaths = new Set();
    const overrides = entries.flatMap((entry) => {
      const prefix = entry.fileName.startsWith('overrides/')
        ? 'overrides/'
        : entry.fileName.startsWith('client-overrides/')
          ? 'client-overrides/'
          : '';
      return prefix && !entry.fileName.endsWith('/')
        ? [{ entry, relativePath: entry.fileName.slice(prefix.length) }]
        : [];
    });
    for (const override of overrides) {
      if (override.entry.uncompressedSize > MAX_MODPACK_FILE_SIZE) {
        throw new Error('File override dalam modpack melebihi batas 200 MB.');
      }
      validateModpackPath(override.relativePath);
      if (filePaths.has(override.relativePath) || overridePaths.has(override.relativePath)) {
        throw new Error('Modpack memiliki file override yang berulang.');
      }
      overridePaths.add(override.relativePath);
    }
    const overrideSize = overrides.reduce((sum, override) => sum + override.entry.uncompressedSize, 0);
    if (totalSize + overrideSize > MAX_MODPACK_TOTAL_SIZE) {
      throw new Error('Ukuran total file modpack melebihi batas 2 GB.');
    }

    const downloadTargets = await Promise.all(
      selectedFiles.map((item) => getModpackDestination(instanceDirectory, item.path))
    );
    const overrideTargets = await Promise.all(
      overrides.map(({ relativePath }) => getModpackDestination(instanceDirectory, relativePath))
    );
    let installedCount = 0;
    for (const [index, item] of selectedFiles.entries()) {
      const target = downloadTargets[index];
      onStatus(`Mengunduh file modpack (${installedCount + 1}/${selectedFiles.length})...`);
      await downloadVerifiedFile(downloadUrls[index], target, item.hashes.sha512, 'sha512', item.fileSize);
      installedCount += 1;
    }

    for (const [index, { entry, relativePath }] of overrides.entries()) {
      const target = overrideTargets[index];
      const stagingPath = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
      let writtenSize = 0;
      const sizeGuard = new Transform({
        transform(chunk, _encoding, callback) {
          writtenSize += chunk.length;
          if (writtenSize > entry.uncompressedSize || writtenSize > MAX_MODPACK_FILE_SIZE) {
            callback(new Error('File override melebihi ukuran yang dinyatakan dalam modpack.'));
            return;
          }
          callback(null, chunk);
        }
      });
      try {
        onStatus(`Memasang file konfigurasi ${relativePath}...`);
        await pipeline(await openEntryReadStream(zip, entry), sizeGuard, createWriteStream(stagingPath, { flags: 'wx' }));
        if (writtenSize !== entry.uncompressedSize) throw new Error('Ukuran file override tidak cocok dengan arsip modpack.');
        await fs.rm(target, { force: true });
        await fs.rename(stagingPath, target);
        installedCount += 1;
      } finally {
        await fs.rm(stagingPath, { force: true });
      }
    }

    return [{ filename, title: version.name, installedCount }];
  } finally {
    zip?.close();
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function getModrinthVersion(projectId, selection, projectType) {
  const query = { game_versions: JSON.stringify([selection.minecraftVersion]) };
  if (projectType === 'mod') query.loaders = JSON.stringify([selection.loader.toLowerCase()]);
  const params = new URLSearchParams(query);
  const response = await fetch(`${MODRINTH_API}/project/${encodeURIComponent(projectId)}/version?${params}`);
  const versions = await readJson(response, 'Versi mod Modrinth');
  const version = versions[0];
  if (!version) throw new Error('Tidak ada file mod yang cocok dengan versi Minecraft dan loader ini.');
  return version;
}

async function installModrinthContent(projectId, selection, destinationDirectory, projectType = 'mod', installed = new Set()) {
  if (!CONTENT_EXTENSIONS[projectType]) throw new Error(`Jenis konten ${projectType} belum didukung untuk instalasi.`);
  if (projectType === 'mod' && selection.loader === 'Vanilla') throw new Error('Mod Java memerlukan loader yang kompatibel.');
  if (installed.has(projectId)) return [];
  if (installed.size >= 32) throw new Error('Batas 32 dependency mod terlampaui.');
  installed.add(projectId);

  const version = await getModrinthVersion(projectId, selection, projectType);
  const file = version.files.find((item) => item.primary) || version.files[0];
  if (!file?.hashes?.sha512) throw new Error('File Modrinth tidak memiliki checksum SHA-512.');
  const filename = safeModFilename(file.filename, CONTENT_EXTENSIONS[projectType]);
  await fs.mkdir(destinationDirectory, { recursive: true });
  await downloadVerifiedFile(file.url, path.join(destinationDirectory, filename), file.hashes.sha512, 'sha512', file.size);

  const results = [{ filename, title: version.name }];
  for (const dependency of version.dependencies || []) {
    if (dependency.dependency_type !== 'required' || !dependency.project_id) continue;
    results.push(...await installModrinthContent(dependency.project_id, selection, destinationDirectory, projectType, installed));
  }
  return results;
}

async function installModrinthProject(projectId, selection, modsDirectory, installed = new Set()) {
  return installModrinthContent(projectId, selection, modsDirectory, 'mod', installed);
}

async function getCurseForgeFile(modId, selection, apiKey, projectType = 'mod') {
  const loader = CURSEFORGE_LOADER_ID[selection.loader];
  const params = new URLSearchParams({
    gameVersion: selection.minecraftVersion,
    pageSize: '20',
    index: '0'
  });
  if (projectType === 'mod') params.set('modLoaderType', String(loader));
  const files = await curseForgeRequest(`${CURSEFORGE_API}/mods/${encodeURIComponent(modId)}/files?${params}`, apiKey);
  const file = files.find((candidate) => candidate.downloadUrl && (candidate.gameVersions || []).includes(selection.minecraftVersion));
  if (!file) throw new Error('CurseForge tidak menyediakan file langsung yang cocok untuk versi ini.');
  return file;
}

async function installCurseForgeProject(modId, selection, modsDirectory, apiKey) {
  const file = await getCurseForgeFile(modId, selection, apiKey);
  const filename = safeModFilename(file.fileName, '.jar');
  const checksum = file.hashes?.find((hash) => hash.algo === 1);
  if (!checksum?.value) throw new Error('File CurseForge tidak memiliki checksum SHA-1.');
  await fs.mkdir(modsDirectory, { recursive: true });
  await downloadVerifiedFile(file.downloadUrl, path.join(modsDirectory, filename), checksum.value, 'sha1', file.fileLength);
  return [{ filename, title: file.displayName }];
}

async function installModrinthResource(projectId, selection, resourcesDirectory, resourceType) {
  if (!['resourcepack', 'shader'].includes(resourceType)) throw new Error('Jenis resource belum didukung.');
  return installModrinthContent(projectId, selection, resourcesDirectory, resourceType);
}

async function installCurseForgeResource(modId, selection, resourcesDirectory, apiKey, resourceType) {
  if (!['resourcepack', 'shader'].includes(resourceType)) throw new Error('Jenis resource belum didukung.');
  const file = await getCurseForgeFile(modId, selection, apiKey, resourceType);
  const filename = safeModFilename(file.fileName, '.zip');
  const checksum = file.hashes?.find((hash) => hash.algo === 1);
  if (!checksum?.value) throw new Error('File CurseForge tidak memiliki checksum SHA-1.');
  await fs.mkdir(resourcesDirectory, { recursive: true });
  await downloadVerifiedFile(file.downloadUrl, path.join(resourcesDirectory, filename), checksum.value, 'sha1', file.fileLength);
  return [{ filename, title: file.displayName }];
}

module.exports = {
  downloadVerifiedFile,
  installModrinthModpack,
  installCurseForgeProject,
  installCurseForgeResource,
  installModrinthResource,
  installModrinthProject,
  searchCurseForgeContent,
  searchModrinthContent,
  safeModFilename,
  validateModpackManifest,
  validateModpackPath,
  searchCurseForgeMods,
  searchModrinthMods
};