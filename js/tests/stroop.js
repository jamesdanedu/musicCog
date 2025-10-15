// js/tests/stroop.js - Stroop Test for Selective Attention and Cognitive Control

class StroopTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        // Color-word mappings to buttons
        this.colorMappings = [
            { 
                name: 'GREEN', 
                rgb: '#4ade80', 
                buttonIndex: 0, 
                buttonName: 'Green Button 1',
                ledColor: 'green'
            },
            { 
                name: 'WHITE', 
                rgb: '#ffffff', 
                buttonIndex: 1, 
                buttonName: 'White Button',
                ledColor: 'white'
            },
            { 
                name: 'RED', 
                rgb: '#ff6b6b', 
                buttonIndex: 2, 
                buttonName: 'Red Button',
                ledColor: 'red'
            },
            { 
                name: 'GREEN', 
                rgb: '#22c55e', 
                buttonIndex: 3, 
                buttonName: 'Green Button 2',
                ledColor: 'green2'
            }
        ];
        
        // Trial types
        this.trialTypes = {
            congruent: 'congruent',     // Word matches ink color
            incongruent: 'incongruent', // Word conflicts with ink color
            neutral: 'neutral'          // Neutral stimulus (colored shape)
        };
        
        this.currentTrial = null;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        
        // Timing
        this.stimulusDuration = 3000; // 3 seconds to respond
        this.minInterval = 800;
        this.maxInterval = 1500;
        
        // Performance tracking by condition
        this.congruentCorrect = 0;
        this.congruentIncorrect = 0;
        this.congruentRTs = [];
        
        this.incongruentCorrect = 0;
        this.incongruentIncorrect = 0;
        this.incongruentRTs = [];
        
        this.neutralCorrect = 0;
        this.neutralIncorrect = 0;
        this.neutralRTs = [];
        
        // Trial distribution (equal)
        this.trialTypeDistribution = [
            this.trialTypes.congruent,
            this.trialTypes.incongruent,
            this.trialTypes.neutral
        ];
    }

    async setupLEDPatterns() {
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="stroop-test">
                <div class="instruction-box">
                    <h3>Stroop Test - Selective Attention</h3>
                    <p class="main-instruction">Press the button that matches the <strong>COLOR OF THE INK</strong>, NOT the word itself!</p>
                    
                    <div class="button-guide">
                        <div class="button-guide-item">
                            <div class="guide-led green"></div>
                            <span>Button 1: Green</span>
                        </div>
                        <div class="button-guide-item">
                            <div class="guide-led white"></div>
                            <span>Button 2: White</span>
                        </div>
                        <div class="button-guide-item">
                            <div class="guide-led red"></div>
                            <span>Button 3: Red</span>
                        </div>
                        <div class="button-guide-item">
                            <div class="guide-led green2"></div>
                            <span>Button 4: Green</span>
                        </div>
                    </div>
                </div>
                
                <div class="stimulus-display" id="stimulusDisplay">
                    <div class="stroop-word" id="stroopWord"></div>
                    <div class="condition-label" id="conditionLabel"></div>
                </div>
                
                <div class="feedback-display" id="feedbackDisplay"></div>
                
                <div class="performance-stats">
                    <div class="condition-stats">
                        <div class="stat-group congruent-group">
                            <h4>Congruent Trials</h4>
                            <p class="description">Word matches ink color</p>
                            <div class="stat-items">
                                <div class="stat-item">
                                    <div class="stat-value" id="congruentCorrect">0</div>
                                    <div class="stat-label">Correct</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="congruentAccuracy">0%</div>
                                    <div class="stat-label">Accuracy</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="congruentAvgRT">0</div>
                                    <div class="stat-label">Avg RT (ms)</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-group incongruent-group">
                            <h4>Incongruent Trials</h4>
                            <p class="description">Word conflicts with ink color</p>
                            <div class="stat-items">
                                <div class="stat-item">
                                    <div class="stat-value" id="incongruentCorrect">0</div>
                                    <div class="stat-label">Correct</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="incongruentAccuracy">0%</div>
                                    <div class="stat-label">Accuracy</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="incongruentAvgRT">0</div>
                                    <div class="stat-label">Avg RT (ms)</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="stat-group neutral-group">
                            <h4>Neutral Trials</h4>
                            <p class="description">Colored shapes (baseline)</p>
                            <div class="stat-items">
                                <div class="stat-item">
                                    <div class="stat-value" id="neutralCorrect">0</div>
                                    <div class="stat-label">Correct</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="neutralAccuracy">0%</div>
                                    <div class="stat-label">Accuracy</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" id="neutralAvgRT">0</div>
                                    <div class="stat-label">Avg RT (ms)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="interference-effect">
                        <h4>Stroop Effect</h4>
                        <div class="effect-stats">
                            <div class="stat-item large">
                                <div class="stat-value" id="stroopEffect">0</div>
                                <div class="stat-label">Interference (ms)</div>
                            </div>
                            <div class="stat-item large">
                                <div class="stat-value" id="interferencePercent">0%</div>
                                <div class="stat-label">RT Increase</div>
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
                .stroop-test {
                    text-align: center;
                    padding: 20px;
                }
                
                .instruction-box {
                    background: rgba(255,255,255,0.1);
                    padding: 25px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                }
                
                .instruction-box h3 {
                    margin: 0 0 15px 0;
                    color: #fff;
                    font-size: 1.6em;
                }
                
                .main-instruction {
                    font-size: 1.3em;
                    margin: 15px 0;
                    color: #fbbf24;
                }
                
                .main-instruction strong {
                    color: #fff;
                    text-decoration: underline;
                }
                
                .button-guide {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }
                
                .button-guide-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0,0,0,0.2);
                    padding: 10px 15px;
                    border-radius: 8px;
                }
                
                .guide-led {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.3);
                }
                
                .guide-led.green { background: #4ade80; }
                .guide-led.white { background: #ffffff; }
                .guide-led.red { background: #ff6b6b; }
                .guide-led.green2 { background: #22c55e; }
                
                .stimulus-display {
                    margin: 60px 0;
                    min-height: 250px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                
                .stroop-word {
                    font-size: 6em;
                    font-weight: bold;
                    min-height: 150px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-transform: uppercase;
                    letter-spacing: 5px;
                    transition: all 0.2s;
                    text-shadow: 0 0 20px currentColor;
                }
                
                .condition-label {
                    margin-top: 20px;
                    font-size: 1.1em;
                    color: rgba(255,255,255,0.5);
                    font-style: italic;
                }
                
                .feedback-display {
                    min-height: 60px;
                    font-size: 1.6em;
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
                
                .condition-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .stat-group {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                }
                
                .stat-group h4 {
                    margin: 0 0 5px 0;
                    color: #fff;
                    font-size: 1.2em;
                }
                
                .stat-group .description {
                    margin: 0 0 15px 0;
                    font-size: 0.9em;
                    color: rgba(255,255,255,0.6);
                }
                
                .congruent-group {
                    border-top: 3px solid #4ade80;
                }
                
                .incongruent-group {
                    border-top: 3px solid #ff6b6b;
                }
                
                .neutral-group {
                    border-top: 3px solid #ffffff;
                }
                
                .stat-items {
                    display: flex;
                    justify-content: space-around;
                    gap: 10px;
                }
                
                .stat-item {
                    text-align: center;
                }
                
                .stat-item .stat-value {
                    font-size: 1.6em;
                    font-weight: bold;
                    color: #fff;
                }
                
                .stat-item.large .stat-value {
                    font-size: 2.5em;
                }
                
                .stat-item .stat-label {
                    font-size: 0.85em;
                    color: rgba(255,255,255,0.7);
                    margin-top: 5px;
                }
                
                .interference-effect {
                    background: rgba(255,185,36,0.15);
                    padding: 25px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    border: 2px solid #fbbf24;
                }
                
                .interference-effect h4 {
                    margin: 0 0 20px 0;
                    color: #fbbf24;
                    font-size: 1.4em;
                }
                
                .effect-stats {
                    display: flex;
                    justify-content: center;
                    gap: 50px;
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
        await this.platform.delay(2000);
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
        
        // Randomly select trial type
        const trialType = this.trialTypeDistribution[
            Math.floor(Math.random() * this.trialTypeDistribution.length)
        ];
        
        // Generate stimulus based on trial type
        let word, inkColor, correctButton;
        
        if (trialType === this.trialTypes.congruent) {
            // Word matches ink color
            const color = this.colorMappings[Math.floor(Math.random() * this.colorMappings.length)];
            word = color.name;
            inkColor = color.rgb;
            correctButton = color.buttonIndex;
            
        } else if (trialType === this.trialTypes.incongruent) {
            // Word conflicts with ink color
            const wordColor = this.colorMappings[Math.floor(Math.random() * this.colorMappings.length)];
            let inkColorObj;
            do {
                inkColorObj = this.colorMappings[Math.floor(Math.random() * this.colorMappings.length)];
            } while (inkColorObj.buttonIndex === wordColor.buttonIndex);
            
            word = wordColor.name;
            inkColor = inkColorObj.rgb;
            correctButton = inkColorObj.buttonIndex;
            
        } else {
            // Neutral - show colored shape (XXXX)
            const color = this.colorMappings[Math.floor(Math.random() * this.colorMappings.length)];
            word = '████';
            inkColor = color.rgb;
            correctButton = color.buttonIndex;
        }
        
        this.currentTrial = {
            trialNumber: this.currentTrial,
            type: trialType,
            word: word,
            inkColor: inkColor,
            correctButton: correctButton
        };
        
        this.stimulusStartTime = performance.now();
        this.waitingForResponse = true;
        
        // Display stimulus
        const stroopWord = document.getElementById('stroopWord');
        const conditionLabel = document.getElementById('conditionLabel');
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        
        stroopWord.textContent = word;
        stroopWord.style.color = inkColor;
        conditionLabel.textContent = `(${trialType})`;
        feedbackDisplay.textContent = '';
        feedbackDisplay.className = 'feedback-display';
        
        // Light up correct button LED as visual cue
        await this.platform.setLED(correctButton + 1, true);
        
        // Record stimulus
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial.trialNumber,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime,
            trialType: trialType,
            word: word,
            inkColorRGB: inkColor,
            correctButton: correctButton
        });
        
        // Timeout if no response
        setTimeout(() => {
            if (this.waitingForResponse) {
                this.handleTimeout();
            }
        }, this.stimulusDuration);
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.waitingForResponse) return;
        
        this.waitingForResponse = false;
        const responseTime = timestamp;
        const reactionTime = responseTime - this.stimulusStartTime;
        
        const correct = buttonIndex === this.currentTrial.correctButton;
        
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        
        // Turn off LED
        await this.platform.setLED(this.currentTrial.correctButton + 1, false);
        
        if (correct) {
            feedbackDisplay.textContent = `✓ Correct! ${reactionTime.toFixed(0)}ms`;
            feedbackDisplay.className = 'feedback-display correct';
            await this.platform.flashLED(buttonIndex + 1, 1, 100);
            
            // Record by condition
            if (this.currentTrial.type === this.trialTypes.congruent) {
                this.congruentCorrect++;
                this.congruentRTs.push(reactionTime);
            } else if (this.currentTrial.type === this.trialTypes.incongruent) {
                this.incongruentCorrect++;
                this.incongruentRTs.push(reactionTime);
            } else {
                this.neutralCorrect++;
                this.neutralRTs.push(reactionTime);
            }
            
        } else {
            feedbackDisplay.textContent = '✗ Wrong button!';
            feedbackDisplay.className = 'feedback-display incorrect';
            await this.platform.flashLED(2, 2, 100); // Red LED flash
            
            // Record by condition
            if (this.currentTrial.type === this.trialTypes.congruent) {
                this.congruentIncorrect++;
            } else if (this.currentTrial.type === this.trialTypes.incongruent) {
                this.incongruentIncorrect++;
            } else {
                this.neutralIncorrect++;
            }
        }
        
        // Update statistics
        this.updateStatistics();
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial.trialNumber,
            timestamp: responseTime,
            relativeTime: responseTime - this.startTime,
            button: buttonIndex,
            trialType: this.currentTrial.type,
            correct: correct,
            reactionTime: reactionTime
        });
        
        // Clear and continue
        setTimeout(() => {
            document.getElementById('stroopWord').textContent = '';
            document.getElementById('conditionLabel').textContent = '';
            feedbackDisplay.textContent = '';
            this.scheduleNextStimulus();
        }, 1000);
    }

    async handleTimeout() {
        this.waitingForResponse = false;
        
        const feedbackDisplay = document.getElementById('feedbackDisplay');
        feedbackDisplay.textContent = '✗ Too slow!';
        feedbackDisplay.className = 'feedback-display incorrect';
        
        // Turn off LED
        await this.platform.setLED(this.currentTrial.correctButton + 1, false);
        
        // Count as incorrect for the condition
        if (this.currentTrial.type === this.trialTypes.congruent) {
            this.congruentIncorrect++;
        } else if (this.currentTrial.type === this.trialTypes.incongruent) {
            this.incongruentIncorrect++;
        } else {
            this.neutralIncorrect++;
        }
        
        this.updateStatistics();
        
        // Record timeout
        this.testData.push({
            type: 'timeout',
            trial: this.currentTrial.trialNumber,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            trialType: this.currentTrial.type
        });
        
        setTimeout(() => {
            document.getElementById('stroopWord').textContent = '';
            document.getElementById('conditionLabel').textContent = '';
            feedbackDisplay.textContent = '';
            this.scheduleNextStimulus();
        }, 1000);
    }

    updateStatistics() {
        // Congruent stats
        const congruentTotal = this.congruentCorrect + this.congruentIncorrect;
        if (congruentTotal > 0) {
            document.getElementById('congruentCorrect').textContent = this.congruentCorrect;
            const acc = (this.congruentCorrect / congruentTotal) * 100;
            document.getElementById('congruentAccuracy').textContent = acc.toFixed(1) + '%';
        }
        if (this.congruentRTs.length > 0) {
            const avg = this.congruentRTs.reduce((a, b) => a + b, 0) / this.congruentRTs.length;
            document.getElementById('congruentAvgRT').textContent = avg.toFixed(0);
        }
        
        // Incongruent stats
        const incongruentTotal = this.incongruentCorrect + this.incongruentIncorrect;
        if (incongruentTotal > 0) {
            document.getElementById('incongruentCorrect').textContent = this.incongruentCorrect;
            const acc = (this.incongruentCorrect / incongruentTotal) * 100;
            document.getElementById('incongruentAccuracy').textContent = acc.toFixed(1) + '%';
        }
        if (this.incongruentRTs.length > 0) {
            const avg = this.incongruentRTs.reduce((a, b) => a + b, 0) / this.incongruentRTs.length;
            document.getElementById('incongruentAvgRT').textContent = avg.toFixed(0);
        }
        
        // Neutral stats
        const neutralTotal = this.neutralCorrect + this.neutralIncorrect;
        if (neutralTotal > 0) {
            document.getElementById('neutralCorrect').textContent = this.neutralCorrect;
            const acc = (this.neutralCorrect / neutralTotal) * 100;
            document.getElementById('neutralAccuracy').textContent = acc.toFixed(1) + '%';
        }
        if (this.neutralRTs.length > 0) {
            const avg = this.neutralRTs.reduce((a, b) => a + b, 0) / this.neutralRTs.length;
            document.getElementById('neutralAvgRT').textContent = avg.toFixed(0);
        }
        
        // Calculate Stroop effect
        if (this.incongruentRTs.length > 0 && this.congruentRTs.length > 0) {
            const incongruentAvg = this.incongruentRTs.reduce((a, b) => a + b, 0) / this.incongruentRTs.length;
            const congruentAvg = this.congruentRTs.reduce((a, b) => a + b, 0) / this.congruentRTs.length;
            const stroopEffect = incongruentAvg - congruentAvg;
            const percentIncrease = (stroopEffect / congruentAvg) * 100;
            
            document.getElementById('stroopEffect').textContent = stroopEffect.toFixed(0);
            document.getElementById('interferencePercent').textContent = percentIncrease.toFixed(1) + '%';
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
        const congruentTotal = this.congruentCorrect + this.congruentIncorrect;
        const incongruentTotal = this.incongruentCorrect + this.incongruentIncorrect;
        const neutralTotal = this.neutralCorrect + this.neutralIncorrect;
        
        const congruentAccuracy = congruentTotal > 0 ? (this.congruentCorrect / congruentTotal) * 100 : 0;
        const incongruentAccuracy = incongruentTotal > 0 ? (this.incongruentCorrect / incongruentTotal) * 100 : 0;
        const neutralAccuracy = neutralTotal > 0 ? (this.neutralCorrect / neutralTotal) * 100 : 0;
        
        const congruentAvgRT = this.congruentRTs.length > 0 
            ? this.congruentRTs.reduce((a, b) => a + b, 0) / this.congruentRTs.length 
            : 0;
        const incongruentAvgRT = this.incongruentRTs.length > 0 
            ? this.incongruentRTs.reduce((a, b) => a + b, 0) / this.incongruentRTs.length 
            : 0;
        const neutralAvgRT = this.neutralRTs.length > 0 
            ? this.neutralRTs.reduce((a, b) => a + b, 0) / this.neutralRTs.length 
            : 0;
        
        // Calculate Stroop interference effect
        const stroopEffect = incongruentAvgRT - congruentAvgRT;
        const facilitationEffect = neutralAvgRT - congruentAvgRT;
        const interferencePercent = congruentAvgRT > 0 ? (stroopEffect / congruentAvgRT) * 100 : 0;
        
        return {
            testName: 'Stroop Test',
            totalTrials: this.currentTrial,
            congruentTrials: congruentTotal,
            incongruentTrials: incongruentTotal,
            neutralTrials: neutralTotal,
            congruentAccuracy: congruentAccuracy.toFixed(2),
            incongruentAccuracy: incongruentAccuracy.toFixed(2),
            neutralAccuracy: neutralAccuracy.toFixed(2),
            congruentAvgRT: congruentAvgRT.toFixed(2),
            incongruentAvgRT: incongruentAvgRT.toFixed(2),
            neutralAvgRT: neutralAvgRT.toFixed(2),
            stroopEffect: stroopEffect.toFixed(2),
            facilitationEffect: facilitationEffect.toFixed(2),
            interferencePercent: interferencePercent.toFixed(2),
            cognitiveControl: (100 - interferencePercent).toFixed(2)
        };
    }
}
