// js/tests/go-nogo.js - Go/No-Go Response Inhibition Test

class GoNoGoTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        // Go/No-Go stimulus types
        this.stimulusTypes = {
            go: { 
                name: 'GO', 
                color: 'green', 
                ledIndex: 0, // Green button
                rgb: '#4ade80',
                shouldRespond: true 
            },
            nogo: { 
                name: 'NO-GO', 
                color: 'red', 
                ledIndex: 2, // Red button  
                rgb: '#ff6b6b',
                shouldRespond: false 
            }
        };
        
        this.currentStimulusType = null;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        
        // Timing parameters
        this.stimulusDuration = 1000; // Show stimulus for 1 second
        this.minInterval = 1500;
        this.maxInterval = 3000;
        this.responseWindow = 1000; // 1 second to respond
        
        // Go trial probability (typically 70-80% to create prepotent response)
        this.goTrialProbability = 0.75; // 75% go trials
        
        // Performance tracking
        this.goHits = 0;          // Correct responses to GO
        this.goMisses = 0;        // Missed GO trials
        this.nogoHits = 0;        // Correct inhibitions (no response to NO-GO)
        this.nogoFalseAlarms = 0; // Incorrect responses to NO-GO
        this.goReactionTimes = [];
    }

    async setupLEDPatterns() {
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="gonogo-test">
                <div class="instruction-box">
                    <h3>Go/No-Go Task</h3>
                    <div class="instructions">
                        <div class="instruction-item go-instruction">
                            <div class="led-example green"></div>
                            <div class="text">
                                <strong>GREEN = GO</strong>
                                <p>Press GREEN button as fast as possible</p>
                            </div>
                        </div>
                        <div class="instruction-item nogo-instruction">
                            <div class="led-example red"></div>
                            <div class="text">
                                <strong>RED = NO-GO</strong>
                                <p>DO NOT press any button!</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stimulus-display" id="stimulusDisplay">
                    <div class="stimulus-circle" id="stimulusCircle">
                        <div class="fixation">+</div>
                    </div>
                    <div class="stimulus-label" id="stimulusLabel"></div>
                </div>
                
                <div class="feedback-display" id="feedbackDisplay"></div>
                
                <div class="performance-stats">
                    <div class="stat-row">
                        <div class="stat-group go-stats">
                            <h4>GO Trials</h4>
                            <div class="stat-items">
                                <div class="stat-item">
                                    <div class="stat-value" id="goHitsCount">0</div>
                                    <div class="stat-label">Correct</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="goMissesCount">0</div>
                                    <div class="stat-label">Missed</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="goAccuracy">0%</div>
                                    <div class="stat-label">Accuracy</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="goAvgRT">0</div>
                                    <div class="stat-label">Avg RT (ms)</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-group nogo-stats">
                            <h4>NO-GO Trials</h4>
                            <div class="stat-items">
                                <div class="stat-item">
                                    <div class="stat-value" id="nogoHitsCount">0</div>
                                    <div class="stat-label">Correct</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="nogoFalseAlarmsCount">0</div>
                                    <div class="stat-label">Errors</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="nogoAccuracy">0%</div>
                                    <div class="stat-label">Inhibition</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="progress-info">
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
            </div>
            
            <style>
                .gonogo-test {
                    text-align: center;
                    padding: 20px;
                }
                
                .instruction-box {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                }
                
                .instruction-box h3 {
                    margin: 0 0 20px 0;
                    color: #fff;
                    font-size: 1.6em;
                }
                
                .instructions {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    flex-wrap: wrap;
                }
                
                .instruction-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    background: rgba(0,0,0,0.2);
                    padding: 15px 25px;
                    border-radius: 10px;
                    min-width: 300px;
                }
                
                .go-instruction {
                    border: 2px solid #4ade80;
                }
                
                .nogo-instruction {
                    border: 2px solid #ff6b6b;
                }
                
                .led-example {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 3px solid rgba(255,255,255,0.3);
                    flex-shrink: 0;
                }
                
                .led-example.green {
                    background: #4ade80;
                    box-shadow: 0 0 20px #4ade80;
                }
                
                .led-example.red {
                    background: #ff6b6b;
                    box-shadow: 0 0 20px #ff6b6b;
                }
                
                .instruction-item .text {
                    text-align: left;
                }
                
                .instruction-item strong {
                    font-size: 1.2em;
                    display: block;
                    margin-bottom: 5px;
                }
                
                .instruction-item p {
                    margin: 0;
                    color: rgba(255,255,255,0.8);
                }
                
                .stimulus-display {
                    margin: 50px 0;
                    min-height: 250px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                
                .stimulus-circle {
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    border: 4px solid rgba(255,255,255,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                    background: rgba(255,255,255,0.05);
                }
                
                .stimulus-circle .fixation {
                    font-size: 60px;
                    color: rgba(255,255,255,0.4);
                }
                
                .stimulus-circle.go {
                    background: #4ade80;
                    border-color: #4ade80;
                    box-shadow: 0 0 60px #4ade80;
                    transform: scale(1.1);
                }
                
                .stimulus-circle.nogo {
                    background: #ff6b6b;
                    border-color: #ff6b6b;
                    box-shadow: 0 0 60px #ff6b6b;
                    transform: scale(1.1);
                }
                
                .stimulus-circle.go .fixation,
                .stimulus-circle.nogo .fixation {
                    display: none;
                }
                
                .stimulus-label {
                    margin-top: 20px;
                    font-size: 1.8em;
                    font-weight: bold;
                    min-height: 40px;
                    color: #fff;
                }
                
                .feedback-display {
                    min-height: 50px;
                    font-size: 1.4em;
                    font-weight: bold;
                    margin: 20px 0;
                }
                
                .feedback-display.correct {
                    color: #4ade80;
                }
                
                .feedback-display.incorrect {
                    color: #ff6b6b;
                }
                
                .performance-stats {
                    margin-top: 40px;
                }
                
                .stat-row {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                }
                
                .stat-group {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    min-width: 350px;
                }
                
                .stat-group h4 {
                    margin: 0 0 15px 0;
                    color: #fff;
                    font-size: 1.2em;
                }
                
                .go-stats {
                    border-top: 3px solid #4ade80;
                }
                
                .nogo-stats {
                    border-top: 3px solid #ff6b6b;
                }
                
                .stat-items {
                    display: flex;
                    justify-content: space-around;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                
                .stat-item {
                    text-align: center;
                }
                
                .stat-item .stat-value {
                    font-size: 1.8em;
                    font-weight: bold;
                    color: #fff;
                }
                
                .stat-item .stat-label {
                    font-size: 0.85em;
                    color: rgba(255,255,255,0.7);
                    margin-top: 5px;
                }
                
                .progress-info {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                }
                
                .progress-info .stat {
                    background: rgba(255,255,255,0.1);
                    padding: 10px 20px;
                    border-radius: 8px;
                }
                
                .progress-info .stat-label {
                    color: rgba(255,255,255,0.7);
                    margin-right: 8px;
                }
                
                .progress-info .stat-value {
                    color: #fff;
                    font-weight: bold;
                    font-size: 1.2em;
                }
            </style>
        `;

        this.updateTimer();
        await this.platform.delay(2000); // Initial delay
        this.scheduleNextStimulus();
    }

    scheduleNextStimulus() {
        if (!this.isRunning) return;
        
        const timeElapsed = Date.now() - this.startTime;
        if (timeElapsed >= this.config.duration) {
            this.complete();
            return;
        }

        const interval = Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
        
        setTimeout(() => {
            if (this.isRunning) {
                this.presentStimulus();
            }
        }, interval);
    }

    async presentStimulus() {
        this.currentTrial++;
        document.getElementById('trialCount').textContent = this.currentTrial;
        
        // Determine trial type (Go or No-Go)
        const isGoTrial = Math.random() < this.goTrialProbability;
        this.currentStimulusType = isGoTrial ? this.stimulusTypes.go : this.stimulusTypes.nogo;
        
        this.stimulusStartTime = performance.now();
        this.waitingForResponse = true;
        
        const stimulusCircle = document.getElementById('stimulusCircle');
        const stimulusLabel = document.getElementById('stimulusLabel');
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        
        // Clear previous feedback
        feedbackDisplay.textContent = '';
        feedbackDisplay.className = 'feedback-display';
        
        // Show stimulus
        stimulusCircle.classList.add(this.currentStimulusType.color);
        stimulusLabel.textContent = this.currentStimulusType.name;
        stimulusLabel.style.color = this.currentStimulusType.rgb;
        
        // Light up corresponding LED
        await this.platform.setLED(this.currentStimulusType.ledIndex + 1, true);
        
        // Record stimulus
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime,
            stimulusType: this.currentStimulusType.name,
            shouldRespond: this.currentStimulusType.shouldRespond
        });
        
        // Hide stimulus after duration
        setTimeout(async () => {
            stimulusCircle.classList.remove(this.currentStimulusType.color);
            stimulusLabel.textContent = '';
            await this.platform.setLED(this.currentStimulusType.ledIndex + 1, false);
        }, this.stimulusDuration);
        
        // Check for response after response window
        setTimeout(() => {
            if (this.waitingForResponse) {
                this.handleNoResponse();
            }
        }, this.responseWindow);
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.waitingForResponse) return;
        
        this.waitingForResponse = false;
        const responseTime = timestamp;
        const reactionTime = responseTime - this.stimulusStartTime;
        
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        
        if (this.currentStimulusType.shouldRespond) {
            // GO trial - response is correct
            this.goHits++;
            this.goReactionTimes.push(reactionTime);
            document.getElementById('goHitsCount').textContent = this.goHits;
            
            feedbackDisplay.textContent = `✓ Correct! ${reactionTime.toFixed(0)}ms`;
            feedbackDisplay.className = 'feedback-display correct';
            
            // Positive feedback
            await this.platform.flashLED(buttonIndex + 1, 1, 100);
            
        } else {
            // NO-GO trial - response is incorrect (commission error)
            this.nogoFalseAlarms++;
            document.getElementById('nogoFalseAlarmsCount').textContent = this.nogoFalseAlarms;
            
            feedbackDisplay.textContent = '✗ Error! Should NOT have pressed!';
            feedbackDisplay.className = 'feedback-display incorrect';
            
            // Error feedback
            await this.platform.flashLED(2, 3, 100); // Flash red LED
        }
        
        // Update statistics
        this.updateStatistics();
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial,
            timestamp: responseTime,
            relativeTime: responseTime - this.startTime,
            button: buttonIndex,
            stimulusType: this.currentStimulusType.name,
            shouldRespond: this.currentStimulusType.shouldRespond,
            reactionTime: reactionTime,
            outcome: this.currentStimulusType.shouldRespond ? 'go_hit' : 'nogo_false_alarm'
        });
        
        // Clear feedback and schedule next
        setTimeout(() => {
            feedbackDisplay.textContent = '';
            feedbackDisplay.className = 'feedback-display';
            this.scheduleNextStimulus();
        }, 800);
    }

    handleNoResponse() {
        this.waitingForResponse = false;
        
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        
        if (this.currentStimulusType.shouldRespond) {
            // GO trial - no response is incorrect (omission error)
            this.goMisses++;
            document.getElementById('goMissesCount').textContent = this.goMisses;
            
            feedbackDisplay.textContent = '✗ Too slow! Should have pressed!';
            feedbackDisplay.className = 'feedback-display incorrect';
            
        } else {
            // NO-GO trial - no response is correct
            this.nogoHits++;
            document.getElementById('nogoHitsCount').textContent = this.nogoHits;
            
            feedbackDisplay.textContent = '✓ Correct inhibition!';
            feedbackDisplay.className = 'feedback-display correct';
        }
        
        // Update statistics
        this.updateStatistics();
        
        // Record no response
        this.testData.push({
            type: 'no_response',
            trial: this.currentTrial,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            stimulusType: this.currentStimulusType.name,
            shouldRespond: this.currentStimulusType.shouldRespond,
            outcome: this.currentStimulusType.shouldRespond ? 'go_miss' : 'nogo_hit'
        });
        
        // Clear feedback and schedule next
        setTimeout(() => {
            feedbackDisplay.textContent = '';
            feedbackDisplay.className = 'feedback-display';
            this.scheduleNextStimulus();
        }, 800);
    }

    updateStatistics() {
        // GO trial statistics
        const totalGoTrials = this.goHits + this.goMisses;
        if (totalGoTrials > 0) {
            const goAccuracy = (this.goHits / totalGoTrials) * 100;
            document.getElementById('goAccuracy').textContent = goAccuracy.toFixed(1) + '%';
        }
        
        if (this.goReactionTimes.length > 0) {
            const avgRT = this.goReactionTimes.reduce((a, b) => a + b, 0) / this.goReactionTimes.length;
            document.getElementById('goAvgRT').textContent = avgRT.toFixed(0);
        }
        
        // NO-GO trial statistics
        const totalNoGoTrials = this.nogoHits + this.nogoFalseAlarms;
        if (totalNoGoTrials > 0) {
            const nogoAccuracy = (this.nogoHits / totalNoGoTrials) * 100;
            document.getElementById('nogoAccuracy').textContent = nogoAccuracy.toFixed(1) + '%';
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
        const totalGoTrials = this.goHits + this.goMisses;
        const totalNoGoTrials = this.nogoHits + this.nogoFalseAlarms;
        
        const goAccuracy = totalGoTrials > 0 ? (this.goHits / totalGoTrials) * 100 : 0;
        const nogoAccuracy = totalNoGoTrials > 0 ? (this.nogoHits / totalNoGoTrials) * 100 : 0;
        
        const avgGoRT = this.goReactionTimes.length > 0 
            ? this.goReactionTimes.reduce((a, b) => a + b, 0) / this.goReactionTimes.length 
            : 0;
        
        const sdGoRT = this.goReactionTimes.length > 1
            ? Math.sqrt(this.goReactionTimes.reduce((sum, rt) => {
                return sum + Math.pow(rt - avgGoRT, 2);
            }, 0) / (this.goReactionTimes.length - 1))
            : 0;
        
        // Commission error rate (false alarms on NO-GO trials)
        const commissionErrorRate = totalNoGoTrials > 0 
            ? (this.nogoFalseAlarms / totalNoGoTrials) * 100 
            : 0;
        
        // Omission error rate (misses on GO trials)
        const omissionErrorRate = totalGoTrials > 0 
            ? (this.goMisses / totalGoTrials) * 100 
            : 0;
        
        // Overall accuracy
        const totalTrials = totalGoTrials + totalNoGoTrials;
        const correctResponses = this.goHits + this.nogoHits;
        const overallAccuracy = totalTrials > 0 ? (correctResponses / totalTrials) * 100 : 0;
        
        return {
            testName: 'Go/No-Go Task',
            totalTrials: this.currentTrial,
            goTrials: totalGoTrials,
            nogoTrials: totalNoGoTrials,
            goHits: this.goHits,
            goMisses: this.goMisses,
            nogoHits: this.nogoHits,
            nogoFalseAlarms: this.nogoFalseAlarms,
            goAccuracy: goAccuracy.toFixed(2),
            nogoAccuracy: nogoAccuracy.toFixed(2),
            overallAccuracy: overallAccuracy.toFixed(2),
            commissionErrorRate: commissionErrorRate.toFixed(2),
            omissionErrorRate: omissionErrorRate.toFixed(2),
            avgGoReactionTime: avgGoRT.toFixed(2),
            sdGoReactionTime: sdGoRT.toFixed(2),
            inhibitionControl: nogoAccuracy.toFixed(2)
        };
    }
}
