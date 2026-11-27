import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVannotAssets } from '../scripts/generate-vannot-assets.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const xmclRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the checked-out XMCL source directory.');
const releaseTag = process.argv[3] || 'windows-v2.1.0-beta.4';
const appVersion = releaseTag.replace(/^(?:windows|linux)-v/, '');
if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(appVersion)) throw new Error(`Invalid Windows release tag: ${releaseTag}`);

async function replaceOnce(file, before, after) {
  const source = await readFile(file, 'utf8');
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error(`Expected one branding anchor in ${file}: ${before}`);
  }
  await writeFile(file, source.replace(before, after));
}

async function rebrandTextFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rebrandTextFiles(file);
    } else if (/\.(html|json|ts|vue)$/.test(entry.name)) {
      const source = await readFile(file, 'utf8');
      const branded = source
        .replaceAll('X Minecraft Launcher', 'Vannot Launcher')
        .replaceAll('>XMCL<', '>Vannot<')
        .replaceAll('"XMCL"', '"Vannot"')
        .replaceAll("'XMCL'", "'Vannot'")
        .replaceAll('logo.webp', 'vannot-logo.png');
      if (branded !== source) await writeFile(file, branded);
    }
  }
}

async function removeClientTitles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeClientTitles(file);
    } else if (/\.(html|json|ts|vue)$/.test(entry.name)) {
      const source = await readFile(file, 'utf8');
      const withoutClientTitles = source
        .replaceAll('"Client"', '""')
        .replaceAll('"Clients"', '""')
        .replaceAll("'Client'", "''")
        .replaceAll("'Clients'", "''")
        .replaceAll('>Client<', '><')
        .replaceAll('>Clients<', '><');
      if (withoutClientTitles !== source) await writeFile(file, withoutClientTitles);
    }
  }
}

const electronApp = path.join(xmclRoot, 'xmcl-electron-app');
const renderer = path.join(xmclRoot, 'xmcl-keystone-ui');
const builderConfig = path.join(electronApp, 'build/electron-builder.config.ts');
await replaceOnce(builderConfig, "productName: 'XMCL',", "productName: 'Vannot Launcher',");
await replaceOnce(builderConfig, "appId: 'xmcl',", "appId: 'id.vannot.launcher.windows',");
await replaceOnce(builderConfig, "name: 'XMCL',", "name: 'Vannot Launcher',");
await replaceOnce(builderConfig, "schemes: ['xmcl'],", "schemes: ['vannot'],");
await replaceOnce(builderConfig, `publish: [{
    provider: 'github',
    owner: 'voxelum',
    repo: 'x-minecraft-launcher',
  }],`, `publish: [{
    provider: 'github',
    owner: 'vannot-launcher',
    repo: 'vannot-launcher',
  }],`);
await replaceOnce(builderConfig, "artifactName: 'xmcl-${version}-${platform}-${arch}.${ext}',", "artifactName: 'VannotLauncher-v${version}-${arch}.${ext}',");
await replaceOnce(builderConfig, "icon: 'icons/dark.ico',", "icon: 'icons/vannot.ico',");
await replaceOnce(builderConfig, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }],`, `  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }, {
    from: 'build/Vannot-Third-Party-Notices.txt',
    to: 'Vannot-Third-Party-Notices.txt',
  }],`);
await replaceOnce(builderConfig, `target: [
      {
        target: 'zip',
        arch: [
          'x64',
          'ia32',
        ],
      },
      'appx',
    ],`, `target: [{
      target: 'nsis',
      arch: ['x64'],
    }],`);
await replaceOnce(builderConfig, `  linux: {
    executableName: 'xmcl',
    electronLanguages: ['en-US'],
    desktop: {
      entry: {
        MimeType: 'x-scheme-handler/xmcl',
        StartupWMClass: 'xmcl',
      },
    },
    category: 'Game',
    icon: 'icons/dark.icns',
    artifactName: 'xmcl-\${version}-\${arch}.\${ext}',
    target: [
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
      { target: 'pacman', arch: ['x64', 'arm64'] },
    ],
  },`, `  linux: {
    executableName: 'vannot-launcher',
    electronLanguages: ['en-US'],
    desktop: {
      entry: {
        MimeType: 'x-scheme-handler/vannot',
        StartupWMClass: 'vannot-launcher',
      },
    },
    category: 'Game',
    icon: 'icons/vannot-256.png',
    artifactName: 'VannotLauncher-v\${version}-\${arch}.\${ext}',
    target: [{ target: 'AppImage', arch: ['x64', 'ia32'] }],
  },`);

const appPackagePath = path.join(electronApp, 'package.json');
const uiPackagePath = path.join(renderer, 'package.json');
await removeClientTitles(renderer);
const uiPackage = JSON.parse(await readFile(uiPackagePath, 'utf8'));
await writeFile(uiPackagePath, `${JSON.stringify(uiPackage, null, 4)}\n`);
const appPackage = JSON.parse(await readFile(appPackagePath, 'utf8'));
appPackage.version = appVersion;
await writeFile(appPackagePath, `${JSON.stringify(appPackage, null, 4)}\n`);

await replaceOnce(
  path.join(renderer, 'src/index.html'),
  '<title>X Minecraft Launcher</title>',
  '<title>Vannot Launcher</title>',
);
await replaceOnce(
  path.join(renderer, 'src/index.html'),
  '<title>Vannot Launcher</title>',
  '<title>Vannot Launcher</title>\n    <link rel="icon" type="image/png" href="./assets/vannot-logo.png">',
);
const loginForm = path.join(renderer, 'src/components/UserLoginForm.vue');
const homeView = path.join(renderer, 'src/views/Home.vue');
const sidebarView = path.join(renderer, 'src/views/AppSideBarClassic.vue');
const launchStatusDialog = path.join(renderer, 'src/views/HomeLaunchStatusDialog.vue');
const vuetifyConfig = path.join(renderer, 'src/vuetify.ts');
const searchModel = path.join(renderer, 'src/composables/search.ts');
await replaceOnce(
  vuetifyConfig,
  "primary: '#4caf50',\n          accent: '#00e676',",
  "primary: '#B9F27A',\n          accent: '#E4B85D',",
);
await replaceOnce(
  homeView,
  "import HomeCriticalError from './HomeCriticalError.vue'",
  "import vannotLogo from '@/assets/vannot-logo.png'\nimport vannotHero from '@/assets/vannot-hero.webp'\nimport HomeCriticalError from './HomeCriticalError.vue'"
);
await replaceOnce(
  loginForm,
  `    <UserLoginAuthoritySelect
      v-model="authority"`,
  `    <div class="mb-4 grid grid-cols-2 gap-2" data-testid="quick-login-providers">
      <v-btn
        data-testid="quick-login-microsoft"
        :variant="authority === AUTHORITY_MICROSOFT ? 'flat' : 'tonal'"
        :color="authority === AUTHORITY_MICROSOFT ? 'primary' : undefined"
        @click="chooseQuickAuthority(AUTHORITY_MICROSOFT)"
      >
        <v-icon start size="17">xmcl:microsoft</v-icon>
        Microsoft
      </v-btn>
      <v-btn
        data-testid="quick-login-offline"
        :variant="authority === AUTHORITY_DEV ? 'flat' : 'tonal'"
        :color="authority === AUTHORITY_DEV ? 'primary' : undefined"
        @click="chooseQuickAuthority(AUTHORITY_DEV)"
      >
        <v-icon start size="17">person</v-icon>
        {{ t('userServices.offline.name') }}
      </v-btn>
      <v-btn
        data-testid="quick-login-elyby"
        :variant="authority.includes('ely.by') ? 'flat' : 'tonal'"
        :color="authority.includes('ely.by') ? 'primary' : undefined"
        :loading="isAddingYggdrasil"
        @click="chooseElyBy"
      >
        <v-icon start size="17">public</v-icon>
        Ely.by
      </v-btn>
      <v-btn
        data-testid="quick-login-littleskin"
        :variant="authority.includes('littleskin.cn') ? 'flat' : 'tonal'"
        :color="authority.includes('littleskin.cn') ? 'primary' : undefined"
        :loading="isAddingYggdrasil"
        @click="chooseLittleSkin"
      >
        <v-icon start size="17">face</v-icon>
        LittleSkin
      </v-btn>
    </div>
    <v-alert v-if="quickAuthError" type="warning" density="compact" variant="tonal" class="mb-3">
      {{ quickAuthError }}
    </v-alert>
    <UserLoginAuthoritySelect
      v-model="authority"`,
);
await replaceOnce(
  loginForm,
  'const { login, abortLogin, on } = useService(UserServiceKey)',
  'const { login, abortLogin, on, addYggdrasilService } = useService(UserServiceKey)',
);
await replaceOnce(
  homeView,
  '          <HomeGrid />',
  `          <section class="vannot-hero mx-3 mb-6" data-testid="vannot-hero">
            <img class="vannot-hero__art" :src="vannotHero" alt="" />
            <div class="vannot-hero__content">
              <div class="vannot-hero__brandline">
                <img class="vannot-hero__logo" :src="vannotLogo" alt="" />
                <div>
                  <div class="vannot-hero__wordmark">VANNOT LAUNCHER</div>
                  <div class="vannot-hero__caption">MINECRAFT JAVA EDITION</div>
                </div>
              </div>
              <div class="vannot-hero__eyebrow"><v-icon size="15">nightlight</v-icon> YOUR WORLD, READY TO PLAY</div>
              <h1>{{ instance.name || ('Minecraft ' + instance.runtime.minecraft) }}</h1>
              <div class="vannot-hero__status">
                <span class="vannot-hero__status-dot" />
                <span>{{ instance.runtime.minecraft || 'Minecraft Java' }}</span>
                <span class="vannot-hero__separator">/</span>
                <span>{{ t('instance.name', 1) }}</span>
              </div>
              <div class="vannot-hero__actions">
                <v-btn data-testid="vannot-play" color="primary" size="large" variant="flat" class="vannot-hero__play" @click="onLaunchClick()">
                  <v-icon start>play_arrow</v-icon>
                  {{ launchText }}
                </v-btn>
                <v-btn
                  data-testid="vannot-discover-mods"
                  color="white"
                  size="large"
                  variant="outlined"
                  class="vannot-hero__discover"
                  :to="{ path: '/mods', query: { source: 'remote' } }"
                >
                  <v-icon start>extension</v-icon>
                  {{ t('store.discover') }}
                </v-btn>
              </div>
            </div>
          </section>
          <section class="vannot-quick-access mx-3 mb-8 grid gap-4" data-testid="vannot-quick-access">
            <div class="vannot-quick-access__group">
              <h2 class="vannot-quick-access__heading">
                <span class="vannot-quick-access__index">01</span>
                <v-icon class="vannot-section-icon" size="18">explore</v-icon>
                {{ t('store.discover') }}
              </h2>
              <div class="vannot-quick-access__grid">
                <v-btn
                  v-for="action in downloadActions"
                  :key="action.id"
                  :data-testid="\`vannot-download-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="tonal"
                  color="primary"
                  append-icon="arrow_forward"
                  class="vannot-action-button min-h-12 justify-start text-left"
                >
                  <v-icon start class="vannot-action-button__icon">{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
              </div>
            </div>
            <div class="vannot-quick-access__group">
              <h2 class="vannot-quick-access__heading">
                <span class="vannot-quick-access__index">02</span>
                <v-icon class="vannot-section-icon" size="18">tune</v-icon>
                {{ t('shared.manage') }}
              </h2>
              <div class="vannot-quick-access__grid">
                <v-btn
                  v-for="action in manageActions"
                  :key="action.id"
                  :data-testid="\`vannot-manage-\${action.id}\`"
                  :to="action.to"
                  block
                  variant="outlined"
                  class="vannot-action-button min-h-12 justify-start text-left"
                >
                  <v-icon start class="vannot-action-button__icon">{{ action.icon }}</v-icon>
                  {{ action.label }}
                </v-btn>
                <v-btn
                  data-testid="vannot-import-modpack"
                  block
                  variant="outlined"
                  class="vannot-action-button min-h-12 justify-start text-left"
                  :loading="importingModpack"
                  @click="importModpack"
                >
                  <v-icon start class="vannot-action-button__icon">drive_folder_upload</v-icon>
                  {{ t('instance.installModpack') }}
                </v-btn>              </div>
            </div>
          </section>
          <HomeGrid />`,
);
await rebrandTextFiles(path.join(renderer, 'src'));
await rebrandTextFiles(path.join(renderer, 'locales'));
await replaceOnce(
  sidebarView,
  "import PlayerAvatar from '@/components/PlayerAvatar.vue'",
  "import vannotLogo from '@/assets/vannot-logo.png'\nimport PlayerAvatar from '@/components/PlayerAvatar.vue'",
);
await replaceOnce(
  sidebarView,
  `    <div v-roving-tabindex role="group" class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"`,
  `    <div class="vannot-sidebar-brand" aria-label="Vannot Launcher">
      <img :src="vannotLogo" alt="" />
      <span>VANNOT</span>
    </div>
    <div v-roving-tabindex role="group" class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"`,
);
await replaceOnce(
  sidebarView,
  `    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <v-btn
        v-shared-tooltip.bottom="t('shared.back')"`,
  `    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <div class="vannot-sidebar-brand vannot-sidebar-brand--horizontal" aria-label="Vannot Launcher">
        <img :src="vannotLogo" alt="" />
        <span>VANNOT</span>
      </div>
      <v-btn
        v-shared-tooltip.bottom="t('shared.back')"`,
);
await replaceOnce(
  sidebarView,
  '</style>',
  `.vannot-sidebar-brand {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 3px auto 10px;
  color: rgba(var(--v-theme-on-surface), 0.82);
  font-size: 9px;
  font-weight: 800;
}

.vannot-sidebar-brand img {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 9px;
}

.vannot-sidebar-brand--horizontal {
  flex-direction: row;
  gap: 7px;
  margin: 0 8px 0 2px;
  font-size: 10px;
}

.vannot-sidebar-brand--horizontal img {
  width: 28px;
  height: 28px;
}
</style>`,
);
await replaceOnce(
  sidebarView,
  `      class="sidebar__instances"
    >
      <AppSideBarInstances />`,
  `      class="sidebar__instances"
    >
      <div v-roving-tabindex role="group" class="sidebar__section sidebar__quick-links">
        <AppSideBarItem
          v-for="action in marketShortcuts"
          :key="action.id"
          :data-testid="\`nav-content-\${action.id}\`"
          v-shared-tooltip.right="() => action.label"
          :to="action.to"
          :aria-label="action.label"
        >
          <v-icon class="sidebar-item__icon" :size="24">{{ action.icon }}</v-icon>
        </AppSideBarItem>
      </div>
      <div class="sidebar__divider" />
      <AppSideBarInstances />`,
);
await replaceOnce(
  sidebarView,
  `      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative"`,
  `      <v-menu location="bottom start">
        <template #activator="{ props: marketMenuProps }">
          <v-btn
            v-bind="marketMenuProps"
            data-testid="nav-content-menu"
            v-shared-tooltip.bottom="t('store.discover')"
            icon
            :aria-label="t('store.discover')"
            class="non-moveable mr-1"
          >
            <v-icon>apps</v-icon>
          </v-btn>
        </template>
        <v-list density="compact" min-width="230">
          <v-list-item
            v-for="action in marketShortcuts"
            :key="action.id"
            :data-testid="\`nav-content-\${action.id}\`"
            :to="action.to"
            :title="action.label"
          >
            <template #prepend><v-icon>{{ action.icon }}</v-icon></template>
          </v-list-item>
        </v-list>
      </v-menu>
      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative"`,
);
await replaceOnce(
  homeView,
  `const { show } = useDialog('HomeDropModpackDialog')`,
  `const { show } = useDialog('HomeDropModpackDialog')

const downloadActions = computed(() => [
  { id: 'mods', label: t('modrinth.projectType.mod'), icon: 'extension', to: { path: '/mods', query: { source: 'remote' } } },
  { id: 'modpacks', label: t('modrinth.projectType.modpack'), icon: 'inventory_2', to: '/store' },
  { id: 'resourcepacks', label: t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'remote' } } },
  { id: 'shaders', label: t('modrinth.projectType.shader'), icon: 'flare', to: { path: '/shaderpacks', query: { source: 'remote' } } },
  { id: 'datapacks', label: t('modrinth.projectType.datapack'), icon: 'data_object', to: { path: '/save', query: { source: 'remote', modrinthCategories: 'datapack' } } },
])

const manageActions = computed(() => [
  { id: 'mods', label: t('shared.manage') + ' ' + t('modrinth.projectType.mod'), icon: 'folder_open', to: { path: '/mods', query: { source: 'local' } } },
  { id: 'resourcepacks', label: t('shared.manage') + ' ' + t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'local' } } },
  { id: 'shaders', label: t('shared.manage') + ' ' + t('modrinth.projectType.shader'), icon: 'tune', to: { path: '/shaderpacks', query: { source: 'local' } } },
  { id: 'worlds', label: t('shared.manage') + ' ' + t('save.name', 2), icon: 'public', to: { path: '/save', query: { source: 'local' } } },
])

const importingModpack = ref(false)
async function importModpack() {
  if (importingModpack.value) return
  importingModpack.value = true
  try {
    const result = await windowController.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Modpack', extensions: ['mrpack', 'zip'] }],
    })
    const file = result.canceled ? undefined : result.filePaths[0]
    if (file) show(file)
  } catch (error) {
    console.error('Failed to select a modpack file', error)
  } finally {
    importingModpack.value = false
  }
}`,
);
await replaceOnce(
  sidebarView,
  `const settingsAriaLabel = computed(() => t('setting.name', 2))`,
  `const settingsAriaLabel = computed(() => t('setting.name', 2))
const marketShortcuts = computed(() => [
  { id: 'mods', label: t('modrinth.projectType.mod'), icon: 'extension', to: { path: '/mods', query: { source: 'remote' } } },
  { id: 'modpacks', label: t('modrinth.projectType.modpack'), icon: 'inventory_2', to: '/store' },
  { id: 'resourcepacks', label: t('modrinth.projectType.resourcepack'), icon: 'palette', to: { path: '/resourcepacks', query: { source: 'remote' } } },
  { id: 'shaders', label: t('modrinth.projectType.shader'), icon: 'flare', to: { path: '/shaderpacks', query: { source: 'remote' } } },
  { id: 'datapacks', label: t('modrinth.projectType.datapack'), icon: 'data_object', to: { path: '/save', query: { source: 'remote', modrinthCategories: 'datapack' } } },
])`,
);
await replaceOnce(
  homeView,
  '</script>',
  `</script>
<style>
.vannot-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  min-height: 310px;
  align-items: center;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px;
  background: #151d1b;
}

.vannot-hero__art {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 44%;
  filter: saturate(0.9) contrast(1.04);
}

.vannot-hero::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: '';
  background: linear-gradient(90deg, rgba(13, 19, 18, 0.97) 0%, rgba(13, 19, 18, 0.82) 48%, rgba(13, 19, 18, 0.12) 100%);
}

.vannot-hero__content {
  display: flex;
  width: min(720px, 78%);
  flex-direction: column;
  align-items: flex-start;
  padding: 32px 40px;
  color: #f3f4ec;
}

.vannot-hero__brandline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vannot-hero__logo {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  object-fit: cover;
}

.vannot-hero__wordmark {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.vannot-hero__caption {
  color: rgba(243, 244, 236, 0.66);
  font-size: 10px;
  line-height: 1.5;
}

.vannot-hero__eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 24px;
  color: #E4B85D;
  font-size: 11px;
  font-weight: 700;
}

.vannot-hero h1 {
  margin: 10px 0 8px;
  color: #f3f4ec;
  font-size: 36px;
  font-weight: 750;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.vannot-hero__status {
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(243, 244, 236, 0.72);
  font-size: 12px;
}

.vannot-hero__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b9f27a;
  box-shadow: 0 0 10px rgba(197, 238, 88, 0.6);
}

.vannot-hero__separator {
  opacity: 0.5;
}

.vannot-hero__play {
  min-width: 174px;
  min-height: 50px;
  border-radius: 6px;
  font-weight: 750;
}

.vannot-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.vannot-hero__discover {
  min-height: 50px;
  border-color: rgba(243, 244, 236, 0.32);
  border-radius: 6px;
  color: #f3f4ec;
}

.vannot-hero__discover:hover {
  background: rgba(243, 244, 236, 0.08);
}

.vannot-quick-access {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.vannot-quick-access__group {
  min-width: 0;
  padding: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.56);
}

.vannot-quick-access__heading {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 13px;
  font-size: 13px;
  font-weight: 700;
}

.vannot-quick-access__index {
  color: rgb(var(--v-theme-primary));
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.vannot-section-icon {
  display: grid;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--v-theme-accent), 0.16);
  color: rgb(var(--v-theme-accent));
}

.vannot-quick-access__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.vannot-action-button {
  justify-content: flex-start;
  min-width: 0;
  min-height: 58px;
  padding-inline: 12px;
  text-align: left;
  transition: background-color 140ms ease, transform 140ms ease;
}

.vannot-action-button:hover {
  transform: translateY(-1px);
}

.vannot-action-button .vannot-action-button__icon {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.16);
  color: rgb(var(--v-theme-primary));
}

.sidebar .sidebar-item__icon {
  display: grid;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  transition: background-color 140ms ease, color 140ms ease;
}

.sidebar .sidebar-item,
.sidebar .sidebar-item__content {
  width: 56px;
  height: 56px;
}

.sidebar .sidebar__instances {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface), 0.32) transparent;
  overscroll-behavior-y: contain;
}

.sidebar .sidebar__instances::-webkit-scrollbar {
  width: 6px;
  height: 6px;
  display: block;
}

.sidebar .sidebar__instances::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background-color: rgba(var(--v-theme-on-surface), 0.32);
}

.sidebar a[aria-current='page'] .sidebar-item__icon,
.sidebar :is(a, button):hover .sidebar-item__icon {
  background: rgba(var(--v-theme-accent), 0.2);
  color: rgb(var(--v-theme-accent));
}

@media (max-width: 1000px) {
  .vannot-quick-access {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 700px) {
  .vannot-hero {
    min-height: 270px;
  }

  .vannot-hero__content {
    width: 100%;
    padding: 22px;
  }

  .vannot-hero h1 {
    font-size: 28px;
  }

  .vannot-hero__discover,
  .vannot-hero__play {
    min-width: 0;
    padding-inline: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vannot-action-button {
    transition: none;
  }

  .vannot-action-button:hover {
    transform: none;
  }
}
</style>`,
);
await replaceOnce(
  launchStatusDialog,
  "import VTypical from '@/components/VTyping.vue'\n",
  '',
);
await replaceOnce(
  launchStatusDialog,
  `            <VTypical
              class="blink"
              :steps="launchingSteps"
            />
            <div
              v-if="hint"
              class="transition-all"
              :class="{ 'text-gray-500': launchingStatus !== '', 'text-transparent': !launchingStatus }"
            >
              {{ hint + '...' }}
            </div>`,
  `            <div class="vannot-launch-status" role="status" aria-live="polite">
              {{ hint || t('launchStatus.launching') }}
            </div>`,
);
await replaceOnce(
  launchStatusDialog,
  `const launchingSteps = computed(() => [
  t('launchStatus.launching'),
  4000,
  t('launchStatus.launchingSlow'),
])

`,
  '',
);
await replaceOnce(
  launchStatusDialog,
  `<style scoped="true">
.blink::after {
  content: '|';
  animation: blink 1s infinite step-start;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>`,
  `<style scoped="true">
.vannot-launch-status {
  min-height: 1.5em;
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  font-weight: 650;
  text-align: center;
}
</style>`,
);
await replaceOnce(
  loginForm,
  `watch(authority, () => {
  emit('seed')
})`,
  `watch(authority, () => {
  emit('seed')
})

const ELY_BY_AUTHORITY = 'https://authserver.ely.by/api/authlib-injector'
const LITTLE_SKIN_AUTHORITY = 'https://littleskin.cn/api/yggdrasil'
const isAddingYggdrasil = ref(false)
const quickAuthError = ref('')

function chooseQuickAuthority(value: string) {
  authority.value = value
  data.username = ''
  data.password = ''
  data.uuid = ''
  quickAuthError.value = ''
  error.value = undefined
  nextTick(() => accountInput.value?.focus())
}

async function chooseYggdrasilProvider(host, authorityUrl) {
  quickAuthError.value = ''
  const existingElyBy = items.value.find((item) => {
    try {
      return new URL(item.value).hostname === host
    } catch {
      return false
    }
  })
  if (existingElyBy) {
    chooseQuickAuthority(existingElyBy.value)
    return
  }

  isAddingYggdrasil.value = true
  try {
    await addYggdrasilService(authorityUrl)
    const added = items.value.find((item) => {
      try {
        return new URL(item.value).hostname === host
      } catch {
        return false
      }
    })
    chooseQuickAuthority(added?.value || authorityUrl)
  } catch {
    quickAuthError.value = t('loginError.badNetworkOrServer')
  } finally {
    isAddingYggdrasil.value = false
  }
}

function chooseElyBy() {
  return chooseYggdrasilProvider('authserver.ely.by', ELY_BY_AUTHORITY)
}

function chooseLittleSkin() {
  return chooseYggdrasilProvider('littleskin.cn', LITTLE_SKIN_AUTHORITY)
}`,
);

const rendererAssets = path.join(renderer, 'src/assets');
const electronIcons = path.join(electronApp, 'icons');
await mkdir(rendererAssets, { recursive: true });
await mkdir(electronIcons, { recursive: true });
await generateVannotAssets(electronIcons);
await copyFile(path.join(electronIcons, 'vannot-logo.png'), path.join(rendererAssets, 'vannot-logo.png'));
await copyFile(path.join(renderer, 'src/assets/banners/1.20.webp'), path.join(rendererAssets, 'vannot-hero.webp'));

const electronController = path.join(electronApp, 'main/ElectronController.ts');
const electronControllerSource = await readFile(electronController, 'utf8');
const brandedController = electronControllerSource
  .replaceAll('XMCL Launcher', 'Vannot Launcher')
  .replace(
    `    browser.loadURL(url.toString())

    this.logger.log(\`Load main window url \${url.toString()}\`)`,
    `    browser.loadURL(url.toString())

    // Some Windows GPU drivers never emit ready-to-show. A bounded fallback
    // prevents Vannot from remaining on a permanent loading screen.
    setTimeout(() => {
      if (!browser.isDestroyed() && !browser.isVisible()) {
        browser.show()
        browser.focus()
      }
    }, 12_000)

    this.logger.log(\`Load main window url \${url.toString()}\`)`,
  );
if (brandedController === electronControllerSource) {
  throw new Error('Failed to apply the Vannot launcher window stability patch.');
}
await writeFile(electronController, brandedController);

await writeFile(
  path.join(electronApp, 'main/pluginAutoUpdate.ts'),
  "export const pluginAutoUpdate = async () => {};\n",
);

const upstreamLicense = await readFile(path.join(xmclRoot, 'LICENSE'), 'utf8');
const notices = await readFile(path.join(projectRoot, 'windows/THIRD_PARTY_NOTICES.md'), 'utf8');
const appBuild = path.join(electronApp, 'build');
await mkdir(appBuild, { recursive: true });
await writeFile(path.join(appBuild, 'Vannot-Third-Party-Notices.txt'), `${notices}\n\n${upstreamLicense}`);
const releasePlatform = releaseTag.startsWith('linux-v') ? 'Linux' : 'Windows';
console.log(`Prepared Vannot Launcher ${releasePlatform} ${appVersion}.`);