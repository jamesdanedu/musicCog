// main.js - Electron main process for Music Cognition Testing Platform
// With Database Integration and NodeMCU Hardware Support

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// ========================================
// DATABASE INTEGRATION
// ========================================
const CognitionDatabase = require('./db/CognitionDatabase');
let db = null;

// Data storage paths
const dataDir = path.join(__dirname, 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');
const participantsFile = path.join(dataDir, 'participants.json');

let mainWindow;
let currentSession = null;

// Hardware Controller (NodeMCU)
let hardwareController = null;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initializeDatabase() {
    try {
        const dbPath = path.join(dataDir, 'cognition_data.db');
        db = await new CognitionDatabase(dbPath).initialize();
        console.log('✅ Database initialized at:', dbPath);
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        return false;
    }
}

// ========================================
// HARDWARE CONTROLLER CLASS (NodeMCU)
// ========================================

class HardwareController {
    constructor() {
        this.port = null;
        this.connected = false;
        this.baudRate = 115200;
        this.buttonStates = [false, false, false, false];
        this.buttonColors = ['green', 'white', 'red', 'green'];
        this.buttonPositions = ['left', 'middle-left', 'middle-right', 'right'];
    }

    async initialize() {
        try {
            console.log('🔌 Initializing hardware...');
            const { SerialPort } = require('serialport');
            const { ReadlineParser } = require('@serialport/parser-readline');
            
            // Find available ports
            const ports = await SerialPort.list();
            const nodeMCUPort = ports.find(p => 
                p.vendorId === '10C4' || // CP2102
                p.vendorId === '1A86' || // CH340
                p.manufacturer?.includes('Silicon') ||
                p.manufacturer?.includes('wch')
            );
            
            if (!nodeMCUPort) {
                console.log('⚠️ No NodeMCU found');
                return { success: false, message: 'No NodeMCU found' };
            }
            
            this.port = new SerialPort({
                path: nodeMCUPort.path,
                baudRate: this.baudRate
            });
            
            const parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
            
            parser.on('data', (data) => {
                this.handleData(data.trim());
            });
            
            this.port.on('error', (err) => {
                console.error('Serial port error:', err);
                this.connected = false;
            });
            
            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Send init command
            this.send('INIT');
            this.connected = true;
            
            console.log(`✅ Connected to NodeMCU on ${nodeMCUPort.path}`);
            return { success: true, port: nodeMCUPort.path };
            
        } catch (error) {
            console.error('❌ Hardware initialization error:', error);
            return { success: false, error: error.message };
        }
    }

    handleData(data) {
        if (data.startsWith('BTN_PRESS:')) {
            const parts = data.split(':');
            const buttonIndex = parseInt(parts[1]);
            const timestamp = parseInt(parts[2]);
            this.buttonStates[buttonIndex] = true;
            
            if (mainWindow) {
                mainWindow.webContents.send('button-press', {
                    button: buttonIndex,
                    timestamp: timestamp,
                    color: this.buttonColors[buttonIndex],
                    position: this.buttonPositions[buttonIndex]
                });
            }
        } else if (data.startsWith('BTN_RELEASE:')) {
            const parts = data.split(':');
            const buttonIndex = parseInt(parts[1]);
            const timestamp = parseInt(parts[2]);
            const duration = parseInt(parts[3]);
            this.buttonStates[buttonIndex] = false;
            
            if (mainWindow) {
                mainWindow.webContents.send('button-release', {
                    button: buttonIndex,
                    timestamp: timestamp,
                    duration: duration
                });
            }
        } else if (data === 'PONG') {
            console.log('Hardware ping OK');
        } else if (data === 'READY') {
            console.log('Hardware ready');
        }
    }

    send(command) {
        if (this.port && this.port.isOpen) {
            this.port.write(command + '\n');
        }
    }

    async setLED(buttonNumber, state) {
        const cmd = state ? `LED_ON:${buttonNumber}` : `LED_OFF:${buttonNumber}`;
        this.send(cmd);
        return true;
    }

    async setAllLEDs(state) {
        this.send(state ? 'ALL_ON' : 'ALL_OFF');
        return true;
    }

    async flashAllLEDs(times = 3, duration = 200) {
        this.send('FLASH_ALL');
        return true;
    }

    async chaseLEDs(rounds = 2, speed = 100) {
        this.send('CHASE');
        return true;
    }

    getStatus() {
        return {
            connected: this.connected,
            buttonStates: this.buttonStates
        };
    }

    async disconnect() {
        if (this.port && this.port.isOpen) {
            this.send('DISCONNECT');
            await new Promise(resolve => setTimeout(resolve, 100));
            this.port.close();
        }
        this.connected = false;
    }
}

// ========================================
// ELECTRON APP LIFECYCLE
// ========================================

async function createWindow() {
    // Initialize database first
    await initializeDatabase();
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        show: false,
        titleBarStyle: 'default'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Initialize hardware
    hardwareController = new HardwareController();
    await hardwareController.initialize();

    // Create application menu
    createApplicationMenu();
}

function createApplicationMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Session',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow.webContents.send('new-session')
                },
                {
                    label: 'Load Session',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => loadSession()
                },
                {
                    label: 'Export Session',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => exportSessionData()
                },
                { type: 'separator' },
                {
                    label: 'Export Raw Data (CSV)',
                    click: () => exportRawData()
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Session',
            submenu: [
                {
                    label: 'Participant Info',
                    click: () => mainWindow.webContents.send('show-participant-form')
                },
                {
                    label: 'System Calibration',
                    click: () => mainWindow.webContents.send('start-calibration')
                },
                {
                    label: 'Start Test Battery',
                    accelerator: 'F1',
                    click: () => mainWindow.webContents.send('start-test-battery')
                }
            ]
        },
        {
            label: 'Hardware',
            submenu: [
                {
                    label: 'Reconnect Hardware',
                    click: async () => {
                        if (hardwareController) {
                            await hardwareController.disconnect();
                        }
                        hardwareController = new HardwareController();
                        await hardwareController.initialize();
                    }
                },
                {
                    label: 'Test All LEDs',
                    click: async () => {
                        if (hardwareController && hardwareController.connected) {
                            await hardwareController.flashAllLEDs(3, 300);
                        }
                    }
                },
                {
                    label: 'Hardware Status',
                    click: () => {
                        if (hardwareController) {
                            const status = hardwareController.getStatus();
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Hardware Status',
                                message: `Connected: ${status.connected}`
                            });
                        }
                    }
                }
            ]
        },
        {
            label: 'Data',
            submenu: [
                {
                    label: 'View Session Summary',
                    click: () => mainWindow.webContents.send('show-session-summary')
                },
                {
                    label: 'Export Raw Data',
                    click: () => exportRawData()
                },
                { type: 'separator' },
                {
                    label: 'View All Participants',
                    click: async () => {
                        if (db) {
                            const participants = db.getAllParticipants();
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Participants',
                                message: `Total participants: ${participants.length}`
                            });
                        }
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
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About',
                            message: 'Music Cognition Testing Platform v1.0.0\n\nResearch Project by:\nCorey Ashcroft, Millie Kehoe, and Harry Quinlan\nSt Mary\'s Secondary School, Edenderry'
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (hardwareController) {
        hardwareController.disconnect();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', async () => {
    // Save and close database
    if (db) {
        console.log('Saving and closing database...');
        db.close();
    }
    // Disconnect hardware
    if (hardwareController) {
        await hardwareController.disconnect();
    }
});

// ========================================
// DATABASE IPC HANDLERS
// ========================================

ipcMain.handle('db:getNextParticipantCode', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getNextParticipantCode() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:createParticipant', async (event, data) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.createParticipant(data) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getParticipant', async (event, idOrCode) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getParticipant(idOrCode) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getAllParticipants', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getAllParticipants() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:createSession', async (event, participantId, deviceInfo) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.createSession(participantId, deviceInfo) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:endSession', async (event, sessionId, notes) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        db.endSession(sessionId, notes);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:createTestRun', async (event, sessionId, testType, musicCondition, config) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.createTestRun(sessionId, testType, musicCondition, config) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:endTestRun', async (event, testRunId, trialCount) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        db.endTestRun(testRunId, trialCount);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:recordTrial', async (event, testRunId, trialData) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        db.recordTrial(testRunId, trialData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:recordTrials', async (event, testRunId, trials) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        db.recordTrials(testRunId, trials);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:createTestSummary', async (event, testRunId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.createTestSummary(testRunId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getPerformanceByCondition', async (event, participantId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getPerformanceByCondition(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getPerformanceByTestType', async (event, participantId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getPerformanceByTestType(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getConditionComparison', async (event, testType, participantId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getConditionComparison(testType, participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getParticipantStats', async (event, participantId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.getParticipantStats(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:compareByMusicalBackground', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.compareByMusicalBackground() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:exportParticipantData', async (event, participantId) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.exportParticipantData(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:exportAllData', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        return { success: true, result: db.exportAllData() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ========================================
// ANALYTICS IPC HANDLERS
// ========================================

ipcMain.handle('db:getOverviewStats', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const participants = db.db.exec("SELECT COUNT(*) as count FROM participants")[0]?.values[0][0] || 0;
        const sessions = db.db.exec("SELECT COUNT(*) as count FROM sessions")[0]?.values[0][0] || 0;
        const testRuns = db.db.exec("SELECT COUNT(*) as count FROM test_runs")[0]?.values[0][0] || 0;
        const totalTrials = db.db.exec("SELECT COUNT(*) as count FROM trials")[0]?.values[0][0] || 0;
        
        return { 
            success: true, 
            result: { participants, sessions, testRuns, totalTrials }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getConditionSummary', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const result = db.db.exec(`
            SELECT 
                tr.music_condition,
                COUNT(DISTINCT tr.id) as test_count,
                AVG(ts.mean_rt) as mean_rt,
                AVG(ts.median_rt) as median_rt,
                AVG(ts.accuracy) as accuracy
            FROM test_runs tr
            LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
            GROUP BY tr.music_condition
            ORDER BY tr.music_condition
        `);
        
        if (!result[0]) return { success: true, result: [] };
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        
        return { success: true, result: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getTestTypeSummary', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const result = db.db.exec(`
            SELECT 
                tr.test_type,
                COUNT(DISTINCT tr.id) as test_count,
                AVG(ts.mean_rt) as mean_rt,
                AVG(ts.accuracy) as accuracy
            FROM test_runs tr
            LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
            GROUP BY tr.test_type
            ORDER BY tr.test_type
        `);
        
        if (!result[0]) return { success: true, result: [] };
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        
        return { success: true, result: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getMusicalBackgroundComparison', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const result = db.db.exec(`
            SELECT 
                p.musical_background,
                COUNT(DISTINCT p.id) as participant_count,
                AVG(ts.mean_rt) as mean_rt,
                AVG(ts.accuracy) as accuracy
            FROM participants p
            JOIN sessions s ON p.id = s.participant_id
            JOIN test_runs tr ON s.id = tr.session_id
            LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
            GROUP BY p.musical_background
            ORDER BY 
                CASE p.musical_background
                    WHEN 'none' THEN 1
                    WHEN 'casual' THEN 2
                    WHEN 'some-lessons' THEN 3
                    WHEN 'moderate' THEN 4
                    WHEN 'extensive' THEN 5
                    WHEN 'professional' THEN 6
                    ELSE 7
                END
        `);
        
        if (!result[0]) return { success: true, result: [] };
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        
        return { success: true, result: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getTimeSeriesData', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        // Get daily aggregated performance data
        const result = db.db.exec(`
            SELECT 
                DATE(s.start_time) as date,
                COUNT(DISTINCT p.id) as participants,
                COUNT(DISTINCT s.id) as sessions,
                COUNT(DISTINCT tr.id) as test_runs,
                AVG(ts.mean_rt) as mean_rt,
                AVG(ts.accuracy) as accuracy
            FROM sessions s
            JOIN participants p ON s.participant_id = p.id
            LEFT JOIN test_runs tr ON s.id = tr.session_id
            LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
            GROUP BY DATE(s.start_time)
            ORDER BY DATE(s.start_time)
        `);
        
        if (!result[0]) return { success: true, result: [] };
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        
        return { success: true, result: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getCumulativeParticipants', async () => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        const result = db.db.exec(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as daily_count,
                SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative_count
            FROM participants
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `);
        
        if (!result[0]) return { success: true, result: [] };
        
        const columns = result[0].columns;
        const rows = result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        
        return { success: true, result: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getCrossTabulation', async (event, dimension1, dimension2) => {
    try {
        if (!db) return { success: false, error: 'Database not initialized' };
        
        // Musical Background × Music Condition cross-tabulation
        if (dimension1 === 'musical_background' && dimension2 === 'music_condition') {
            const result = db.db.exec(`
                SELECT 
                    p.musical_background,
                    tr.music_condition,
                    COUNT(DISTINCT tr.id) as test_count,
                    AVG(ts.mean_rt) as mean_rt,
                    AVG(ts.accuracy) as accuracy
                FROM participants p
                JOIN sessions s ON p.id = s.participant_id
                JOIN test_runs tr ON s.id = tr.session_id
                LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
                GROUP BY p.musical_background, tr.music_condition
                ORDER BY 
                    CASE p.musical_background
                        WHEN 'none' THEN 1
                        WHEN 'casual' THEN 2
                        WHEN 'some-lessons' THEN 3
                        WHEN 'moderate' THEN 4
                        WHEN 'extensive' THEN 5
                        WHEN 'professional' THEN 6
                        ELSE 7
                    END,
                    tr.music_condition
            `);
            
            if (!result[0]) return { success: true, result: [] };
            
            const columns = result[0].columns;
            const rows = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => obj[col] = row[i]);
                return obj;
            });
            
            return { success: true, result: rows };
        }
        
        // Age Category × Music Condition
        if (dimension1 === 'age_category' && dimension2 === 'music_condition') {
            const result = db.db.exec(`
                SELECT 
                    p.age_category,
                    tr.music_condition,
                    COUNT(DISTINCT tr.id) as test_count,
                    AVG(ts.mean_rt) as mean_rt,
                    AVG(ts.accuracy) as accuracy
                FROM participants p
                JOIN sessions s ON p.id = s.participant_id
                JOIN test_runs tr ON s.id = tr.session_id
                LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
                GROUP BY p.age_category, tr.music_condition
                ORDER BY p.age_category, tr.music_condition
            `);
            
            if (!result[0]) return { success: true, result: [] };
            
            const columns = result[0].columns;
            const rows = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => obj[col] = row[i]);
                return obj;
            });
            
            return { success: true, result: rows };
        }
        
        // Musical Background × Test Type
        if (dimension1 === 'musical_background' && dimension2 === 'test_type') {
            const result = db.db.exec(`
                SELECT 
                    p.musical_background,
                    tr.test_type,
                    COUNT(DISTINCT tr.id) as test_count,
                    AVG(ts.mean_rt) as mean_rt,
                    AVG(ts.accuracy) as accuracy
                FROM participants p
                JOIN sessions s ON p.id = s.participant_id
                JOIN test_runs tr ON s.id = tr.session_id
                LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
                GROUP BY p.musical_background, tr.test_type
                ORDER BY 
                    CASE p.musical_background
                        WHEN 'none' THEN 1
                        WHEN 'casual' THEN 2
                        WHEN 'some-lessons' THEN 3
                        WHEN 'moderate' THEN 4
                        WHEN 'extensive' THEN 5
                        WHEN 'professional' THEN 6
                        ELSE 7
                    END,
                    tr.test_type
            `);
            
            if (!result[0]) return { success: true, result: [] };
            
            const columns = result[0].columns;
            const rows = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => obj[col] = row[i]);
                return obj;
            });
            
            return { success: true, result: rows };
        }
        
        return { success: false, error: 'Unsupported cross-tabulation dimensions' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ========================================
// HARDWARE IPC HANDLERS
// ========================================

ipcMain.handle('setup-hardware', async () => {
    if (hardwareController) {
        return hardwareController.getStatus();
    }
    return { connected: false, message: 'Controller not initialized' };
});

ipcMain.handle('get-hardware-status', async () => {
    if (hardwareController) {
        return hardwareController.getStatus();
    }
    return { connected: false };
});

ipcMain.handle('set-led', async (event, buttonNumber, state) => {
    if (hardwareController && hardwareController.connected) {
        const success = await hardwareController.setLED(buttonNumber, state);
        return { success };
    }
    return { success: false, error: 'Hardware not connected' };
});

ipcMain.handle('set-all-leds', async (event, state) => {
    if (hardwareController && hardwareController.connected) {
        const success = await hardwareController.setAllLEDs(state);
        return { success };
    }
    return { success: false, error: 'Hardware not connected' };
});

ipcMain.handle('flash-all-leds', async (event, times, duration) => {
    if (hardwareController && hardwareController.connected) {
        const success = await hardwareController.flashAllLEDs(times, duration);
        return { success };
    }
    return { success: false, error: 'Hardware not connected' };
});

ipcMain.handle('chase-leds', async (event, rounds, speed) => {
    if (hardwareController && hardwareController.connected) {
        const success = await hardwareController.chaseLEDs(rounds, speed);
        return { success };
    }
    return { success: false, error: 'Hardware not connected' };
});

// ========================================
// SESSION IPC HANDLERS
// ========================================

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
                hardwareConnected: hardwareController ? hardwareController.connected : false
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
        await saveTestFile(testResult);
        
        return { success: true, testId: testResult.id };
    } catch (error) {
        console.error('Error saving test data:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// FILE MANAGEMENT FUNCTIONS
// ========================================

async function saveSession(session) {
    const sessionFile = path.join(dataDir, `session_${session.id}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
    
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
    const testFile = path.join(dataDir, `test_${testResult.id}.json`);
    fs.writeFileSync(testFile, JSON.stringify(testResult, null, 2));
}

async function loadSession() {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Load Session',
        defaultPath: dataDir,
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const sessionData = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            currentSession = sessionData;
            mainWindow.webContents.send('session-loaded', sessionData);
            
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Session Loaded',
                message: `Session loaded successfully!\nParticipant: ${sessionData.participantId}`
            });
        } catch (error) {
            dialog.showErrorBox('Load Error', `Failed to load session: ${error.message}`);
        }
    }
}

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
            title: 'Export Raw Data as CSV',
            defaultPath: `raw_data_${currentSession.id}_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (filePath) {
            await exportToCSV(filePath);
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

async function exportToCSV(filePath) {
    const csvData = [];
    
    for (const test of currentSession.tests) {
        for (const dataPoint of test.rawData || []) {
            csvData.push({
                sessionId: currentSession.id,
                participantId: currentSession.participantId,
                testId: test.id,
                testName: test.testName,
                musicCondition: test.musicCondition,
                buttonConfig: test.buttonConfig,
                eventType: dataPoint.type || 'response',
                timestamp: dataPoint.timestamp,
                button: dataPoint.button,
                reactionTime: dataPoint.reactionTime || '',
                accuracy: dataPoint.accuracy || '',
                correct: dataPoint.correct || '',
                musicTime: dataPoint.musicTime || '',
                testPhase: dataPoint.testPhase || '',
                value: dataPoint.value || '',
                additional: JSON.stringify(dataPoint)
            });
        }
    }

    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'sessionId', title: 'Session_ID' },
            { id: 'participantId', title: 'Participant_ID' },
            { id: 'testId', title: 'Test_ID' },
            { id: 'testName', title: 'Test_Name' },
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

console.log('🚀 Music Cognition Testing Platform - Main Process Started');
