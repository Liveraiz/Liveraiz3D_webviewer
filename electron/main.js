const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Set userData path to avoid cache permission issues on Windows
app.setPath('userData', path.join(app.getPath('userData'), 'cache'));

// Get file path from command line arguments
// Format: "LiverAiz3D Viewer.exe C:\path\to\file.zip"
const getCliFilePath = () => {
    const args = process.argv.slice(1);
    
    // In production, args[0] might be the file path
    // In dev, skip first arg (which is the app path)
    for (const arg of args) {
        // Check if it looks like a file path (ends with .zip or contains path separators)
        if ((arg.endsWith('.zip') || arg.includes('\\') || arg.includes('/')) 
            && !arg.startsWith('--')) {
            if (fs.existsSync(arg)) {
                return arg;
            }
        }
    }
    return null;
};

let mainWindow;
const cliFilePath = getCliFilePath();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
    }

    // Send CLI file path to renderer process when ready
    if (cliFilePath) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('load-file', cliFilePath);
        });
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Handle file path from hospital integration
ipcMain.handle('get-cli-file', () => {
    return cliFilePath;
});
