// js/tests/test-base.js - Base class for all tests

class CognitionTestBase {
    constructor(config, platform) {
        this.config = config;
        this.platform = platform;
        this.testData = [];
        this.startTime = null;
        this.isRunning = false;
        this.currentTrial = 0;
        this.metrics = {};
    }

    async initialize() {
        console.log(`Initializing ${this.config.name}...`);
        this.startTime = Date.now();
        
        // Setup LED patterns based on button configuration
        await this.setupLEDPatterns();
        
        // Show instructions
        await this.showInstructions();
    }

    async setupLEDPatterns() {
        // Override in subclasses
        switch(this.config.buttonConfig) {
            case 'single':
                await this.platform.setLED(1, true);
                break;
            case 'dual':
                await this.platform.setLED(1, true);
                await this.platform.setLED(4, true);
                break;
            case 'all_four':
                await this.platform.setAllLEDs(true);
                break;
        }
    }

    async showInstructions() {
        // Display test instructions
        const instructionsHTML = `
            <div class="test-instructions">
                <h2>${this.config.name}</h2>
                <p>${this.config.description}</p>
                <p><strong>Duration:</strong> ${Math.floor(this.config.duration / 60000)} minutes</p>
                <p><strong>Press any button when ready to begin</strong></p>
            </div>
        `;
        
        const testContent = document.getElementById('testContent');
        if (testContent) {
            testContent.innerHTML = instructionsHTML;
        }
        
        // Wait for button press to start
        return new Promise((resolve) => {
            this.instructionResolver = resolve;
        });
    }

    handleButtonPress(buttonData) {
        if (this.instructionResolver) {
            this.instructionResolver();
            this.instructionResolver = null;
            this.start();
        } else if (this.isRunning) {
            this.recordResponse(buttonData);
        }
    }

    handleButtonRelease(buttonData) {
        // Override in subclasses if needed
    }

    async start() {
        console.log(`Starting ${this.config.name}...`);
        this.isRunning = true;
        this.startTime = Date.now();
        
        // Start test-specific logic
        await this.runTest();
    }

    async runTest() {
        // Override in subclasses
        throw new Error('runTest() must be implemented by subclass');
    }

    recordResponse(buttonData) {
        const dataPoint = {
            trial: this.currentTrial,
            timestamp: Date.now(),
            relativeTime: Date.now() - this.startTime,
            button: buttonData.button,
            ...buttonData
        };
        
        this.testData.push(dataPoint);
    }

    calculateMetrics() {
        // Override in subclasses
        return {};
    }

    async complete() {
        this.isRunning = false;
        
        // Turn off LEDs
        await this.platform.setAllLEDs(false);
        
        // Calculate final metrics
        this.metrics = this.calculateMetrics();
        
        // Show completion animation
        await this.platform.onGameWin();
        
        return {
            testName: this.config.name,
            startTime: this.startTime,
            endTime: Date.now(),
            duration: Date.now() - this.startTime,
            rawData: this.testData,
            metrics: this.metrics,
            config: this.config
        };
    }

    destroy() {
        this.isRunning = false;
    }
}