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
        return ipcRenderer.invoke('read-file', filePath).then(result => {
            // If it's a binary file, convert Array back to Uint8Array
            if (result.isBinary && Array.isArray(result.content)) {
                result.content = new Uint8Array(result.content);
            }
            return result;
        });
    },
    // App close handler for cleanup
    onAppClose: (callback) => {
        ipcRenderer.on('app-close', (event) => {
            console.log('[Preload] app-close message received');
            callback();
        });
    },
});
