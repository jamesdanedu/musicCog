// js/tests/simple-reaction.js - Simple Reaction Time Test Implementation

class SimpleReactionTest {
    constructor(canvas, ctx, platform, config) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.platform = platform;
        this.config = config;
        
        // Scale factors
        this.scaleX = canvas.width / 800;
        this.scaleY = canvas.height / 600;
        
        // Test parameters
        this.duration = config.duration || 120000; // 2 minutes
        this.minInterval = 1000; // Minimum 1 second between stimuli
        this.maxInterval = 4000; // Maximum 4 seconds between stimuli
        
        // Stimulus properties
        this.stimulusSize = 80 * Math.min(this.scaleX, this.scaleY);
        this.stimulusColor = '#ff4444';
        this.stimulusActive = false;
        this.stimulusOnsetTime = 0;
        
        // Test state
        this.running = false;
        this.started = false;
        this.startTime = 0;
        this.nextStimulusTime = 0;
        this.trialCount = 0;
        this.responseCount = 0;
        
        // Data collection
        this.reactionTimes = [];
        this.missedStimuli = 0;
        this.falseStarts = 0;
        this.currentTrial = null;
        
        // Visual feedback
        this.feedbackText = '';
        this.feedbackColor = '#ffffff';
        this.feedbackTimer = 0;
        
        // Instructions phase
        this.showingInstructions = true;
        this.instructionPhase = 0; // 0=intro, 1=ready, 2=running
        
        this.initialize();
    }

    initialize() {
        // Start with instructions
        this.showingInstructions = true;
        this.instructionPhase = 0;
        
        // Set up canvas
        this.canvas.width = Math.min(800 * this.scaleX, this.canvas.clientWidth);
        this.canvas.height = Math.min(600 * this.scaleY, this.canvas.clientHeight);
        
        // Begin render loop
        this.gameLoop = this.gameLoop.bind(this);
        this.gameLoop();
        
        console.log('Simple Reaction Test initialized');
    }

    handleButtonPress(buttonIndex, timestamp) {
        // Only respond to button 0 (first button)
        if (buttonIndex !== 0) return;
        
        if (this.showingInstructions) {
            this.handleInstructionAdvance();
            return;
        }
        
        if (!this.running) return;
        
        if (this.stimulusActive) {
            // Valid response
            const reactionTime = timestamp - this.stimulusOnsetTime;
            this.handleValidResponse(reactionTime, timestamp);
        } else {
            // False start (response without stimulus)
            this.handleFalseStart(timestamp);
        }
    }

    handleButtonRelease(buttonIndex, timestamp) {
        // Not used in this test
    }

    handleInstructionAdvance() {
        switch (this.instructionPhase) {
            case 0: // Show ready screen
                this.instructionPhase = 1;
                break;
            case 1: // Start test
                this.startTest();
                break;
        }
    }

    startTest() {
        this.showingInstructions = false;
        this.running = true;
        this.started = true;
        this.startTime = performance.now();
        
        // Schedule first stimulus
        this.scheduleNextStimulus();
        
        // Log test start
        this.platform.dataLogger.startTest({
            testType: 'simple-reaction',
            duration: this.duration,
            config: this.config
        });
        
        // Update UI
        this.updateStats();
        
        console.log('Simple Reaction Test started');
    }

    scheduleNextStimulus() {
        if (!this.running) return;
        
        // Random interval between min and max
        const interval = this.minInterval + Math.random() * (this.maxInterval - this.minInterval);
        this.nextStimulusTime = performance.now() + interval;
        
        // Log stimulus scheduling
        this.platform.dataLogger.logEvent({
            type: 'stimulus_scheduled',
            timestamp: performance.now(),
            scheduledTime: this.nextStimulusTime,
            interval: interval
        });
    }

    showStimulus() {
        this.stimulusActive = true;
        this.stimulusOnsetTime = performance.now();
        this.trialCount++;
        
        this.currentTrial = {
            trialNumber: this.trialCount,
            stimulusOnset: this.stimulusOnsetTime,
            responded: false
        };
        
        // Log stimulus onset
        this.platform.dataLogger.logTrialStart(this.currentTrial);
        this.platform.dataLogger.logStimulusOnset({
            stimulusType: 'visual',
            position: 'center',
            color: this.stimulusColor,
            size: this.stimulusSize
        });
        
        // Set timeout for missed response (2 seconds)
        this.stimulusTimeout = setTimeout(() => {
            if (this.stimulusActive) {
                this.handleMissedResponse();
            }
        }, 2000);
        
        console.log(`Stimulus ${this.trialCount} shown at ${this.stimulusOnsetTime}`);
    }

    handleValidResponse(reactionTime, timestamp) {
        this.stimulusActive = false;
        this.responseCount++;
        this.currentTrial.responded = true;
        this.currentTrial.reactionTime = reactionTime;
        this.currentTrial.responseTime = timestamp;
        
        // Clear timeout
        if (this.stimulusTimeout) {
            clearTimeout(this.stimulusTimeout);
            this.stimulusTimeout = null;
        }
        
        // Store reaction time
        this.reactionTimes.push(reactionTime);
        
        // Log response
        const rtData = this.platform.dataLogger.logReactionTime(
            this.stimulusOnsetTime, 
            timestamp, 
            true, 
            {
                trialNumber: this.trialCount,
                stimulusType: 'visual'
            }
        );
        
        this.platform.dataLogger.logTrialEnd(this.currentTrial);
        
        // Provide feedback
        this.showFeedback(reactionTime);
        
        // Update metrics
        this.platform.metricsCollector.collectReactionTime(
            this.stimulusOnsetTime, 
            timestamp, 
            true
        );
        
        // Schedule next stimulus
        this.scheduleNextStimulus();
        
        // Update UI
        this.updateStats();
        
        console.log(`Valid response: ${reactionTime.toFixed(2)}ms`);
    }

    handleMissedResponse() {
        this.stimulusActive = false;
        this.missedStimuli++;
        
        if (this.currentTrial) {
            this.currentTrial.missed = true;
            this.platform.dataLogger.logTrialEnd(this.currentTrial);
        }
        
        // Log missed response
        this.platform.dataLogger.logEvent({
            type: 'missed_response',
            timestamp: performance.now(),
            trialNumber: this.trialCount,
            stimulusOnset: this.stimulusOnsetTime
        });
        
        this.showFeedback(null, 'Too slow!', '#ff8800');
        
        // Schedule next stimulus
        this.scheduleNextStimulus();
        
        console.log(`Missed stimulus ${this.trialCount}`);
    }

    handleFalseStart(timestamp) {
        this.falseStarts++;
        
        // Log false start
        this.platform.dataLogger.logEvent({
            type: 'false_start',
            timestamp: timestamp
        });
        
        this.showFeedback(null, 'Too early!', '#ff4444');
        
        console.log('False start detected');
    }

    showFeedback(reactionTime, customText = null, customColor = null) {
        if (customText) {
            this.feedbackText = customText;
            this.feedbackColor = customColor || '#ffffff';
        } else if (reactionTime !== null) {
            // Categorize reaction time
            if (reactionTime < 150) {
                this.feedbackText = 'Too fast!';
                this.feedbackColor = '#ffaa00';
            } else if (reactionTime < 250) {
                this.feedbackText = `Excellent! ${reactionTime.toFixed(0)}ms`;
                this.feedbackColor = '#00ff00';
            } else if (reactionTime < 350) {
                this.feedbackText = `Good! ${reactionTime.toFixed(0)}ms`;
                this.feedbackColor = '#88ff88';
            } else if (reactionTime < 500) {
                this.feedbackText = `OK ${reactionTime.toFixed(0)}ms`;
                this.feedbackColor = '#ffff88';
            } else {
                this.feedbackText = `Slow ${reactionTime.toFixed(0)}ms`;
                this.feedbackColor = '#ff8888';
            }
        }
        
        this.feedbackTimer = 60; // Show for 1 second at 60fps
    }

    update() {
        if (!this.running && !this.showingInstructions) return;
        
        const now = performance.now();
        
        if (this.running) {
            // Check if test duration is complete
            if (now - this.startTime >= this.duration) {
                this.endTest();
                return;
            }
            
            // Check if it's time to show stimulus
            if (!this.stimulusActive && now >= this.nextStimulusTime) {
                this.showStimulus();
            }
            
            // Update stats
            this.updateStats();
        }
        
        // Update feedback timer
        if (this.feedbackTimer > 0) {
            this.feedbackTimer--;
        }
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.showingInstructions) {
            this.drawInstructions();
        } else if (this.running) {
            this.drawTest();
        } else {
            this.drawResults();
        }
    }

    drawInstructions() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        
        if (this.instructionPhase === 0) {
            // Introduction screen
            this.ctx.font = `bold ${Math.max(32, 48 * this.scaleY)}px Arial`;
            this.ctx.fillText('Simple Reaction Time Test', centerX, centerY - 120 * this.scaleY);
            
            this.ctx.font = `${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.fillText('A red circle will appear at random times', centerX, centerY - 60 * this.scaleY);
            this.ctx.fillText('Press the RED button as quickly as possible', centerX, centerY - 30 * this.scaleY);
            this.ctx.fillText('when you see the circle', centerX, centerY);
            
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.fillText('⚠️ Do NOT press before the circle appears', centerX, centerY + 40 * this.scaleY);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = `bold ${Math.max(20, 28 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press RED button to continue', centerX, centerY + 100 * this.scaleY);
            
        } else if (this.instructionPhase === 1) {
            // Ready screen
            this.ctx.font = `bold ${Math.max(36, 54 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText('Get Ready!', centerX, centerY - 40 * this.scaleY);
            
            this.ctx.font = `${Math.max(20, 28 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`Test Duration: ${this.duration / 1000} seconds`, centerX, centerY);
            this.ctx.fillText('Stay focused and respond as quickly as possible', centerX, centerY + 30 * this.scaleY);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = `bold ${Math.max(22, 30 * this.scaleY)}px Arial`;
            this.ctx.fillText('Press RED button to START', centerX, centerY + 80 * this.scaleY);
        }
    }

    drawTest() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Draw fixation cross when no stimulus
        if (!this.stimulusActive) {
            this.ctx.strokeStyle = '#666666';
            this.ctx.lineWidth = 3;
            const crossSize = 20 * Math.min(this.scaleX, this.scaleY);
            
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - crossSize, centerY);
            this.ctx.lineTo(centerX + crossSize, centerY);
            this.ctx.moveTo(centerX, centerY - crossSize);
            this.ctx.lineTo(centerX, centerY + crossSize);
            this.ctx.stroke();
        }
        
        // Draw stimulus when active
        if (this.stimulusActive) {
            this.ctx.fillStyle = this.stimulusColor;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, this.stimulusSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add pulsing effect
            const pulseAlpha = 0.3 + 0.3 * Math.sin((performance.now() - this.stimulusOnsetTime) * 0.01);
            this.ctx.fillStyle = `rgba(255, 68, 68, ${pulseAlpha})`;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, this.stimulusSize / 2 + 10, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw feedback
        if (this.feedbackTimer > 0) {
            this.ctx.fillStyle = this.feedbackColor;
            this.ctx.font = `bold ${Math.max(24, 32 * this.scaleY)}px Arial`;
            this.ctx.textAlign = 'center';
            
            const alpha = Math.min(1, this.feedbackTimer / 20);
            this.ctx.globalAlpha = alpha;
            this.ctx.fillText(this.feedbackText, centerX, centerY + 120 * this.scaleY);
            this.ctx.globalAlpha = 1;
        }
        
        // Draw progress and stats
        this.drawTestUI();
    }

    drawTestUI() {
        // Time remaining
        const timeRemaining = Math.max(0, this.duration - (performance.now() - this.startTime));
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, 20, 30);
        
        // Trial count
        this.ctx.fillText(`Trials: ${this.trialCount}`, 20, 55);
        
        // Response statistics
        if (this.reactionTimes.length > 0) {
            const avgRT = this.reactionTimes.reduce((a, b) => a + b) / this.reactionTimes.length;
            this.ctx.fillText(`Avg RT: ${avgRT.toFixed(0)}ms`, 20, 80);
        }
        
        // Accuracy info
        this.ctx.fillText(`Responded: ${this.responseCount}`, 20, 105);
        this.ctx.fillText(`Missed: ${this.missedStimuli}`, 20, 130);
        this.ctx.fillText(`False starts: ${this.falseStarts}`, 20, 155);
        
        // Progress bar
        const progress = Math.min(1, (performance.now() - this.startTime) / this.duration);
        const barWidth = this.canvas.width - 40;
        const barHeight = 8;
        const barY = this.canvas.height - 30;
        
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(20, barY, barWidth, barHeight);
        
        this.ctx.fillStyle = '#00aa00';
        this.ctx.fillRect(20, barY, barWidth * progress, barHeight);
        
        // Instructions
        this.ctx.textAlign = 'center';
        this.ctx.font = `${Math.max(14, 18 * this.scaleY)}px Arial`;
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.fillText('Press RED button when circle appears', this.canvas.width / 2, this.canvas.height - 50);
    }

    drawResults() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        
        // Title
        this.ctx.font = `bold ${Math.max(32, 42 * this.scaleY)}px Arial`;
        this.ctx.fillText('Test Complete!', centerX, centerY - 120 * this.scaleY);
        
        // Results
        if (this.reactionTimes.length > 0) {
            const avgRT = this.reactionTimes.reduce((a, b) => a + b) / this.reactionTimes.length;
            const minRT = Math.min(...this.reactionTimes);
            const maxRT = Math.max(...this.reactionTimes);
            const consistency = this.calculateConsistency();
            
            this.ctx.font = `${Math.max(18, 24 * this.scaleY)}px Arial`;
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillText(`Average Reaction Time: ${avgRT.toFixed(1)}ms`, centerX, centerY - 60 * this.scaleY);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(`Fastest: ${minRT.toFixed(0)}ms`, centerX, centerY - 30 * this.scaleY);
            this.ctx.fillText(`Slowest: ${maxRT.toFixed(0)}ms`, centerX, centerY);
            this.ctx.fillText(`Consistency: ${consistency.toFixed(1)}%`, centerX, centerY + 30 * this.scaleY);
            
            // Performance rating
            let rating = 'Good';
            let ratingColor = '#ffff00';
            
            if (avgRT < 200) {
                rating = 'Excellent';
                ratingColor = '#00ff00';
            } else if (avgRT < 300) {
                rating = 'Very Good';
                ratingColor = '#88ff00';
            } else if (avgRT < 400) {
                rating = 'Good';
                ratingColor = '#ffff00';
            } else {
                rating = 'Needs Practice';
                ratingColor = '#ff8800';
            }
            
            this.ctx.fillStyle = ratingColor;
            this.ctx.font = `bold ${Math.max(24, 32 * this.scaleY)}px Arial`;
            this.ctx.fillText(`Rating: ${rating}`, centerX, centerY + 70 * this.scaleY);
        } else {
            this.ctx.fillStyle = '#ff8800';
            this.ctx.font = `${Math.max(20, 28 * this.scaleY)}px Arial`;
            this.ctx.fillText('No valid responses recorded', centerX, centerY);
        }
        
        // Summary stats
        this.ctx.fillStyle = '#aaaaaa';
        this.ctx.font = `${Math.max(16, 20 * this.scaleY)}px Arial`;
        this.ctx.fillText(`Total Stimuli: ${this.trialCount}`, centerX, centerY + 110 * this.scaleY);
        this.ctx.fillText(`Responses: ${this.responseCount} | Missed: ${this.missedStimuli} | False Starts: ${this.falseStarts}`, centerX, centerY + 135 * this.scaleY);
    }

    calculateConsistency() {
        if (this.reactionTimes.length < 2) return 100;
        
        const mean = this.reactionTimes.reduce((a, b) => a + b) / this.reactionTimes.length;
        const variance = this.reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / this.reactionTimes.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Convert to consistency percentage (lower SD = higher consistency)
        const coefficientOfVariation = standardDeviation / mean;
        return Math.max(0, 100 - (coefficientOfVariation * 100));
    }

    updateStats() {
        // Update platform statistics display
        if (this.reactionTimes.length > 0) {
            const avgRT = this.reactionTimes.reduce((a, b) => a + b) / this.reactionTimes.length;
            this.platform.updateTestStat('reactionTime', `${avgRT.toFixed(0)}ms`);
        }
        
        const accuracy = this.trialCount > 0 ? (this.responseCount / this.trialCount) * 100 : 0;
        this.platform.updateTestStat('accuracy', `${accuracy.toFixed(1)}%`);
        
        this.platform.updateTestStat('currentScore', this.responseCount.toString());
        
        const timeRemaining = Math.max(0, this.duration - (performance.now() - this.startTime));
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        this.platform.updateTestStat('timeRemaining', `${minutes}:${seconds.toString().padStart(2, '0')}`);
    }

    endTest() {
        this.running = false;
        
        // Calculate final results
        const results = {
            trialCount: this.trialCount,
            responseCount: this.responseCount,
            missedStimuli: this.missedStimuli,
            falseStarts: this.falseStarts,
            reactionTimes: [...this.reactionTimes],
            averageRT: this.reactionTimes.length > 0 ? this.reactionTimes.reduce((a, b) => a + b) / this.reactionTimes.length : null,
            consistency: this.calculateConsistency(),
            accuracy: this.trialCount > 0 ? (this.responseCount / this.trialCount) * 100 : 0
        };
        
        // Log test end
        this.platform.dataLogger.endTest(results);
        
        // Notify platform
        setTimeout(() => {
            this.platform.onTestComplete(results);
        }, 3000); // Show results for 3 seconds
        
        console.log('Simple Reaction Test completed:', results);
    }

    gameLoop() {
        this.update();
        this.draw();
        
        if (this.running || this.showingInstructions || this.feedbackTimer > 0) {
            requestAnimationFrame(this.gameLoop);
        }
    }

    getCurrentPhase() {
        if (this.showingInstructions) return 'instructions';
        if (this.running) return 'testing';
        return 'completed';
    }

    destroy() {
        this.running = false;
        if (this.stimulusTimeout) {
            clearTimeout(this.stimulusTimeout);
        }
        console.log('Simple Reaction Test destroyed');
    }
}
