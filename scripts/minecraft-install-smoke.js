const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getVersionList } = require('@xmcl/installer');
const { installOfficialVersion } = require('../src/minecraft-service');

async function sha1File(file) {
  const hash = crypto.createHash('sha1');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const versionId = process.env.VANNOT_SMOKE_MINECRAFT_VERSION || '1.21.1';
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vannot-minecraft-smoke-'));
  try {
    const manifest = await getVersionList();
    const officialVersion = manifest.versions.find((version) => version.id === versionId);
    assert.ok(officialVersion, `Minecraft ${versionId} must exist in the official Mojang manifest.`);
    const versionResponse = await fetch(officialVersion.url);
    assert.ok(versionResponse.ok, `official metadata for Minecraft ${versionId} must be downloadable`);
    const officialMetadata = await versionResponse.json();
    const installed = await installOfficialVersion(directory, versionId, (message) => console.log(message));
    assert.equal(installed.version, versionId);
    const versionDirectory = path.join(directory, 'versions', versionId);
    const metadata = JSON.parse(await fs.readFile(path.join(versionDirectory, `${versionId}.json`), 'utf8'));
    assert.equal(metadata.id, versionId);
    const clientJar = path.join(versionDirectory, `${versionId}.jar`);
    const expectedSha1 = officialMetadata.downloads?.client?.sha1;
    assert.match(expectedSha1 || '', /^[a-f\d]{40}$/i, 'official client manifest must provide a SHA-1 checksum');
    assert.equal(await sha1File(clientJar), expectedSha1.toLowerCase(), 'installed game jar must match Mojang official manifest');
    console.log(`Verified official Minecraft ${versionId} client jar: ${expectedSha1}`);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
