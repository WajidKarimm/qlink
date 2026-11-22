'use strict';
const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, shell, dialog, nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');

const SHORTCUT = 'CommandOrControl+Shift+L';
const launchedHidden = process.argv.includes('--hidden'); // passed when Windows starts us at login
let win = null;
let tray = null;
let quitting = false;

/* ---------- storage: one JSON file in the user's app-data folder ---------- */
const dataFile = () => path.join(app.getPath('userData'), 'links.json');
const keyOf = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
const newId = () => 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function isHttp(u) {
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:';
  } catch (e) {
    return false;
  }
}

function readItems() {
  try {
    const a = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x === 'object' && typeof x.url === 'string')
    .slice(0, 5000)
    .map((x) => ({
      id: String(x.id || '').slice(0, 64),
      url: x.url.slice(0, 2000),
      label: String(x.label || '').slice(0, 200),
      platform: String(x.platform || '').slice(0, 80),
      pinned: !!x.pinned,
      createdAt: Number(x.createdAt) || Date.now()
    }));
}

function writeItems(items) {
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(cleanItems(items), null, 2));
  fs.renameSync(tmp, file); // write-then-rename so a crash never leaves a half-written file
}

/* ---------- window ---------- */
function createWindow() {
  // A frameless, transparent window: the page draws its own rounded card.
  // The 12px transparent margin around the card holds its shadow.
  win = new BrowserWindow({
    width: 984,
    height: 624,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Link Vault',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.center();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // When Windows auto-starts us at login, stay in the tray instead of popping up.
  win.once('ready-to-show', () => { if (!launchedHidden) win.show(); });

  // Links open in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // Closing the window keeps the app in the tray so the shortcut keeps working.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('focus-search');
}

function toggleWindow() {
  if (win && win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

/* ---------- backup, from the tray menu ---------- */
function dialogParent() {
  return win && win.isVisible() ? win : null;
}

async function exportLinks() {
  const opts = {
    title: 'Export links',
    defaultPath: 'link-vault-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const parent = dialogParent();
  const r = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
  if (r.canceled || !r.filePath) return;
  try {
    fs.writeFileSync(r.filePath, JSON.stringify(cleanItems(readItems()), null, 2));
  } catch (e) {
    dialog.showErrorBox('Export failed', 'Could not write that file.');
  }
}

async function importLinks() {
  const opts = {
    title: 'Import links',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  };
  const parent = dialogParent();
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  if (r.canceled || !r.filePaths.length) return;

  let incoming;
  try {
    incoming = cleanItems(JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')));
  } catch (e) {
    dialog.showErrorBox('Import failed', 'That file is not a Link Vault backup.');
    return;
  }

  const items = readItems();
  const seen = new Set(items.map((i) => keyOf(i.url)));
  const ids = new Set(items.map((i) => i.id));
  let added = 0;
  for (const x of incoming) {
    if (!isHttp(x.url)) continue;
    const k = keyOf(x.url);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!x.id || ids.has(x.id)) x.id = newId();
    ids.add(x.id);
    items.push(x);
    added++;
  }
  if (added) writeItems(items);
  showWindow();
  if (win) win.webContents.send('vault:reload', added);
}

/* ---------- auto-launch at Windows login (enabled once, on first run after install) ---------- */
function ensureAutoLaunchDefault() {
  if (!app.isPackaged) return; // don't mess with login items while running from source
  const marker = path.join(app.getPath('userData'), '.autostart-initialized');
  if (fs.existsSync(marker)) return; // user may have changed this since; leave their choice alone
  app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  try { fs.writeFileSync(marker, ''); } catch (e) {}
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Link Vault');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Link Vault', click: showWindow },
      { type: 'separator' },
      { label: 'Export links…', click: exportLinks },
      { label: 'Import links…', click: importLinks },
      { type: 'separator' },
      {
        label: 'Start at login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: item.checked ? ['--hidden'] : [] })
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } }
    ])
  );
  tray.on('click', toggleWindow);
}

/* ---------- IPC: the only things the page can ask the main process to do ---------- */
ipcMain.handle('vault:load', () => readItems());

ipcMain.handle('vault:save', (_e, items) => {
  writeItems(items);
  return true;
});

ipcMain.handle('vault:copy', (_e, text) => {
  clipboard.writeText(String(text || '').slice(0, 20000));
  return true;
});

ipcMain.handle('vault:hide', () => {
  if (win) win.hide();
});

/* ---------- app lifecycle ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    createWindow();
    createTray();
    globalShortcut.register(SHORTCUT, toggleWindow);
    ensureAutoLaunchDefault();
    app.on('activate', showWindow);
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  // Stay alive in the tray when every window is closed.
  app.on('window-all-closed', () => {});
}
