const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function findDefenderCli({ platform = process.platform, env = process.env, fsApi = fs } = {}) {
  if (platform !== 'win32') {
    throw new Error('Pemindaian Microsoft Defender hanya tersedia di Windows.');
  }

  const platformDirectory = path.win32.join(
    env.ProgramData || 'C:\\ProgramData',
    'Microsoft',
    'Windows Defender',
    'Platform'
  );
  let platformVersions = [];
  try {
    const entries = await fsApi.readdir(platformDirectory, { withFileTypes: true });
    platformVersions = entries
      .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const candidates = [
    ...platformVersions.map((version) => path.win32.join(platformDirectory, version, 'MpCmdRun.exe')),
    path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Windows Defender', 'MpCmdRun.exe')
  ];
  for (const candidate of candidates) {
    try {
      await fsApi.access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  throw new Error('Microsoft Defender tidak ditemukan. Aktifkan Microsoft Defender sebelum memasang konten.');
}

function powershellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

async function scanWithDefender(targetPath, {
  platform = process.platform,
  env = process.env,
  fsApi = fs,
  run = execFileAsync,
  onStatus = () => {}
} = {}) {
  if (platform !== 'win32') {
    throw new Error('Pemindaian Microsoft Defender hanya tersedia di Windows.');
  }
  const defenderCli = await findDefenderCli({ platform, env, fsApi });
  const powershell = path.win32.join(
    env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$protection = Get-MpComputerStatus',
    'if (-not $protection.AMServiceEnabled -or -not $protection.AntivirusEnabled -or -not $protection.RealTimeProtectionEnabled) { exit 3 }',
    `$defender = ${powershellLiteral(defenderCli)}`,
    `$target = ${powershellLiteral(targetPath)}`,
    `$scanArguments = '-Scan -ScanType 3 -File "' + $target + '"'`,
    '$scan = Start-Process -FilePath $defender -ArgumentList $scanArguments -Verb RunAs -Wait -PassThru',
    'exit $scan.ExitCode'
  ].join('; ');

  onStatus('Meminta izin Administrator untuk memindai dengan Microsoft Defender...');
  try {
    await run(powershell, [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-EncodedCommand',
      encodePowerShell(script)
    ], { windowsHide: true, timeout: 20 * 60 * 1000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    if (error.code === 2) {
      throw new Error('Microsoft Defender menemukan ancaman atau pemindaian gagal; konten tidak dipasang.');
    }
    if (error.code === 1) {
      throw new Error('Izin Administrator ditolak atau Microsoft Defender gagal dijalankan; konten tidak dipasang.');
    }
    if (error.code === 3) {
      throw new Error('Microsoft Defender atau perlindungan real-time tidak aktif; konten tidak dipasang.');
    }
    if (error.killed || error.code === 'ETIMEDOUT') {
      throw new Error('Pemindaian Microsoft Defender melewati batas waktu; konten tidak dipasang.');
    }
    throw new Error(`Pemindaian Microsoft Defender gagal; konten tidak dipasang: ${error.message}`);
  }
  try {
    await fsApi.access(targetPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Microsoft Defender mengarantina atau menghapus konten; pemasangan dibatalkan.');
    }
    throw error;
  }
  onStatus('Pemindaian Microsoft Defender selesai.');
}

module.exports = { findDefenderCli, scanWithDefender };
