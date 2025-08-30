// main.js - Electron main process for Music Cognition Testing Platform
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Data storage paths
const dataDir = path.join(__dirname, 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');
const participantsFile = path.join(dataDir, 'participants.json');

let mainWindow;
let currentSession = null;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false // Allow loading local audio files
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        show: false,
        titleBarStyle: 'default'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Show welcome screen
        mainWindow.webContents.send('show-welcome');
    });

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Create application menu
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Session',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('new-session');
                    }
                },
                {
                    label: 'Load Session',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        loadSession();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Export Data',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        exportSessionData();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Session',
            submenu: [
                {
                    label: 'Participant Info',
                    click: () => {
                        mainWindow.webContents.send('show-participant-form');
                    }
                },
                {
                    label: 'System Calibration',
                    click: () => {
                        mainWindow.webContents.send('start-calibration');
                    }
                },
                {
                    label: 'Start Test Battery',
                    accelerator: 'F1',
                    click: () => {
                        mainWindow.webContents.send('start-test-battery');
                    }
                }
            ]
        },
        {
            label: 'Data',
            submenu: [
                {
                    label: 'View Session Summary',
                    click: () => {
                        mainWindow.webContents.send('show-session-summary');
                    }
                },
                {
                    label: 'Export Raw Data',
                    click: () => {
                        exportRawData();
                    }
                },
                {
                    label: 'Data Analysis',
                    click: () => {
                        mainWindow.webContents.send('show-analysis');
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        showAbout();
                    }
                },
                {
                    label: 'User Manual',
                    click: () => {
                        mainWindow.webContents.send('show-manual');
                    }
                }
            ]
        }
    ];

    // macOS menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Session Management
ipcMain.handle('create-session', async (event, participantData) => {
    try {
        currentSession = {
            id: uuidv4(),
            participantId: participantData.id || uuidv4(),
            participant: participantData,
            startTime: new Date().toISOString(),
            status: 'active',
            tests: [],
            calibration: null,
            environment: {
                platform: process.platform,
                electronVersion: process.versions.electron,
                nodeVersion: process.versions.node,
                audioDevices: await getAudioDevices()
            }
        };
        
        await saveSession(currentSession);
        return { success: true, session: currentSession };
    } catch (error) {
        console.error('Error creating session:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-current-session', async () => {
    return currentSession;
});

ipcMain.handle('update-session', async (event, sessionData) => {
    try {
        if (currentSession) {
            Object.assign(currentSession, sessionData);
            await saveSession(currentSession);
            return { success: true };
        }
        return { success: false, error: 'No active session' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Test Data Management
ipcMain.handle('save-test-data', async (event, testData) => {
    try {
        if (!currentSession) {
            throw new Error('No active session');
        }
        
        const testResult = {
            id: uuidv4(),
            testName: testData.testName,
            startTime: testData.startTime,
            endTime: testData.endTime,
            duration: testData.duration,
            musicCondition: testData.musicCondition,
            buttonConfig: testData.buttonConfig,
            rawData: testData.rawData,
            metrics: testData.metrics,
            calibration: testData.calibration,
            timestamp: new Date().toISOString()
        };
        
        currentSession.tests.push(testResult);
        await saveSession(currentSession);
        
        // Also save individual test file
        await saveTestFile(testResult);
        
        return { success: true, testId: testResult.id };
    } catch (error) {
        console.error('Error saving test data:', error);
        return { success: false, error: error.message };
    }
});

// Audio Device Management
async function getAudioDevices() {
    // This would be expanded to get actual audio device info
    return {
        inputDevices: [],
        outputDevices: [],
        sampleRate: 48000,
        bufferSize: 512
    };
}

// Microbit Hardware Management
ipcMain.handle('setup-microbit', async () => {
    try {
        // Initialize Microbit connection
        const { SerialPort } = require('serialport');
        
        const ports = await SerialPort.list();
        const microbitPort = ports.find(port => 
            port.vendorId === '0D28' && port.productId === '0204'
        );
        
        if (microbitPort) {
            return { 
                success: true, 
                message: 'Microbit connected',
                port: microbitPort.path 
            };
        } else {
            return { 
                success: false, 
                message: 'Microbit not found. Please check connection.' 
            };
        }
    } catch (error) {
        return { 
            success: false, 
            message: `Microbit connection error: ${error.message}` 
        };
    }
});

// Data Export Functions
async function exportSessionData() {
    try {
        if (!currentSession) {
            dialog.showErrorBox('No Session', 'No active session to export.');
            return;
        }
        
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Session Data',
            defaultPath: `session_${currentSession.id}_${new Date().toISOString().split('T')[0]}.json`,
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(currentSession, null, 2));
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Complete',
                message: 'Session data exported successfully!'
            });
        }
    } catch (error) {
        dialog.showErrorBox('Export Error', error.message);
    }
}

async function exportRawData() {
    try {
        if (!currentSession || currentSession.tests.length === 0) {
            dialog.showErrorBox('No Data', 'No test data to export.');
            return;
        }
        
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Raw Data',
            defaultPath: `raw_data_${currentSession.id}_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (filePath) {
            await exportToCsv(currentSession, filePath);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Complete',
                message: 'Raw data exported successfully!'
            });
        }
    } catch (error) {
        dialog.showErrorBox('Export Error', error.message);
    }
}

async function exportToCsv(session, filePath) {
    const csvData = [];
    
    session.tests.forEach(test => {
        if (test.rawData && test.rawData.length > 0) {
            test.rawData.forEach(dataPoint => {
                csvData.push({
                    sessionId: session.id,
                    participantId: session.participantId,
                    testName: test.testName,
                    testId: test.id,
                    musicCondition: test.musicCondition,
                    buttonConfig: test.buttonConfig,
                    eventType: dataPoint.type,
                    timestamp: dataPoint.timestamp,
                    button: dataPoint.button || '',
                    reactionTime: dataPoint.reactionTime || '',
                    accuracy: dataPoint.accuracy || '',
                    correct: dataPoint.correct || '',
                    musicTime: dataPoint.musicTime || '',
                    testPhase: dataPoint.testPhase || '',
                    value: dataPoint.value || '',
                    additional: JSON.stringify(dataPoint.additional || {})
                });
            });
        }
    });
    
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'sessionId', title: 'Session_ID' },
            { id: 'participantId', title: 'Participant_ID' },
            { id: 'testName', title: 'Test_Name' },
            { id: 'testId', title: 'Test_ID' },
            { id: 'musicCondition', title: 'Music_Condition' },
            { id: 'buttonConfig', title: 'Button_Config' },
            { id: 'eventType', title: 'Event_Type' },
            { id: 'timestamp', title: 'Timestamp' },
            { id: 'button', title: 'Button' },
            { id: 'reactionTime', title: 'Reaction_Time_ms' },
            { id: 'accuracy', title: 'Accuracy' },
            { id: 'correct', title: 'Correct' },
            { id: 'musicTime', title: 'Music_Time_ms' },
            { id: 'testPhase', title: 'Test_Phase' },
            { id: 'value', title: 'Value' },
            { id: 'additional', title: 'Additional_Data' }
        ]
    });
    
    await csvWriter.writeRecords(csvData);
}

// File Management
async function saveSession(session) {
    const sessionFile = path.join(dataDir, `session_${session.id}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    
    // Update sessions index
    let sessions = [];
    if (fs.existsSync(sessionsFile)) {
        sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
    }
    
    const existingIndex = sessions.findIndex(s => s.id === session.id);
    const sessionSummary = {
        id: session.id,
        participantId: session.participantId,
        startTime: session.startTime,
        status: session.status,
        testCount: session.tests.length,
        lastModified: new Date().toISOString()
    };
    
    if (existingIndex >= 0) {
        sessions[existingIndex] = sessionSummary;
    } else {
        sessions.push(sessionSummary);
    }
    
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
}

async function saveTestFile(testResult) {
    const testFile = path.join(dataDir, 'tests', `test_${testResult.id}.json`);
    const testDir = path.dirname(testFile);
    
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, JSON.stringify(testResult, null, 2));
}

async function loadSession() {
    try {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Session',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (filePaths && filePaths.length > 0) {
            const sessionData = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            currentSession = sessionData;
            
            mainWindow.webContents.send('session-loaded', currentSession);
            
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Session Loaded',
                message: `Session loaded: ${currentSession.id}`
            });
        }
    } catch (error) {
        dialog.showErrorBox('Load Error', error.message);
    }
}

function showAbout() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Music Cognition Testing Platform',
        message: 'Music Cognition Testing Platform',
        detail: `Version 1.0.0\n\nA scientific platform for testing concentration and reaction times under different musical conditions.\n\nDeveloped for psychological and cognitive research applications.`
    });
}

// App Events
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    // Save any pending data
    if (currentSession) {
        saveSession(currentSession);
    }
});

// Prevent navigation away from the app
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, url) => {
        if (url !== contents.getURL()) {
            event.preventDefault();
        }
    });
});
