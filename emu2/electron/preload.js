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
