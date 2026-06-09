const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Set userData path to avoid cache permission issues on Windows
app.setPath('userData', path.join(app.getPath('userData'), 'cache'));

// Log file for debugging
const logFile = path.join(os.tmpdir(), 'liveraiz-viewer-debug.log');
const debugLog = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    try {
        fs.appendFileSync(logFile, logMessage);
    } catch (e) {
        console.error('Failed to write log:', e);
    }
};

debugLog('=== LiverAiz3D Viewer Started ===');
debugLog(`Full process.argv: ${JSON.stringify(process.argv)}`);

// Get file path from command line arguments
// Supports: 
// 1. "LiverAiz3D Viewer.exe C:\path\to\folder"
// 2. "LiverAiz3D Viewer.exe C:\path\to\file.zip"
// 3. "LiverAiz3D Viewer.exe --file=C:\path\to\folder"
const getCliFilePath = () => {
    debugLog('[CLI] Starting argument parsing...');
    
    // Check for --file= format
    for (const arg of process.argv) {
        if (arg.startsWith('--file=')) {
            const filePath = arg.substring(7);
            debugLog(`[CLI] Found --file= argument: ${filePath}`);
            if (fs.existsSync(filePath)) {
                debugLog(`[CLI] ✓ Path exists: ${filePath}`);
                return filePath;
            }
        }
    }
    
    // Check for positional arguments (paths with \ or /)
    // In packaged app: argv[1] is the resource path, user args start from argv[2]
    // In dev: user args start after the executable path
    const startIndex = process.argv[1]?.includes('resources') ? 2 : 1;
    
    debugLog(`[CLI] Checking arguments starting from index ${startIndex}`);
    
    for (let i = startIndex; i < process.argv.length; i++) {
        const arg = process.argv[i];
        debugLog(`[CLI] Arg[${i}]: ${arg}`);
        
        // Skip flags and check for path-like arguments
        if (!arg.startsWith('-') && (arg.includes('\\') || arg.includes('/'))) {
            debugLog(`[CLI] Potential path: ${arg}`);
            
            try {
                if (fs.existsSync(arg)) {
                    const stats = fs.statSync(arg);
                    const isDirectory = stats.isDirectory();
                    const isZip = arg.endsWith('.zip');
                    
                    debugLog(`[CLI] Path stats - Exists: true | Directory: ${isDirectory} | Zip: ${isZip}`);
                    
                    if (isDirectory || isZip) {
                        debugLog(`[CLI] ✓✓✓ VALID PATH FOUND: ${arg}`);
                        return arg;
                    }
                } else {
                    debugLog(`[CLI] Path does not exist: ${arg}`);
                }
            } catch (error) {
                debugLog(`[CLI] Error checking path ${arg}: ${error.message}`);
            }
        }
    }
    
    debugLog('[CLI] No valid CLI file path found');
    debugLog(`Log file: ${logFile}`);
    return null;
};

let mainWindow;
const cliFilePath = getCliFilePath();
debugLog(`CLI file path resolved to: ${cliFilePath}`);

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
        debugLog('[Window] Development mode - loading dev server');
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        debugLog('[Window] Production mode - loading build');
        mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
        
        // For debugging: uncomment next line to open DevTools in production
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Send CLI file path to renderer process when ready
    if (cliFilePath) {
        debugLog(`[IPC] Will send load-file message with: ${cliFilePath}`);
        mainWindow.webContents.on('did-finish-load', () => {
            debugLog('[IPC] Sending load-file to renderer');
            mainWindow.webContents.send('load-file', cliFilePath);
        });
    } else {
        debugLog('[IPC] No CLI file path, manual file selection will be used');
    }
}

app.whenReady().then(() => {
    debugLog('[App] Application ready');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            debugLog('[App] Reactivating - creating new window');
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    debugLog('[App] All windows closed');
    if (process.platform !== 'darwin') app.quit();
});

// Handle file path from hospital integration
ipcMain.handle('get-cli-file', () => {
    debugLog('[IPC] get-cli-file requested');
    return cliFilePath;
});

// Handle folder reading for hospital integration
ipcMain.handle('read-folder', async (event, folderPath) => {
    try {
        debugLog(`[IPC] read-folder requested: ${folderPath}`);
        
        if (!folderPath || !fs.existsSync(folderPath)) {
            debugLog(`[IPC] Folder not found: ${folderPath}`);
            return { error: 'Folder not found' };
        }
        
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
            debugLog(`[IPC] Path is not a directory: ${folderPath}`);
            return { error: 'Path is not a directory' };
        }
        
        // Read directory contents
        const files = fs.readdirSync(folderPath);
        debugLog(`[IPC] Found ${files.length} files in folder`);
        
        // Find 3D model files (.glb, .gltf, .obj, etc.)
        const modelFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.glb', '.gltf', '.obj', '.fbx', '.usdz', '.ply'].includes(ext);
        });
        
        debugLog(`[IPC] Found ${modelFiles.length} model files: ${modelFiles.join(', ')}`);
        
        if (modelFiles.length === 0) {
            debugLog(`[IPC] No model files found in: ${folderPath}`);
            return { error: 'No model files found', files: files };
        }
        
        // For each model file, find related files with same basename
        const modelSets = modelFiles.map(modelFile => {
            const ext = path.extname(modelFile);
            const basename = modelFile.substring(0, modelFile.length - ext.length);
            
            debugLog(`[IPC] Processing model: ${modelFile}, basename: ${basename}`);
            
            // Find related files (.csv, .png, etc.)
            const relatedFiles = {};
            relatedFiles.model = modelFile;
            relatedFiles.modelPath = path.join(folderPath, modelFile);
            
            // Look for CSV file with same basename
            const csvFile = files.find(f => {
                const fBasename = f.substring(0, f.length - path.extname(f).length);
                return fBasename === basename && path.extname(f).toLowerCase() === '.csv';
            });
            if (csvFile) {
                relatedFiles.csv = csvFile;
                relatedFiles.csvPath = path.join(folderPath, csvFile);
                debugLog(`[IPC] Found CSV: ${csvFile}`);
            }
            
            // Look for PNG file with same basename
            const pngFile = files.find(f => {
                const fBasename = f.substring(0, f.length - path.extname(f).length);
                return fBasename === basename && path.extname(f).toLowerCase() === '.png';
            });
            if (pngFile) {
                relatedFiles.png = pngFile;
                relatedFiles.pngPath = path.join(folderPath, pngFile);
                debugLog(`[IPC] Found PNG: ${pngFile}`);
            }
            
            // Look for JPG file with same basename
            const jpgFile = files.find(f => {
                const fBasename = f.substring(0, f.length - path.extname(f).length);
                return fBasename === basename && ['.jpg', '.jpeg'].includes(path.extname(f).toLowerCase());
            });
            if (jpgFile) {
                relatedFiles.jpg = jpgFile;
                relatedFiles.jpgPath = path.join(folderPath, jpgFile);
                debugLog(`[IPC] Found JPG: ${jpgFile}`);
            }
            
            return relatedFiles;
        });
        
        debugLog(`[IPC] Created ${modelSets.length} model sets`);
        
        // Return first model set (or user can select from multiple)
        const primarySet = modelSets[0];
        
        debugLog(`[IPC] Returning primary model set: ${JSON.stringify(primarySet)}`);
        
        return {
            success: true,
            primarySet: primarySet,
            allSets: modelSets,
            folderPath: folderPath,
            allFiles: files,
            modelCount: modelFiles.length
        };
    } catch (error) {
        debugLog(`[IPC] Error reading folder: ${error.message}`);
        return { error: error.message };
    }
});

// Handle file reading for hospital integration
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        debugLog(`[IPC] read-file requested: ${filePath}`);
        
        if (!filePath || !fs.existsSync(filePath)) {
            debugLog(`[IPC] File not found: ${filePath}`);
            return { error: 'File not found' };
        }
        
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            debugLog(`[IPC] Path is not a file: ${filePath}`);
            return { error: 'Path is not a file' };
        }
        
        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');
        debugLog(`[IPC] File read successfully, size: ${content.length} bytes`);
        
        return {
            success: true,
            content: content,
            filePath: filePath
        };
    } catch (error) {
        debugLog(`[IPC] Error reading file: ${error.message}`);
        return { error: error.message };
    }
});

debugLog('=== Startup Complete ===');
