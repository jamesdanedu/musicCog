// js/tests/simple-reaction.js - Simple Reaction Time Test

class SimpleReactionTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        this.stimulusInterval = null;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        this.minInterval = 2000;  // Minimum 2 seconds between stimuli
        this.maxInterval = 5000;  // Maximum 5 seconds between stimuli
        this.reactionTimes = [];
    }

    async setupLEDPatterns() {
        // Turn off all LEDs initially
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="simple-reaction-test">
                <div class="fixation-point">+</div>
                <div class="stimulus-area" id="stimulusArea"></div>
                <div class="test-info">
                    <p>Press GREEN button as quickly as possible when it lights up</p>
                    <div class="trial-counter">Trial: <span id="trialCount">0</span></div>
                    <div class="time-remaining">Time: <span id="timeRemaining"></span></div>
                </div>
            </div>
        `;

        this.updateTimer();
        this.scheduleNextStimulus();
    }

    scheduleNextStimulus() {
        if (!this.isRunning) return;
        
        const timeElapsed = Date.now() - this.startTime;
        if (timeElapsed >= this.config.duration) {
            this.complete();
            return;
        }

        // Random interval between stimuli
        const interval = Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
        
        this.stimulusInterval = setTimeout(() => {
            this.presentStimulus();
        }, interval);
    }

    async presentStimulus() {
        if (!this.isRunning) return;

        this.currentTrial++;
        document.getElementById('trialCount').textContent = this.currentTrial;

        // Visual stimulus
        const stimulusArea = document.getElementById('stimulusArea');
        stimulusArea.classList.add('active');
        stimulusArea.style.backgroundColor = '#00ff00';

        // LED stimulus - turn on green button
        await this.platform.setLED(1, true);
        
        this.stimulusStartTime = Date.now();
        this.waitingForResponse = true;

        // Record stimulus presentation
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime
        });
    }

    handleButtonPress(buttonData) {
        if (this.instructionResolver) {
            super.handleButtonPress(buttonData);
            return;
        }

        if (!this.isRunning) return;

        const responseTime = Date.now();
        const reactionTime = responseTime - this.stimulusStartTime;

        if (this.waitingForResponse && buttonData.button === 1) {
            // Correct response
            this.waitingForResponse = false;
            this.reactionTimes.push(reactionTime);

            // Visual feedback
            const stimulusArea = document.getElementById('stimulusArea');
            stimulusArea.classList.remove('active');
            stimulusArea.style.backgroundColor = 'transparent';

            // Turn off LED
            this.platform.setLED(1, false);

            // Record response
            this.testData.push({
                type: 'response',
                trial: this.currentTrial,
                timestamp: responseTime,
                relativeTime: responseTime - this.startTime,
                button: buttonData.button,
                reactionTime: reactionTime,
                correct: true
            });

            // Brief feedback LED flash
            setTimeout(() => {
                this.platform.flashLED(1, 1, 100);
            }, 200);

            // Schedule next stimulus
            this.scheduleNextStimulus();

        } else if (!this.waitingForResponse) {
            // False alarm - pressed before stimulus
            this.testData.push({
                type: 'false_alarm',
                trial: this.currentTrial,
                timestamp: responseTime,
                relativeTime: responseTime - this.startTime,
                button: buttonData.button
            });

            // Penalty feedback
            this.platform.flashLED(buttonData.button, 3, 100);
        }
    }

    updateTimer() {
        if (!this.isRunning) return;

        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, this.config.duration - elapsed);
        const seconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;

        const timeDisplay = document.getElementById('timeRemaining');
        if (timeDisplay) {
            timeDisplay.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
        }

        if (remaining > 0) {
            setTimeout(() => this.updateTimer(), 100);
        }
    }

    calculateMetrics() {
        if (this.reactionTimes.length === 0) {
            return {
                meanRT: null,
                medianRT: null,
                sdRT: null,
                trialCount: this.currentTrial
            };
        }

        const sorted = [...this.reactionTimes].sort((a, b) => a - b);
        const mean = this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        
        const variance = this.reactionTimes.reduce((sum, rt) => {
            return sum + Math.pow(rt - mean, 2);
        }, 0) / this.reactionTimes.length;
        const sd = Math.sqrt(variance);

        // Count false alarms
        const falseAlarms = this.testData.filter(d => d.type === 'false_alarm').length;

        return {
            meanRT: Math.round(mean),
            medianRT: Math.round(median),
            sdRT: Math.round(sd),
            minRT: Math.round(Math.min(...this.reactionTimes)),
            maxRT: Math.round(Math.max(...this.reactionTimes)),
            trialCount: this.currentTrial,
            validTrials: this.reactionTimes.length,
            falseAlarms: falseAlarms,
            accuracy: (this.reactionTimes.length / this.currentTrial * 100).toFixed(1)
        };
    }

    destroy() {
        super.destroy();
        if (this.stimulusInterval) {
            clearTimeout(this.stimulusInterval);
        }
    }
}