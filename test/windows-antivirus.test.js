const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { findDefenderCli, scanWithDefender } = require('../src/windows-antivirus');

const env = {
  ProgramData: 'C:\\ProgramData',
  ProgramFiles: 'C:\\Program Files',
  SystemRoot: 'C:\\Windows'
};
const platformDirectory = path.win32.join(env.ProgramData, 'Microsoft', 'Windows Defender', 'Platform');

function mockFileSystem(existingPaths = []) {
  const existing = new Set(existingPaths);
  return {
    async readdir() {
      return [
        { name: '4.18.2.0', isDirectory: () => true },
        { name: '4.18.10.0', isDirectory: () => true },
        { name: 'notes', isDirectory: () => false }
      ];
    },
    async access(file) {
      if (!existing.has(file) && !file.endsWith('staging folder')) {
        const error = new Error('File not found');
        error.code = 'ENOENT';
        throw error;
      }
    }
  };
}

test('finds the newest installed Microsoft Defender command line scanner', async () => {
  const latest = path.win32.join(platformDirectory, '4.18.10.0', 'MpCmdRun.exe');
  assert.equal(await findDefenderCli({
    platform: 'win32',
    env,
    fsApi: mockFileSystem([latest])
  }), latest);
});

test('requires Windows Defender and refuses unsupported operating systems', async () => {
  await assert.rejects(findDefenderCli({ platform: 'linux', env }), /hanya tersedia di Windows/);
  await assert.rejects(findDefenderCli({ platform: 'win32', env, fsApi: mockFileSystem() }), /Defender tidak ditemukan/);
});

test('requests UAC for a custom scan and only succeeds when the target remains available', async () => {
  const target = "C:\\Games\\O'Brien\\mods\\.vannot-scan-staging folder";
  const latest = path.win32.join(platformDirectory, '4.18.10.0', 'MpCmdRun.exe');
  let command;
  await scanWithDefender(target, {
    platform: 'win32',
    env,
    fsApi: mockFileSystem([latest]),
    onStatus: (message) => { if (!message.includes('Administrator')) assert.match(message, /selesai/); },
    run: async (executable, args, options) => {
      command = { executable, args, options };
      const script = Buffer.from(args.at(-1), 'base64').toString('utf16le');
      assert.match(script, /Get-MpComputerStatus/);
      assert.match(script, /RealTimeProtectionEnabled/);
      assert.match(script, /-Verb RunAs/);
      assert.match(script, /-ScanType 3/);
      assert.match(script, /O''Brien/);
      assert.match(script, /C:\\Games\\O''Brien\\mods\\\.vannot-scan-staging folder/);
      return { stdout: '', stderr: '' };
    }
  });
  assert.equal(command.executable, path.win32.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'));
  assert.equal(command.options.windowsHide, true);
});

test('blocks installation when Defender reports a threat or UAC is denied', async () => {
  const latest = path.win32.join(platformDirectory, '4.18.10.0', 'MpCmdRun.exe');
  const scanOptions = {
    platform: 'win32',
    env,
    fsApi: mockFileSystem([latest]),
    run: async () => {
      const error = new Error('scan failed');
      error.code = 2;
      throw error;
    }
  };
  await assert.rejects(scanWithDefender('C:\\staging', scanOptions), /menemukan ancaman atau pemindaian gagal/);
  await assert.rejects(scanWithDefender('C:\\staging', {
    ...scanOptions,
    run: async () => {
      const error = new Error('cancelled');
      error.code = 1;
      throw error;
    }
  }), /Izin Administrator ditolak/);
  await assert.rejects(scanWithDefender('C:\\staging', {
    ...scanOptions,
    run: async () => {
      const error = new Error('Defender inactive');
      error.code = 3;
      throw error;
    }
  }), /perlindungan real-time tidak aktif/);
});

test('blocks installation if Defender removes the staged scan target', async () => {
  const latest = path.win32.join(platformDirectory, '4.18.10.0', 'MpCmdRun.exe');
  const fsApi = mockFileSystem([latest]);
  fsApi.access = async (file) => {
    if (file === 'C:\\staging') {
      const error = new Error('File was quarantined');
      error.code = 'ENOENT';
      throw error;
    }
  };
  await assert.rejects(scanWithDefender('C:\\staging', {
    platform: 'win32',
    env,
    fsApi,
    run: async () => ({ stdout: '', stderr: '' })
  }), /mengarantina atau menghapus/);
});
