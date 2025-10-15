// js/tests/n-back.js - N-Back Working Memory Test

class NBackTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        this.nBack = 2; // 2-back task
        this.stimulusSequence = [];
        this.responseHistory = [];
        this.currentStimulus = null;
        this.stimulusStartTime = null;
        this.waitingForResponse = false;
        
        this.stimulusDuration = 500; // Show stimulus for 500ms
        this.interStimulusInterval = 2000; // 2 seconds between stimuli
        
        // Use button numbers as stimuli (0, 1, 2, 3)
        this.stimuliSet = [0, 1, 2, 3];
        
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
            <div class="nback-test">
                <div class="instruction-box">
                    <h3>${this.nBack}-Back Working Memory Task</h3>
                    <p>Press GREEN button if the current LED matches the one from ${this.nBack} positions back</p>
                </div>
                
                <div class="button-reference">
                    <div class="button-ref" data-button="0">
                        <div class="led-circle green"></div>
                        <span>Button 1</span>
                    </div>
                    <div class="button-ref" data-button="1">
                        <div class="led-circle white"></div>
                        <span>Button 2</span>
                    </div>
                    <div class="button-ref" data-button="2">
                        <div class="led-circle red"></div>
                        <span>Button 3</span>
                    </div>
                    <div class="button-ref" data-button="3">
                        <div class="led-circle green2"></div>
                        <span>Button 4</span>
                    </div>
                </div>
                
                <div class="stimulus-display" id="stimulusDisplay">
                    <div class="current-stimulus" id="currentStimulus"></div>
                    <div class="sequence-history" id="sequenceHistory"></div>
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
                            <div class="stat-value" id="accuracyPercent">0%</div>
                            <div class="stat-label">Accuracy</div>
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
                .nback-test {
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
                    margin: 0 0 10px 0;
                    color: #fff;
                    font-size: 1.4em;
                }
                
                .instruction-box p {
                    margin: 0;
                    color: rgba(255,255,255,0.8);
                    font-size: 1.1em;
                }
                
                .button-reference {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .button-ref {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                }
                
                .button-ref .led-circle {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.3);
                }
                
                .led-circle.green { background-color: #4ade80; }
                .led-circle.white { background-color: #ffffff; }
                .led-circle.red { background-color: #ff6b6b; }
                .led-circle.green2 { background-color: #22c55e; }
                
                .button-ref span {
                    font-size: 0.85em;
                    color: rgba(255,255,255,0.7);
                }
                
                .stimulus-display {
                    margin: 40px 0;
                    min-height: 200px;
                }
                
                .current-stimulus {
                    width: 150px;
                    height: 150px;
                    margin: 0 auto 20px;
                    border-radius: 50%;
                    border: 4px solid rgba(255,255,255,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3em;
                    font-weight: bold;
                    transition: all 0.2s;
                    background: rgba(255,255,255,0.05);
                }
                
                .current-stimulus.active {
                    transform: scale(1.1);
                    box-shadow: 0 0 40px rgba(255,255,255,0.5);
                }
                
                .sequence-history {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    min-height: 50px;
                    flex-wrap: wrap;
                }
                
                .history-item {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2em;
                    font-weight: bold;
                    border: 2px solid rgba(255,255,255,0.2);
                    opacity: 0.6;
                    transition: all 0.3s;
                }
                
                .history-item.highlight {
                    opacity: 1;
                    transform: scale(1.1);
                    border-color: #fbbf24;
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

        setTimeout(() => {
            if (this.isRunning) {
                this.presentStimulus();
            }
        }, this.interStimulusInterval);
    }

    async presentStimulus() {
        this.currentTrial++;
        document.getElementById('trialCount').textContent = this.currentTrial;
        
        // Determine if this should be a match trial (30% probability after n trials)
        let stimulus;
        const shouldMatch = this.stimulusSequence.length >= this.nBack && Math.random() < 0.3;
        
        if (shouldMatch) {
            // Match: Use the stimulus from n-back position
            stimulus = this.stimulusSequence[this.stimulusSequence.length - this.nBack];
        } else {
            // Non-match: Choose random stimulus different from n-back
            const validStimuli = this.stimuliSet.filter(s => 
                this.stimulusSequence.length < this.nBack || 
                s !== this.stimulusSequence[this.stimulusSequence.length - this.nBack]
            );
            stimulus = validStimuli[Math.floor(Math.random() * validStimuli.length)];
        }
        
        this.currentStimulus = stimulus;
        this.stimulusSequence.push(stimulus);
        
        this.stimulusStartTime = performance.now();
        this.waitingForResponse = true;
        
        // Display stimulus
        const currentStimulusEl = document.getElementById('currentStimulus');
        currentStimulusEl.textContent = stimulus + 1; // Display as 1-4
        currentStimulusEl.classList.add('active');
        
        // Light up corresponding LED
        await this.platform.setLED(stimulus + 1, true);
        
        // Color the stimulus display
        const colors = ['#4ade80', '#ffffff', '#ff6b6b', '#22c55e'];
        currentStimulusEl.style.background = colors[stimulus];
        currentStimulusEl.style.color = stimulus === 1 ? '#000' : '#fff';
        
        // Update history display
        this.updateHistoryDisplay();
        
        // Record stimulus
        const isMatch = this.stimulusSequence.length > this.nBack && 
                       this.currentStimulus === this.stimulusSequence[this.stimulusSequence.length - this.nBack - 1];
        
        this.testData.push({
            type: 'stimulus',
            trial: this.currentTrial,
            timestamp: this.stimulusStartTime,
            relativeTime: this.stimulusStartTime - this.startTime,
            stimulus: stimulus,
            isMatch: isMatch,
            nBackStimulus: this.stimulusSequence.length > this.nBack ? 
                          this.stimulusSequence[this.stimulusSequence.length - this.nBack - 1] : null
        });
        
        // Turn off stimulus after duration
        setTimeout(async () => {
            currentStimulusEl.classList.remove('active');
            currentStimulusEl.style.background = 'rgba(255,255,255,0.05)';
            await this.platform.setLED(stimulus + 1, false);
        }, this.stimulusDuration);
        
        // Handle no response after full interval
        setTimeout(() => {
            if (this.waitingForResponse) {
                this.handleNoResponse();
            }
        }, this.interStimulusInterval - 100);
    }

    updateHistoryDisplay() {
        const historyEl = document.getElementById('sequenceHistory');
        historyEl.innerHTML = '';
        
        const colors = ['#4ade80', '#ffffff', '#ff6b6b', '#22c55e'];
        const displayCount = Math.min(10, this.stimulusSequence.length);
        const startIdx = Math.max(0, this.stimulusSequence.length - displayCount);
        
        for (let i = startIdx; i < this.stimulusSequence.length; i++) {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = this.stimulusSequence[i] + 1;
            item.style.background = colors[this.stimulusSequence[i]];
            item.style.color = this.stimulusSequence[i] === 1 ? '#000' : '#fff';
            
            // Highlight the n-back position
            if (i === this.stimulusSequence.length - this.nBack - 1) {
                item.classList.add('highlight');
            }
            
            historyEl.appendChild(item);
        }
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.waitingForResponse) return;
        
        this.waitingForResponse = false;
        const responseTime = timestamp;
        const reactionTime = responseTime - this.stimulusStartTime;
        
        // Check if it's a match trial
        const isMatch = this.stimulusSequence.length > this.nBack && 
                       this.currentStimulus === this.stimulusSequence[this.stimulusSequence.length - this.nBack - 1];
        
        if (isMatch) {
            // Correct hit
            this.hits++;
            document.getElementById('hitsCount').textContent = this.hits;
            await this.platform.flashLED(1, 1, 100);
        } else {
            // False alarm
            this.falseAlarms++;
            document.getElementById('falseAlarmsCount').textContent = this.falseAlarms;
            await this.platform.flashLED(2, 2, 100);
        }
        
        this.updateAccuracy();
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial,
            timestamp: responseTime,
            relativeTime: responseTime - this.startTime,
            button: buttonIndex,
            isMatch: isMatch,
            reactionTime: reactionTime,
            outcome: isMatch ? 'hit' : 'false_alarm'
        });
        
        this.scheduleNextStimulus();
    }

    handleNoResponse() {
        this.waitingForResponse = false;
        
        const isMatch = this.stimulusSequence.length > this.nBack && 
                       this.currentStimulus === this.stimulusSequence[this.stimulusSequence.length - this.nBack - 1];
        
        if (isMatch) {
            // Miss
            this.misses++;
            document.getElementById('missesCount').textContent = this.misses;
        } else {
            // Correct rejection
            this.correctRejections++;
        }
        
        this.updateAccuracy();
        
        // Record no response
        this.testData.push({
            type: 'no_response',
            trial: this.currentTrial,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            isMatch: isMatch,
            outcome: isMatch ? 'miss' : 'correct_rejection'
        });
        
        this.scheduleNextStimulus();
    }

    updateAccuracy() {
        const total = this.hits + this.misses + this.falseAlarms + this.correctRejections;
        if (total > 0) {
            const accuracy = ((this.hits + this.correctRejections) / total) * 100;
            document.getElementById('accuracyPercent').textContent = accuracy.toFixed(1) + '%';
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
        const totalTargets = this.hits + this.misses;
        const totalNonTargets = this.falseAlarms + this.correctRejections;
        const total = totalTargets + totalNonTargets;
        
        const hitRate = totalTargets > 0 ? this.hits / totalTargets : 0;
        const falseAlarmRate = totalNonTargets > 0 ? this.falseAlarms / totalNonTargets : 0;
        const accuracy = total > 0 ? (this.hits + this.correctRejections) / total : 0;
        
        // Calculate d' (sensitivity)
        const dPrime = this.calculateDPrime(hitRate, falseAlarmRate);
        
        return {
            testName: `${this.nBack}-Back Working Memory`,
            totalTrials: this.currentTrial,
            hits: this.hits,
            misses: this.misses,
            falseAlarms: this.falseAlarms,
            correctRejections: this.correctRejections,
            hitRate: (hitRate * 100).toFixed(2),
            falseAlarmRate: (falseAlarmRate * 100).toFixed(2),
            accuracy: (accuracy * 100).toFixed(2),
            dPrime: dPrime.toFixed(3),
            workingMemoryCapacity: this.nBack
        };
    }

    calculateDPrime(hitRate, faRate) {
        // Adjust extreme values
        if (hitRate >= 0.9999) hitRate = 0.9999;
        if (hitRate <= 0.0001) hitRate = 0.0001;
        if (faRate >= 0.9999) faRate = 0.9999;
        if (faRate <= 0.0001) faRate = 0.0001;
        
        const zHit = this.inverseNormalCDF(hitRate);
        const zFA = this.inverseNormalCDF(faRate);
        
        return zHit - zFA;
    }

    inverseNormalCDF(p) {
        const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
                    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
        const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
                    6.680131188771972e+01, -1.328068155288572e+01];
        const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
                   -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
        const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
                   3.754408661907416e+00];
        
        const pLow = 0.02425;
        const pHigh = 1 - pLow;
        
        let q, r, x;
        
        if (p < pLow) {
            q = Math.sqrt(-2 * Math.log(p));
            x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        } else if (p <= pHigh) {
            q = p - 0.5;
            r = q * q;
            x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
                (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
        } else {
            q = Math.sqrt(-2 * Math.log(1 - p));
            x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                 ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }
        
        return x;
    }
}
