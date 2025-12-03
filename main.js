// main.js - Electron main process for Music Cognition Testing Platform with NodeMCU Hardware Control
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

// NodeMCU Hardware Controller
let microbitController = null;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// ========================================
// NODEMCU HARDWARE CONTROLLER CLASS
// Updated to work with single NodeMCU ESP8266 instead of 4 Microbits
// ========================================

class MicrobitHardwareController {
    constructor() {
        this.nodemcu = null; // Single NodeMCU device
        this.connected = false;
        this.baudRate = 115200;
        
        // Button color mapping (same as before)
        this.buttonColors = ['green', 'white', 'red', 'green'];
        this.buttonPositions = ['left', 'middle-left', 'middle-right', 'right'];
        
        // Button state tracking for all 4 buttons
        this.buttonStates = [false, false, false, false];
    }

    async initialize() {
        try {
            console.log('🔌 Initializing NodeMCU hardware...');
            
            // Find and connect to NodeMCU
            await this.connectNodeMCU();
            
            if (this.nodemcu) {
                this.connected = true;
                console.log('✅ Connected to NodeMCU');
                
                // Send initial configuration
                await this.sendToNodeMCU('INIT');
                
                return { success: true, count: 1 };
            } else {
                console.log('⚠️ NodeMCU not found');
                return { success: false, message: 'NodeMCU not found' };
            }
            
        } catch (error) {
            console.error('❌ NodeMCU initialization error:', error);
            return { success: false, error: error.message };
        }
    }

    async connectNodeMCU() {
        const { SerialPort } = require('serialport');
        const { ReadlineParser } = require('@serialport/parser-readline');
        
        try {
            // List all available ports
            const ports = await SerialPort.list();
            console.log('Available serial ports:', ports);
            
            // Find NodeMCU/ESP8266 port
            // ESP8266 typically shows up with these identifiers
            const nodemcuPort = ports.find(port => 
                // Common NodeMCU identifiers
                port.manufacturer?.toLowerCase().includes('silicon labs') ||
                port.manufacturer?.toLowerCase().includes('ch340') ||
                port.manufacturer?.toLowerCase().includes('cp210') ||
                port.productId === '7523' || // CH340 USB-Serial
                port.productId === 'ea60' || // CP2102 USB-Serial
                // Generic USB-Serial identifiers
                port.path.includes('usbserial') ||
                port.path.includes('USB')
            );
            
            if (!nodemcuPort) {
                throw new Error('NodeMCU not found. Please check USB connection and drivers.');
            }
            
            console.log(`Found NodeMCU on port: ${nodemcuPort.path}`);
            
            // Create serial connection
            const port = new SerialPort({
                path: nodemcuPort.path,
                baudRate: this.baudRate,
                autoOpen: false
            });
            
            // Setup parser for line-based communication
            const parser = port.pipe(new ReadlineParser({ 
                delimiter: '\n',
                encoding: 'utf8'
            }));
            
            // Setup message handler
            parser.on('data', (data) => {
                this.handleMessage(data.trim());
            });
            
            // Setup error handlers
            port.on('close', () => {
                console.log('NodeMCU connection closed');
                this.connected = false;
                this.nodemcu = null;
                
                if (mainWindow) {
                    mainWindow.webContents.send('microbit-status', {
                        status: 'disconnected'
                    });
                }
            });
            
            port.on('error', (error) => {
                console.error('NodeMCU port error:', error);
            });
            
            // Open the connection
            await new Promise((resolve, reject) => {
                port.open((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Store the connection
            this.nodemcu = {
                port: port,
                parser: parser,
                id: 'nodemcu-main',
                path: nodemcuPort.path,
                buttonStates: [false, false, false, false]
            };
            
            console.log('NodeMCU connected successfully');
            
            // Wait a moment for ESP to be ready
            await this.delay(1000);
            
            // Notify renderer process
            if (mainWindow) {
                mainWindow.webContents.send('microbit-status', {
                    status: 'connected',
                    device: 'NodeMCU ESP8266'
                });
            }
            
            // Run LED test sequence to verify hardware
            console.log('='.repeat(50));
            console.log('🎨 Starting LED Test Sequence...');
            console.log('='.repeat(50));
            await this.delay(500);
            await this.testSequence();
            console.log('='.repeat(50));
            console.log('✅ LED Test Complete - System Ready!');
            console.log('='.repeat(50));
            
        } catch (error) {
            console.error('NodeMCU connection error:', error);
            throw error;
        }
    }

    handleMessage(message) {
        if (!message || message.length === 0) return;
        
        console.log('NodeMCU message:', message);
        
        const parts = message.split(':');
        const command = parts[0];
        
        switch (command) {
            case 'BTN_PRESS':
                this.handleButtonPress(parts);
                break;
                
            case 'BTN_RELEASE':
                this.handleButtonRelease(parts);
                break;
                
            case 'READY':
                console.log('NodeMCU is ready');
                break;
                
            case 'INITIALIZED':
                console.log('NodeMCU initialized successfully');
                break;
                
            case 'STATUS':
                this.handleStatusUpdate(parts);
                break;
                
            case 'ERROR':
                console.error('NodeMCU error:', parts.slice(1).join(':'));
                break;
                
            case 'PONG':
                console.log('NodeMCU responded to ping');
                break;
                
            default:
                console.log('Unknown NodeMCU message:', message);
        }
    }

    handleButtonPress(parts) {
        // Format: BTN_PRESS:buttonIndex:timestamp
        const buttonIndex = parseInt(parts[1]);
        const timestamp = parseInt(parts[2]) || Date.now();

        if (buttonIndex >= 0 && buttonIndex <= 3) {
            this.nodemcu.buttonStates[buttonIndex] = true;
            this.buttonStates[buttonIndex] = true;

            // Enhanced console logging
            console.log('');
            console.log('━'.repeat(60));
            console.log(`🎮 BUTTON PRESSED!`);
            console.log(`   Button: ${buttonIndex + 1} (${this.buttonColors[buttonIndex].toUpperCase()})`);
            console.log(`   Position: ${this.buttonPositions[buttonIndex]}`);
            console.log(`   Timestamp: ${timestamp}ms`);
            console.log('━'.repeat(60));

            // Emit to renderer
            if (mainWindow) {
                mainWindow.webContents.send('microbit-button-press', {
                    microbitId: this.nodemcu.id,
                    button: buttonIndex + 1, // 1-indexed for UI
                    color: this.buttonColors[buttonIndex],
                    position: this.buttonPositions[buttonIndex],
                    timestamp: timestamp
                });
            }
        }
    }

    handleButtonRelease(parts) {
        // Format: BTN_RELEASE:buttonIndex:timestamp:duration
        const buttonIndex = parseInt(parts[1]);
        const timestamp = parseInt(parts[2]) || Date.now();
        const duration = parseInt(parts[3]) || 0;

        if (buttonIndex >= 0 && buttonIndex <= 3) {
            this.nodemcu.buttonStates[buttonIndex] = false;
            this.buttonStates[buttonIndex] = false;

            // Enhanced console logging
            console.log(`   ↳ Button ${buttonIndex + 1} RELEASED after ${duration}ms`);
            console.log('');

            // Emit to renderer
            if (mainWindow) {
                mainWindow.webContents.send('microbit-button-release', {
                    microbitId: this.nodemcu.id,
                    button: buttonIndex + 1, // 1-indexed for UI
                    color: this.buttonColors[buttonIndex],
                    position: this.buttonPositions[buttonIndex],
                    timestamp: timestamp,
                    duration: duration
                });
            }
        }
    }

    handleStatusUpdate(parts) {
        // Format: STATUS:buttonStates:ledStates:uptime
        console.log('NodeMCU Status:', parts.slice(1).join(' | '));
    }

    async sendToNodeMCU(message) {
        return new Promise((resolve, reject) => {
            if (!this.nodemcu || !this.nodemcu.port.isOpen) {
                reject(new Error('Port not open'));
                return;
            }

            const messageWithNewline = message + '\n';
            this.nodemcu.port.write(messageWithNewline, (error) => {
                if (error) {
                    console.error('Send error:', error);
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    // LED Control Methods (same interface as before)
    async setLED(buttonNumber, state) {
        try {
            const buttonIndex = buttonNumber - 1; // Convert to 0-indexed
            const command = state ? `LED_ON:${buttonIndex}` : `LED_OFF:${buttonIndex}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('LED control error:', error);
            return false;
        }
    }

    async setAllLEDs(state) {
        try {
            const command = state ? 'ALL_ON' : 'ALL_OFF';
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('LED control error:', error);
            return false;
        }
    }

    async flashLED(buttonNumber, times = 2, duration = 100) {
        try {
            const buttonIndex = buttonNumber - 1;
            await this.sendToNodeMCU(`FLASH:${buttonIndex}:${times}:${duration}`);
            return true;
        } catch (error) {
            console.error('LED flash error:', error);
            return false;
        }
    }

    async flashAllLEDs(times = 2, duration = 100) {
        try {
            await this.sendToNodeMCU(`FLASH_ALL:${times}:${duration}`);
            return true;
        } catch (error) {
            console.error('LED flash error:', error);
            return false;
        }
    }

    async chaseLEDs(rounds = 3, speed = 100) {
        try {
            await this.sendToNodeMCU(`CHASE:${rounds}:${speed}`);
            return true;
        } catch (error) {
            console.error('LED chase error:', error);
            return false;
        }
    }

    async randomLEDSequence(count, onDuration, offDuration, sequences) {
        try {
            const command = `RANDOM_SEQ:${count}:${onDuration}:${offDuration}:${sequences}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('Random sequence error:', error);
            return false;
        }
    }

    async randomFlashSequence(sequences, flashDuration) {
        try {
            const command = `RANDOM_FLASH:${sequences}:${flashDuration}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('Random flash error:', error);
            return false;
        }
    }

    async randomLEDGame(rounds, speed) {
        try {
            const command = `RANDOM_GAME:${rounds}:${speed}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('Random game error:', error);
            return false;
        }
    }

    async simonSaysPattern(patternLength, playbackSpeed) {
        try {
            const command = `SIMON:${patternLength}:${playbackSpeed}`;
            await this.sendToNodeMCU(command);
            
            // The NodeMCU will send back the pattern
            return { success: true, pattern: [] }; // Pattern will be sent via message handler
        } catch (error) {
            console.error('Simon says error:', error);
            return { success: false };
        }
    }

    async randomCascade(waves, waveSpeed) {
        try {
            const command = `CASCADE:${waves}:${waveSpeed}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('Cascade error:', error);
            return false;
        }
    }

    async rhythmicRandomPattern(beats, tempo) {
        try {
            const command = `RHYTHM:${beats}:${tempo}`;
            await this.sendToNodeMCU(command);
            return true;
        } catch (error) {
            console.error('Rhythm error:', error);
            return false;
        }
    }

    // Game Event Patterns
    async gameStartPattern() {
        try {
            await this.sendToNodeMCU('GAME_START');
            return true;
        } catch (error) {
            console.error('Game start pattern error:', error);
            return false;
        }
    }

    async gameOverPattern() {
        try {
            await this.sendToNodeMCU('GAME_OVER');
            return true;
        } catch (error) {
            console.error('Game over pattern error:', error);
            return false;
        }
    }

    async gameWinPattern() {
        try {
            await this.sendToNodeMCU('GAME_WIN');
            return true;
        } catch (error) {
            console.error('Game win pattern error:', error);
            return false;
        }
    }

    async testSequence() {
        console.log('🔄 Starting NodeMCU test sequence...');
        
        try {
            // Flash all LEDs
            console.log('   📍 Test 1/3: Flashing all LEDs (2 times)...');
            await this.flashAllLEDs(2, 150);
            await this.delay(500);
            console.log('   ✓ Flash test complete');
            
            // Chase pattern
            console.log('   📍 Test 2/3: Chase pattern (2 rounds)...');
            await this.chaseLEDs(2, 100);
            await this.delay(500);
            console.log('   ✓ Chase pattern complete');
            
            // Individual LED test
            console.log('   📍 Test 3/3: Individual LED test...');
            for (let i = 1; i <= 4; i++) {
                console.log(`      • Testing LED ${i} (${this.buttonColors[i-1]})...`);
                await this.setLED(i, true);
                await this.delay(200);
                await this.setLED(i, false);
                await this.delay(100);
            }
            console.log('   ✓ Individual LED test complete');
            
            console.log('🎉 Test sequence completed successfully!');
            return true;
        } catch (error) {
            console.error('❌ Test sequence error:', error);
            return false;
        }
    }

    getStatus() {
        return {
            connected: this.connected,
            connectionCount: this.connected ? 1 : 0,
            device: 'NodeMCU ESP8266',
            buttonStates: this.buttonStates
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async disconnect() {
        if (this.nodemcu && this.nodemcu.port) {
            try {
                await this.sendToNodeMCU('DISCONNECT');
                await this.delay(100);
                this.nodemcu.port.close();
            } catch (error) {
                console.error('Disconnect error:', error);
            }
        }
        this.connected = false;
        this.nodemcu = null;
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
    
    // Initialize NodeMCU controller
    initializeMicrobitController();
}

async function initializeMicrobitController() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Music Cognition Testing Platform - NodeMCU Edition    ║');
    console.log('║                  Hardware Initialization                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    microbitController = new MicrobitHardwareController();
    const result = await microbitController.initialize();
    
    if (result.success) {
        console.log('');
        console.log('✅ NodeMCU controller initialized successfully');
        console.log('📊 Status: Ready for testing');
        console.log('👉 Press any arcade button to test...');
        console.log('');
        
        if (mainWindow) {
            mainWindow.webContents.send('microbit-status', {
                status: 'connected',
                count: result.count
            });
        }
    } else {
        console.log('');
        console.log('⚠️ NodeMCU controller initialization failed');
        console.log('💡 Tip: Check USB connection and drivers');
        console.log('');
        
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
                    label: 'Export Data',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => exportSessionData()
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
                    label: 'Reconnect NodeMCU',
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
                    label: 'NodeMCU Status',
                    click: () => {
                        if (microbitController) {
                            const status = microbitController.getStatus();
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'NodeMCU Status',
                                message: `Connected: ${status.connected}\nDevice: ${status.device || 'NodeMCU ESP8266'}`
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
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About',
                            message: 'Music Cognition Testing Platform v1.0.0\nNodeMCU ESP8266 Edition'
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
    if (microbitController) {
        await microbitController.disconnect();
    }
});

// ========================================
// IPC HANDLERS - NODEMCU HARDWARE
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
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('set-all-leds', async (event, state) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.setAllLEDs(state);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('flash-led', async (event, buttonNumber, times, duration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.flashLED(buttonNumber, times, duration);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('flash-all-leds', async (event, times, duration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.flashAllLEDs(times, duration);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('chase-leds', async (event, rounds, speed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.chaseLEDs(rounds, speed);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('random-led-sequence', async (event, count, onDuration, offDuration, sequences) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomLEDSequence(count, onDuration, offDuration, sequences);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('random-flash-sequence', async (event, sequences, flashDuration) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomFlashSequence(sequences, flashDuration);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('random-led-game', async (event, rounds, speed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomLEDGame(rounds, speed);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('simon-says-pattern', async (event, patternLength, playbackSpeed) => {
    if (microbitController && microbitController.connected) {
        const result = await microbitController.simonSaysPattern(patternLength, playbackSpeed);
        return result;
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('random-cascade', async (event, waves, waveSpeed) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.randomCascade(waves, waveSpeed);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('rhythmic-random-pattern', async (event, beats, tempo) => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.rhythmicRandomPattern(beats, tempo);
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('game-start-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameStartPattern();
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('game-over-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameOverPattern();
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

ipcMain.handle('game-win-pattern', async () => {
    if (microbitController && microbitController.connected) {
        const success = await microbitController.gameWinPattern();
        return { success };
    }
    return { success: false, error: 'NodeMCU not connected' };
});

// ========================================
// IPC HANDLERS - SESSION MANAGEMENT
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
                hardwareConnected: microbitController ? microbitController.connected : false,
                hardwareDevice: 'NodeMCU ESP8266'
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
// DATA EXPORT FUNCTIONS
// ========================================

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
// FILE MANAGEMENT
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

console.log('🚀 Music Cognition Testing Platform - Main Process Started (NodeMCU Edition)');
