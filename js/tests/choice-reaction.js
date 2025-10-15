// js/tests/choice-reaction.js - Choice Reaction Time Test

class ChoiceReactionTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        // Button to color mapping
        this.buttonColors = [
            { button: 0, color: 'green', name: 'Green 1', rgb: '#4ade80' },
            { button: 1, color: 'white', name: 'White', rgb: '#ffffff' },
            { button: 2, color: 'red', name: 'Red', rgb: '#ff6b6b' },
            { button: 3, color: 'green2', name: 'Green 2', rgb: '#22c55e' }
        ];
        
        this.currentTarget = null;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        this.minInterval = 1500;
        this.maxInterval = 3000;
        this.reactionTimes = [];
        this.correctResponses = 0;
        this.incorrectResponses = 0;
    }

    async setupLEDPatterns() {
        // Turn off all LEDs initially
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="choice-reaction-test">
                <div class="instruction-box">
                    <h3>Press the button that matches the lit LED color</h3>
                </div>
                
                <div class="button-display">
                    <div class="button-indicator" data-button="0">
                        <div class="led-circle green"></div>
                        <span>Button 1 (Green)</span>
                    </div>
                    <div class="button-indicator" data-button="1">
                        <div class="led-circle white"></div>
                        <span>Button 2 (White)</span>
                    </div>
                    <div class="button-indicator" data-button="2">
                        <div class="led-circle red"></div>
                        <span>Button 3 (Red)</span>
                    </div>
                    <div class="button-indicator" data-button="3">
                        <div class="led-circle green2"></div>
                        <span>Button 4 (Green)</span>
                    </div>
                </div>
                
                <div class="stimulus-area" id="stimulusArea">
                    <div class="fixation-point">+</div>
                </div>
                
                <div class="test-stats">
                    <div class="stat">
                        <span class="stat-label">Correct:</span>
                        <span class="stat-value" id="correctCount">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Incorrect:</span>
                        <span class="stat-value" id="incorrectCount">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Trial:</span>
                        <span class="stat-value" id="trialCount">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Time:</span>
                        <span class="stat-value" id="timeRemaining"></span>
                    </div>
                </div>
            </div>
            
            <style>
                .choice-reaction-test {
                    text-align: center;
                    padding: 20px;
                }
                
                .instruction-box {
                    background: rgba(255,255,255,0.1);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                }
                
                .instruction-box h3 {
                    margin: 0;
                    color: #fff;
                    font-size: 1.3em;
                }
                
                .button-display {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin: 30px 0;
                    flex-wrap: wrap;
                }
                
                .button-indicator {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 15px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    min-width: 120px;
                }
                
                .button-indicator.active {
                    background: rgba(255,255,255,0.3);
                    box-shadow: 0 0 20px rgba(255,255,255,0.5);
                }
                
                .led-circle {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 3px solid rgba(255,255,255,0.3);
                    transition: all 0.2s;
                }
                
                .led-circle.green { background-color: #4ade80; }
                .led-circle.white { background-color: #ffffff; }
                .led-circle.red { background-color: #ff6b6b; }
                .led-circle.green2 { background-color: #22c55e; }
                
                .led-circle.lit {
                    box-shadow: 0 0 30px currentColor;
                    transform: scale(1.1);
                }
                
                .stimulus-area {
                    margin: 40px 0;
                    min-height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .fixation-point {
                    font-size: 48px;
                    color: rgba(255,255,255,0.5);
                }
                
                .test-stats {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    margin-top: 30px;
                    flex-wrap: wrap;
                }
                
                .stat {
                    background: rgba(255,255,255,0.1);
                    padding: 10px 20px;
                    border-radius: 8px;
                }
                
                .stat-label {
                    color: rgba(255,255,255,0.7);
                    margin-right: 8px;
                }
                
                .stat-value {
                    color: #fff;
                    font-weight: bold;
                    font-size: 1.2em;
                }
            </style>
        `;

        this.updateTimer();
        await this.platform.delay(1000); // Brief delay before first stimulus
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
        
        setTimeout(() => {
            if (this.isRunning) {
                this.presentStimulus();
            }
        }, interval);
    }

    async presentStimulus() {
        // Choose random button
        this.currentTarget = Math.floor(Math.random() * 4);
        this.currentTrial++;
        
        document.getElementById('trialCount').textContent = this.currentTrial;
        
        // Light up the corresponding LED
        await this.platform.setLED(this.currentTarget + 1, true);
        
        // Highlight the button indicator in UI
        const indicators = document.querySelectorAll('.button-indicator');
        indicators.forEach((ind, idx) => {
            if (idx === this.currentTarget) {
                ind.classList.add('active');
                ind.querySelector('.led-circle').classList.add('lit');
            } else {
                ind.classList.remove('active');
                ind.querySelector('.led-circle').classList.remove('lit');
            }
        });
        
        this.stimulusStartTime = performance.now();
        this.waitingForResponse = true;
        
        // Record stimulus presentation
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime,
            targetButton: this.currentTarget,
            targetColor: this.buttonColors[this.currentTarget].color
        });
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.waitingForResponse) return;
        
        this.waitingForResponse = false;
        const responseTime = timestamp;
        const reactionTime = responseTime - this.stimulusStartTime;
        
        // Check if correct button
        const correct = buttonIndex === this.currentTarget;
        
        if (correct) {
            this.correctResponses++;
            document.getElementById('correctCount').textContent = this.correctResponses;
            this.reactionTimes.push(reactionTime);
            
            // Brief flash for correct response
            await this.platform.flashLED(buttonIndex + 1, 1, 100);
        } else {
            this.incorrectResponses++;
            document.getElementById('incorrectCount').textContent = this.incorrectResponses;
            
            // Error feedback - flash the wrong button and show correct
            await this.platform.flashLED(buttonIndex + 1, 2, 100);
        }
        
        // Turn off stimulus LED
        await this.platform.setLED(this.currentTarget + 1, false);
        
        // Clear UI highlighting
        document.querySelectorAll('.button-indicator').forEach(ind => {
            ind.classList.remove('active');
            ind.querySelector('.led-circle').classList.remove('lit');
        });
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial,
            timestamp: responseTime,
            relativeTime: responseTime - this.startTime,
            button: buttonIndex,
            targetButton: this.currentTarget,
            correct: correct,
            reactionTime: reactionTime
        });
        
        // Schedule next stimulus
        this.scheduleNextStimulus();
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
        const validRTs = this.reactionTimes.filter(rt => rt > 100 && rt < 2000);
        
        const meanRT = validRTs.length > 0 
            ? validRTs.reduce((a, b) => a + b, 0) / validRTs.length 
            : 0;
        
        const sdRT = validRTs.length > 1
            ? Math.sqrt(validRTs.reduce((sum, rt) => sum + Math.pow(rt - meanRT, 2), 0) / (validRTs.length - 1))
            : 0;
        
        const totalResponses = this.correctResponses + this.incorrectResponses;
        const accuracy = totalResponses > 0 
            ? (this.correctResponses / totalResponses) * 100 
            : 0;
        
        return {
            testName: 'Choice Reaction Time',
            totalTrials: this.currentTrial,
            correctResponses: this.correctResponses,
            incorrectResponses: this.incorrectResponses,
            accuracy: accuracy.toFixed(2),
            meanReactionTime: meanRT.toFixed(2),
            sdReactionTime: sdRT.toFixed(2),
            medianReactionTime: this.calculateMedian(validRTs).toFixed(2),
            validResponses: validRTs.length
        };
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }
}
