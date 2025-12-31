// main.js - Electron main process for Music Cognition Testing Platform with Microbit Hardware Control and SQLite Database
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Import Database
const Database = require('./database');

// Data storage paths
const dataDir = path.join(__dirname, 'data');
const sessionsFile = path.join(dataDir, 'sessions.json');
const participantsFile = path.join(dataDir, 'participants.json');

let mainWindow;
let currentSession = null;
let db = null;

// Microbit Hardware Controller
let microbitController = null;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// ========================================
// MICROBIT HARDWARE CONTROLLER CLASS
// ========================================

class MicrobitHardwareController {
    constructor() {
        this.microbits = [];
        this.connected = false;
        this.baudRate = 115200;
        
        // Button color mapping
        this.buttonColors = ['green', 'white', 'red', 'green'];
        this.buttonPositions = ['left', 'middle-left', 'middle-right', 'right'];
    }

    async initialize() {
        try {
            console.log('🔌 Initializing Microbit hardware...');
            
            // Find and connect to all Microbits
            await this.connectAllMicrobits();
            
            if (this.microbits.length > 0) {
                this.connected = true;
                console.log(`✅ Connected to ${this.microbits.length} Microbit(s)`);
                
                // Send initial configuration
                for (const mb of this.microbits) {
                    await this.sendToMicrobit(mb, 'INIT');
                }
                
                return { success: true, count: this.microbits.length };
            } else {
                console.log('⚠️ No Microbits found');
                return { success: false, message: 'No Microbits found' };
            }
            
        } catch (error) {
            console.error('❌ Microbit initialization error:', error);
            return { success: false, error: error.message };
        }
    }

    async connectAllMicrobits() {
        // Use the static list method from SerialPort class (v12.x API)
        const { SerialPort } = require('serialport');
        const ports = await SerialPort.list();
        
        // Find all Microbit ports
        const microbitPorts = ports.filter(port => 
            (port.vendorId === '0D28' && port.productId === '0204') || 
            port.manufacturer?.toLowerCase().includes('mbed') ||
            port.product?.toLowerCase().includes('microbit')
        );

        console.log(`Found ${microbitPorts.length} Microbit port(s)`);

        // Connect to each Microbit
        for (let i = 0; i < microbitPorts.length; i++) {
            const portInfo = microbitPorts[i];
            try {
                await this.connectMicrobit(portInfo, i);
            } catch (error) {
                console.error(`Failed to connect to Microbit on ${portInfo.path}:`, error);
            }
        }
    }

    async connectMicrobit(portInfo, index) {
        return new Promise((resolve, reject) => {
            // Import SerialPort for each connection
            const { SerialPort } = require('serialport');
            const { ReadlineParser } = require('@serialport/parser-readline');
            
            const port = new SerialPort({
                path: portInfo.path,
                baudRate: this.baudRate,
                autoOpen: false
            });

            const parser = port.pipe(new ReadlineParser({ 
                delimiter: '\n',
                encoding: 'utf8'
            }));

            port.open((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                const microbit = {
                    id: index,
                    port: port,
                    parser: parser,
                    path: portInfo.path,
                    buttonStates: [false, false, false, false]
                };

                // Setup message handler
                parser.on('data', (data) => {
                    this.handleMicrobitMessage(microbit, data.trim());
                });

                port.on('error', (error) => {
                    console.error(`Microbit ${index} error:`, error);
                });

                port.on('close', () => {
                    console.log(`Microbit ${index} disconnected`);
                    this.microbits = this.microbits.filter(mb => mb.id !== index);
                    if (this.microbits.length === 0) {
                        this.connected = false;
                    }
                });

                this.microbits.push(microbit);
                console.log(`✅ Connected Microbit ${index} on ${portInfo.path}`);
                resolve(microbit);
            });
        });
    }

    handleMicrobitMessage(microbit, message) {
        if (!message || message.length === 0) return;

        console.log(`📨 Microbit ${microbit.id}: ${message}`);

        const parts = message.split(':');
        const command = parts[0];

        switch (command) {
            case 'BTN_PRESS':
                this.handleButtonPress(microbit, parts);
                break;
            
            case 'BTN_RELEASE':
                this.handleButtonRelease(microbit, parts);
                break;
            
            case 'STATUS':
                console.log(`Microbit ${microbit.id} status:`, parts.slice(1).join(':'));
                break;
            
            case 'ERROR':
                console.error(`Microbit ${microbit.id} error:`, parts.slice(1).join(':'));
                break;
            
            case 'READY':
                console.log(`✅ Microbit ${microbit.id} ready`);
                break;
            
            default:
                console.log(`Unknown message from Microbit ${microbit.id}:`, message);
        }
    }

    handleButtonPress(microbit, parts) {
        // Format: BTN_PRESS:buttonIndex:timestamp
        const buttonIndex = parseInt(parts[1]);
        const timestamp = parseInt(parts[2]) || Date.now();

        if (buttonIndex >= 0 && buttonIndex <= 3) {
            microbit.buttonStates[buttonIndex] = true;

            // Emit to renderer
            if (mainWindow) {
                mainWindow.webContents.send('microbit-button-press', {
                    microbitId: microbit.id,
                    button: buttonIndex + 1, // 1-indexed for UI
                    color: this.buttonColors[buttonIndex],
                    position: this.buttonPositions[buttonIndex],
                    timestamp: timestamp
                });
            }

            console.log(`🎮 Button ${buttonIndex + 1} (${this.buttonColors[buttonIndex]}) PRESSED`);
        }
    }

    handleButtonRelease(microbit, parts) {
        // Format: BTN_RELEASE:buttonIndex:timestamp:duration
        const buttonIndex = parseInt(parts[1]);
        const timestamp = parseInt(parts[2]) || Date.now();
        const duration = parseInt(parts[3]) || 0;

        if (buttonIndex >= 0 && buttonIndex <= 3) {
            microbit.buttonStates[buttonIndex] = false;

            // Emit to renderer
            if (mainWindow) {
                mainWindow.webContents.send('microbit-button-release', {
                    microbitId: microbit.id,
                    button: buttonIndex + 1, // 1-indexed for UI
                    color: this.buttonColors[buttonIndex],
                    position: this.buttonPositions[buttonIndex],
                    timestamp: timestamp,
                    duration: duration
                });
            }

            console.log(`🎮 Button ${buttonIndex + 1} (${this.buttonColors[buttonIndex]}) RELEASED (${duration}ms)`);
        }
    }

    async sendToMicrobit(microbit, message) {
        return new Promise((resolve, reject) => {
            if (!microbit.port.isOpen) {
                reject(new Error('Port not open'));
                return;
            }

            const messageWithNewline = message + '\n';
            microbit.port.write(messageWithNewline, (error) => {
                if (error) {
                    console.error('Send error:', error);
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    async sendToAll(message) {
        const promises = this.microbits.map(mb => this.sendToMicrobit(mb, message));
        await Promise.all(promises);
    }

    // LED Control Methods
    async setLED(buttonNumber, state) {
        try {
            const buttonIndex = buttonNumber - 1; // Convert to 0-indexed
            const command = state ? `LED_ON:${buttonIndex}` : `LED_OFF:${buttonIndex}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('LED control error:', error);
            return false;
        }
    }

    async setAllLEDs(state) {
        try {
            const command = state ? 'ALL_LED_ON' : 'ALL_LED_OFF';
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('All LED control error:', error);
            return false;
        }
    }

    async flashLED(buttonNumber, times, duration) {
        try {
            const buttonIndex = buttonNumber - 1;
            const command = `FLASH:${buttonIndex}:${times}:${duration}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Flash LED error:', error);
            return false;
        }
    }

    async flashAllLEDs(times, duration) {
        try {
            const command = `FLASH_ALL:${times}:${duration}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Flash all LEDs error:', error);
            return false;
        }
    }

    async chaseLEDs(rounds, speed) {
        try {
            const command = `CHASE:${rounds}:${speed}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Chase LEDs error:', error);
            return false;
        }
    }

    async randomLEDSequence(count, onDuration, offDuration, sequences) {
        try {
            const command = `RANDOM_SEQ:${count}:${onDuration}:${offDuration}:${sequences}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Random sequence error:', error);
            return false;
        }
    }

    async randomFlashSequence(sequences, flashDuration) {
        try {
            const command = `RANDOM_FLASH:${sequences}:${flashDuration}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Random flash error:', error);
            return false;
        }
    }

    async randomLEDGame(rounds, speed) {
        try {
            const command = `RANDOM_GAME:${rounds}:${speed}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Random game error:', error);
            return false;
        }
    }

    async simonSaysPattern(patternLength, playbackSpeed) {
        try {
            const command = `SIMON:${patternLength}:${playbackSpeed}`;
            await this.sendToAll(command);
            
            // The Microbit will send back the pattern
            return { success: true, pattern: [] }; // Pattern will be sent via message handler
        } catch (error) {
            console.error('Simon says error:', error);
            return { success: false };
        }
    }

    async randomCascade(waves, waveSpeed) {
        try {
            const command = `CASCADE:${waves}:${waveSpeed}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Cascade error:', error);
            return false;
        }
    }

    async rhythmicRandomPattern(beats, tempo) {
        try {
            const command = `RHYTHM:${beats}:${tempo}`;
            await this.sendToAll(command);
            return true;
        } catch (error) {
            console.error('Rhythm error:', error);
            return false;
        }
    }

    // Game Event Patterns
    async gameStartPattern() {
        try {
            await this.sendToAll('GAME_START');
            return true;
        } catch (error) {
            console.error('Game start pattern error:', error);
            return false;
        }
    }

    async gameOverPattern() {
        try {
            await this.sendToAll('GAME_OVER');
            return true;
        } catch (error) {
            console.error('Game over pattern error:', error);
            return false;
        }
    }

    async gameWinPattern() {
        try {
            await this.sendToAll('GAME_WIN');
            return true;
        } catch (error) {
            console.error('Game win pattern error:', error);
            return false;
        }
    }

    getStatus() {
        return {
            connected: this.connected,
            connectionCount: this.microbits.length,
            microbits: this.microbits.map(mb => ({
                id: mb.id,
                path: mb.path,
                buttonStates: mb.buttonStates
            }))
        };
    }

    async disconnect() {
        console.log('Disconnecting all Microbits...');
        
        for (const mb of this.microbits) {
            try {
                await this.sendToMicrobit(mb, 'DISCONNECT');
                await new Promise(resolve => setTimeout(resolve, 100));
                mb.port.close();
            } catch (error) {
                console.error(`Error disconnecting Microbit ${mb.id}:`, error);
            }
        }
        
        this.microbits = [];
        this.connected = false;
    }
}

// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initializeDatabase() {
    try {
        db = new Database();
        await db.initialize();
        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        dialog.showErrorBox('Database Error', 
            `Failed to initialize database: ${error.message}\n\nThe application may not function correctly.`);
        return false;
    }
}

// ========================================
// ELECTRON APP LIFECYCLE
// ========================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        show: false,
        titleBarStyle: 'default'
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.send('show-welcome');
    });

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    createMenu();
    
    // Initialize Microbit controller
    initializeMicrobitController();
}

async function initializeMicrobitController() {
    microbitController = new MicrobitHardwareController();
    const result = await microbitController.initialize();
    
    if (result.success) {
        console.log('✅ Microbit controller initialized');
        if (mainWindow) {
            mainWindow.webContents.send('microbit-status', {
                status: 'connected',
                count: result.count
            });
        }
        
        // Log to database if session active
        if (currentSession && db) {
            await db.logSystemEvent(currentSession.id, 'MICROBIT_CONNECTED', {
                count: result.count,
                timestamp: Date.now()
            });
        }
    } else {
        console.log('⚠️ Microbit controller initialization failed');
        if (mainWindow) {
            mainWindow.webContents.send('microbit-status', {
                status: 'disconnected',
                message: result.message || result.error
            });
        }
    }
}

function createMenu() {
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
                { type: 'separator' },
                {
                    label: 'Export Current Session',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => exportCurrentSession()
                },
                {
                    label: 'Export All Data',
                    click: () => exportAllData()
                },
                {
                    label: 'Export Raw Data (CSV)',
                    click: () => exportRawData()
                },
                { type: 'separator' },
                {
                    label: 'View Database Stats',
                    click: () => showDatabaseStats()
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
                    label: 'Reconnect Microbit',
                    click: async () => {
                        if (microbitController) {
                            await microbitController.disconnect();
                        }
                        await initializeMicrobitController();
                    }
                },
                {
                    label: 'Test All LEDs',
                    click: async () => {
                        if (microbitController && microbitController.connected) {
                            await microbitController.flashAllLEDs(3, 300);
                        }
                    }
                },
                {
                    label: 'Microbit Status',
                    click: () => {
                        if (microbitController) {
                            const status = microbitController.getStatus();
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Microbit Status',
                                message: `Connected: ${status.connected}\nDevices: ${status.connectionCount}`
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
                    label: 'View Participants',
                    click: () => showParticipantList()
                },
                {
                    label: 'View Recent Sessions',
                    click: () => showRecentSessions()
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/yourusername/music-cognition-platform');
                    }
                },
                {
                    label: 'About',
                    click: () => showAbout()
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
    // Initialize database first
    const dbReady = await initializeDatabase();
    
    if (dbReady) {
        createWindow();
    } else {
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (microbitController) {
        microbitController.disconnect();
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
    // Save any pending data
    if (currentSession && db) {
        try {
            const endTime = new Date().toISOString();
            await db.updateSession(currentSession.id, {
                endTime: endTime,
                totalDuration: Date.now() - new Date(currentSession.startTime).getTime(),
                testsCompleted: currentSession.tests.length,
                notes: 'Session closed with application'
            });
        } catch (error) {
            console.error('Error saving session on quit:', error);
        }
    }
    
    // Close database connection
    if (db) {
        await db.close();
    }
    
    // Disconnect Microbit
    if (microbitController) {
        await microbitController.disconnect();
    }
});

// ========================================
// IPC HANDLERS - MICROBIT HARDWARE
// ========================================

ipcMain.handle('setup-microbit', async () => {
    if (microbitController) {
        return microbitController.getStatus();
    }
    return { connected: false, message: 'Controller not initialized' };
});

ipcMain.handle('get-microbit-status', async () => {
    if (microbitController) {
        return microbitController.getStatus();
    }
    return { connected: false, connectionCount: 0 };
});

ipcMain.handle('set-led', async (event, buttonNumber, state) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.setLED(buttonNumber, state);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('set-all-leds', async (event, state) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.setAllLEDs(state);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('flash-led', async (event, buttonNumber, times, duration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.flashLED(buttonNumber, times, duration);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('flash-all-leds', async (event, times, duration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.flashAllLEDs(times, duration);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('chase-leds', async (event, rounds, speed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.chaseLEDs(rounds, speed);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('random-led-sequence', async (event, count, onDuration, offDuration, sequences) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomLEDSequence(count, onDuration, offDuration, sequences);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('random-flash-sequence', async (event, sequences, flashDuration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomFlashSequence(sequences, flashDuration);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('random-led-game', async (event, rounds, speed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomLEDGame(rounds, speed);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('simon-says-pattern', async (event, patternLength, playbackSpeed) => {
    if (microbitController && microbitController.connected) {
        const result = await microbitController.simonSaysPattern(patternLength, playbackSpeed);
        return result;
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('random-cascade', async (event, waves, waveSpeed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomCascade(waves, waveSpeed);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('rhythmic-random-pattern', async (event, beats, tempo) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.rhythmicRandomPattern(beats, tempo);
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('game-start-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameStartPattern();
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('game-over-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameOverPattern();
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

ipcMain.handle('game-win-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameWinPattern();
        return { success };
    }
    return { success: false, error: 'Microbit not connected' };
});

// ========================================
// IPC HANDLERS - SESSION MANAGEMENT (WITH DATABASE)
// ========================================

ipcMain.handle('create-session', async (event, participantData) => {
    try {
        console.log('Creating new session for participant:', participantData);
        
        // Create or get participant in database
        let participantDbId;
        const existingParticipant = await db.getParticipant(participantData.id);
        
        if (existingParticipant) {
            participantDbId = existingParticipant.id;
            // Update participant data
            await db.updateParticipant(participantData.id, participantData);
        } else {
            // Create new participant
            participantDbId = await db.createParticipant(participantData);
        }
        
        // Create session
        const sessionId = uuidv4();
        const startTime = new Date().toISOString();
        
        const hardwareConfig = {
            microbitConnected: microbitController ? microbitController.connected : false,
            microbitCount: microbitController ? microbitController.microbits.length : 0,
            platform: process.platform,
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node
        };
        
        await db.createSession(sessionId, participantData.id, startTime, hardwareConfig);
        
        currentSession = {
            id: sessionId,
            participantId: participantData.id,
            participant: participantData,
            startTime: startTime,
            status: 'active',
            tests: [],
            calibration: null,
            environment: hardwareConfig
        };
        
        // Also save to JSON for backwards compatibility (optional)
        await saveSession(currentSession);
        
        // Log system event
        await db.logSystemEvent(sessionId, 'SESSION_CREATED', {
            participantId: participantData.id,
            hardwareConfig: hardwareConfig
        });
        
        return {
            success: true,
            session: currentSession
        };
        
    } catch (error) {
        console.error('Session creation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

ipcMain.handle('get-current-session', async () => {
    return currentSession;
});

ipcMain.handle('update-session', async (event, sessionData) => {
    try {
        if (!currentSession) {
            return { success: false, error: 'No active session' };
        }
        
        Object.assign(currentSession, sessionData);
        
        // Update in database
        if (db) {
            await db.updateSession(currentSession.id, {
                endTime: sessionData.endTime || null,
                totalDuration: sessionData.totalDuration || null,
                testsCompleted: currentSession.tests.length,
                notes: sessionData.notes || null
            });
        }
        
        // Also update JSON for backwards compatibility
        await saveSession(currentSession);
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('save-test-data', async (event, testData) => {
    try {
        if (!currentSession) {
            throw new Error('No active session');
        }
        
        const testId = uuidv4();
        const endTime = new Date().toISOString();
        const duration = testData.duration || (new Date(endTime) - new Date(testData.startTime));
        
        const testResult = {
            id: testId,
            testName: testData.testName,
            startTime: testData.startTime,
            endTime: endTime,
            duration: duration,
            musicCondition: testData.musicCondition,
            buttonConfig: testData.buttonConfig,
            rawData: testData.rawData || [],
            metrics: testData.metrics || {},
            calibration: testData.calibration,
            timestamp: new Date().toISOString()
        };
        
        currentSession.tests.push(testResult);
        
        // Calculate metrics
        const metrics = testData.metrics || {};
        
        // Save test to database
        if (db) {
            await db.createTest({
                testId: testId,
                sessionId: currentSession.id,
                testName: testData.testName,
                musicCondition: testData.musicCondition,
                buttonConfig: testData.buttonConfig,
                startTime: testData.startTime,
                endTime: endTime,
                duration: duration,
                totalTrials: metrics.totalTrials || 0,
                correctTrials: metrics.correctTrials || 0,
                incorrectTrials: metrics.incorrectTrials || 0,
                missedTrials: metrics.missedTrials || 0,
                accuracy: metrics.accuracy || 0,
                avgReactionTime: metrics.avgReactionTime || 0,
                medianReactionTime: metrics.medianReactionTime || 0,
                stdReactionTime: metrics.stdReactionTime || 0,
                minReactionTime: metrics.minReactionTime || 0,
                maxReactionTime: metrics.maxReactionTime || 0,
                detailedMetrics: metrics.detailed || null
            });
            
            // Save raw events if provided
            if (testData.rawData && testData.rawData.length > 0) {
                await db.logEventsBulk(testId, testData.rawData);
            }
            
            await db.logSystemEvent(currentSession.id, 'TEST_COMPLETED', {
                testId: testId,
                testName: testData.testName,
                duration: duration,
                accuracy: metrics.accuracy
            });
        }
        
        // Also save to JSON for backwards compatibility
        await saveSession(currentSession);
        await saveTestFile(testResult);
        
        return { success: true, testId: testId };
    } catch (error) {
        console.error('Error saving test data:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('end-session', async (event) => {
    try {
        if (!currentSession) {
            throw new Error('No active session');
        }
        
        const endTime = new Date().toISOString();
        const duration = new Date(endTime) - new Date(currentSession.startTime);
        
        if (db) {
            await db.updateSession(currentSession.id, {
                endTime: endTime,
                totalDuration: duration,
                testsCompleted: currentSession.tests.length,
                notes: null
            });
            
            await db.logSystemEvent(currentSession.id, 'SESSION_ENDED', {
                duration: duration,
                testsCompleted: currentSession.tests.length
            });
        }
        
        currentSession.endTime = endTime;
        currentSession.status = 'completed';
        await saveSession(currentSession);
        
        const sessionData = currentSession;
        currentSession = null;
        
        return {
            success: true,
            session: sessionData
        };
        
    } catch (error) {
        console.error('End session error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

ipcMain.handle('log-event', async (event, testId, eventData) => {
    try {
        if (db) {
            await db.logEvent(testId, eventData);
        }
        return { success: true };
    } catch (error) {
        console.error('Log event error:', error);
        return { success: false, error: error.message };
    }
});

// ========================================
// IPC HANDLERS - DATA RETRIEVAL
// ========================================

ipcMain.handle('get-participants', async (event) => {
    try {
        const participants = await db.getAllParticipants();
        return { success: true, participants };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-participant', async (event, participantId) => {
    try {
        const participant = await db.getParticipant(participantId);
        const sessions = await db.getSessionsForParticipant(participantId);
        const stats = await db.getParticipantStatistics(participantId);
        
        return {
            success: true,
            participant,
            sessions,
            statistics: stats
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-recent-sessions', async (event, limit) => {
    try {
        const sessions = await db.getAllSessions(limit || 50);
        return { success: true, sessions };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-session-details', async (event, sessionId) => {
    try {
        const session = await db.getSession(sessionId);
        const tests = await db.getTestsForSession(sessionId);
        
        return {
            success: true,
            session,
            tests
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-test-details', async (event, testId) => {
    try {
        const test = await db.getTest(testId);
        const events = await db.getEventsForTest(testId);
        
        return {
            success: true,
            test,
            events
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ========================================
// DATA EXPORT FUNCTIONS
// ========================================

async function exportCurrentSession() {
    try {
        if (!currentSession) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Active Session',
                message: 'There is no active session to export.'
            });
            return;
        }
        
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Session Data',
            defaultPath: `session_${currentSession.id}_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'JSON Files', extensions: ['json'] }
            ]
        });
        
        if (filePath) {
            if (filePath.endsWith('.json')) {
                // Export as JSON
                const data = await db.exportSessionData(currentSession.id);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            } else {
                // Export as CSV
                await exportSessionToCsv(currentSession.id, filePath);
            }
            
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

async function exportSessionToCsv(sessionId, filePath) {
    const data = await db.exportSessionData(sessionId);
    const csvData = [];
    
    for (const test of data.tests) {
        for (const event of test.events || []) {
            csvData.push({
                session_id: sessionId,
                participant_id: data.session.participant_id,
                test_name: test.test_name,
                test_id: test.test_id,
                music_condition: test.music_condition,
                event_type: event.event_type,
                timestamp: event.timestamp,
                button: event.button || '',
                reaction_time: event.reaction_time || '',
                correct: event.correct !== null ? event.correct : '',
                music_time: event.music_time || '',
                test_phase: event.test_phase || '',
                trial_number: event.trial_number || ''
            });
        }
    }
    
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'session_id', title: 'Session_ID' },
            { id: 'participant_id', title: 'Participant_ID' },
            { id: 'test_name', title: 'Test_Name' },
            { id: 'test_id', title: 'Test_ID' },
            { id: 'music_condition', title: 'Music_Condition' },
            { id: 'event_type', title: 'Event_Type' },
            { id: 'timestamp', title: 'Timestamp' },
            { id: 'button', title: 'Button' },
            { id: 'reaction_time', title: 'Reaction_Time_ms' },
            { id: 'correct', title: 'Correct' },
            { id: 'music_time', title: 'Music_Time_ms' },
            { id: 'test_phase', title: 'Test_Phase' },
            { id: 'trial_number', title: 'Trial_Number' }
        ]
    });
    
    await csvWriter.writeRecords(csvData);
}

async function exportAllData() {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export All Data',
            defaultPath: `all_data_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });
        
        if (filePath) {
            const sessions = await db.getAllSessions(1000);
            
            for (let i = 0; i < sessions.length; i++) {
                const sessionPath = filePath.replace('.csv', `_session_${i + 1}.csv`);
                await exportSessionToCsv(sessions[i].session_id, sessionPath);
            }
            
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Export Complete',
                message: `Exported ${sessions.length} sessions successfully!`
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
        for (const dataPoint of test.rawData) {
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

// ========================================
// UI HELPER FUNCTIONS
// ========================================

async function showDatabaseStats() {
    try {
        const size = await db.getDbSize();
        const participants = await db.getAllParticipants();
        const sessions = await db.getAllSessions(1000);
        const recentActivity = await db.getRecentActivity(30);
        
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Database Statistics',
            message: 'Database Information',
            detail: `Database Size: ${size.megabytes} MB
            
Total Participants: ${participants.length}
Total Sessions: ${sessions.length}
Active Last 30 Days: ${recentActivity.length} days with activity

Database Location: ${db.dbPath}`
        });
    } catch (error) {
        dialog.showErrorBox('Error', error.message);
    }
}

async function showParticipantList() {
    try {
        const result = await db.getAllParticipants();
        mainWindow.webContents.send('show-participant-list', result);
    } catch (error) {
        dialog.showErrorBox('Error', error.message);
    }
}

async function showRecentSessions() {
    try {
        const result = await db.getAllSessions(20);
        mainWindow.webContents.send('show-recent-sessions', result);
    } catch (error) {
        dialog.showErrorBox('Error', error.message);
    }
}

function showAbout() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Music Cognition Testing Platform',
        message: 'Music Cognition Testing Platform v1.0.0',
        detail: `A scientific platform for testing concentration and reaction times under different musical conditions.

Research Project by:
Corey Ashcroft, Millie Kehoe, and Harry Quinlan
St Mary's Secondary School, Edenderry, Co. Offaly

Developed for psychological and cognitive research applications.

Database: SQLite (Local Storage)
Hardware: Microbit Arcade Button Support`
    });
}

// ========================================
// BACKWARDS COMPATIBILITY - JSON STORAGE
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

console.log('🚀 Music Cognition Testing Platform - Main Process Started');