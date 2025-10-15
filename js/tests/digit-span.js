// js/tests/digit-span.js - Digit Span Test for Working Memory Capacity

class DigitSpanTest extends CognitionTestBase {
    constructor(config, platform) {
        super(config, platform);
        
        // Map digits to buttons (0-3 for 4 buttons)
        this.digitButtonMap = {
            1: 0, // Button 1 (Green 1)
            2: 1, // Button 2 (White)
            3: 2, // Button 3 (Red)
            4: 3  // Button 4 (Green 2)
        };
        
        this.digits = [1, 2, 3, 4];
        
        // Test phases
        this.phases = {
            forward: 'forward',
            backward: 'backward'
        };
        
        this.currentPhase = this.phases.forward;
        this.currentSequence = [];
        this.userResponse = [];
        this.sequenceLength = 3; // Start with 3 digits
        this.maxSequenceLength = 9;
        this.minSequenceLength = 3;
        
        // Timing
        this.digitDisplayDuration = 1000; // Show each digit for 1 second
        this.interDigitInterval = 500; // 500ms between digits
        
        // Scoring
        this.forwardSpan = 0;
        this.backwardSpan = 0;
        this.forwardCorrect = 0;
        this.forwardIncorrect = 0;
        this.backwardCorrect = 0;
        this.backwardIncorrect = 0;
        
        // Adaptive testing
        this.consecutiveCorrect = 0;
        this.consecutiveIncorrect = 0;
        this.trialsAtCurrentLength = 0;
        this.maxTrialsPerLength = 2; // Two trials at each length
        
        // State
        this.showingSequence = false;
        this.collectingResponse = false;
        this.responseStartTime = null;
    }

    async setupLEDPatterns() {
        await this.platform.setAllLEDs(false);
    }

    async runTest() {
        const testContent = document.getElementById('testContent');
        testContent.innerHTML = `
            <div class="digit-span-test">
                <div class="instruction-box">
                    <h3>Digit Span Test - Working Memory</h3>
                    <div id="phaseInstructions" class="phase-instructions">
                        <h4>FORWARD SPAN</h4>
                        <p>Watch the sequence of lights, then reproduce it in the <strong>SAME ORDER</strong></p>
                    </div>
                    
                    <div class="button-reference">
                        <div class="button-ref">
                            <div class="ref-number">1</div>
                            <div class="ref-led green"></div>
                            <span>Button 1</span>
                        </div>
                        <div class="button-ref">
                            <div class="ref-number">2</div>
                            <div class="ref-led white"></div>
                            <span>Button 2</span>
                        </div>
                        <div class="button-ref">
                            <div class="ref-number">3</div>
                            <div class="ref-led red"></div>
                            <span>Button 3</span>
                        </div>
                        <div class="button-ref">
                            <div class="ref-number">4</div>
                            <div class="ref-led green2"></div>
                            <span>Button 4</span>
                        </div>
                    </div>
                </div>
                
                <div class="test-status" id="testStatus">
                    <div class="status-message" id="statusMessage">Get Ready...</div>
                </div>
                
                <div class="sequence-display">
                    <div class="digit-display" id="digitDisplay"></div>
                    <div class="sequence-progress" id="sequenceProgress"></div>
                </div>
                
                <div class="response-area" id="responseArea">
                    <div class="response-prompt" id="responsePrompt"></div>
                    <div class="response-sequence" id="responseSequence"></div>
                </div>
                
                <div class="performance-stats">
                    <div class="span-results">
                        <div class="span-group forward-span">
                            <h4>Forward Span</h4>
                            <div class="span-display">
                                <div class="span-value" id="forwardSpanValue">-</div>
                                <div class="span-label">Longest Sequence</div>
                            </div>
                            <div class="span-stats">
                                <span>Correct: <strong id="forwardCorrect">0</strong></span>
                                <span>Incorrect: <strong id="forwardIncorrect">0</strong></span>
                            </div>
                        </div>
                        
                        <div class="span-group backward-span">
                            <h4>Backward Span</h4>
                            <div class="span-display">
                                <div class="span-value" id="backwardSpanValue">-</div>
                                <div class="span-label">Longest Sequence</div>
                            </div>
                            <div class="span-stats">
                                <span>Correct: <strong id="backwardCorrect">0</strong></span>
                                <span>Incorrect: <strong id="backwardIncorrect">0</strong></span>
                            </div>
                        </div>
                        
                        <div class="span-group total-span">
                            <h4>Total Span</h4>
                            <div class="span-display">
                                <div class="span-value" id="totalSpanValue">-</div>
                                <div class="span-label">Working Memory Capacity</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="progress-info">
                        <div class="stat">
                            <span class="stat-label">Current Length:</span>
                            <span class="stat-value" id="currentLength">3</span>
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
            </div>
            
            <style>
                .digit-span-test {
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
                    margin: 0 0 20px 0;
                    color: #fff;
                    font-size: 1.6em;
                }
                
                .phase-instructions {
                    background: rgba(74,222,128,0.15);
                    padding: 20px;
                    border-radius: 8px;
                    border: 2px solid #4ade80;
                    margin-bottom: 20px;
                }
                
                .phase-instructions h4 {
                    margin: 0 0 10px 0;
                    color: #4ade80;
                    font-size: 1.3em;
                }
                
                .phase-instructions p {
                    margin: 0;
                    font-size: 1.1em;
                    color: #fff;
                }
                
                .button-reference {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    flex-wrap: wrap;
                }
                
                .button-ref {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    background: rgba(0,0,0,0.2);
                    padding: 15px;
                    border-radius: 8px;
                    min-width: 100px;
                }
                
                .ref-number {
                    font-size: 2em;
                    font-weight: bold;
                    color: #fff;
                }
                
                .ref-led {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid rgba(255,255,255,0.3);
                }
                
                .ref-led.green { background: #4ade80; }
                .ref-led.white { background: #ffffff; }
                .ref-led.red { background: #ff6b6b; }
                .ref-led.green2 { background: #22c55e; }
                
                .test-status {
                    margin: 30px 0;
                    min-height: 50px;
                }
                
                .status-message {
                    font-size: 1.4em;
                    color: #fbbf24;
                    font-weight: 600;
                }
                
                .sequence-display {
                    margin: 40px 0;
                    min-height: 250px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                
                .digit-display {
                    width: 200px;
                    height: 200px;
                    border-radius: 50%;
                    border: 4px solid rgba(255,255,255,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 6em;
                    font-weight: bold;
                    transition: all 0.2s;
                    background: rgba(255,255,255,0.05);
                }
                
                .digit-display.active {
                    transform: scale(1.1);
                    box-shadow: 0 0 60px currentColor;
                }
                
                .sequence-progress {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                    min-height: 30px;
                }
                
                .progress-dot {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    transition: all 0.3s;
                }
                
                .progress-dot.shown {
                    background: #4ade80;
                    box-shadow: 0 0 10px #4ade80;
                }
                
                .response-area {
                    margin: 40px 0;
                    min-height: 150px;
                }
                
                .response-prompt {
                    font-size: 1.3em;
                    color: #fbbf24;
                    margin-bottom: 20px;
                    font-weight: 600;
                }
                
                .response-sequence {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                
                .response-digit {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    border: 3px solid rgba(255,255,255,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2em;
                    font-weight: bold;
                    color: #fff;
                    transition: all 0.2s;
                }
                
                .performance-stats {
                    margin-top: 40px;
                }
                
                .span-results {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .span-group {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                }
                
                .span-group h4 {
                    margin: 0 0 15px 0;
                    color: #fff;
                    font-size: 1.2em;
                }
                
                .forward-span {
                    border-top: 3px solid #4ade80;
                }
                
                .backward-span {
                    border-top: 3px solid #fbbf24;
                }
                
                .total-span {
                    border-top: 3px solid #60a5fa;
                }
                
                .span-display {
                    text-align: center;
                    margin-bottom: 15px;
                }
                
                .span-value {
                    font-size: 3em;
                    font-weight: bold;
                    color: #fff;
                }
                
                .span-label {
                    font-size: 0.9em;
                    color: rgba(255,255,255,0.7);
                    margin-top: 5px;
                }
                
                .span-stats {
                    display: flex;
                    justify-content: space-around;
                    font-size: 0.95em;
                    color: rgba(255,255,255,0.8);
                }
                
                .progress-info {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    flex-wrap: wrap;
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
        this.startTrial();
    }

    async startTrial() {
        if (!this.isRunning) return;
        
        const timeElapsed = Date.now() - this.startTime;
        if (timeElapsed >= this.config.duration) {
            this.complete();
            return;
        }

        this.currentTrial++;
        document.getElementById('trialCount').textContent = this.currentTrial;
        document.getElementById('currentLength').textContent = this.sequenceLength;
        document.getElementById('statusMessage').textContent = 'Watch the sequence...';
        
        // Generate random sequence
        this.currentSequence = [];
        for (let i = 0; i < this.sequenceLength; i++) {
            this.currentSequence.push(this.digits[Math.floor(Math.random() * this.digits.length)]);
        }
        
        this.userResponse = [];
        
        // Record trial start
        this.testData.push({
            type: 'trial_start',
            trial: this.currentTrial,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            phase: this.currentPhase,
            sequenceLength: this.sequenceLength,
            sequence: [...this.currentSequence]
        });
        
        await this.platform.delay(1000);
        await this.showSequence();
    }

    async showSequence() {
        this.showingSequence = true;
        const digitDisplay = document.getElementById('digitDisplay');
        const sequenceProgress = document.getElementById('sequenceProgress');
        
        // Create progress dots
        sequenceProgress.innerHTML = '';
        for (let i = 0; i < this.sequenceLength; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            dot.id = `dot-${i}`;
            sequenceProgress.appendChild(dot);
        }
        
        // Show each digit in sequence
        for (let i = 0; i < this.currentSequence.length; i++) {
            const digit = this.currentSequence[i];
            const buttonIndex = this.digitButtonMap[digit];
            
            // Show digit visually
            digitDisplay.textContent = digit;
            digitDisplay.classList.add('active');
            
            // Color based on button
            const colors = ['#4ade80', '#ffffff', '#ff6b6b', '#22c55e'];
            digitDisplay.style.color = colors[buttonIndex];
            
            // Light up corresponding LED
            await this.platform.setLED(buttonIndex + 1, true);
            
            // Mark progress dot
            document.getElementById(`dot-${i}`).classList.add('shown');
            
            // Hold for duration
            await this.platform.delay(this.digitDisplayDuration);
            
            // Clear
            digitDisplay.classList.remove('active');
            digitDisplay.textContent = '';
            await this.platform.setLED(buttonIndex + 1, false);
            
            // Inter-digit interval
            if (i < this.currentSequence.length - 1) {
                await this.platform.delay(this.interDigitInterval);
            }
        }
        
        this.showingSequence = false;
        await this.platform.delay(500);
        this.startResponseCollection();
    }

    async startResponseCollection() {
        this.collectingResponse = true;
        this.responseStartTime = performance.now();
        
        const statusMessage = document.getElementById('statusMessage');
        const responsePrompt = document.getElementById('responsePrompt');
        
        if (this.currentPhase === this.phases.forward) {
            statusMessage.textContent = 'Recall: Press buttons in SAME order';
            responsePrompt.textContent = 'Enter the sequence in the same order →';
        } else {
            statusMessage.textContent = 'Recall: Press buttons in REVERSE order';
            responsePrompt.textContent = 'Enter the sequence in reverse order ←';
        }
        
        // Clear response display
        document.getElementById('responseSequence').innerHTML = '';
    }

    async handleButtonPress(buttonIndex, timestamp, buttonData) {
        if (!this.collectingResponse) return;
        
        // Map button to digit
        let digit = null;
        for (const [d, btn] of Object.entries(this.digitButtonMap)) {
            if (btn === buttonIndex) {
                digit = parseInt(d);
                break;
            }
        }
        
        if (digit === null) return;
        
        // Add to response
        this.userResponse.push(digit);
        
        // Visual feedback
        await this.platform.flashLED(buttonIndex + 1, 1, 150);
        
        // Display response digit
        const responseSequence = document.getElementById('responseSequence');
        const responseDigit = document.createElement('div');
        responseDigit.className = 'response-digit';
        responseDigit.textContent = digit;
        
        const colors = ['#4ade80', '#ffffff', '#ff6b6b', '#22c55e'];
        responseDigit.style.background = colors[buttonIndex];
        responseDigit.style.color = buttonIndex === 1 ? '#000' : '#fff';
        
        responseSequence.appendChild(responseDigit);
        
        // Check if sequence complete
        if (this.userResponse.length === this.sequenceLength) {
            this.collectingResponse = false;
            await this.platform.delay(500);
            this.evaluateResponse();
        }
    }

    async evaluateResponse() {
        const statusMessage = document.getElementById('statusMessage');
        
        // Determine expected sequence
        let expectedSequence;
        if (this.currentPhase === this.phases.forward) {
            expectedSequence = [...this.currentSequence];
        } else {
            expectedSequence = [...this.currentSequence].reverse();
        }
        
        // Check if correct
        const correct = this.userResponse.every((digit, index) => digit === expectedSequence[index]);
        
        // Record response
        this.testData.push({
            type: 'response',
            trial: this.currentTrial,
            timestamp: performance.now(),
            relativeTime: performance.now() - this.startTime,
            phase: this.currentPhase,
            sequenceLength: this.sequenceLength,
            expectedSequence: expectedSequence,
            userResponse: [...this.userResponse],
            correct: correct,
            responseTime: performance.now() - this.responseStartTime
        });
        
        // Update statistics
        if (this.currentPhase === this.phases.forward) {
            if (correct) {
                this.forwardCorrect++;
                document.getElementById('forwardCorrect').textContent = this.forwardCorrect;
                if (this.sequenceLength > this.forwardSpan) {
                    this.forwardSpan = this.sequenceLength;
                    document.getElementById('forwardSpanValue').textContent = this.forwardSpan;
                }
            } else {
                this.forwardIncorrect++;
                document.getElementById('forwardIncorrect').textContent = this.forwardIncorrect;
            }
        } else {
            if (correct) {
                this.backwardCorrect++;
                document.getElementById('backwardCorrect').textContent = this.backwardCorrect;
                if (this.sequenceLength > this.backwardSpan) {
                    this.backwardSpan = this.sequenceLength;
                    document.getElementById('backwardSpanValue').textContent = this.backwardSpan;
                }
            } else {
                this.backwardIncorrect++;
                document.getElementById('backwardIncorrect').textContent = this.backwardIncorrect;
            }
        }
        
        // Update total span
        const totalSpan = this.forwardSpan + this.backwardSpan;
        document.getElementById('totalSpanValue').textContent = totalSpan;
        
        // Show feedback
        if (correct) {
            statusMessage.textContent = '✓ Correct!';
            statusMessage.style.color = '#4ade80';
            await this.platform.flashAllLEDs(2, 200);
            this.consecutiveCorrect++;
            this.consecutiveIncorrect = 0;
        } else {
            statusMessage.textContent = '✗ Incorrect';
            statusMessage.style.color = '#ff6b6b';
            await this.platform.flashLED(2, 3, 150);
            this.consecutiveIncorrect++;
            this.consecutiveCorrect = 0;
        }
        
        await this.platform.delay(2000);
        
        // Adaptive difficulty adjustment
        this.trialsAtCurrentLength++;
        
        if (this.trialsAtCurrentLength >= this.maxTrialsPerLength) {
            // Move to next length
            this.trialsAtCurrentLength = 0;
            
            if (this.consecutiveCorrect >= this.maxTrialsPerLength && this.sequenceLength < this.maxSequenceLength) {
                // Increase difficulty
                this.sequenceLength++;
                statusMessage.textContent = 'Increasing difficulty!';
                statusMessage.style.color = '#fbbf24';
                await this.platform.delay(1500);
            } else if (this.consecutiveIncorrect >= this.maxTrialsPerLength && this.sequenceLength > this.minSequenceLength) {
                // Decrease difficulty
                this.sequenceLength--;
                statusMessage.textContent = 'Adjusting difficulty...';
                statusMessage.style.color = '#fbbf24';
                await this.platform.delay(1500);
            } else if (this.consecutiveIncorrect >= this.maxTrialsPerLength) {
                // Switch phase if at minimum length
                if (this.currentPhase === this.phases.forward) {
                    this.switchToBackwardPhase();
                    return;
                } else {
                    // End test if failing at minimum length in backward phase
                    this.complete();
                    return;
                }
            }
        }
        
        statusMessage.style.color = '#fbbf24';
        this.startTrial();
    }

    async switchToBackwardPhase() {
        this.currentPhase = this.phases.backward;
        this.sequenceLength = 3; // Reset to starting length
        this.consecutiveCorrect = 0;
        this.consecutiveIncorrect = 0;
        this.trialsAtCurrentLength = 0;
        
        const phaseInstructions = document.getElementById('phaseInstructions');
        phaseInstructions.innerHTML = `
            <h4>BACKWARD SPAN</h4>
            <p>Watch the sequence of lights, then reproduce it in <strong>REVERSE ORDER</strong></p>
        `;
        phaseInstructions.style.background = 'rgba(251,191,36,0.15)';
        phaseInstructions.style.borderColor = '#fbbf24';
        phaseInstructions.querySelector('h4').style.color = '#fbbf24';
        
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = 'Starting BACKWARD SPAN phase...';
        
        await this.platform.delay(3000);
        this.startTrial();
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
        const totalSpan = this.forwardSpan + this.backwardSpan;
        const forwardTotal = this.forwardCorrect + this.forwardIncorrect;
        const backwardTotal = this.backwardCorrect + this.backwardIncorrect;
        
        const forwardAccuracy = forwardTotal > 0 ? (this.forwardCorrect / forwardTotal) * 100 : 0;
        const backwardAccuracy = backwardTotal > 0 ? (this.backwardCorrect / backwardTotal) * 100 : 0;
        
        return {
            testName: 'Digit Span',
            totalTrials: this.currentTrial,
            forwardSpan: this.forwardSpan,
            backwardSpan: this.backwardSpan,
            totalSpan: totalSpan,
            forwardCorrect: this.forwardCorrect,
            forwardIncorrect: this.forwardIncorrect,
            forwardAccuracy: forwardAccuracy.toFixed(2),
            backwardCorrect: this.backwardCorrect,
            backwardIncorrect: this.backwardIncorrect,
            backwardAccuracy: backwardAccuracy.toFixed(2),
            workingMemoryCapacity: totalSpan,
            executiveFunction: this.backwardSpan // Backward span is a measure of executive function
        };
    }
}
