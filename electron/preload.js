const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    platform: process.platform,
    isElectron: true,
    versions: {
        chrome: process.versions.chrome,
        electron: process.versions.electron,
        node: process.versions.node,
    },
});
