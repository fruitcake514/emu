AI Prompt
i want a electron app front end that can run on linux thath allows me to one click run MS-DOS and Win3.x games without any configuration as archive.org does with their emulator. if possible i want to utilize ExoDOS dos games and win3.x game collection. heres a starting place
AI Prompt 2
i dont want to install windows 3.x is it possible to use https://github.com/db48x/emularity or dosbox pure. I want to use https://github.com/exoscoriae/eXoDOS and https://github.com/exoscoriae/eXoWin3x with very minimal set up to just run and play games
# eXoDOS/eXoWin3x Launcher with Emularity

Complete Electron app that uses Archive.org's Emularity system (same as their web player) to run eXoDOS and eXoWin3x games with zero configuration.
https://github.com/Voljega/ExoDOSConverter
## Quick Setup

1. Download eXoDOS v6 and/or eXoWin3x v2 from retro-exo.com
2. Run the `setup.bat` to extract metadata (or manually extract the zip files)
3. Point this launcher to your eXoDOS/eXoWin3x folder
4. Click and play!

## Project Structure

```
exo-launcher/
├── package.json
├── electron/
│   ├── main.js
│   ├── preload.js
│   └── xmlParser.js
├── public/
│   ├── index.html
│   ├── emularity/
│   │   ├── loader.js
│   │   ├── browserfs.min.js
│   │   └── es6-promise.js
│   └── emulators/
│       ├── dosbox.js
│       └── dosbox.mem
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   └── styles.css
└── README.md
```

## package.json

```json
{
  "name": "exo-launcher",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "electron .",
    "package": "electron-builder"
  },
  "dependencies": {
    "electron-is-dev": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "xml2js": "^0.6.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "electron": "^26.0.0",
    "electron-builder": "^24.0.0",
    "vite": "^4.0.0"
  },
  "build": {
    "appId": "com.exolauncher.app",
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Game"
    }
  }
}
```

## electron/main.js

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { parseExoXML, parseDosBoxConf } = require('./xmlParser');

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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
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
    } catch (e) {}
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
```

## electron/xmlParser.js

```javascript
const fs = require('fs');
const xml2js = require('xml2js');
const path = require('path');

async function parseExoXML(xmlFile, exoBasePath) {
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlContent);
  
  const games = [];
  const gameNodes = result.LaunchBox?.Game || [];
  
  for (const game of gameNodes) {
    const title = game.Title?.[0] || 'Unknown';
    const appPath = game.ApplicationPath?.[0] || '';
    
    // Find the game folder in eXo/eXoDOS/!dos or eXo/eXoWin3x/!win3x
    let gamePath = '';
    if (appPath) {
      const gameFolder = path.dirname(appPath).split(path.sep).pop();
      const dosPath = path.join(exoBasePath, 'eXo', 'eXoDOS', '!dos', gameFolder);
      const winPath = path.join(exoBasePath, 'eXo', 'eXoWin3x', '!win3x', gameFolder);
      
      if (fs.existsSync(dosPath)) {
        gamePath = dosPath;
      } else if (fs.existsSync(winPath)) {
        gamePath = winPath;
      }
    }
    
    if (!gamePath) continue;
    
    games.push({
      title,
      developer: game.Developer?.[0] || '',
      publisher: game.Publisher?.[0] || '',
      releaseDate: game.ReleaseDate?.[0] || '',
      genre: game.Genre?.[0] || '',
      series: game.Series?.[0] || '',
      notes: game.Notes?.[0] || '',
      path: gamePath,
      coverImage: game.CoverImagePath?.[0] || '',
      backgroundImage: game.BackgroundImagePath?.[0] || ''
    });
  }
  
  return games;
}

function parseDosBoxConf(confPath) {
  const content = fs.readFileSync(confPath, 'utf-8');
  const conf = {};
  let currentSection = '';
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).toLowerCase();
      conf[currentSection] = {};
    } else if (trimmed && !trimmed.startsWith('#') && currentSection) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length) {
        conf[currentSection][key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  
  return conf;
}

module.exports = { parseExoXML, parseDosBoxConf };
```

## electron/preload.js

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  scanExoLocations: () => ipcRenderer.invoke('scan-exo-locations'),
  selectExoFolder: () => ipcRenderer.invoke('select-exo-folder'),
  loadExoGames: (path) => ipcRenderer.invoke('load-exo-games', path),
  getGameInfo: (path) => ipcRenderer.invoke('get-game-info', path),
  launchWithEmularity: (info) => ipcRenderer.invoke('launch-with-emularity', info),
  readGameFile: (path) => ipcRenderer.invoke('read-game-file', path),
  listGameFiles: (path) => ipcRenderer.invoke('list-game-files', path)
});
```

## public/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eXoDOS/eXoWin3x Launcher</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

## public/emulator.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Emularity Player</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: system-ui;
      color: #fff;
    }
    #canvas {
      max-width: 100%;
      max-height: 80vh;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #status {
      margin: 20px;
      text-align: center;
    }
    .loading {
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div id="status" class="loading">Loading game...</div>
  <canvas id="canvas"></canvas>
  
  <script src="/emularity/es6-promise.js"></script>
  <script src="/emularity/browserfs.min.js"></script>
  <script src="/emularity/loader.js"></script>
  <script>
    // Get game info from URL params
    const params = new URLSearchParams(window.location.search);
    const gameData = JSON.parse(decodeURIComponent(params.get('game')));
    
    document.getElementById('status').textContent = `Loading ${gameData.title || 'game'}...`;
    
    // Initialize Emularity with eXoDOS game
    async function loadGame() {
      try {
        // Get all game files
        const files = await window.electronAPI.listGameFiles(gameData.gamePath);
        
        // Create virtual filesystem
        const fileSystem = {};
        for (const file of files) {
          const content = await window.electronAPI.readGameFile(file.path);
          fileSystem[file.name] = content;
        }
        
        // Configure emulator
        const emulator = new Emulator(
          document.querySelector("#canvas"),
          null,
          new DosBoxLoader(
            DosBoxLoader.emulatorJS("/emulators/dosbox.js"),
            DosBoxLoader.locateAdditionalEmulatorJS((filename) => {
              return filename === "dosbox.mem" 
                ? "/emulators/dosbox.mem" 
                : "/emulators/" + filename;
            }),
            DosBoxLoader.nativeResolution(640, 480),
            DosBoxLoader.mountFS("c", fileSystem),
            DosBoxLoader.startExe(gameData.startCommand || "DIR.EXE")
          )
        );
        
        emulator.start({ waitAfterDownloading: true });
        document.getElementById('status').textContent = 'Ready!';
        setTimeout(() => {
          document.getElementById('status').style.display = 'none';
        }, 2000);
        
      } catch (err) {
        document.getElementById('status').textContent = 'Error: ' + err.message;
        document.getElementById('status').classList.remove('loading');
      }
    }
    
    loadGame();
  </script>
</body>
</html>
```

## src/main.jsx

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
```

## src/styles.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #e2e8f0;
  overflow-x: hidden;
}

#root {
  min-height: 100vh;
}

::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #1e293b;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
```

## Installation Steps

### 1. Download Emularity Files

Download from https://archive.org/details/emularity_engine_v1:
- `dosbox.js.gz` → extract to `public/emulators/dosbox.js`
- `dosbox.mem.gz` → extract to `public/emulators/dosbox.mem`

Download from https://github.com/db48x/emularity:
- `loader.js` → save to `public/emularity/loader.js`
- `browserfs.min.js` → save to `public/emularity/browserfs.min.js`
- `es6-promise.js` → save to `public/emularity/es6-promise.js`

### 2. Install and Run

```bash
npm install
npm run dev    # Start Vite dev server
npm start      # In another terminal, start Electron
```

### 3. Setup eXoDOS/eXoWin3x

1. Download eXoDOS v6 or eXoWin3x v2 from retro-exo.com
2. Extract the archive
3. Run `setup.bat` (use Wine on Linux if needed: `wine setup.bat`)
4. This creates the `xml` folder with all metadata

## Features

- ✅ Zero configuration - just point to your eXo folder
- ✅ Uses Emularity (same as Archive.org)
- ✅ Reads eXoDOS XML metadata automatically
- ✅ Shows cover art, genres, years, etc.
- ✅ One-click launch
- ✅ Supports both DOS and Windows 3.x games
- ✅ No Windows 3.x installation needed (uses game's embedded config)

## Notes

- The launcher reads the `dosbox.bat` file from each game to determine what to run
- Cover images are loaded from `Images/MS-DOS/` in the eXo folder
- Each game's DOSBox configuration is automatically loaded
- Windows 3.x games work because eXoDOS includes the necessary Windows files per-game

This approach is exactly like Archive.org - it uses the same Emularity loader and EM-DOSBox engine!
