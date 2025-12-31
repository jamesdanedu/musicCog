// js/session-controller.js - Manages test session flow with suites and conditions

class SessionController {
    constructor(platform) {
        this.platform = platform;
        this.selectedSuites = ['reaction-inhibition']; // Default to Suite 1
        this.musicConditions = ['silence', 'classical-80bpm', 'electronic-140bpm'];
        
        // Session state
        this.currentSession = null;
        this.testQueue = [];
        this.currentTestIndex = 0;
        this.currentConditionIndex = 0;
        
        // Bind methods
        this.toggleSuite = this.toggleSuite.bind(this);
        this.startTesting = this.startTesting.bind(this);
    }

    // === SUITE SELECTION ===
    
    toggleSuite(cardElement) {
        const suiteId = cardElement.dataset.suite;
        
        if (cardElement.classList.contains('selected')) {
            // Don't allow deselecting if it's the only selected suite
            const selectedCards = document.querySelectorAll('.suite-card.selected');
            if (selectedCards.length <= 1) {
                this.showMessage('At least one suite must be selected', 'warning');
                return;
            }
            cardElement.classList.remove('selected');
            this.selectedSuites = this.selectedSuites.filter(s => s !== suiteId);
        } else {
            cardElement.classList.add('selected');
            this.selectedSuites.push(suiteId);
        }
        
        this.updateTimeEstimate();
    }

    updateTimeEstimate() {
        const numSuites = this.selectedSuites.length;
        const numConditions = this.musicConditions.length;
        
        // Calculate based on selected suites
        let testsPerCondition = 0;
        let testTimePerCondition = 0;
        
        this.selectedSuites.forEach(suiteId => {
            const suite = TEST_SUITES[suiteId === 'reaction-inhibition' ? 'reactionInhibition' : 'cognitiveLoad'];
            testsPerCondition += suite.tests.length;
            suite.tests.forEach(testId => {
                testTimePerCondition += TEST_CONFIGURATIONS[testId].duration;
            });
        });
        
        // Total time calculation
        const totalTestTime = testTimePerCondition * numConditions;
        const transitionTime = (testsPerCondition * numConditions) * 5000; // 5 sec per test transition
        const conditionTransitions = (numConditions - 1) * 10000; // 10 sec between conditions
        const overhead = 180000; // 3 min for form + results
        
        const totalMs = totalTestTime + transitionTime + conditionTransitions + overhead;
        const totalMinutes = Math.ceil(totalMs / 60000);
        
        // Update UI
        const timeValue = document.getElementById('estimatedTime');
        const timeBreakdown = document.getElementById('timeBreakdown');
        
        if (timeValue) {
            timeValue.textContent = `~${totalMinutes} minutes`;
            
            // Color code based on time
            if (totalMinutes <= 17) {
                timeValue.style.color = '#4ade80'; // Green
            } else if (totalMinutes <= 25) {
                timeValue.style.color = '#fbbf24'; // Yellow
            } else {
                timeValue.style.color = '#f87171'; // Red
            }
        }
        
        if (timeBreakdown) {
            timeBreakdown.textContent = `${testsPerCondition} tests × ${numConditions} conditions + transitions`;
        }
    }

    // === SESSION INITIALIZATION ===
    
    async startTesting() {
        if (this.selectedSuites.length === 0) {
            this.showMessage('Please select at least one test suite', 'error');
            return;
        }

        // Build test queue
        this.buildTestQueue();
        
        // Initialize session data
        this.currentSession.testQueue = this.testQueue;
        this.currentSession.selectedSuites = [...this.selectedSuites];
        this.currentSession.musicConditions = [...this.musicConditions];
        this.currentSession.startTime = new Date().toISOString();
        this.currentSession.results = [];
        
        // Reset indices
        this.currentTestIndex = 0;
        this.currentConditionIndex = 0;
        
        // Show test screen
        this.platform.showScreen('testScreen');
        
        // Start first condition
        await this.startNextCondition();
    }

    buildTestQueue() {
        this.testQueue = [];
        
        // For each condition
        this.musicConditions.forEach((conditionId, condIndex) => {
            const condition = MUSIC_CONDITIONS.find(c => c.id === conditionId) || 
                             { id: conditionId, name: conditionId };
            
            // For each selected suite
            this.selectedSuites.forEach(suiteId => {
                const suiteKey = suiteId === 'reaction-inhibition' ? 'reactionInhibition' : 'cognitiveLoad';
                const suite = TEST_SUITES[suiteKey];
                
                // For each test in suite
                suite.tests.forEach(testId => {
                    this.testQueue.push({
                        testId: testId,
                        testConfig: TEST_CONFIGURATIONS[testId],
                        conditionId: condition.id,
                        conditionName: condition.name,
                        conditionIndex: condIndex,
                        suiteId: suiteId,
                        suiteName: suite.name
                    });
                });
            });
        });
        
        console.log(`Built test queue with ${this.testQueue.length} tests`);
        console.log('Queue:', this.testQueue.map(t => `${t.testConfig.name} (${t.conditionName})`));
    }

    // === TEST EXECUTION FLOW ===
    
    async startNextCondition() {
        const currentItem = this.testQueue[this.currentTestIndex];
        
        if (!currentItem) {
            // All done
            await this.completeSession();
            return;
        }
        
        // Check if this is a new condition
        const isNewCondition = this.currentTestIndex === 0 || 
            this.testQueue[this.currentTestIndex - 1].conditionId !== currentItem.conditionId;
        
        if (isNewCondition) {
            // Show condition transition screen
            await this.showConditionTransition(currentItem);
            
            // Setup audio for this condition
            await this.setupAudioCondition(currentItem.conditionId);
        }
        
        // Run the test
        await this.runTest(currentItem);
    }

    async showConditionTransition(testItem) {
        const conditionIndex = testItem.conditionIndex + 1;
        const totalConditions = this.musicConditions.length;
        
        return new Promise(resolve => {
            const testContent = document.getElementById('testContent');
            if (testContent) {
                testContent.innerHTML = `
                    <div class="condition-transition">
                        <div class="condition-number">Condition ${conditionIndex} of ${totalConditions}</div>
                        <h2 class="condition-name">${testItem.conditionName}</h2>
                        <p class="condition-instruction">
                            ${this.getConditionInstruction(testItem.conditionId)}
                        </p>
                        <div class="countdown" id="conditionCountdown">Starting in 5...</div>
                    </div>
                    <style>
                        .condition-transition {
                            text-align: center;
                            padding: 60px 40px;
                        }
                        .condition-number {
                            font-size: 1.2em;
                            color: rgba(255,255,255,0.6);
                            margin-bottom: 10px;
                        }
                        .condition-name {
                            font-size: 2.5em;
                            margin: 20px 0;
                            color: #667eea;
                        }
                        .condition-instruction {
                            font-size: 1.1em;
                            color: rgba(255,255,255,0.8);
                            margin-bottom: 30px;
                        }
                        .countdown {
                            font-size: 1.5em;
                            color: #4ade80;
                        }
                    </style>
                `;
            }
            
            // Countdown
            let count = 5;
            const countdownEl = document.getElementById('conditionCountdown');
            const interval = setInterval(() => {
                count--;
                if (countdownEl) {
                    countdownEl.textContent = count > 0 ? `Starting in ${count}...` : 'Starting...';
                }
                if (count <= 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        });
    }

    getConditionInstruction(conditionId) {
        const instructions = {
            'silence': 'This block will be completed in silence. Focus on the tests.',
            'classical-80bpm': 'You will hear slow classical music during this block.',
            'classical-120bpm': 'You will hear medium-tempo classical music during this block.',
            'electronic-140bpm': 'You will hear fast electronic music during this block.',
            'white-noise': 'You will hear white noise during this block.',
            'ambient': 'You will hear ambient soundscape during this block.',
            'binaural': 'You will hear binaural beats during this block. Use headphones for best effect.'
        };
        return instructions[conditionId] || 'Complete the following tests.';
    }

    async setupAudioCondition(conditionId) {
        // Stop any current audio
        await this.platform.stopAudio();
        
        if (conditionId === 'silence') {
            // No audio needed
            return;
        }
        
        const condition = MUSIC_CONDITIONS.find(c => c.id === conditionId) ||
                         ALTERNATIVE_CONDITIONS[conditionId];
        
        if (!condition) {
            console.warn(`Unknown condition: ${conditionId}`);
            return;
        }
        
        if (condition.type === 'noise' && conditionId === 'white-noise') {
            // Generate white noise
            await this.platform.generateWhiteNoise();
        } else if (condition.file) {
            // Load audio file
            await this.platform.loadAudio(condition.file);
        }
    }

    async runTest(testItem) {
        console.log(`Running test: ${testItem.testConfig.name} under ${testItem.conditionName}`);
        
        // Update UI
        this.updateTestProgress(testItem);
        
        // Get the test class
        const TestClass = this.getTestClass(testItem.testId);
        
        if (!TestClass) {
            console.error(`Test class not found for: ${testItem.testId}`);
            this.currentTestIndex++;
            await this.startNextCondition();
            return;
        }
        
        // Create and run test instance
        const testInstance = new TestClass(testItem.testConfig, this.platform);
        
        try {
            await testInstance.initialize();
            
            // Wait for test completion
            const results = await testInstance.complete();
            
            // Store results
            this.currentSession.results.push({
                testId: testItem.testId,
                testName: testItem.testConfig.name,
                conditionId: testItem.conditionId,
                conditionName: testItem.conditionName,
                suiteId: testItem.suiteId,
                timestamp: new Date().toISOString(),
                duration: results.duration,
                metrics: results.metrics,
                rawData: results.rawData
            });
            
            // Move to next test
            this.currentTestIndex++;
            
            // Brief pause between tests
            await this.delay(2000);
            
            // Continue
            await this.startNextCondition();
            
        } catch (error) {
            console.error('Test error:', error);
            this.currentTestIndex++;
            await this.startNextCondition();
        }
    }

    updateTestProgress(testItem) {
        const progressFill = document.getElementById('progressFill');
        const currentTestName = document.getElementById('currentTestName');
        const testTitle = document.getElementById('testTitle');
        
        const progress = ((this.currentTestIndex) / this.testQueue.length) * 100;
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${Math.round(progress)}%`;
        }
        
        if (currentTestName) {
            currentTestName.textContent = `${testItem.testConfig.name} — ${testItem.conditionName}`;
        }
        
        if (testTitle) {
            testTitle.textContent = testItem.testConfig.name;
        }
    }

    getTestClass(testId) {
        const classMap = {
            'simple-reaction': typeof SimpleReactionTest !== 'undefined' ? SimpleReactionTest : null,
            'go-nogo': typeof GoNoGoTest !== 'undefined' ? GoNoGoTest : null,
            'stroop': typeof StroopTest !== 'undefined' ? StroopTest : null,
            'choice-reaction': typeof ChoiceReactionTest !== 'undefined' ? ChoiceReactionTest : null,
            'digit-span': typeof DigitSpanTest !== 'undefined' ? DigitSpanTest : null,
            'n-back': typeof NBackTest !== 'undefined' ? NBackTest : null
        };
        return classMap[testId] || null;
    }

    // === SESSION COMPLETION ===
    
    async completeSession() {
        // Stop audio
        await this.platform.stopAudio();
        
        // Mark session complete
        this.currentSession.endTime = new Date().toISOString();
        this.currentSession.status = 'completed';
        
        // Calculate summary statistics
        this.currentSession.summary = this.calculateSessionSummary();
        
        // Save session
        await this.saveSession();
        
        // Show results
        this.platform.showScreen('resultsScreen');
        this.displayResults();
    }

    calculateSessionSummary() {
        const summary = {
            totalTests: this.currentSession.results.length,
            byCondition: {},
            bySuite: {},
            overall: {}
        };
        
        // Group by condition
        this.musicConditions.forEach(condId => {
            const conditionResults = this.currentSession.results.filter(r => r.conditionId === condId);
            summary.byCondition[condId] = this.aggregateMetrics(conditionResults);
        });
        
        // Group by suite
        this.selectedSuites.forEach(suiteId => {
            const suiteResults = this.currentSession.results.filter(r => r.suiteId === suiteId);
            summary.bySuite[suiteId] = this.aggregateMetrics(suiteResults);
        });
        
        // Overall
        summary.overall = this.aggregateMetrics(this.currentSession.results);
        
        return summary;
    }

    aggregateMetrics(results) {
        if (results.length === 0) return {};
        
        const allRTs = [];
        const allAccuracies = [];
        
        results.forEach(r => {
            if (r.metrics.meanRT) allRTs.push(r.metrics.meanRT);
            if (r.metrics.accuracy) allAccuracies.push(parseFloat(r.metrics.accuracy));
        });
        
        return {
            testCount: results.length,
            avgRT: allRTs.length > 0 ? Math.round(allRTs.reduce((a,b) => a+b) / allRTs.length) : null,
            avgAccuracy: allAccuracies.length > 0 ? 
                (allAccuracies.reduce((a,b) => a+b) / allAccuracies.length).toFixed(1) : null
        };
    }

    async saveSession() {
        try {
            // Save via IPC to main process
            if (typeof ipcRenderer !== 'undefined') {
                await ipcRenderer.invoke('save-session', this.currentSession);
            }
            
            // Also save to localStorage as backup
            const sessions = JSON.parse(localStorage.getItem('sessions') || '[]');
            sessions.push(this.currentSession);
            localStorage.setItem('sessions', JSON.stringify(sessions));
            
            console.log('Session saved successfully');
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    displayResults() {
        const resultsContent = document.getElementById('resultsContent') || 
                              document.getElementById('performanceSummary');
        
        if (!resultsContent) return;
        
        let html = '<div class="results-grid">';
        
        // By condition comparison
        html += '<div class="results-section"><h3>Performance by Condition</h3>';
        this.musicConditions.forEach(condId => {
            const stats = this.currentSession.summary.byCondition[condId];
            const condName = MUSIC_CONDITIONS.find(c => c.id === condId)?.name || condId;
            html += `
                <div class="condition-result">
                    <span class="cond-name">${condName}</span>
                    <span class="cond-stat">RT: ${stats.avgRT || '--'}ms</span>
                    <span class="cond-stat">Acc: ${stats.avgAccuracy || '--'}%</span>
                </div>
            `;
        });
        html += '</div>';
        
        // Individual test results
        html += '<div class="results-section"><h3>Individual Tests</h3>';
        this.currentSession.results.forEach(r => {
            html += `
                <div class="test-result-row">
                    <span class="test-name">${r.testName}</span>
                    <span class="test-condition">${r.conditionName}</span>
                    <span class="test-metrics">
                        ${r.metrics.meanRT ? `RT: ${Math.round(r.metrics.meanRT)}ms` : ''}
                        ${r.metrics.accuracy ? `Acc: ${r.metrics.accuracy}%` : ''}
                    </span>
                </div>
            `;
        });
        html += '</div></div>';
        
        resultsContent.innerHTML = html;
    }

    // === UTILITIES ===
    
    showMessage(message, type = 'info') {
        // Simple alert for now, could be replaced with toast notification
        alert(message);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionController;
}
