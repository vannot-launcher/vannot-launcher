const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  downloadVerifiedFile,
  installScannedContent,
  installModrinthModpack,
  validateModpackManifest,
  validateModpackPath,
  searchModrinthContent,
  safeModFilename,
  searchCurseForgeMods,
  searchModrinthMods
} = require('../src/mod-platforms');

test('Modrinth search filters by project type, Minecraft version, and loader', async () => {
  const originalFetch = global.fetch;
  let requestUrl;
  global.fetch = async (url) => {
    requestUrl = new URL(url);
    return new Response(JSON.stringify({ hits: [{ project_id: 'mod-id', title: 'Test Mod' }] }), { status: 200 });
  };

  try {
    const mods = await searchModrinthMods('sodium', { minecraftVersion: '1.21.1', loader: 'Fabric' });
    const facets = JSON.parse(requestUrl.searchParams.get('facets'));
    assert.equal(mods[0].title, 'Test Mod');
    assert.deepEqual(facets, [['project_type:mod'], ['versions:1.21.1'], ['categories:fabric']]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Modrinth modpack search filters to the official selected Minecraft version', async () => {
  const originalFetch = global.fetch;
  let requestUrl;
  global.fetch = async (url) => {
    requestUrl = new URL(url);
    return new Response(JSON.stringify({ hits: [] }), { status: 200 });
  };

  try {
    await searchModrinthContent('kitchen sink', {
      minecraftVersion: '1.21.1',
      loader: 'Fabric'
    }, 'modpack');
    assert.deepEqual(JSON.parse(requestUrl.searchParams.get('facets')), [
      ['project_type:modpack'],
      ['versions:1.21.1']
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Modrinth modpacks must match the selected game and loader', () => {
  const selection = { minecraftVersion: '1.21.1', loader: 'Fabric', loaderVersion: '0.16.5' };
  const manifest = {
    formatVersion: 1,
    game: 'minecraft',
    dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.5' }
  };

  assert.doesNotThrow(() => validateModpackManifest(manifest, selection));
  assert.throws(() => validateModpackManifest({
    ...manifest,
    dependencies: { ...manifest.dependencies, minecraft: '1.20.1' }
  }, selection), /Minecraft 1\.20\.1/);
  assert.throws(() => validateModpackManifest(manifest, { ...selection, loaderVersion: '0.16.4' }), /memerlukan Fabric 0\.16\.5/);
  assert.doesNotThrow(() => validateModpackManifest({
    ...manifest,
    dependencies: { minecraft: '1.21.1', 'quilt-loader': '0.28.1' }
  }, { minecraftVersion: '1.21.1', loader: 'Quilt', loaderVersion: '0.28.1' }));
});

test('Modrinth modpack paths reject traversal and Windows device names', () => {
  assert.deepEqual(validateModpackPath('mods/example.jar'), ['mods', 'example.jar']);
  assert.throws(() => validateModpackPath('mods/../../outside.jar'), /jalur file yang tidak valid/);
  assert.throws(() => validateModpackPath('config/CON.toml'), /nama file yang tidak didukung Windows/);
  assert.throws(() => validateModpackPath('saves/world/level.dat'), /lokasi yang tidak didukung/);
});

test('CurseForge refuses requests when no official API key is configured', async () => {
  await assert.rejects(searchCurseForgeMods('sodium', { minecraftVersion: '1.21.1', loader: 'Fabric' }, ''), /API key/);
});

test('mod downloads require HTTPS and a matching checksum', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dinastixd-mod-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const payload = Buffer.from('trusted mod bytes');
  const hash = crypto.createHash('sha512').update(payload).digest('hex');
  const target = path.join(directory, 'mod.jar');
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(payload, { status: 200 });

  try {
    await downloadVerifiedFile('https://cdn.example/mod.jar', target, hash, 'sha512', payload.length);
    assert.deepEqual(await fs.readFile(target), payload);
    await assert.rejects(downloadVerifiedFile('http://cdn.example/mod.jar', target, hash, 'sha512', payload.length), /HTTPS/);
    await assert.rejects(downloadVerifiedFile('https://cdn.example/mod.jar', path.join(directory, 'bad.jar'), '0'.repeat(128), 'sha512', payload.length), /Checksum/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('third-party files stay in staging unless antivirus scanning succeeds', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-staging-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const contentDirectory = path.join(directory, 'mods');
  const destination = path.join(contentDirectory, 'mod.jar');

  await assert.rejects(installScannedContent(
    contentDirectory,
    async () => { throw new Error('Defender scan failed'); },
    async (stagingDirectory) => {
      await fs.writeFile(path.join(stagingDirectory, 'mod.jar'), 'untrusted mod');
      return [{ filename: 'mod.jar', title: 'Untrusted mod' }];
    }
  ), /Defender scan failed/);
  await assert.rejects(fs.access(destination), { code: 'ENOENT' });
  assert.deepEqual((await fs.readdir(contentDirectory)).filter((name) => name.startsWith('.vannot-scan-')), []);
});

test('third-party files are moved into the game only after a successful scan', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-scanned-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const contentDirectory = path.join(directory, 'mods');
  let scannedContents;

  const files = await installScannedContent(
    contentDirectory,
    async (stagingDirectory) => {
      scannedContents = await fs.readdir(stagingDirectory);
    },
    async (stagingDirectory) => {
      await fs.writeFile(path.join(stagingDirectory, 'clean-mod.jar'), 'scanned bytes');
      return [{ filename: 'clean-mod.jar', title: 'Clean mod' }];
    }
  );
  assert.deepEqual(scannedContents, ['clean-mod.jar']);
  assert.deepEqual(await fs.readFile(path.join(contentDirectory, 'clean-mod.jar'), 'utf8'), 'scanned bytes');
  assert.equal(files[0].title, 'Clean mod');
});

test('a quarantined file blocks the batch without replacing existing content', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-quarantine-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const contentDirectory = path.join(directory, 'mods');
  const destination = path.join(contentDirectory, 'mod.jar');
  await fs.mkdir(contentDirectory, { recursive: true });
  await fs.writeFile(destination, 'previously installed mod');

  await assert.rejects(installScannedContent(
    contentDirectory,
    async (stagingDirectory) => fs.rm(path.join(stagingDirectory, 'mod.jar')),
    async (stagingDirectory) => {
      await fs.writeFile(path.join(stagingDirectory, 'mod.jar'), 'detected mod');
      return [{ filename: 'mod.jar', title: 'Detected mod' }];
    }
  ), { code: 'ENOENT' });
  assert.equal(await fs.readFile(destination, 'utf8'), 'previously installed mod');
});

test('third-party file installation requires a scanner', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-no-scanner-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await assert.rejects(
    installScannedContent(directory, undefined, async () => []),
    /Pemindaian Microsoft Defender wajib/
  );
  await assert.rejects(
    installModrinthModpack('test', {}, directory),
    /Pemindaian Microsoft Defender wajib/
  );
});

test('mod filename validation rejects path traversal', () => {
  assert.equal(safeModFilename('mod-file-1.0.jar'), 'mod-file-1.0.jar');
  assert.throws(() => safeModFilename('../outside.jar'), /Nama file/);
});