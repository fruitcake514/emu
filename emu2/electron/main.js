const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { parseExoXML, parseDosBoxConf } = require('./xmlParser');

// Force production if ELECTRON_IS_DEV=0, otherwise default to !app.isPackaged
const forceProd = process.env.ELECTRON_IS_DEV === '0';
const isDev = forceProd ? false : (require('electron-is-dev') || process.env.ELECTRON_IS_DEV === '1');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0f172a'
  });

  console.log('ELECTRON_IS_DEV:', process.env.ELECTRON_IS_DEV);
  console.log('isDev:', isDev);

  if (isDev) {
    console.log('Running in development mode');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    console.log('Running in production mode');
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Scan for eXoDOS/eXoWin3x installations
ipcMain.handle('scan-exo-locations', async () => {
  const home = require('os').homedir();
  const candidates = [
    path.join(home, 'eXoDOS'),
    path.join(home, 'eXoWin3x'),
    path.join(home, 'Downloads', 'eXoDOS'),
    path.join(home, 'Downloads', 'eXoWin3x'),
    path.join(home, 'Games', 'eXoDOS'),
    path.join(home, 'Games', 'eXoWin3x'),
    '/mnt/games/eXoDOS',
    '/mnt/games/eXoWin3x'
  ];

  const found = [];
  for (const p of candidates) {
    try {
      // Check if it's an eXo installation by looking for xml folder
      const xmlPath = path.join(p, 'xml');
      if (fs.existsSync(xmlPath) && fs.statSync(xmlPath).isDirectory()) {
        found.push({
          path: p,
          type: p.includes('Win3x') ? 'win3x' : 'dos'
        });
      }
    } catch (e) { }
  }
  return found;
});

// Select custom folder
ipcMain.handle('select-exo-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select eXoDOS or eXoWin3x folder'
  });

  if (result.canceled) return null;

  const selectedPath = result.filePaths[0];
  const xmlPath = path.join(selectedPath, 'xml');

  if (!fs.existsSync(xmlPath)) {
    dialog.showErrorBox('Invalid Folder', 'This folder does not contain eXo metadata. Please run setup.bat first.');
    return null;
  }

  return {
    path: selectedPath,
    type: selectedPath.includes('Win3x') ? 'win3x' : 'dos'
  };
});

// Load games from eXo XML
ipcMain.handle('load-exo-games', async (_, exoPath) => {
  try {
    const xmlPath = path.join(exoPath, 'xml');
    const platformFile = path.join(xmlPath, 'MS-DOS.xml');

    if (!fs.existsSync(platformFile)) {
      throw new Error('MS-DOS.xml not found. Run setup.bat to extract metadata.');
    }

    const games = await parseExoXML(platformFile, exoPath);
    return games;
  } catch (err) {
    console.error('Error loading games:', err);
    throw err;
  }
});

// Get game launch info
ipcMain.handle('get-game-info', async (_, gamePath) => {
  try {
    const confPath = path.join(gamePath, 'dosbox.conf');
    const batPath = path.join(gamePath, 'dosbox.bat');

    let startCommand = '';
    let dosboxConf = {};

    // Parse dosbox.conf if it exists
    if (fs.existsSync(confPath)) {
      dosboxConf = parseDosBoxConf(confPath);
    }

    // Parse dosbox.bat to find the start command
    if (fs.existsSync(batPath)) {
      const batContent = fs.readFileSync(batPath, 'utf-8');
      const lines = batContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('REM') && !trimmed.startsWith('@') &&
          !trimmed.toLowerCase().startsWith('mount') &&
          !trimmed.toLowerCase().startsWith('imgmount')) {
          startCommand = trimmed;
          break;
        }
      }
    }

    return {
      startCommand,
      dosboxConf,
      gamePath
    };
  } catch (err) {
    console.error('Error getting game info:', err);
    throw err;
  }
});

// Open game in Emularity window
ipcMain.handle('launch-with-emularity', async (_, gameInfo) => {
  const emuWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#000000'
  });

  // Pass game info via query params
  const gameData = encodeURIComponent(JSON.stringify(gameInfo));
  const url = isDev
    ? `http://localhost:5173/emulator.html?game=${gameData}`
    : `file://${path.join(__dirname, '..', 'dist', 'emulator.html')}?game=${gameData}`;

  await emuWindow.loadURL(url);
  return true;
});

// Serve game files for Emularity
ipcMain.handle('read-game-file', async (_, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  } catch (err) {
    throw new Error(`Failed to read file: ${filePath}`);
  }
});

// List files in game directory
ipcMain.handle('list-game-files', async (_, gamePath) => {
  try {
    const files = [];
    const scan = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const relativePath = prefix ? path.join(prefix, entry) : entry;
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath, relativePath);
        } else {
          files.push({
            name: relativePath,
            path: fullPath,
            size: stat.size
          });
        }
      }
    };
    scan(gamePath);
    return files;
  } catch (err) {
    throw new Error(`Failed to list files: ${err.message}`);
  }
});
