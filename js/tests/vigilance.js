// js/tests/vigilance.js - Sustained Attention Test (Vigilance Task)

class VigilanceTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        this.targetProbability = 0.15; // 15% of stimuli are targets
        this.stimulusInterval = null;
        this.isTarget = false;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        
        this.intervalMin = 1000; // 1 second
        this.intervalMax = 3000; // 3 seconds
        this.responseWindow = 1500; // 1.5 seconds to respond
        
        this.hits = 0;
        this.misses = 0;
        this.falseAlarms = 0;
        this.correctRejections = 0;
    }

    async setupLEDPatterns() {
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="vigilance-test">
                <div class="instruction-box">
                    <h3>Press GREEN button ONLY when you see the TARGET (double flash)</h3>
                    <p>Do NOT press for single flashes</p>
                </div>
                
                <div class="stimulus-area" id="stimulusArea">
                    <div class="led-indicator">
                        <div class="led-display" id="ledDisplay"></div>
                        <div class="led-label" id="ledLabel">Waiting...</div>
                    </div>
                </div>
                
                <div class="performance-stats">
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-value" id="hitsCount">0</div>
                            <div class="stat-label">Hits</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="missesCount">0</div>
                            <div class="stat-label">Misses</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="falseAlarmsCount">0</div>
                            <div class="stat-label">False Alarms</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="correctRejectionsCount">0</div>
                            <div class="stat-label">Correct Rejections</div>
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
                .vigilance-test {
                    text-align: center;
                    padding: 20px;
                }
                
                .instruction-box {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 40px;
                }
                
                .instruction-box h3 {
                    margin: 0 0 10px 0;
                    color: #4ade80;
                    font-size: 1.4em;
                }
                
                .instruction-box p {
                    margin: 0;
                    color: #ff6b6b;
                    font-size: 1.1em;
                }
                
                .stimulus-area {
                    margin: 50px 0;
                    min-height: 200px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .led-indicator {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                }
                
                .led-display {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    border: 4px solid rgba(255,255,255,0.3);
                    transition: all 0.1s;
                }
                
                .led-display.flash {
                    background: #4ade80;
                    box-shadow: 0 0 40px #4ade80;
                    transform: scale(1.1);
                }
                
                .led-display.target {
                    background: #fbbf24;
                    box-shadow: 0 0 40px #fbbf24;
                }
                
                .led-label {
                    font-size: 1.2em;
                    color: rgba(255,255,255,0.7);
                    min-height: 30px;
                }
                
                .performance-stats {
                    margin-top: 40px;
                }
                
                .stat-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 30px;
                }
                
                .stat-item {
                    background: rgba(255,255,255,0.1);
                    padding: 15px;
                    border-radius: 10px;
                }
                
                .stat-item .stat-value {
                    font-size: 2em;
                    font-weight: bold;
                    color: #fff;
                }
                
                .stat-item .stat-label {
                    font-size: 0.9em;
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

        const interval = Math.random() * (this.intervalMax - this.intervalMin) + this.intervalMin;
        
        setTimeout(() => {
            if (this.isRunning) {
                this.presentStimulus();
            }
        }, interval);
    }

    async presentStimulus() {
        this.currentTrial++;
        document.getElementById('trialCount').textContent = this.currentTrial;
        
        // Determine if this is a target trial
        this.isTarget = Math.random() < this.targetProbability;
        
        this.stimulusStartTime = performance.now();
        this.waitingForResponse = true;
        
        const ledDisplay = document.getElementById('ledDisplay');
        const ledLabel = document.getElementById('ledLabel');
        
        if (this.isTarget) {
            // Target: Double flash (yellow)
            ledLabel.textContent = '';
            
            // First flash
            ledDisplay.classList.add('flash', 'target');
            await this.platform.setLED(1, true);
            await this.platform.delay(150);
            
            ledDisplay.classList.remove('flash', 'target');
            await this.platform.setLED(1, false);
            await this.platform.delay(100);
            
            // Second flash
            ledDisplay.classList.add('flash', 'target');
            await this.platform.setLED(1, true);
            await this.platform.delay(150);
            
            ledDisplay.classList.remove('flash', 'target');
            await this.platform.setLED(1, false);
            
        } else {
            // Non-target: Single flash (green)
            ledLabel.textContent = '';
            
            ledDisplay.classList.add('flash');
            await this.platform.setLED(1, true);
            await this.platform.delay(150);
            
            ledDisplay.classList.remove('flash');
            await this.platform.setLED(1, false);
        }
        
        // Record stimulus
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime,
            isTarget: this.isTarget
        });
        
        // Wait for response window
        setTimeout(() => {
            if (this.waitingForResponse) {
                this.handleNoResponse();
            }
        }, this.responseWindow);
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.waitingForResponse) {
            // Response outside of window
            return;
        }
        
        this.waitingForResponse = false;
        const responseTime = timestamp;
        const reactionTime = responseTime - this.stimulusStartTime;
        
        const ledLabel = document.getElementById('ledLabel');
        
        if (this.isTarget) {
            // Correct detection (Hit)
            this.hits++;
            document.getElementById('hitsCount').textContent = this.hits;
            ledLabel.textContent = 'HIT!';
            ledLabel.style.color = '#4ade80';
            
            await this.platform.flashLED(1, 1, 100);
            
        } else {
            // Incorrect detection (False Alarm)
            this.falseAlarms++;
            document.getElementById('falseAlarmsCount').textContent = this.falseAlarms;
            ledLabel.textContent = 'FALSE ALARM';
            ledLabel.style.color = '#ff6b6b';
            
            await this.platform.flashLED(2, 2, 100);
        }
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial,
            timestamp: responseTime,
            relativeTime: responseTime - this.startTime,
            button: buttonIndex,
            isTarget: this.isTarget,
            reactionTime: reactionTime,
            outcome: this.isTarget ? 'hit' : 'false_alarm'
        });
        
        // Clear label and schedule next
        setTimeout(() => {
            ledLabel.textContent = 'Waiting...';
            ledLabel.style.color = 'rgba(255,255,255,0.7)';
            this.scheduleNextStimulus();
        }, 500);
    }

    handleNoResponse() {
        this.waitingForResponse = false;
        
        const ledLabel = document.getElementById('ledLabel');
        
        if (this.isTarget) {
            // Target presented but no response (Miss)
            this.misses++;
            document.getElementById('missesCount').textContent = this.misses;
            ledLabel.textContent = 'MISS';
            ledLabel.style.color = '#ff6b6b';
            
        } else {
            // Non-target presented and no response (Correct Rejection)
            this.correctRejections++;
            document.getElementById('correctRejectionsCount').textContent = this.correctRejections;
            // Don't show feedback for correct rejections (silent)
        }
        
        // Record non-response
        this.testData.push({
            type: 'no_response',
            trial: this.currentTrial,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            isTarget: this.isTarget,
            outcome: this.isTarget ? 'miss' : 'correct_rejection'
        });
        
        setTimeout(() => {
            ledLabel.textContent = 'Waiting...';
            ledLabel.style.color = 'rgba(255,255,255,0.7)';
            this.scheduleNextStimulus();
        }, 500);
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
        const totalTargets = this.hits + this.misses;
        const totalNonTargets = this.falseAlarms + this.correctRejections;
        
        const hitRate = totalTargets > 0 ? this.hits / totalTargets : 0;
        const falseAlarmRate = totalNonTargets > 0 ? this.falseAlarms / totalNonTargets : 0;
        
        // Calculate d' (sensitivity)
        const zHit = this.zScore(hitRate);
        const zFA = this.zScore(falseAlarmRate);
        const dPrime = zHit - zFA;
        
        // Calculate criterion (c)
        const criterion = -0.5 * (zHit + zFA);
        
        return {
            testName: 'Sustained Attention (Vigilance)',
            totalTrials: this.currentTrial,
            hits: this.hits,
            misses: this.misses,
            falseAlarms: this.falseAlarms,
            correctRejections: this.correctRejections,
            hitRate: (hitRate * 100).toFixed(2),
            falseAlarmRate: (falseAlarmRate * 100).toFixed(2),
            dPrime: dPrime.toFixed(3),
            criterion: criterion.toFixed(3),
            sensitivity: dPrime.toFixed(3)
        };
    }

    zScore(p) {
        // Convert proportion to z-score
        // Adjust extreme values to avoid infinity
        if (p >= 0.9999) p = 0.9999;
        if (p <= 0.0001) p = 0.0001;
        
        // Approximation of inverse normal CDF
        const t = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
        const c = [2.515517, 0.802853, 0.010328];
        const d = [1.432788, 0.189269, 0.001308];
        
        const z = t - ((c[0] + c[1] * t + c[2] * t * t) / 
                       (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t));
        
        return p < 0.5 ? -z : z;
    }
}
