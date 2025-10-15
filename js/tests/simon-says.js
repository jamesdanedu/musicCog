// js/tests/simon-says.js - Simon Says Memory Game with Metrics

class SimonSaysTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        // Button configuration (all 4 buttons)
        this.buttons = [
            { index: 0, color: '#4ade80', name: 'Green 1', sound: 330 },
            { index: 1, color: '#ffffff', name: 'White', sound: 415 },
            { index: 2, color: '#ff6b6b', name: 'Red', sound: 523 },
            { index: 3, color: '#22c55e', name: 'Green 2', sound: 659 }
        ];
        
        // Game state
        this.currentSequence = [];
        this.userSequence = [];
        this.currentLevel = 1;
        this.maxLevel = 20;
        this.startingLength = 3;
        
        // Timing parameters
        this.baseLEDDuration = 600; // Base duration for LED flash
        this.baseGapDuration = 300; // Base gap between flashes
        this.speedUpFactor = 0.95; // Speed increases by 5% each level
        
        // Game modes
        this.gameOver = false;
        this.showingPattern = false;
        this.collectingInput = false;
        
        // Performance metrics
        this.totalRounds = 0;
        this.correctRounds = 0;
        this.failedRounds = 0;
        this.longestSequence = 0;
        this.totalResponseTime = 0;
        this.responseCount = 0;
        this.perfectRounds = 0; // Rounds with no mistakes
        this.averageAccuracyPerRound = [];
        
        // Speed and difficulty tracking
        this.currentSpeed = 1.0;
        this.speedIncreasePerLevel = 0.05;
    }

    async setupLEDPatterns() {
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="simon-says-test">
                <div class="game-header">
                    <h2>🎮 Simon Says</h2>
                    <div class="game-info">
                        <div class="info-item">
                            <span class="label">Level:</span>
                            <span class="value" id="currentLevel">1</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Score:</span>
                            <span class="value" id="currentScore">0</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Best:</span>
                            <span class="value" id="bestScore">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="game-status" id="gameStatus">
                    <div class="status-message" id="statusMessage">Watch the pattern...</div>
                    <div class="speed-indicator">
                        Speed: <span id="speedMultiplier">1.0</span>x
                    </div>
                </div>
                
                <div class="simon-board">
                    <div class="simon-buttons">
                        <div class="simon-button" data-button="0" id="simonBtn0">
                            <div class="button-inner green">
                                <span class="button-number">1</span>
                            </div>
                        </div>
                        <div class="simon-button" data-button="1" id="simonBtn1">
                            <div class="button-inner white">
                                <span class="button-number">2</span>
                            </div>
                        </div>
                        <div class="simon-button" data-button="2" id="simonBtn2">
                            <div class="button-inner red">
                                <span class="button-number">3</span>
                            </div>
                        </div>
                        <div class="simon-button" data-button="3" id="simonBtn3">
                            <div class="button-inner green2">
                                <span class="button-number">4</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="sequence-display">
                        <div class="sequence-label">Sequence Length:</div>
                        <div class="sequence-length" id="sequenceLength">0</div>
                    </div>
                </div>
                
                <div class="progress-tracker">
                    <div class="progress-dots" id="progressDots"></div>
                </div>
                
                <div class="game-metrics">
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-icon">🎯</div>
                            <div class="metric-value" id="totalRounds">0</div>
                            <div class="metric-label">Rounds</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">✓</div>
                            <div class="metric-value" id="correctRounds">0</div>
                            <div class="metric-label">Correct</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">⚡</div>
                            <div class="metric-value" id="avgResponseTime">0</div>
                            <div class="metric-label">Avg RT (ms)</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">🏆</div>
                            <div class="metric-value" id="longestSequence">0</div>
                            <div class="metric-label">Longest</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">💯</div>
                            <div class="metric-value" id="perfectRounds">0</div>
                            <div class="metric-label">Perfect</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-icon">📊</div>
                            <div class="metric-value" id="accuracy">0%</div>
                            <div class="metric-label">Accuracy</div>
                        </div>
                    </div>
                </div>
                
                <div class="time-info">
                    <span>Time: <strong id="timeRemaining"></strong></span>
                </div>
            </div>
            
            <style>
                .simon-says-test {
                    text-align: center;
                    padding: 20px;
                    max-width: 900px;
                    margin: 0 auto;
                }
                
                .game-header {
                    margin-bottom: 30px;
                }
                
                .game-header h2 {
                    margin: 0 0 15px 0;
                    font-size: 2.5em;
                    color: #fff;
                    text-shadow: 0 0 20px rgba(255,255,255,0.3);
                }
                
                .game-info {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    flex-wrap: wrap;
                }
                
                .info-item {
                    background: rgba(255,255,255,0.1);
                    padding: 10px 25px;
                    border-radius: 10px;
                    backdrop-filter: blur(10px);
                }
                
                .info-item .label {
                    color: rgba(255,255,255,0.7);
                    margin-right: 8px;
                    font-size: 0.9em;
                }
                
                .info-item .value {
                    color: #fbbf24;
                    font-weight: bold;
                    font-size: 1.3em;
                }
                
                .game-status {
                    margin: 20px 0;
                    min-height: 80px;
                }
                
                .status-message {
                    font-size: 1.5em;
                    color: #4ade80;
                    font-weight: 600;
                    margin-bottom: 10px;
                }
                
                .speed-indicator {
                    font-size: 1.1em;
                    color: rgba(255,255,255,0.7);
                }
                
                #speedMultiplier {
                    color: #fbbf24;
                    font-weight: bold;
                }
                
                .simon-board {
                    margin: 40px 0;
                    position: relative;
                }
                
                .simon-buttons {
                    display: grid;
                    grid-template-columns: repeat(2, 150px);
                    grid-template-rows: repeat(2, 150px);
                    gap: 15px;
                    justify-content: center;
                    margin-bottom: 30px;
                }
                
                .simon-button {
                    cursor: pointer;
                    transition: transform 0.1s;
                }
                
                .simon-button:active {
                    transform: scale(0.95);
                }
                
                .button-inner {
                    width: 150px;
                    height: 150px;
                    border-radius: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    border: 3px solid rgba(255,255,255,0.3);
                    transition: all 0.15s;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                }
                
                .button-inner.green {
                    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
                }
                
                .button-inner.white {
                    background: linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%);
                }
                
                .button-inner.red {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ef4444 100%);
                }
                
                .button-inner.green2 {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                }
                
                .button-inner.active {
                    transform: scale(1.1);
                    box-shadow: 0 0 40px currentColor;
                    filter: brightness(1.5);
                }
                
                .button-number {
                    font-size: 3em;
                    font-weight: bold;
                    color: rgba(0,0,0,0.3);
                    text-shadow: 0 2px 4px rgba(255,255,255,0.5);
                }
                
                .button-inner.white .button-number {
                    color: rgba(0,0,0,0.4);
                }
                
                .sequence-display {
                    text-align: center;
                }
                
                .sequence-label {
                    font-size: 1em;
                    color: rgba(255,255,255,0.7);
                    margin-bottom: 5px;
                }
                
                .sequence-length {
                    font-size: 3em;
                    font-weight: bold;
                    color: #fbbf24;
                    text-shadow: 0 0 20px rgba(251,191,36,0.5);
                }
                
                .progress-tracker {
                    margin: 30px 0;
                    min-height: 50px;
                }
                
                .progress-dots {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                
                .progress-dot {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    transition: all 0.3s;
                }
                
                .progress-dot.shown {
                    background: #4ade80;
                    box-shadow: 0 0 10px #4ade80;
                }
                
                .progress-dot.correct {
                    background: #4ade80;
                    box-shadow: 0 0 10px #4ade80;
                }
                
                .progress-dot.incorrect {
                    background: #ff6b6b;
                    box-shadow: 0 0 10px #ff6b6b;
                }
                
                .game-metrics {
                    margin: 40px 0;
                }
                
                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 15px;
                }
                
                .metric-card {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    backdrop-filter: blur(10px);
                    transition: transform 0.2s;
                }
                
                .metric-card:hover {
                    transform: translateY(-2px);
                }
                
                .metric-icon {
                    font-size: 2em;
                    margin-bottom: 10px;
                }
                
                .metric-value {
                    font-size: 2em;
                    font-weight: bold;
                    color: #fff;
                    margin-bottom: 5px;
                }
                
                .metric-label {
                    font-size: 0.9em;
                    color: rgba(255,255,255,0.7);
                }
                
                .time-info {
                    margin-top: 20px;
                    padding: 10px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 8px;
                    display: inline-block;
                }
                
                .time-info strong {
                    color: #fbbf24;
                    font-size: 1.2em;
                }
            </style>
        `;

        this.updateTimer();
        await this.platform.delay(1500);
        this.startRound();
    }

    async startRound() {
        if (!this.isRunning || this.gameOver) return;
        
        const timeElapsed = Date.now() - this.startTime;
        if (timeElapsed >= this.config.duration) {
            this.complete();
            return;
        }

        this.totalRounds++;
        this.currentTrial = this.totalRounds;
        
        // Calculate sequence length: starts at 3, adds 1 every 2 levels
        const sequenceLength = this.startingLength + Math.floor((this.currentLevel - 1) / 2);
        
        // Add one more button to sequence
        const newButton = Math.floor(Math.random() * 4);
        this.currentSequence.push(newButton);
        
        this.userSequence = [];
        
        // Update display
        document.getElementById('currentLevel').textContent = this.currentLevel;
        document.getElementById('sequenceLength').textContent = this.currentSequence.length;
        document.getElementById('totalRounds').textContent = this.totalRounds;
        
        // Calculate current speed
        this.currentSpeed = 1 + (this.currentLevel - 1) * this.speedIncreasePerLevel;
        document.getElementById('speedMultiplier').textContent = this.currentSpeed.toFixed(1);
        
        // Record round start
        this.testData.push({
            type: 'round_start',
            trial: this.totalRounds,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            level: this.currentLevel,
            sequenceLength: this.currentSequence.length,
            sequence: [...this.currentSequence],
            speed: this.currentSpeed
        });
        
        await this.platform.delay(1000);
        await this.showPattern();
    }

    async showPattern() {
        this.showingPattern = true;
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = 'Watch carefully...';
        statusMessage.style.color = '#4ade80';
        
        // Create progress dots
        const progressDots = document.getElementById('progressDots');
        progressDots.innerHTML = '';
        for (let i = 0; i < this.currentSequence.length; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            dot.id = `progress-${i}`;
            progressDots.appendChild(dot);
        }
        
        // Calculate timing based on speed
        const ledDuration = this.baseLEDDuration / this.currentSpeed;
        const gapDuration = this.baseGapDuration / this.currentSpeed;
        
        // Show each button in sequence
        for (let i = 0; i < this.currentSequence.length; i++) {
            const buttonIndex = this.currentSequence[i];
            
            // Flash LED
            await this.flashButton(buttonIndex, ledDuration);
            
            // Mark progress
            document.getElementById(`progress-${i}`).classList.add('shown');
            
            // Gap between flashes
            if (i < this.currentSequence.length - 1) {
                await this.platform.delay(gapDuration);
            }
        }
        
        this.showingPattern = false;
        await this.platform.delay(500);
        this.startInputCollection();
    }

    async flashButton(buttonIndex, duration) {
        const buttonEl = document.getElementById(`simonBtn${buttonIndex}`);
        const buttonInner = buttonEl.querySelector('.button-inner');
        
        // Visual flash
        buttonInner.classList.add('active');
        
        // LED flash
        await this.platform.setLED(buttonIndex + 1, true);
        
        await this.platform.delay(duration);
        
        buttonInner.classList.remove('active');
        await this.platform.setLED(buttonIndex + 1, false);
    }

    startInputCollection() {
        this.collectingInput = true;
        this.responseStartTime = performance.now();
        
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = 'Your turn! Repeat the pattern';
        statusMessage.style.color = '#fbbf24';
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.collectingInput || this.showingPattern) return;
        
        const responseTime = timestamp - this.responseStartTime;
        
        // Visual and haptic feedback
        await this.flashButton(buttonIndex, 150);
        
        // Add to user sequence
        this.userSequence.push(buttonIndex);
        
        // Check if correct so far
        const currentIndex = this.userSequence.length - 1;
        const correct = buttonIndex === this.currentSequence[currentIndex];
        
        // Update progress dot
        const dot = document.getElementById(`progress-${currentIndex}`);
        if (dot) {
            dot.classList.remove('shown');
            dot.classList.add(correct ? 'correct' : 'incorrect');
        }
        
        // Record response
        this.testData.push({
            type: 'button_press',
            trial: this.totalRounds,
            timestamp: timestamp,
            relativeTime: timestamp - this.startTime,
            sequencePosition: currentIndex,
            expectedButton: this.currentSequence[currentIndex],
            pressedButton: buttonIndex,
            correct: correct,
            responseTime: responseTime
        });
        
        // Track response time
        this.totalResponseTime += responseTime;
        this.responseCount++;
        
        if (!correct) {
            // Wrong button!
            await this.handleError();
            return;
        }
        
        // Check if sequence complete
        if (this.userSequence.length === this.currentSequence.length) {
            this.collectingInput = false;
            await this.handleSuccess();
        } else {
            // Reset timer for next button
            this.responseStartTime = performance.now();
        }
    }

    async handleSuccess() {
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = '✓ Perfect!';
        statusMessage.style.color = '#4ade80';
        
        this.correctRounds++;
        document.getElementById('correctRounds').textContent = this.correctRounds;
        
        // Check if perfect round (no mistakes in input)
        if (this.userSequence.every((btn, idx) => btn === this.currentSequence[idx])) {
            this.perfectRounds++;
            document.getElementById('perfectRounds').textContent = this.perfectRounds;
        }
        
        // Update longest sequence
        if (this.currentSequence.length > this.longestSequence) {
            this.longestSequence = this.currentSequence.length;
            document.getElementById('longestSequence').textContent = this.longestSequence;
            document.getElementById('bestScore').textContent = this.longestSequence;
        }
        
        // Update score (current sequence length)
        document.getElementById('currentScore').textContent = this.currentSequence.length;
        
        // Update metrics
        this.updateMetrics();
        
        // Success feedback
        await this.platform.flashAllLEDs(2, 150);
        
        await this.platform.delay(1500);
        
        // Level up every 2 successful rounds
        if (this.correctRounds % 2 === 0 && this.currentLevel < this.maxLevel) {
            this.currentLevel++;
            statusMessage.textContent = `🎉 Level ${this.currentLevel}!`;
            statusMessage.style.color = '#fbbf24';
            await this.platform.chaseLEDs(2, 100);
            await this.platform.delay(1500);
        }
        
        // Continue to next round
        this.startRound();
    }

    async handleError() {
        this.collectingInput = false;
        this.gameOver = true;
        
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = '✗ Game Over!';
        statusMessage.style.color = '#ff6b6b';
        
        this.failedRounds++;
        
        // Update metrics
        this.updateMetrics();
        
        // Error feedback
        await this.platform.flashLED(2, 3, 200);
        
        await this.platform.delay(2000);
        
        // Show final results
        statusMessage.textContent = `Final Score: ${this.longestSequence} | Level: ${this.currentLevel}`;
        statusMessage.style.color = '#fbbf24';
        
        await this.platform.delay(3000);
        
        // End test
        this.complete();
    }

    updateMetrics() {
        // Average response time
        if (this.responseCount > 0) {
            const avgRT = Math.round(this.totalResponseTime / this.responseCount);
            document.getElementById('avgResponseTime').textContent = avgRT;
        }
        
        // Accuracy
        const totalAttempts = this.correctRounds + this.failedRounds;
        if (totalAttempts > 0) {
            const accuracy = ((this.correctRounds / totalAttempts) * 100).toFixed(1);
            document.getElementById('accuracy').textContent = accuracy + '%';
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
        const avgResponseTime = this.responseCount > 0 
            ? this.totalResponseTime / this.responseCount 
            : 0;
        
        const totalAttempts = this.correctRounds + this.failedRounds;
        const accuracy = totalAttempts > 0 
            ? (this.correctRounds / totalAttempts) * 100 
            : 0;
        
        const perfectRoundRate = this.totalRounds > 0
            ? (this.perfectRounds / this.totalRounds) * 100
            : 0;
        
        return {
            testName: 'Simon Says',
            finalLevel: this.currentLevel,
            longestSequence: this.longestSequence,
            totalRounds: this.totalRounds,
            correctRounds: this.correctRounds,
            failedRounds: this.failedRounds,
            perfectRounds: this.perfectRounds,
            accuracy: accuracy.toFixed(2),
            perfectRoundRate: perfectRoundRate.toFixed(2),
            averageResponseTime: avgResponseTime.toFixed(2),
            totalResponseCount: this.responseCount,
            maxSpeed: this.currentSpeed.toFixed(2),
            sequentialMemoryCapacity: this.longestSequence,
            gameScore: this.longestSequence * this.currentLevel
        };
    }
}
