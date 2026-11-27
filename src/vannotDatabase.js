const DATABASE_KEY = 'moon.launcher.database.v1';
const DATABASE_BACKUP_KEY = 'moon.launcher.database.backup';
const SCHEMA_VERSION = 1;
const LEGACY_KEYS = {
  minecraftVersion: 'noom.minecraftVersion',
  offlineProfiles: 'noom.offlineProfiles',
  activeOfflineProfile: 'noom.activeOfflineProfile',
};

const emptyDatabase = () => ({
  schemaVersion: SCHEMA_VERSION,
  instances: [],
  profiles: [],
  mods: [],
  modpacks: [],
  minecraftVersions: [],
  catalogCache: {},
  downloads: [],
  updateHistory: [],
  settings: {},
  activeOfflineProfile: '',
  minecraftVersion: '',
});

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function normalizeDatabase(database) {
  const defaults = emptyDatabase();
  return {
    ...defaults,
    ...database,
    schemaVersion: SCHEMA_VERSION,
    instances: Array.isArray(database?.instances) ? database.instances : [],
    profiles: Array.isArray(database?.profiles) ? database.profiles : [],
    mods: Array.isArray(database?.mods) ? database.mods : [],
    modpacks: Array.isArray(database?.modpacks) ? database.modpacks : [],
    minecraftVersions: Array.isArray(database?.minecraftVersions) ? database.minecraftVersions : [],
    catalogCache: database?.catalogCache && typeof database.catalogCache === 'object' ? database.catalogCache : {},
    downloads: Array.isArray(database?.downloads) ? database.downloads : [],
    updateHistory: Array.isArray(database?.updateHistory) ? database.updateHistory : [],
    settings: database?.settings && typeof database.settings === 'object' ? database.settings : {},
  };
}

function saveDatabase(database) {
  const normalized = normalizeDatabase(database);
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.error('Vannot database could not be saved.', error);
    throw error;
  }
  return normalized;
}

function migrateLegacyData(database) {
  const legacyProfiles = readJson(LEGACY_KEYS.offlineProfiles);
  const profiles = Array.isArray(legacyProfiles) ? legacyProfiles : database.profiles;
  return {
    ...database,
    profiles,
    minecraftVersion: localStorage.getItem(LEGACY_KEYS.minecraftVersion) || database.minecraftVersion,
    activeOfflineProfile: localStorage.getItem(LEGACY_KEYS.activeOfflineProfile) || database.activeOfflineProfile,
  };
}

export function getVannotDatabase() {
  const raw = localStorage.getItem(DATABASE_KEY);
  let database;
  try {
    database = raw ? normalizeDatabase(JSON.parse(raw)) : emptyDatabase();
  } catch {
    if (raw) localStorage.setItem(DATABASE_BACKUP_KEY, raw);
    database = normalizeDatabase(readJson(DATABASE_BACKUP_KEY));
    if (!localStorage.getItem(DATABASE_BACKUP_KEY)) database = emptyDatabase();
  }

  if (!raw) database = migrateLegacyData(database);
  return saveDatabase(database);
}

export function updateVannotDatabase(updater) {
  const current = getVannotDatabase();
  const next = typeof updater === 'function' ? updater(current) : updater;
  return saveDatabase(next);
}

export function getVannotSetting(key, fallback) {
  const settings = getVannotDatabase().settings;
  return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback;
}

export function setVannotSetting(key, value) {
  updateVannotDatabase((database) => ({
    ...database,
    settings: { ...database.settings, [key]: value },
  }));
}

export function exportVannotDatabase() {
  return JSON.stringify(getVannotDatabase(), null, 2);
}

export function importVannotDatabase(serialized) {
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Format database Vannot tidak valid.');
  }
  return saveDatabase(normalizeDatabase(parsed));
}
