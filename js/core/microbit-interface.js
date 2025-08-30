// js/core/microbit-interface.js - Microbit Hardware Interface for Arcade Buttons

class MicrobitInterface {
    constructor(platform) {
        this.platform = platform;
        this.connected = false;
        this.connecting = false;
        this.serialPort = null;
        this.parser = null;
        
        // Button state tracking
        this.buttonStates = [false, false, false, false];
        this.lastPressTime = [0, 0, 0, 0];
        this.lastReleaseTime = [0, 0, 0, 0];
        this.buttonPressCount = [0, 0, 0, 0];
        
        // Timing and calibration
        this.calibrationData = {
            latency: 0,
            jitter: 0,
            clockOffset: 0,
            buttonResponseTimes: [0, 0, 0, 0],
            calibrated: false
        };
        
        // Communication settings
        this.baudRate = 115200;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Message queue and rate limiting
        this.messageQueue = [];
        this.processingQueue = false;
        this.maxMessagesPerSecond = 100;
        this.messageTimestamps = [];
        
        // Performance monitoring
        this.performanceMetrics = {
            messagesReceived: 0,
            messagesDropped: 0,
            averageLatency: 0,
            connectionUptime: 0,
            lastMessageTime: 0
        };
        
        // Event handlers
        this.eventHandlers = {
            connect: [],
            disconnect: [],
            buttonPress: [],
            buttonRelease: [],
            calibrationComplete: [],
            error: []
        };
        
        console.log('MicrobitInterface initialized');
        
        // Auto-connect attempt
        this.connect();
    }

    // Connection Management
    async connect() {
        if (this.connected || this.connecting) {
            console.log('Microbit already connected or connecting');
            return { success: false, message: 'Already connected or connecting' };
        }
        
        this.connecting = true;
        
        try {
            console.log('Attempting to connect to Microbit...');
            
            // Try Node.js SerialPort first (Electron main process)
            if (typeof require !== 'undefined') {
                return await this.connectNodeSerial();
            }
            // Fallback to Web Serial API (if available)
            else if (typeof navigator !== 'undefined' && 'serial' in navigator) {
                return await this.connectWebSerial();
            }
            else {
                throw new Error('No serial communication method available');
            }
            
        } catch (error) {
            console.error('Microbit connection failed:', error);
            this.connecting = false;
            this.emitEvent('error', { type: 'connection_failed', error: error.message });
            
            // Schedule reconnection attempt
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnection();
            }
            
            return { success: false, message: error.message };
        }
    }

    async connectNodeSerial() {
        const { SerialPort } = require('serialport');
        const { ReadlineParser } = require('@serialport/parser-readline');
        
        // Find Microbit port
        const ports = await SerialPort.list();
        const microbitPort = ports.find(port => 
            (port.vendorId === '0D28' && port.productId === '0204') || // BBC Microbit
            port.manufacturer?.includes('mbed') ||
            port.product?.includes('microbit')
        );
        
        if (!microbitPort) {
            throw new Error('Microbit not found. Please check USB connection and drivers.');
        }
        
        console.log(`Found Microbit on port: ${microbitPort.path}`);
        
        // Create serial connection
        this.serialPort = new SerialPort({
            path: microbitPort.path,
            baudRate: this.baudRate,
            autoOpen: false
        });
        
        // Setup parser
        this.parser = this.serialPort.pipe(new ReadlineParser({ 
            delimiter: '\n',
            encoding: 'utf8'
        }));
        
        // Setup event handlers
        this.setupNodeSerialHandlers();
        
        // Open connection
        return new Promise((resolve, reject) => {
            this.serialPort.open((error) => {
                if (error) {
                    reject(error);
                } else {
                    this.onConnected(microbitPort.path);
                    resolve({ success: true, port: microbitPort.path });
                }
            });
        });
    }

    async connectWebSerial() {
        // Request port from user
        this.serialPort = await navigator.serial.requestPort({
            filters: [
                { usbVendorId: 0x0D28, usbProductId: 0x0204 } // BBC Microbit
            ]
        });
        
        // Open connection
        await this.serialPort.open({ 
            baudRate: this.baudRate,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: 'none'
        });
        
        // Setup readers
        this.setupWebSerialHandlers();
        
        this.onConnected('Web Serial');
        return { success: true, port: 'Web Serial' };
    }

    setupNodeSerialHandlers() {
        this.parser.on('data', (data) => {
            this.handleIncomingMessage(data.trim());
        });
        
        this.serialPort.on('close', () => {
            this.onDisconnected('Serial port closed');
        });
        
        this.serialPort.on('error', (error) => {
            console.error('Serial port error:', error);
            this.emitEvent('error', { type: 'serial_error', error: error.message });
        });
    }

    async setupWebSerialHandlers() {
        this.reader = this.serialPort.readable.getReader();
        this.writer = this.serialPort.writable.getWriter();
        
        // Start reading loop
        this.readLoop();
    }

    async readLoop() {
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
            while (this.connected && this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                let lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                lines.forEach(line => {
                    if (line.trim()) {
                        this.handleIncomingMessage(line.trim());
                    }
                });
            }
        } catch (error) {
            console.error('Read loop error:', error);
            this.onDisconnected('Read error: ' + error.message);
        }
    }

    onConnected(portInfo) {
        this.connected = true;
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.performanceMetrics.connectionUptime = performance.now();
        
        console.log(`Microbit connected on ${portInfo}`);
        
        // Send initialization message
        setTimeout(() => {
            this.sendMessage('INIT');
            this.startCalibration();
        }, 1000);
        
        this.emitEvent('connect', { port: portInfo });
    }

    onDisconnected(reason) {
        console.log(`Microbit disconnected: ${reason}`);
        
        const wasConnected = this.connected;
        this.connected = false;
        this.connecting = false;
        
        // Cleanup resources
        this.cleanup();
        
        if (wasConnected) {
            this.emitEvent('disconnect', { reason });
            
            // Schedule reconnection
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnection();
            }
        }
    }

    scheduleReconnection() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
        
        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.connected) {
                this.connect();
            }
        }, delay);
    }

    // Message Processing
    handleIncomingMessage(message) {
        try {
            this.performanceMetrics.messagesReceived++;
            this.performanceMetrics.lastMessageTime = performance.now();
            
            // Rate limiting check
            if (!this.checkMessageRateLimit()) {
                this.performanceMetrics.messagesDropped++;
                return;
            }
            
            // Add to processing queue
            this.messageQueue.push({
                message: message,
                timestamp: performance.now()
            });
            
            // Process queue if not already processing
            if (!this.processingQueue) {
                this.processMessageQueue();
            }
            
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    checkMessageRateLimit() {
        const now = performance.now();
        
        // Remove timestamps older than 1 second
        this.messageTimestamps = this.messageTimestamps.filter(ts => now - ts < 1000);
        
        // Check if we're under the rate limit
        if (this.messageTimestamps.length >= this.maxMessagesPerSecond) {
            return false;
        }
        
        this.messageTimestamps.push(now);
        return true;
    }

    async processMessageQueue() {
        this.processingQueue = true;
        
        while (this.messageQueue.length > 0) {
            const { message, timestamp } = this.messageQueue.shift();
            await this.processMessage(message, timestamp);
        }
        
        this.processingQueue = false;
    }

    async processMessage(message, timestamp) {
        const parts = message.split(':');
        const command = parts[0];
        
        // Apply latency compensation
        const compensatedTimestamp = timestamp - this.calibrationData.latency;
        
        switch (command) {
            case 'BTN_PRESS':
                this.handleButtonPress(parseInt(parts[1]), compensatedTimestamp, parseInt(parts[2]));
                break;
                
            case 'BTN_RELEASE':
                this.handleButtonRelease(parseInt(parts[1]), compensatedTimestamp, parseInt(parts[2]), parseInt(parts[3]));
                break;
                
            case 'CALIBRATE_RESPONSE':
                this.handleCalibrationResponse(parts[1], timestamp);
                break;
                
            case 'STATUS':
                this.handleStatusUpdate(parts.slice(1));
                break;
                
            case 'ERROR':
                this.handleMicrobitError(parts.slice(1).join(':'));
                break;
                
            case 'DEBUG':
                console.log('Microbit Debug:', parts.slice(1).join(':'));
                break;
                
            default:
                console.log('Unknown Microbit message:', message);
        }
    }

    handleButtonPress(buttonIndex, timestamp, microbitTime) {
        if (buttonIndex < 0 || buttonIndex > 3) {
            console.warn(`Invalid button index: ${buttonIndex}`);
            return;
        }
        
        // Update state tracking
        this.buttonStates[buttonIndex] = true;
        this.lastPressTime[buttonIndex] = timestamp;
        this.buttonPressCount[buttonIndex]++;
        
        // Create button event
        const buttonEvent = {
            type: 'press',
            button: buttonIndex,
            timestamp: timestamp,
            microbitTime: microbitTime,
            latency: this.calibrationData.latency,
            sessionTime: timestamp - this.platform.sessionStartTime
        };
        
        // Log to platform data logger
        this.platform.dataLogger.logEvent({
            type: 'button_press',
            button: buttonIndex,
            timestamp: timestamp,
            microbitTime: microbitTime,
            latencyCompensation: this.calibrationData.latency
        });
        
        // Forward to platform
        if (this.platform.handleButtonPress) {
            this.platform.handleButtonPress(buttonIndex, timestamp);
        }
        
        // Emit event
        this.emitEvent('buttonPress', buttonEvent);
        
        // Visual feedback
        this.sendMessage(`LED_ON:${buttonIndex}`);
        
        console.log(`Button ${buttonIndex} pressed at ${timestamp.toFixed(2)}ms`);
    }

    handleButtonRelease(buttonIndex, timestamp, microbitTime, pressDuration) {
        if (buttonIndex < 0 || buttonIndex > 3) {
            console.warn(`Invalid button index: ${buttonIndex}`);
            return;
        }
        
        // Update state tracking
        this.buttonStates[buttonIndex] = false;
        this.lastReleaseTime[buttonIndex] = timestamp;
        
        // Calculate hold duration
        const holdDuration = timestamp - this.lastPressTime[buttonIndex];
        
        // Create button event
        const buttonEvent = {
            type: 'release',
            button: buttonIndex,
            timestamp: timestamp,
            microbitTime: microbitTime,
            pressDuration: pressDuration,
            holdDuration: holdDuration,
            latency: this.calibrationData.latency
        };
        
        // Log to platform data logger
        this.platform.dataLogger.logEvent({
            type: 'button_release',
            button: buttonIndex,
            timestamp: timestamp,
            microbitTime: microbitTime,
            pressDuration: pressDuration,
            holdDuration: holdDuration
        });
        
        // Forward to platform
        if (this.platform.handleButtonRelease) {
            this.platform.handleButtonRelease(buttonIndex, timestamp);
        }
        
        // Emit event
        this.emitEvent('buttonRelease', buttonEvent);
        
        // Clear visual feedback
        setTimeout(() => {
            this.sendMessage(`LED_OFF:${buttonIndex}`);
        }, 100);
        
        console.log(`Button ${buttonIndex} released after ${holdDuration.toFixed(2)}ms`);
    }

    handleStatusUpdate(statusParts) {
        const status = {
            battery: statusParts[0] || 'unknown',
            temperature: parseInt(statusParts[1]) || 0,
            uptime: parseInt(statusParts[2]) || 0
        };
        
        console.log('Microbit status:', status);
    }

    handleMicrobitError(errorMessage) {
        console.error('Microbit error:', errorMessage);
        this.emitEvent('error', { type: 'microbit_error', message: errorMessage });
    }

    // Calibration System
    async startCalibration() {
        if (!this.connected) {
            console.warn('Cannot calibrate - Microbit not connected');
            return false;
        }
        
        console.log('Starting Microbit calibration...');
        
        try {
            // Latency calibration
            await this.calibrateLatency();
            
            // Clock synchronization
            await this.synchronizeClock();
            
            // Button response testing
            await this.testButtonResponse();
            
            this.calibrationData.calibrated = true;
            console.log('Microbit calibration complete:', this.calibrationData);
            
            this.emitEvent('calibrationComplete', this.calibrationData);
            return true;
            
        } catch (error) {
            console.error('Calibration failed:', error);
            this.emitEvent('error', { type: 'calibration_failed', error: error.message });
            return false;
        }
    }

    async calibrateLatency() {
        const measurements = [];
        const numTests = 20;
        
        console.log(`Running ${numTests} latency measurements...`);
        
        for (let i = 0; i < numTests; i++) {
            const startTime = performance.now();
            
            // Send ping to Microbit
            await this.sendMessage(`CALIBRATE_PING:${startTime}`);
            
            // Wait for response
            const response = await this.waitForCalibrationResponse(startTime, 500);
            
            if (response) {
                const roundTripTime = response.responseTime - startTime;
                const estimatedLatency = roundTripTime / 2;
                measurements.push(estimatedLatency);
                
                console.log(`Latency test ${i + 1}: ${estimatedLatency.toFixed(2)}ms`);
            }
            
            // Small delay between tests
            await this.delay(50);
        }
        
        if (measurements.length > 0) {
            this.calibrationData.latency = this.calculateMean(measurements);
            this.calibrationData.jitter = this.calculateStandardDeviation(measurements);
            
            console.log(`Average latency: ${this.calibrationData.latency.toFixed(2)}ms ± ${this.calibrationData.jitter.toFixed(2)}ms`);
        } else {
            console.warn('No latency measurements obtained');
            this.calibrationData.latency = 5; // Default estimate
        }
    }

    waitForCalibrationResponse(originalTime, timeoutMs) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), timeoutMs);
            
            const handler = (response) => {
                if (Math.abs(response.originalTime - originalTime) < 1) {
                    clearTimeout(timeout);
                    resolve(response);
                }
            };
            
            this.tempCalibrationHandler = handler;
        });
    }

    handleCalibrationResponse(originalTimeStr, responseTime) {
        const originalTime = parseFloat(originalTimeStr);
        
        if (this.tempCalibrationHandler) {
            this.tempCalibrationHandler({
                originalTime: originalTime,
                responseTime: responseTime
            });
            this.tempCalibrationHandler = null;
        }
    }

    async synchronizeClock() {
        console.log('Synchronizing clocks...');
        
        const localTime = performance.now();
        await this.sendMessage(`SYNC_CLOCK:${localTime}`);
        
        // Simple clock offset calculation
        // In a more sophisticated system, you'd do multiple measurements
        this.calibrationData.clockOffset = 0; // Placeholder
    }

    async testButtonResponse() {
        console.log('Testing button response times...');
        
        for (let buttonIndex = 0; buttonIndex < 4; buttonIndex++) {
            console.log(`Testing button ${buttonIndex}...`);
            
            // Light up button LED to prompt user
            await this.sendMessage(`TEST_BUTTON:${buttonIndex}`);
            
            // Wait for button press (with timeout)
            const startTime = performance.now();
            const pressed = await this.waitForButtonPress(buttonIndex, 10000);
            
            if (pressed) {
                const responseTime = pressed.timestamp - startTime;
                this.calibrationData.buttonResponseTimes[buttonIndex] = responseTime;
                console.log(`Button ${buttonIndex} response time: ${responseTime.toFixed(2)}ms`);
            } else {
                console.log(`Button ${buttonIndex} test timed out`);
                this.calibrationData.buttonResponseTimes[buttonIndex] = -1;
            }
            
            // Turn off LED
            await this.sendMessage(`LED_OFF:${buttonIndex}`);
            await this.delay(500);
        }
    }

    waitForButtonPress(buttonIndex, timeoutMs) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), timeoutMs);
            
            const handler = (event) => {
                if (event.button === buttonIndex) {
                    clearTimeout(timeout);
                    this.off('buttonPress', handler);
                    resolve(event);
                }
            };
            
            this.on('buttonPress', handler);
        });
    }

    // Communication Methods
    async sendMessage(message) {
        if (!this.connected) {
            console.warn('Cannot send message - Microbit not connected');
            return false;
        }
        
        try {
            const messageWithNewline = message + '\n';
            
            if (this.writer) {
                // Web Serial API
                const encoder = new TextEncoder();
                await this.writer.write(encoder.encode(messageWithNewline));
            } else if (this.serialPort && this.serialPort.write) {
                // Node.js SerialPort
                return new Promise((resolve, reject) => {
                    this.serialPort.write(messageWithNewline, (error) => {
                        if (error) {
                            console.error('Send message error:', error);
                            reject(error);
                        } else {
                            resolve(true);
                        }
                    });
                });
            } else {
                throw new Error('No valid communication channel');
            }
            
            return true;
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.emitEvent('error', { type: 'send_error', error: error.message });
            return false;
        }
    }

    // Visual Feedback
    async showPattern(pattern) {
        await this.sendMessage(`PATTERN:${pattern}`);
    }

    async showIcon(iconName) {
        await this.sendMessage(`ICON:${iconName}`);
    }

    async clearDisplay() {
        await this.sendMessage('CLEAR');
    }

    async setPixel(x, y, brightness) {
        await this.sendMessage(`PIXEL:${x}:${y}:${brightness}`);
    }

    // Button State Queries
    isButtonPressed(buttonIndex) {
        return this.buttonStates[buttonIndex] || false;
    }

    getButtonStates() {
        return [...this.buttonStates];
    }

    getButtonPressCount(buttonIndex) {
        return this.buttonPressCount[buttonIndex] || 0;
    }

    getLastPressTime(buttonIndex) {
        return this.lastPressTime[buttonIndex] || 0;
    }

    // Performance Metrics
    getPerformanceMetrics() {
        const uptime = this.connected ? performance.now() - this.performanceMetrics.connectionUptime : 0;
        
        return {
            ...this.performanceMetrics,
            connectionUptime: uptime,
            messageRate: this.performanceMetrics.messagesReceived / (uptime / 1000),
            dropRate: this.performanceMetrics.messagesDropped / this.performanceMetrics.messagesReceived
        };
    }

    getCalibrationData() {
        return { ...this.calibrationData };
    }

    // Event System
    on(eventName, handler) {
        if (!this.eventHandlers[eventName]) {
            this.eventHandlers[eventName] = [];
        }
        this.eventHandlers[eventName].push(handler);
    }

    off(eventName, handler) {
        if (this.eventHandlers[eventName]) {
            const index = this.eventHandlers[eventName].indexOf(handler);
            if (index !== -1) {
                this.eventHandlers[eventName].splice(index, 1);
            }
        }
    }

    emitEvent(eventName, data) {
        if (this.eventHandlers[eventName]) {
            this.eventHandlers[eventName].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventName}:`, error);
                }
            });
        }
    }

    // Utility Methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    calculateMean(values) {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = this.calculateMean(values);
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(this.calculateMean(squareDiffs));
    }

    // Cleanup and Disconnect
    cleanup() {
        // Close serial connection
        try {
            if (this.reader) {
                this.reader.cancel();
                this.reader = null;
            }
            
            if (this.writer) {
                this.writer.close();
                this.writer = null;
            }
            
            if (this.serialPort) {
                if (this.serialPort.close) {
                    this.serialPort.close();
                } else if (this.serialPort.destroy) {
                    this.serialPort.destroy();
                }
                this.serialPort = null;
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
        
        // Clear handlers
        this.tempCalibrationHandler = null;
        
        // Reset state
        this.buttonStates = [false, false, false, false];
    }

    async disconnect() {
        if (!this.connected) return;
        
        console.log('Disconnecting from Microbit...');
        
        // Send goodbye message
        try {
            await this.sendMessage('DISCONNECT');
            await this.delay(100); // Give time for message to send
        } catch (error) {
            console.error('Error sending disconnect message:', error);
        }
        
        this.cleanup();
        this.onDisconnected('Manual disconnect');
    }

    // Status and Diagnostics
    getStatus() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            calibrated: this.calibrationData.calibrated,
            reconnectAttempts: this.reconnectAttempts,
            buttonStates: this.getButtonStates(),
            performance: this.getPerformanceMetrics(),
            calibration: this.getCalibrationData()
        };
    }

    runDiagnostics() {
        console.log('Running Microbit diagnostics...');
        
        const status = this.getStatus();
        console.log('Connection Status:', status);
        
        if (this.connected) {
            // Test each button LED
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    this.sendMessage(`LED_ON:${i}`);
                    setTimeout(() => {
                        this.sendMessage(`LED_OFF:${i}`);
                    }, 200);
                }, i * 300);
            }
            
            // Test display
            setTimeout(() => {
                this.showIcon('HEART');
                setTimeout(() => {
                    this.clearDisplay();
                }, 1000);
            }, 1500);
        }
        
        return status;
    }
}
