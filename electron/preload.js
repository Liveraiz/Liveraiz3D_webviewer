const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    platform: process.platform,
    isElectron: true,
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node,
    },
    // IPC handlers for hospital integration
    onLoadFile: (callback) => {
        ipcRenderer.on('load-file', (event, filePath) => {
            callback(filePath);
        });
    },
    getCliFile: () => {
        return ipcRenderer.invoke('get-cli-file');
    },
    readFolder: (folderPath) => {
        return ipcRenderer.invoke('read-folder', folderPath);
    },
    readFile: (filePath) => {
        return ipcRenderer.invoke('read-file', filePath);
    },
});
