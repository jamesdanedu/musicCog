// js/core/data-logger.js - Scientific Data Logging System

class DataLogger {
    constructor() {
        this.sessionLog = [];
        this.currentTestLog = [];
        this.metricsLog = [];
        this.audioMetrics = [];
        this.systemMetrics = [];
        
        // High-precision timing
        this.sessionStartTime = performance.now();
        this.currentTestStartTime = null;
        
        // Data validation
        this.requiredFields = ['type', 'timestamp'];
        this.validEventTypes = [
            'button_press', 'button_release', 'stimulus_onset', 'stimulus_offset',
            'response', 'trial_start', 'trial_end', 'test_start', 'test_end',
            'music_start', 'music_stop', 'calibration', 'error', 'system'
        ];
        
        // Performance monitoring
        this.performanceMetrics = {
            eventCount: 0,
            droppedEvents: 0,
            lastEventTime: 0,
            averageInterval: 0
        };
        
        console.log('DataLogger initialized');
    }

    // Primary logging method
    logEvent(event) {
        try {
            // Validate event
            if (!this.validateEvent(event)) {
                this.performanceMetrics.droppedEvents++;
                console.warn('Invalid event dropped:', event);
                return false;
            }
            
            // Enhance event with additional metadata
            const enhancedEvent = this.enhanceEvent(event);
            
            // Store in appropriate logs
            this.sessionLog.push(enhancedEvent);
            if (this.currentTestStartTime) {
                this.currentTestLog.push(enhancedEvent);
            }
            
            // Update performance metrics
            this.updatePerformanceMetrics(enhancedEvent);
            
            // Real-time data integrity check
            this.checkDataIntegrity(enhancedEvent);
            
            return true;
            
        } catch (error) {
            console.error('DataLogger error:', error);
            this.logSystemError('logging_error', error.message);
            return false;
        }
    }

    validateEvent(event) {
        // Check required fields
        if (!event || typeof event !== 'object') {
            return false;
        }
        
        for (const field of this.requiredFields) {
            if (!(field in event)) {
                return false;
            }
        }
        
        // Validate event type
        if (!this.validEventTypes.includes(event.type)) {
            return false;
        }
        
        // Validate timestamp
        if (typeof event.timestamp !== 'number' || event.timestamp < 0) {
            return false;
        }
        
        return true;
    }

    enhanceEvent(event) {
        const now = performance.now();
        
        return {
            ...event,
            sessionTime: now - this.sessionStartTime,
            testTime: this.currentTestStartTime ? now - this.currentTestStartTime : null,
            microsecondPrecision: now,
            sequence: this.sessionLog.length + 1,
            enhanced: true,
            metadata: {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };
    }

    updatePerformanceMetrics(event) {
        this.performanceMetrics.eventCount++;
        
        if (this.performanceMetrics.lastEventTime > 0) {
            const interval = event.timestamp - this.performanceMetrics.lastEventTime;
            this.performanceMetrics.averageInterval = 
                (this.performanceMetrics.averageInterval + interval) / 2;
        }
        
        this.performanceMetrics.lastEventTime = event.timestamp;
    }

    checkDataIntegrity(event) {
        // Check for temporal anomalies
        if (this.sessionLog.length > 1) {
            const prevEvent = this.sessionLog[this.sessionLog.length - 2];
            const timeDiff = event.timestamp - prevEvent.timestamp;
            
            // Flag suspiciously large time gaps (>5 seconds)
            if (timeDiff > 5000) {
                this.logSystemError('temporal_anomaly', 
                    `Large time gap detected: ${timeDiff}ms`);
            }
            
            // Flag negative time differences
            if (timeDiff < 0) {
                this.logSystemError('negative_time', 
                    `Negative time difference: ${timeDiff}ms`);
            }
        }
        
        // Check for button press/release pairing
        if (event.type === 'button_release') {
            const lastPress = this.findLastButtonPress(event.button);
            if (!lastPress) {
                this.logSystemError('unpaired_release', 
                    `Button release without corresponding press: ${event.button}`);
            }
        }
    }

    findLastButtonPress(buttonIndex) {
        for (let i = this.sessionLog.length - 1; i >= 0; i--) {
            const logEvent = this.sessionLog[i];
            if (logEvent.type === 'button_press' && logEvent.button === buttonIndex) {
                return logEvent;
            }
            if (logEvent.type === 'button_release' && logEvent.button === buttonIndex) {
                return null; // Found a release before press
            }
        }
        return null;
    }

    // Specialized logging methods
    logReactionTime(stimulusTime, responseTime, correct = null, additional = {}) {
        const reactionTime = responseTime - stimulusTime;
        
        this.logEvent({
            type: 'response',
            timestamp: responseTime,
            stimulusTime: stimulusTime,
            reactionTime: reactionTime,
            correct: correct,
            ...additional
        });
        
        return reactionTime;
    }

    logTrialStart(trialData) {
        this.logEvent({
            type: 'trial_start',
            timestamp: performance.now(),
            ...trialData
        });
    }

    logTrialEnd(trialData) {
        this.logEvent({
            type: 'trial_end',
            timestamp: performance.now(),
            ...trialData
        });
    }

    logStimulusOnset(stimulusData) {
        this.logEvent({
            type: 'stimulus_onset',
            timestamp: performance.now(),
            ...stimulusData
        });
    }

    logSystemError(errorType, message, additional = {}) {
        this.logEvent({
            type: 'error',
            timestamp: performance.now(),
            errorType: errorType,
            message: message,
            ...additional
        });
    }

    logCalibrationData(calibrationType, data) {
        this.logEvent({
            type: 'calibration',
            timestamp: performance.now(),
            calibrationType: calibrationType,
            calibrationData: data
        });
    }

    // Test session management
    startTest(testConfig) {
        this.currentTestStartTime = performance.now();
        this.currentTestLog = [];
        
        this.logEvent({
            type: 'test_start',
            timestamp: this.currentTestStartTime,
            testConfig: testConfig
        });
    }

    endTest(testResults) {
        const endTime = performance.now();
        
        this.logEvent({
            type: 'test_end',
            timestamp: endTime,
            duration: endTime - this.currentTestStartTime,
            testResults: testResults
        });
        
        // Archive current test log
        const testArchive = {
            testStartTime: this.currentTestStartTime,
            testEndTime: endTime,
            events: [...this.currentTestLog],
            summary: this.generateTestSummary()
        };
        
        this.archivedTests = this.archivedTests || [];
        this.archivedTests.push(testArchive);
        
        this.currentTestStartTime = null;
        this.currentTestLog = [];
        
        return testArchive;
    }

    // Audio and music logging
    logAudioEvent(eventType, audioData) {
        this.audioMetrics.push({
            timestamp: performance.now(),
            eventType: eventType,
            ...audioData
        });
        
        this.logEvent({
            type: 'music_' + eventType,
            timestamp: performance.now(),
            audioData: audioData
        });
    }

    logAudioFeatures(features) {
        this.audioMetrics.push({
            timestamp: performance.now(),
            features: features
        });
    }

    // Data export and analysis
    exportSessionData(format = 'json') {
        const exportData = {
            metadata: {
                sessionId: this.getSessionId(),
                exportTime: new Date().toISOString(),
                platform: navigator.platform,
                userAgent: navigator.userAgent,
                sessionDuration: performance.now() - this.sessionStartTime,
                eventCount: this.sessionLog.length,
                performanceMetrics: this.performanceMetrics
            },
            sessionLog: this.sessionLog,
            archivedTests: this.archivedTests || [],
            audioMetrics: this.audioMetrics,
            systemMetrics: this.systemMetrics
        };
        
        switch (format) {
            case 'json':
                return JSON.stringify(exportData, null, 2);
            case 'csv':
                return this.convertToCSV(exportData);
            default:
                return exportData;
        }
    }

    convertToCSV(data) {
        const headers = [
            'sequence', 'type', 'timestamp', 'sessionTime', 'testTime',
            'button', 'reactionTime', 'correct', 'stimulusType', 
            'responseType', 'accuracy', 'musicTime', 'testPhase',
            'errorType', 'message', 'additional'
        ];
        
        let csv = headers.join(',') + '\n';
        
        data.sessionLog.forEach(event => {
            const row = headers.map(header => {
                let value = event[header];
                
                // Handle nested objects
                if (value && typeof value === 'object') {
                    value = JSON.stringify(value);
                }
                
                // Handle undefined/null
                if (value === undefined || value === null) {
                    value = '';
                }
                
                // Escape commas and quotes
                if (typeof value === 'string') {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                
                return value;
            });
            
            csv += row.join(',') + '\n';
        });
        
        return csv;
    }

    // Analysis and summary methods
    generateSessionSummary() {
        const summary = {
            totalEvents: this.sessionLog.length,
            sessionDuration: performance.now() - this.sessionStartTime,
            eventTypes: this.countEventTypes(),
            buttonPresses: this.countButtonPresses(),
            reactionTimes: this.analyzeReactionTimes(),
            errorCount: this.countErrors(),
            performanceMetrics: this.performanceMetrics,
            dataQuality: this.assessDataQuality()
        };
        
        return summary;
    }

    generateTestSummary() {
        if (!this.currentTestLog.length) {
            return null;
        }
        
        const testEvents = this.currentTestLog;
        const reactionTimes = testEvents
            .filter(e => e.type === 'response' && e.reactionTime)
            .map(e => e.reactionTime);
        
        const responses = testEvents.filter(e => e.type === 'response');
        const correctResponses = responses.filter(e => e.correct === true);
        
        return {
            eventCount: testEvents.length,
            reactionTimes: {
                count: reactionTimes.length,
                mean: this.calculateMean(reactionTimes),
                median: this.calculateMedian(reactionTimes),
                std: this.calculateStandardDeviation(reactionTimes),
                min: Math.min(...reactionTimes),
                max: Math.max(...reactionTimes)
            },
            accuracy: responses.length > 0 ? correctResponses.length / responses.length : 0,
            responseCount: responses.length,
            correctCount: correctResponses.length
        };
    }

    countEventTypes() {
        const counts = {};
        this.sessionLog.forEach(event => {
            counts[event.type] = (counts[event.type] || 0) + 1;
        });
        return counts;
    }

    countButtonPresses() {
        const counts = {};
        this.sessionLog
            .filter(e => e.type === 'button_press')
            .forEach(event => {
                const button = event.button || 'unknown';
                counts[button] = (counts[button] || 0) + 1;
            });
        return counts;
    }

    analyzeReactionTimes() {
        const reactionTimes = this.sessionLog
            .filter(e => e.type === 'response' && e.reactionTime)
            .map(e => e.reactionTime);
        
        if (reactionTimes.length === 0) {
            return null;
        }
        
        return {
            count: reactionTimes.length,
            mean: this.calculateMean(reactionTimes),
            median: this.calculateMedian(reactionTimes),
            std: this.calculateStandardDeviation(reactionTimes),
            min: Math.min(...reactionTimes),
            max: Math.max(...reactionTimes),
            percentiles: {
                p25: this.calculatePercentile(reactionTimes, 25),
                p75: this.calculatePercentile(reactionTimes, 75),
                p90: this.calculatePercentile(reactionTimes, 90),
                p95: this.calculatePercentile(reactionTimes, 95)
            }
        };
    }

    countErrors() {
        return this.sessionLog.filter(e => e.type === 'error').length;
    }

    assessDataQuality() {
        const totalEvents = this.sessionLog.length;
        const errorEvents = this.countErrors();
        const droppedEvents = this.performanceMetrics.droppedEvents;
        
        return {
            errorRate: errorEvents / totalEvents,
            droppedEventRate: droppedEvents / (totalEvents + droppedEvents),
            temporalConsistency: this.checkTemporalConsistency(),
            completenessScore: this.calculateCompleteness()
        };
    }

    checkTemporalConsistency() {
        if (this.sessionLog.length < 2) return 1.0;
        
        let violations = 0;
        for (let i = 1; i < this.sessionLog.length; i++) {
            const prevTime = this.sessionLog[i-1].timestamp;
            const currTime = this.sessionLog[i].timestamp;
            
            if (currTime < prevTime) {
                violations++;
            }
        }
        
        return 1 - (violations / this.sessionLog.length);
    }

    calculateCompleteness() {
        // Check for expected event patterns
        const buttonPresses = this.sessionLog.filter(e => e.type === 'button_press');
        const buttonReleases = this.sessionLog.filter(e => e.type === 'button_release');
        
        // Expect roughly equal press/release events
        const balance = Math.min(buttonPresses.length, buttonReleases.length) / 
                      Math.max(buttonPresses.length, buttonReleases.length);
        
        return balance || 0;
    }

    // Statistical helper methods
    calculateMean(values) {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        
        const mean = this.calculateMean(values);
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(this.calculateMean(squareDiffs));
    }

    calculatePercentile(values, percentile) {
        if (values.length === 0) return 0;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        
        if (Math.floor(index) === index) {
            return sorted[index];
        } else {
            const lower = sorted[Math.floor(index)];
            const upper = sorted[Math.ceil(index)];
            return lower + (upper - lower) * (index - Math.floor(index));
        }
    }

    // Utility methods
    getSessionId() {
        return 'session_' + Date.now();
    }

    clearLogs() {
        this.sessionLog = [];
        this.currentTestLog = [];
        this.audioMetrics = [];
        this.systemMetrics = [];
        this.archivedTests = [];
        this.performanceMetrics = {
            eventCount: 0,
            droppedEvents: 0,
            lastEventTime: 0,
            averageInterval: 0
        };
    }

    getLogSize() {
        return {
            sessionLog: this.sessionLog.length,
            audioMetrics: this.audioMetrics.length,
            archivedTests: this.archivedTests ? this.archivedTests.length : 0,
            totalMemoryUsage: this.estimateMemoryUsage()
        };
    }

    estimateMemoryUsage() {
        // Rough estimate of memory usage in bytes
        const jsonString = JSON.stringify({
            sessionLog: this.sessionLog,
            audioMetrics: this.audioMetrics,
            archivedTests: this.archivedTests
        });
        
        return jsonString.length * 2; // Rough estimate for UTF-16
    }
}
