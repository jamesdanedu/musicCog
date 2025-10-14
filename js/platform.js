// js/platform.js - Main Music Cognition Testing Platform Logic with Microbit Integration

const { ipcRenderer } = require('electron');

class MusicCognitionPlatform {
    constructor() {
        console.log('Initializing Music Cognition Testing Platform...');
        
        // Core systems
        this.currentSession = null;
        this.currentTest = null;
        this.testInstance = null;
        this.testQueue = [];
        this.testIndex = 0;
        
        // Audio system
        this.audioContext = null;
        this.currentTrack = null;
        this.musicAnalyzer = null;
        this.audioBuffer = null;
        this.audioSource = null;
        
        // Hardware interface - Microbit
        this.microbitInterface = null;
        this.hardwareReady = false;
        this.microbitConnected = false;
        this.buttonStates = [false, false, false, false]; // Green1, White, Red, Green2
        
        // Data collection
        this.dataLogger = new DataLogger();
        this.metricsCollector = new MetricsCollector();
        
        // Current screen management
        this.currentScreen = 'welcomeScreen';
        
        // Test configurations
        this.testConfigurations = this.setupTestConfigurations();
        this.musicConditions = this.setupMusicConditions();
        
        // Initialize platform
        this.initialize();
    }

    async initialize() {
        try {
            // Setup audio context
            await this.initializeAudio();
            
            // Setup hardware interface
            await this.initializeHardware();
            
            // Setup Microbit listeners
            this.setupMicrobitListeners();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Update system status
            this.updateSystemStatus();
            
            // Start clock
            this.startClock();
            
            console.log('Platform initialization complete');
            
        } catch (error) {
            console.error('Platform initialization error:', error);
            this.showError('System initialization failed', error.message);
        }
    }

    async initializeAudio() {
        try {
            // Create audio context
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Create music analyzer
            this.musicAnalyzer = new MusicAnalyzer(this.audioContext);
            
            // Test audio functionality
            const oscillator = this.audioContext.createOscillator();
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.001);
            
            this.updateStatus('audioStatus', 'Audio: Ready', 'success');
            console.log('Audio system initialized');
            
        } catch (error) {
            console.error('Audio initialization error:', error);
            this.updateStatus('audioStatus', 'Audio: Error', 'error');
        }
    }

    async initializeHardware() {
        try {
            // Check Microbit connection status
            await this.checkMicrobitConnection();
            
        } catch (error) {
            console.error('Hardware initialization error:', error);
            this.updateStatus('microbitStatus', 'Microbit: Error', 'error');
            this.setupKeyboardFallback();
        }
    }

    async checkMicrobitConnection() {
        try {
            const status = await ipcRenderer.invoke('get-microbit-status');
            this.microbitConnected = status.connected;
            
            if (status.connected) {
                this.hardwareReady = true;
                this.updateStatus('microbitStatus', `Microbit: ${status.connectionCount} Connected`, 'success');
                console.log(`✅ Connected to ${status.connectionCount} Microbit(s)`);
                
                // Show success LED pattern
                await this.onGameStart();
            } else {
                this.updateStatus('microbitStatus', 'Microbit: Not Found', 'warning');
                console.log('Microbit not found, using keyboard fallback');
                this.setupKeyboardFallback();
            }
        } catch (error) {
            console.error('Microbit connection check error:', error);
            this.updateStatus('microbitStatus', 'Microbit: Not Available', 'warning');
            this.setupKeyboardFallback();
        }
    }

    setupMicrobitListeners() {
        console.log('Setting up Microbit event listeners...');
        
        // Listen for button press events from Microbits
        ipcRenderer.on('microbit-button-press', (event, data) => {
            console.log(`🎮 Microbit Button Press: ${data.color} Button ${data.button} (${data.position})`);
            
            // Update button state
            this.buttonStates[data.button - 1] = true;
            
            // Forward to current test
            this.handleButtonPress(data.button - 1, performance.now(), data);
            
            // Visual feedback
            this.visualizeButtonPress(data.button - 1);
        });

        // Listen for button release events
        ipcRenderer.on('microbit-button-release', (event, data) => {
            console.log(`🎮 Microbit Button Release: ${data.color} Button ${data.button} (${data.position})`);
            
            // Update button state
            this.buttonStates[data.button - 1] = false;
            
            // Forward to current test
            this.handleButtonRelease(data.button - 1, performance.now(), data);
            
            // Visual feedback
            this.visualizeButtonRelease(data.button - 1);
        });

        // Listen for Microbit status updates
        ipcRenderer.on('microbit-status', (event, data) => {
            console.log('Microbit status update:', data);
            if (data.status === 'connected') {
                this.microbitConnected = true;
                this.hardwareReady = true;
                this.updateStatus('microbitStatus', 'Microbit: Connected', 'success');
            }
        });
    }

    // ========================================
    // LED CONTROL METHODS
    // ========================================

    async setLED(buttonNumber, state) {
        try {
            const result = await ipcRenderer.invoke('set-led', buttonNumber, state);
            if (result.success) {
                console.log(`💡 LED ${buttonNumber} set to ${state ? 'ON' : 'OFF'}`);
            }
            return result.success;
        } catch (error) {
            console.error('Error controlling LED:', error);
            return false;
        }
    }

    async setAllLEDs(state) {
        try {
            const result = await ipcRenderer.invoke('set-all-leds', state);
            if (result.success) {
                console.log(`💡 All LEDs set to ${state ? 'ON' : 'OFF'}`);
            }
            return result.success;
        } catch (error) {
            console.error('Error controlling all LEDs:', error);
            return false;
        }
    }

    async flashLED(buttonNumber, times = 3, duration = 500) {
        try {
            const result = await ipcRenderer.invoke('flash-led', buttonNumber, times, duration);
            return result.success;
        } catch (error) {
            console.error('Error flashing LED:', error);
            return false;
        }
    }

    async flashAllLEDs(times = 3, duration = 300) {
        try {
            const result = await ipcRenderer.invoke('flash-all-leds', times, duration);
            return result.success;
        } catch (error) {
            console.error('Error flashing all LEDs:', error);
            return false;
        }
    }

    async chaseLEDs(rounds = 2, speed = 200) {
        try {
            const result = await ipcRenderer.invoke('chase-leds', rounds, speed);
            return result.success;
        } catch (error) {
            console.error('Error running LED chase:', error);
            return false;
        }
    }

    async randomLEDSequence(count = 4, onDuration = 500, offDuration = 100, totalSequences = 1) {
        try {
            const result = await ipcRenderer.invoke('random-led-sequence', count, onDuration, offDuration, totalSequences);
            return result.success;
        } catch (error) {
            console.error('Error running random LED sequence:', error);
            return false;
        }
    }

    async randomFlashSequence(sequences = 3, flashDuration = 500) {
        try {
            const result = await ipcRenderer.invoke('random-flash-sequence', sequences, flashDuration);
            return result.success;
        } catch (error) {
            console.error('Error running random flash sequence:', error);
            return false;
        }
    }

    async randomLEDGame(rounds = 5, speed = 600) {
        try {
            const result = await ipcRenderer.invoke('random-led-game', rounds, speed);
            return result.success;
        } catch (error) {
            console.error('Error running random LED game:', error);
            return false;
        }
    }

    async simonSaysPattern(patternLength = 4, playbackSpeed = 800) {
        try {
            const result = await ipcRenderer.invoke('simon-says-pattern', patternLength, playbackSpeed);
            if (result.success) {
                return result.pattern;
            }
            return null;
        } catch (error) {
            console.error('Error running Simon Says pattern:', error);
            return null;
        }
    }

    async randomCascade(waves = 3, waveSpeed = 200) {
        try {
            const result = await ipcRenderer.invoke('random-cascade', waves, waveSpeed);
            return result.success;
        } catch (error) {
            console.error('Error running random cascade:', error);
            return false;
        }
    }

    async rhythmicRandomPattern(beats = 8, tempo = 600) {
        try {
            const result = await ipcRenderer.invoke('rhythmic-random-pattern', beats, tempo);
            return result.success;
        } catch (error) {
            console.error('Error running rhythmic pattern:', error);
            return false;
        }
    }

    // Game Event LED Patterns
    async onGameStart() {
        console.log('🎮 Game start LED pattern');
        await ipcRenderer.invoke('game-start-pattern');
    }

    async onGameOver() {
        console.log('🎮 Game over LED pattern');
        await ipcRenderer.invoke('game-over-pattern');
    }

    async onGameWin() {
        console.log('🎮 Game win LED pattern');
        await ipcRenderer.invoke('game-win-pattern');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========================================
    // EVENT LISTENERS SETUP
    // ========================================

    setupEventListeners() {
        // IPC listeners
        ipcRenderer.on('show-welcome', () => {
            this.showScreen('welcomeScreen');
        });

        ipcRenderer.on('new-session', () => {
            this.showScreen('participantScreen');
        });

        ipcRenderer.on('start-calibration', () => {
            this.startCalibration();
        });

        // UI Event Listeners
        const newSessionBtn = document.getElementById('newSessionBtn');
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => {
                this.showScreen('participantScreen');
            });
        }

        const loadSessionBtn = document.getElementById('loadSessionBtn');
        if (loadSessionBtn) {
            loadSessionBtn.addEventListener('click', async () => {
                await this.loadSession();
            });
        }

        const calibrateBtn = document.getElementById('calibrateBtn');
        if (calibrateBtn) {
            calibrateBtn.addEventListener('click', () => {
                this.showScreen('calibrationScreen');
            });
        }

        // Participant form
        const participantForm = document.getElementById('participantForm');
        if (participantForm) {
            participantForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleParticipantSubmit(e);
            });
        }

        const cancelParticipantBtn = document.getElementById('cancelParticipantBtn');
        if (cancelParticipantBtn) {
            cancelParticipantBtn.addEventListener('click', () => {
                this.showScreen('welcomeScreen');
            });
        }

        // Test selection
        const testCards = document.querySelectorAll('.test-card');
        testCards.forEach(card => {
            card.addEventListener('click', () => {
                this.toggleTestSelection(card);
            });
        });

        const standardBatteryBtn = document.getElementById('standardBatteryBtn');
        if (standardBatteryBtn) {
            standardBatteryBtn.addEventListener('click', () => {
                this.selectStandardBattery();
            });
        }

        const startTestingBtn = document.getElementById('startTestingBtn');
        if (startTestingBtn) {
            startTestingBtn.addEventListener('click', () => {
                this.startTestBattery();
            });
        }

        // Test controls
        const pauseTestBtn = document.getElementById('pauseTestBtn');
        if (pauseTestBtn) {
            pauseTestBtn.addEventListener('click', () => {
                this.pauseCurrentTest();
            });
        }

        const stopTestBtn = document.getElementById('stopTestBtn');
        if (stopTestBtn) {
            stopTestBtn.addEventListener('click', () => {
                this.stopCurrentTest();
            });
        }

        // Volume controls
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(parseFloat(e.target.value) / 100);
            });
        }

        // Calibration
        const startCalibrationBtn = document.getElementById('startCalibrationBtn');
        if (startCalibrationBtn) {
            startCalibrationBtn.addEventListener('click', () => {
                this.startCalibration();
            });
        }

        // Results
        const exportResultsBtn = document.getElementById('exportResultsBtn');
        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => {
                this.exportResults();
            });
        }

        const newSessionFromResultsBtn = document.getElementById('newSessionFromResultsBtn');
        if (newSessionFromResultsBtn) {
            newSessionFromResultsBtn.addEventListener('click', () => {
                this.showScreen('participantScreen');
            });
        }

        console.log('Event listeners setup complete');
    }

    setupTestConfigurations() {
        return {
            'simple-reaction': {
                name: 'Simple Reaction Time',
                class: 'SimpleReactionTest',
                duration: 120000, // 2 minutes
                buttonConfig: 'single',
                description: 'Press the button as quickly as possible when stimulus appears',
                metrics: ['reactionTime', 'consistency', 'lapses']
            },
            'choice-reaction': {
                name: 'Choice Reaction Time',
                class: 'ChoiceReactionTest',
                duration: 180000, // 3 minutes
                buttonConfig: 'all_four',
                description: 'Press the correct button based on stimulus type',
                metrics: ['reactionTime', 'accuracy', 'interference']
            },
            'vigilance': {
                name: 'Sustained Attention',
                class: 'VigilanceTest',
                duration: 600000, // 10 minutes
                buttonConfig: 'single',
                description: 'Monitor for rare target stimuli over extended period',
                metrics: ['hitRate', 'falseAlarms', 'vigilanceDecrement']
            },
            'n-back': {
                name: 'Working Memory (N-Back)',
                class: 'NBackTest',
                duration: 300000, // 5 minutes
                buttonConfig: 'dual',
                description: 'Identify when current stimulus matches one N trials back',
                metrics: ['accuracy', 'dprime', 'workingMemoryCapacity']
            },
            'rhythm-sync': {
                name: 'Rhythm Synchronization',
                class: 'RhythmSyncTest',
                duration: 240000, // 4 minutes
                buttonConfig: 'rhythm_tap',
                description: 'Synchronize button presses with musical beats',
                metrics: ['timingError', 'synchronization', 'adaptability']
            },
            'multi-stream': {
                name: 'Multi-Stream Attention',
                class: 'MultiStreamTest',
                duration: 360000, // 6 minutes
                buttonConfig: 'all_four',
                description: 'Monitor multiple streams simultaneously',
                metrics: ['dividedAttention', 'switchingCosts', 'overallAccuracy']
            },
            'stroop': {
                name: 'Stroop Interference',
                class: 'StroopTest',
                duration: 180000, // 3 minutes
                buttonConfig: 'color_mapping',
                description: 'Respond to ink color while ignoring word meaning',
                metrics: ['interferenceEffect', 'cognitiveControl', 'processingSpeed']
            },
            'dual-task': {
                name: 'Dual-Task Paradigm',
                class: 'DualTaskTest',
                duration: 300000, // 5 minutes
                buttonConfig: 'dual_task',
                description: 'Perform two tasks simultaneously',
                metrics: ['dualTaskCost', 'taskPrioritization', 'multitaskingEfficiency']
            }
        };
    }

    setupMusicConditions() {
        return {
            'silence': {
                name: 'Silence (Baseline)',
                type: 'none',
                description: 'No background music - baseline condition',
                arousal: 'neutral',
                bpm: 0
            },
            'classical_low': {
                name: 'Classical - Low Tempo',
                type: 'audio',
                file: 'audio/classical_60bpm.mp3',
                description: 'Classical music at 60 BPM',
                arousal: 'low',
                bpm: 60
            },
            'classical_high': {
                name: 'Classical - High Tempo',
                type: 'audio',
                file: 'audio/classical_120bpm.mp3',
                description: 'Classical music at 120 BPM',
                arousal: 'high',
                bpm: 120
            },
            'ambient': {
                name: 'Ambient',
                type: 'audio',
                file: 'audio/ambient.mp3',
                description: 'Ambient instrumental music',
                arousal: 'low',
                bpm: 70
            },
            'electronic': {
                name: 'Electronic',
                type: 'audio',
                file: 'audio/electronic_140bpm.mp3',
                description: 'Electronic music at 140 BPM',
                arousal: 'high',
                bpm: 140
            },
            'white_noise': {
                name: 'White Noise',
                type: 'generated',
                description: 'Continuous white noise',
                arousal: 'neutral',
                frequency: 'white'
            },
            'binaural': {
                name: 'Binaural Beats (40Hz)',
                type: 'generated',
                description: 'Gamma frequency binaural beats',
                arousal: 'focus',
                frequency: 40
            }
        };
    }

    setupKeyboardFallback() {
        // Fallback keyboard mapping for testing without hardware
        const keyMap = {
            'KeyA': 0, 'KeyS': 1, 'KeyD': 2, 'KeyF': 3
        };
        
        document.addEventListener('keydown', (event) => {
            const buttonIndex = keyMap[event.code];
            if (buttonIndex !== undefined && !this.buttonStates[buttonIndex]) {
                this.buttonStates[buttonIndex] = true;
                this.handleButtonPress(buttonIndex, performance.now());
                this.visualizeButtonPress(buttonIndex);
            }
        });
        
        document.addEventListener('keyup', (event) => {
            const buttonIndex = keyMap[event.code];
            if (buttonIndex !== undefined) {
                this.buttonStates[buttonIndex] = false;
                this.handleButtonRelease(buttonIndex, performance.now());
                this.visualizeButtonRelease(buttonIndex);
            }
        });
        
        console.log('Keyboard fallback enabled (A, S, D, F keys)');
    }

    // ========================================
    // SCREEN MANAGEMENT
    // ========================================

    showScreen(screenId, data = null) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            targetScreen.classList.add('fade-in');
            this.currentScreen = screenId;
            
            // Screen-specific initialization
            if (data) {
                this.initializeScreen(screenId, data);
            }
        }
        
        console.log(`Switched to screen: ${screenId}`);
    }

    initializeScreen(screenId, data) {
        switch (screenId) {
            case 'testSelectionScreen':
                this.populateSessionInfo(data);
                break;
            case 'testScreen':
                this.initializeTestScreen(data);
                break;
            case 'resultsScreen':
                this.populateResults(data);
                break;
        }
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    async handleParticipantSubmit(event) {
        try {
            this.showLoading('Creating session...');
            
            const formData = new FormData(event.target);
            const participantData = {
                id: formData.get('participantId') || `P${Date.now()}`,
                age: parseInt(formData.get('age')) || null,
                gender: formData.get('gender') || null,
                handedness: formData.get('handedness') || null,
                musicalTraining: parseInt(formData.get('musicalTraining')) || 0,
                hearingImpairment: formData.get('hearing') || 'none',
                medications: formData.get('medications') || '',
                caffeineIntake: formData.get('caffeineIntake') || 'none',
                sleepHours: parseFloat(formData.get('sleepHours')) || null,
                notes: formData.get('notes') || ''
            };
            
            const result = await ipcRenderer.invoke('create-session', participantData);
            
            if (result.success) {
                this.currentSession = result.session;
                this.updateStatus('sessionStatus', `Session: ${this.currentSession.id.substring(0, 8)}`, 'success');
                this.showScreen('testSelectionScreen', this.currentSession);
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('Session creation error:', error);
            this.showError('Session Creation Failed', error.message);
        } finally {
            this.hideLoading();
        }
    }

    populateSessionInfo(session) {
        const sessionInfo = document.getElementById('sessionInfo');
        if (sessionInfo && session) {
            sessionInfo.innerHTML = `
                <strong>Participant:</strong> ${session.participant.id}<br>
                <strong>Started:</strong> ${new Date(session.startTime).toLocaleString()}<br>
                <strong>Age:</strong> ${session.participant.age || 'Not specified'}<br>
                <strong>Musical Training:</strong> ${session.participant.musicalTraining} years
            `;
        }
    }

    // ========================================
    // TEST SELECTION
    // ========================================

    toggleTestSelection(card) {
        card.classList.toggle('selected');
        this.updateTestSelection();
    }

    selectStandardBattery() {
        // Select all test cards for standard battery
        document.querySelectorAll('.test-card').forEach(card => {
            card.classList.add('selected');
        });
        
        // Select common music conditions
        const defaultConditions = ['silence', 'classical_low', 'ambient', 'electronic'];
        document.querySelectorAll('.condition-selection input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = defaultConditions.includes(checkbox.value);
        });
        
        this.updateTestSelection();
    }

    updateTestSelection() {
        const selectedTests = Array.from(document.querySelectorAll('.test-card.selected'))
            .map(card => card.dataset.test);
        
        const selectedConditions = Array.from(document.querySelectorAll('.condition-selection input:checked'))
            .map(checkbox => checkbox.value);
        
        const startButton = document.getElementById('startTestingBtn');
        if (startButton) {
            startButton.disabled = selectedTests.length === 0 || selectedConditions.length === 0;
        }
        
        console.log(`Selected tests: ${selectedTests.join(', ')}`);
        console.log(`Selected conditions: ${selectedConditions.join(', ')}`);
    }

    // ========================================
    // TEST EXECUTION
    // ========================================

    async startTestBattery() {
        try {
            if (!this.currentSession) {
                throw new Error('No active session');
            }
            
            const selectedTests = Array.from(document.querySelectorAll('.test-card.selected'))
                .map(card => card.dataset.test);
            
            const selectedConditions = Array.from(document.querySelectorAll('.condition-selection input:checked'))
                .map(checkbox => checkbox.value);
            
            if (selectedTests.length === 0 || selectedConditions.length === 0) {
                alert('Please select at least one test and one music condition');
                return;
            }
            
            // Create test queue with randomized order
            this.testQueue = this.createTestQueue(selectedTests, selectedConditions);
            this.testIndex = 0;
            
            console.log(`Starting test battery with ${this.testQueue.length} tests`);
            
            // Show test screen
            this.showScreen('testScreen');
            
            // Start first test
            await this.startNextTest();
            
        } catch (error) {
            console.error('Test battery start error:', error);
            this.showError('Test Start Failed', error.message);
        }
    }

    createTestQueue(tests, conditions) {
        const queue = [];
        
        // Create all test-condition combinations
        tests.forEach(testType => {
            conditions.forEach(condition => {
                queue.push({
                    testType: testType,
                    musicCondition: condition,
                    config: this.testConfigurations[testType]
                });
            });
        });
        
        // Randomize order (counterbalancing)
        return this.shuffleArray(queue);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async startNextTest() {
        if (this.testIndex >= this.testQueue.length) {
            // All tests completed
            await this.completeTestBattery();
            return;
        }
        
        const testConfig = this.testQueue[this.testIndex];
        
        // Update progress
        this.updateTestProgress();
        
        // Show test info
        document.getElementById('currentTestName').textContent = 
            `${testConfig.config.name} - ${testConfig.musicCondition}`;
        
        try {
            // Setup music condition
            await this.setupMusicCondition(testConfig.musicCondition);
            
            // Update UI
            this.updateMusicIndicator(testConfig.musicCondition);
            
            // Initialize test instance
            await this.initializeTest(testConfig);
            
        } catch (error) {
            console.error('Test start error:', error);
            this.showError('Test Failed', error.message);
            
            // Skip to next test
            this.testIndex++;
            this.startNextTest();
        }
    }

    async initializeTest(testConfig) {
        console.log(`Initializing test: ${testConfig.testType}`);
        
        // Get test class
        const TestClass = this.getTestClass(testConfig.testType);
        if (!TestClass) {
            console.error(`Test class not found: ${testConfig.testType}`);
            this.testIndex++;
            this.startNextTest();
            return;
        }
        
        // Create test instance
        this.testInstance = new TestClass(testConfig.config, this);
        
        // Initialize and run test
        try {
            await this.testInstance.initialize();
        } catch (error) {
            console.error('Test initialization error:', error);
            this.testIndex++;
            this.startNextTest();
        }
    }

    getTestClass(testType) {
        const testClasses = {
            'simple-reaction': typeof SimpleReactionTest !== 'undefined' ? SimpleReactionTest : null,
            'choice-reaction': typeof ChoiceReactionTest !== 'undefined' ? ChoiceReactionTest : null,
            'vigilance': typeof VigilanceTest !== 'undefined' ? VigilanceTest : null,
            'n-back': typeof NBackTest !== 'undefined' ? NBackTest : null,
            'rhythm-sync': typeof RhythmSyncTest !== 'undefined' ? RhythmSyncTest : null,
            'multi-stream': typeof MultiStreamTest !== 'undefined' ? MultiStreamTest : null,
            'stroop': typeof StroopTest !== 'undefined' ? StroopTest : null,
            'dual-task': typeof DualTaskTest !== 'undefined' ? DualTaskTest : null
        };
        
        return testClasses[testType];
    }

    async completeCurrentTest() {
        if (!this.testInstance) return;
        
        try {
            // Get test results
            const testResults = await this.testInstance.complete();
            
            // Add music condition info
            testResults.musicCondition = this.testQueue[this.testIndex].musicCondition;
            testResults.buttonConfig = this.testInstance.config.buttonConfig;
            
            // Save test data
            const result = await ipcRenderer.invoke('save-test-data', testResults);
            
            if (result.success) {
                console.log('Test data saved:', result.testId);
            }
            
            // Clean up
            this.testInstance.destroy();
            this.testInstance = null;
            
            // Stop music
            this.stopMusic();
            
            // Short break before next test
            await this.showInterTestBreak();
            
            // Move to next test
            this.testIndex++;
            await this.startNextTest();
            
        } catch (error) {
            console.error('Error completing test:', error);
        }
    }

    async showInterTestBreak() {
        const testContent = document.getElementById('testContent');
        if (!testContent) return;
        
        testContent.innerHTML = `
            <div class="inter-test-break">
                <h2>Test Complete!</h2>
                <p>Take a short break before the next test</p>
                <div class="break-timer" id="breakTimer">30</div>
                <p>Next test will start automatically...</p>
                <button class="btn-primary" id="skipBreakBtn">Skip Break</button>
            </div>
        `;
        
        // LED celebration pattern
        await this.randomCascade(2, 150);
        
        // Countdown
        let remaining = 30;
        const breakTimer = document.getElementById('breakTimer');
        const skipBtn = document.getElementById('skipBreakBtn');
        
        return new Promise((resolve) => {
            const countdown = setInterval(() => {
                remaining--;
                if (breakTimer) {
                    breakTimer.textContent = remaining;
                }
                
                if (remaining <= 0) {
                    clearInterval(countdown);
                    resolve();
                }
            }, 1000);
            
            if (skipBtn) {
                skipBtn.onclick = () => {
                    clearInterval(countdown);
                    resolve();
                };
            }
        });
    }

    async completeTestBattery() {
        console.log('Test battery complete!');
        
        // Turn off all LEDs
        await this.setAllLEDs(false);
        
        // Show completion
        await this.onGameWin();
        
        // Update session
        await ipcRenderer.invoke('update-session', {
            status: 'completed',
            endTime: new Date().toISOString()
        });
        
        // Show results
        this.showScreen('resultsScreen');
        await this.displaySessionSummary();
    }

    updateTestProgress() {
        const progressFill = document.getElementById('testProgress');
        const progressText = document.getElementById('progressText');
        const testName = document.getElementById('currentTestName');
        
        if (progressFill && progressText && testName) {
            const progress = (this.testIndex / this.testQueue.length) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${this.testIndex + 1} / ${this.testQueue.length}`;
            
            const currentTest = this.testQueue[this.testIndex];
            if (currentTest) {
                testName.textContent = currentTest.config.name;
            }
        }
    }

    // ========================================
    // MUSIC MANAGEMENT
    // ========================================

    async setupMusicCondition(conditionKey) {
        const condition = this.musicConditions[conditionKey];
        
        if (condition.type === 'none') {
            // Silence - stop any current audio
            this.stopMusic();
            
        } else if (condition.type === 'audio') {
            // Load and play audio file
            await this.loadAndPlayAudio(condition.file);
            
        } else if (condition.type === 'generated') {
            // Generate synthetic audio
            await this.generateAudio(condition);
        }
        
        console.log(`Music condition set to: ${condition.name}`);
        
        // LED pattern to indicate music starting
        if (condition.type !== 'none') {
            await this.chaseLEDs(1, 100);
        }
    }

    async loadAndPlayAudio(filePath) {
        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Fetch audio file
            const response = await fetch(filePath);
            const arrayBuffer = await response.arrayBuffer();
            
            // Decode audio data
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Create and connect source
            this.audioSource = this.audioContext.createBufferSource();
            this.audioSource.buffer = this.audioBuffer;
            this.audioSource.loop = true;
            
            // Connect to analyzer and destination
            if (this.musicAnalyzer) {
                this.musicAnalyzer.connectSource(this.audioSource);
            }
            this.audioSource.connect(this.audioContext.destination);
            
            // Start playback
            this.audioSource.start();
            
        } catch (error) {
            console.error('Audio loading error:', error);
            // Continue without audio
        }
    }

    async generateAudio(condition) {
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            if (condition.frequency === 'white') {
                // Generate white noise
                this.generateWhiteNoise();
            } else if (typeof condition.frequency === 'number') {
                // Generate binaural beats
                this.generateBinauralBeats(condition.frequency);
            }
            
        } catch (error) {
            console.error('Audio generation error:', error);
        }
    }

    generateWhiteNoise() {
        // Create white noise buffer
        const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        // Create and play source
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = buffer;
        this.audioSource.loop = true;
        this.audioSource.connect(this.audioContext.destination);
        this.audioSource.start();
    }

    generateBinauralBeats(targetFrequency) {
        // Create two oscillators with slight frequency difference
        const baseFreq = 200; // Base frequency
        const beatFreq = targetFrequency; // Beat frequency
        
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const merger = this.audioContext.createChannelMerger(2);
        
        osc1.frequency.value = baseFreq;
        osc2.frequency.value = baseFreq + beatFreq;
        
        osc1.connect(merger, 0, 0); // Left channel
        osc2.connect(merger, 0, 1); // Right channel
        merger.connect(this.audioContext.destination);
        
        osc1.start();
        osc2.start();
        
        // Store reference for cleanup
        this.audioSource = { 
            stop: () => {
                osc1.stop();
                osc2.stop();
            }
        };
    }

    stopMusic() {
        if (this.audioSource) {
            try {
                this.audioSource.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.audioSource = null;
        }
    }

    updateMusicIndicator(conditionKey) {
        const indicator = document.getElementById('currentMusicCondition');
        if (indicator) {
            const condition = this.musicConditions[conditionKey];
            indicator.textContent = condition.name;
        }
    }

    // ========================================
    // BUTTON HANDLING
    // ========================================

    handleButtonPress(buttonIndex, timestamp, data = null) {
        // Log raw button data
        this.dataLogger.logEvent({
            type: 'button_press',
            button: buttonIndex,
            buttonData: data,
            timestamp: timestamp,
            musicTime: this.getCurrentMusicTime(),
            testPhase: this.getCurrentTestPhase()
        });
        
        // Forward to current test
        if (this.testInstance && this.testInstance.handleButtonPress) {
            // Convert 0-based index to 1-based for test
            const buttonData = {
                button: buttonIndex + 1,
                timestamp: timestamp,
                ...data
            };
            this.testInstance.handleButtonPress(buttonData);
        }
    }

    handleButtonRelease(buttonIndex, timestamp, data = null) {
        this.dataLogger.logEvent({
            type: 'button_release',
            button: buttonIndex,
            buttonData: data,
            timestamp: timestamp,
            musicTime: this.getCurrentMusicTime()
        });
        
        if (this.testInstance && this.testInstance.handleButtonRelease) {
            const buttonData = {
                button: buttonIndex + 1,
                timestamp: timestamp,
                ...data
            };
            this.testInstance.handleButtonRelease(buttonData);
        }
    }

    visualizeButtonPress(buttonIndex) {
        const indicator = document.querySelector(`[data-button="${buttonIndex}"]`);
        if (indicator) {
            indicator.classList.add('active');
            const visual = indicator.querySelector('.button-visual');
            if (visual) {
                visual.classList.add('pressed');
            }
        }
    }

    visualizeButtonRelease(buttonIndex) {
        const indicator = document.querySelector(`[data-button="${buttonIndex}"]`);
        if (indicator) {
            indicator.classList.remove('active');
            const visual = indicator.querySelector('.button-visual');
            if (visual) {
                visual.classList.remove('pressed');
            }
        }
    }

    // ========================================
    // RESULTS & DATA EXPORT
    // ========================================

    async displaySessionSummary() {
        const resultsContent = document.getElementById('resultsContent');
        if (!resultsContent) return;
        
        const session = await ipcRenderer.invoke('get-current-session');
        
        if (!session || !session.tests) {
            resultsContent.innerHTML = '<p>No test data available</p>';
            return;
        }
        
        let summaryHTML = `
            <h2>Session Summary</h2>
            <div class="session-overview">
                <p><strong>Participant:</strong> ${session.participant.id}</p>
                <p><strong>Tests Completed:</strong> ${session.tests.length}</p>
                <p><strong>Duration:</strong> ${this.formatDuration(
                    new Date(session.endTime) - new Date(session.startTime)
                )}</p>
            </div>
            <div class="test-results">
        `;
        
        session.tests.forEach(test => {
            summaryHTML += `
                <div class="test-result-card">
                    <h3>${test.testName}</h3>
                    <p><strong>Music:</strong> ${test.musicCondition}</p>
                    <div class="metrics">
            `;
            
            for (const [key, value] of Object.entries(test.metrics)) {
                summaryHTML += `<div class="metric"><span>${key}:</span> <strong>${value}</strong></div>`;
            }
            
            summaryHTML += `
                    </div>
                </div>
            `;
        });
        
        summaryHTML += '</div>';
        resultsContent.innerHTML = summaryHTML;
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    getCurrentMusicTime() {
        if (this.audioContext && this.audioSource) {
            return this.audioContext.currentTime * 1000; // Convert to milliseconds
        }
        return 0;
    }

    getCurrentTestPhase() {
        return this.testInstance ? this.testInstance.getCurrentPhase?.() || 'active' : 'none';
    }

    updateStatus(elementId, text, type = 'info') {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            element.className = `status-item ${type}`;
        }
    }

    updateSystemStatus() {
        // Update hardware status
        const hardwareCard = document.getElementById('hardwareStatus');
        if (hardwareCard) {
            const statusSpan = hardwareCard.querySelector('.status-text span');
            if (statusSpan) {
                statusSpan.textContent = this.hardwareReady ? 'Ready' : 'Checking...';
                statusSpan.className = this.hardwareReady ? 'success' : 'warning';
            }
        }
    }

    startClock() {
        const updateClock = () => {
            const clockElement = document.getElementById('clockDisplay');
            if (clockElement) {
                const now = new Date();
                clockElement.textContent = now.toLocaleTimeString();
            }
        };
        
        updateClock();
        setInterval(updateClock, 1000);
    }

    setVolume(volume) {
        if (this.audioSource && this.audioContext) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            // Note: Simplified implementation
            console.log(`Volume set to: ${(volume * 100).toFixed(0)}%`);
        }
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (overlay && loadingText) {
            loadingText.textContent = text;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showError(title, message) {
        alert(`${title}\n\n${message}`);
    }

    // Placeholder methods for features not yet implemented
    startCalibration() {
        console.log('Calibration not yet implemented');
        alert('Calibration feature coming soon!');
    }

    pauseCurrentTest() {
        console.log('Pause not yet implemented');
        if (this.testInstance && this.testInstance.pause) {
            this.testInstance.pause();
        }
    }

    stopCurrentTest() {
        if (confirm('Are you sure you want to stop the current test? Progress will be lost.')) {
            if (this.testInstance) {
                this.testInstance.destroy();
                this.testInstance = null;
            }
            this.stopMusic();
            this.showScreen('testSelectionScreen', this.currentSession);
        }
    }

    async exportResults() {
        try {
            // Trigger main process export
            await ipcRenderer.invoke('export-session-data');
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Export Failed', error.message);
        }
    }

    async loadSession() {
        console.log('Load session triggered');
        // This will be handled by main process
    }

    initializeTestScreen(data) {
        console.log('Test screen initialized');
    }

    populateResults(session) {
        this.displaySessionSummary();
    }
}

// Add keyboard shortcut to open LED test panel
document.addEventListener('keydown', (e) => {
    if (e.key === 'L' && e.ctrlKey) {
        e.preventDefault();
        if (window.platform) {
            window.platform.createLEDTestPanel?.();
        }
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof MusicCognitionPlatform !== 'undefined') {
        window.platform = new MusicCognitionPlatform();
        console.log('✅ Music Cognition Platform initialized');
    } else {
        console.error('❌ MusicCognitionPlatform class not found!');
    }
});