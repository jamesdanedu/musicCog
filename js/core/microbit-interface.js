// js/core/metrics-collector.js - Advanced Metrics Collection for Scientific Analysis

class MetricsCollector {
    constructor() {
        // Core metric storage
        this.metrics = {
            reactionTimes: [],
            accuracy: [],
            attentionLapses: [],
            motorVariability: [],
            cognitiveLoad: [],
            temporalPrecision: [],
            responseConsistency: []
        };
        
        // Real-time analysis windows
        this.rollingWindows = {
            shortTerm: [], // Last 10 responses
            mediumTerm: [], // Last 50 responses  
            longTerm: [] // Last 200 responses
        };
        
        // Attention monitoring
        this.attentionState = {
            currentLapse: false,
            lapseStartTime: null,
            sustainedAttentionScore: 1.0,
            vigilanceDecrement: 0
        };
        
        // Performance thresholds (adaptive)
        this.thresholds = {
            lapseThreshold: 2.5, // Standard deviations above mean
            consistencyThreshold: 0.3, // Coefficient of variation
            minValidRT: 100, // Minimum valid reaction time (ms)
            maxValidRT: 2000, // Maximum valid reaction time (ms)
            outlierThreshold: 3.0 // Z-score for outlier detection
        };
        
        // Statistical accumulators
        this.statistics = {
            totalResponses: 0,
            correctResponses: 0,
            totalErrors: 0,
            sessionStartTime: performance.now(),
            testStartTime: null,
            lastUpdateTime: performance.now()
        };
        
        // Musical entrainment metrics
        this.rhythmMetrics = {
            beatPhase: [],
            synchronizationError: [],
            adaptationRate: 0,
            entrainmentStrength: 0
        };
        
        // Individual difference measures
        this.individualMetrics = {
            baselineRT: null,
            learningCurve: [],
            fatigueIndex: 0,
            motivationLevel: 1.0,
            strategicalChanges: []
        };
        
        console.log('MetricsCollector initialized');
    }

    // Primary data collection method
    collectReactionTime(stimulusTime, responseTime, correct, additional = {}) {
        const reactionTime = responseTime - stimulusTime;
        const timestamp = performance.now();
        
        // Validate reaction time
        if (!this.isValidReactionTime(reactionTime)) {
            this.recordInvalidResponse(reactionTime, 'invalid_rt', additional);
            return null;
        }
        
        // Create comprehensive reaction time record
        const rtRecord = {
            reactionTime: reactionTime,
            stimulusTime: stimulusTime,
            responseTime: responseTime,
            correct: correct,
            timestamp: timestamp,
            sessionTime: timestamp - this.statistics.sessionStartTime,
            testTime: this.statistics.testStartTime ? timestamp - this.statistics.testStartTime : null,
            trialNumber: this.statistics.totalResponses + 1,
            ...additional
        };
        
        // Store in primary metrics
        this.metrics.reactionTimes.push(rtRecord);
        this.statistics.totalResponses++;
        if (correct) {
            this.statistics.correctResponses++;
        }
        
        // Update rolling windows
        this.updateRollingWindows(rtRecord);
        
        // Real-time analysis
        this.analyzeAttentionState(rtRecord);
        this.analyzeMotorVariability(rtRecord);
        this.analyzeCognitiveLoad(rtRecord);
        this.analyzeTemporalPrecision(rtRecord);
        
        // Update adaptive thresholds
        this.updateAdaptiveThresholds();
        
        // Calculate derived metrics
        this.updateDerivedMetrics();
        
        console.log(`RT collected: ${reactionTime.toFixed(2)}ms, Correct: ${correct}`);
        
        return rtRecord;
    }

    isValidReactionTime(rt) {
        return rt >= this.thresholds.minValidRT && 
               rt <= this.thresholds.maxValidRT && 
               !isNaN(rt) && 
               isFinite(rt);
    }

    recordInvalidResponse(value, reason, additional = {}) {
        const invalidRecord = {
            value: value,
            reason: reason,
            timestamp: performance.now(),
            ...additional
        };
        
        this.metrics.invalidResponses = this.metrics.invalidResponses || [];
        this.metrics.invalidResponses.push(invalidRecord);
        
        console.warn(`Invalid response recorded: ${reason}, Value: ${value}`);
    }

    updateRollingWindows(rtRecord) {
        // Add to all windows
        Object.keys(this.rollingWindows).forEach(windowKey => {
            this.rollingWindows[windowKey].push(rtRecord);
        });
        
        // Maintain window sizes
        if (this.rollingWindows.shortTerm.length > 10) {
            this.rollingWindows.shortTerm.shift();
        }
        if (this.rollingWindows.mediumTerm.length > 50) {
            this.rollingWindows.mediumTerm.shift();
        }
        if (this.rollingWindows.longTerm.length > 200) {
            this.rollingWindows.longTerm.shift();
        }
    }

    analyzeAttentionState(rtRecord) {
        if (this.rollingWindows.mediumTerm.length < 10) return;
        
        // Calculate recent mean and SD
        const recentRTs = this.rollingWindows.mediumTerm.map(r => r.reactionTime);
        const mean = this.calculateMean(recentRTs);
        const sd = this.calculateStandardDeviation(recentRTs);
        
        // Check for attention lapse
        const isLapse = rtRecord.reactionTime > (mean + this.thresholds.lapseThreshold * sd);
        
        if (isLapse && !this.attentionState.currentLapse) {
            // Lapse onset
            this.attentionState.currentLapse = true;
            this.attentionState.lapseStartTime = rtRecord.timestamp;
            
            this.metrics.attentionLapses.push({
                onsetTime: rtRecord.timestamp,
                reactionTime: rtRecord.reactionTime,
                threshold: mean + this.thresholds.lapseThreshold * sd,
                trialNumber: rtRecord.trialNumber,
                severity: (rtRecord.reactionTime - mean) / sd
            });
            
            console.log(`Attention lapse detected: ${rtRecord.reactionTime.toFixed(2)}ms (threshold: ${(mean + this.thresholds.lapseThreshold * sd).toFixed(2)}ms)`);
            
        } else if (!isLapse && this.attentionState.currentLapse) {
            // Lapse recovery
            const lapse = this.metrics.attentionLapses[this.metrics.attentionLapses.length - 1];
            if (lapse) {
                lapse.offsetTime = rtRecord.timestamp;
                lapse.duration = rtRecord.timestamp - lapse.onsetTime;
                lapse.recoveryRT = rtRecord.reactionTime;
            }
            
            this.attentionState.currentLapse = false;
            console.log('Attention lapse recovery detected');
        }
        
        // Update sustained attention score
        this.updateSustainedAttentionScore();
    }

    updateSustainedAttentionScore() {
        if (this.metrics.reactionTimes.length < 20) return;
        
        // Calculate vigilance decrement (performance degradation over time)
        const firstQuartile = this.metrics.reactionTimes.slice(0, Math.floor(this.metrics.reactionTimes.length / 4));
        const lastQuartile = this.metrics.reactionTimes.slice(-Math.floor(this.metrics.reactionTimes.length / 4));
        
        const firstMean = this.calculateMean(firstQuartile.map(r => r.reactionTime));
        const lastMean = this.calculateMean(lastQuartile.map(r => r.reactionTime));
        
        this.attentionState.vigilanceDecrement = (lastMean - firstMean) / firstMean;
        
        // Sustained attention score (0-1, higher is better)
        const lapseRate = this.metrics.attentionLapses.length / this.metrics.reactionTimes.length;
        const consistencyScore = 1 - this.calculateConsistencyIndex();
        const vigilanceScore = Math.max(0, 1 - Math.abs(this.attentionState.vigilanceDecrement));
        
        this.attentionState.sustainedAttentionScore = (consistencyScore * 0.4) + (vigilanceScore * 0.4) + ((1 - lapseRate) * 0.2);
    }

    analyzeMotorVariability(rtRecord) {
        if (this.rollingWindows.shortTerm.length < 5) return;
        
        const recentRTs = this.rollingWindows.shortTerm.map(r => r.reactionTime);
        const variability = this.calculateStandardDeviation(recentRTs) / this.calculateMean(recentRTs);
        
        this.metrics.motorVariability.push({
            timestamp: rtRecord.timestamp,
            variability: variability,
            windowSize: recentRTs.length,
            meanRT: this.calculateMean(recentRTs),
            trialNumber: rtRecord.trialNumber
        });
        
        // Detect sudden changes in variability
        if (this.metrics.motorVariability.length > 10) {
            const recentVariability = this.metrics.motorVariability.slice(-5).map(v => v.variability);
            const previousVariability = this.metrics.motorVariability.slice(-10, -5).map(v => v.variability);
            
            const recentMean = this.calculateMean(recentVariability);
            const previousMean = this.calculateMean(previousVariability);
            const change = (recentMean - previousMean) / previousMean;
            
            if (Math.abs(change) > 0.3) { // 30% change threshold
                console.log(`Motor variability change detected: ${(change * 100).toFixed(1)}%`);
            }
        }
    }

    analyzeCognitiveLoad(rtRecord) {
        // Estimate cognitive load based on RT variability and error patterns
        if (this.rollingWindows.mediumTerm.length < 10) return;
        
        const recentData = this.rollingWindows.mediumTerm.slice(-10);
        const meanRT = this.calculateMean(recentData.map(r => r.reactionTime));
        const rtVariability = this.calculateStandardDeviation(recentData.map(r => r.reactionTime)) / meanRT;
        const errorRate = 1 - (recentData.filter(r => r.correct).length / recentData.length);
        
        // Composite cognitive load index (0-1, higher = more load)
        const loadIndex = Math.min(1, (rtVariability * 0.6) + (errorRate * 0.4));
        
        this.metrics.cognitiveLoad.push({
            timestamp: rtRecord.timestamp,
            loadIndex: loadIndex,
            meanRT: meanRT,
            rtVariability: rtVariability,
            errorRate: errorRate,
            trialNumber: rtRecord.trialNumber
        });
        
        // Detect cognitive overload
        if (loadIndex > 0.7) {
            console.log(`High cognitive load detected: ${(loadIndex * 100).toFixed(1)}%`);
        }
    }

    analyzeTemporalPrecision(rtRecord) {
        // Analyze timing precision and consistency
        if (this.metrics.reactionTimes.length < 5) return;
        
        const recent5 = this.metrics.reactionTimes.slice(-5).map(r => r.reactionTime);
        const mean = this.calculateMean(recent5);
        const deviation = Math.abs(rtRecord.reactionTime - mean);
        const precision = 1 - (deviation / mean); // Higher = more precise
        
        this.metrics.temporalPrecision.push({
            timestamp: rtRecord.timestamp,
            precision: Math.max(0, precision),
            deviation: deviation,
            meanReference: mean,
            trialNumber: rtRecord.trialNumber
        });
    }

    updateAdaptiveThresholds() {
        if (this.metrics.reactionTimes.length < 20) return;
        
        // Update lapse threshold based on individual performance
        const allRTs = this.metrics.reactionTimes.map(r => r.reactionTime);
        const individualMean = this.calculateMean(allRTs);
        const individualSD = this.calculateStandardDeviation(allRTs);
        
        // Adaptive threshold (more conservative for variable performers)
        const variabilityFactor = individualSD / individualMean;
        this.thresholds.lapseThreshold = Math.max(2.0, Math.min(3.5, 2.5 + variabilityFactor));
        
        // Update baseline if this is early in session
        if (this.individualMetrics.baselineRT === null && this.metrics.reactionTimes.length >= 10) {
            const first10RTs = this.metrics.reactionTimes.slice(0, 10).map(r => r.reactionTime);
            this.individualMetrics.baselineRT = this.calculateMean(first10RTs);
            console.log(`Baseline RT established: ${this.individualMetrics.baselineRT.toFixed(2)}ms`);
        }
    }

    // Musical entrainment analysis
    analyzeRhythmicSynchronization(responseTime, beatTime, targetPhase = 0) {
        const phase = ((responseTime - beatTime) % 1000) / 1000; // Normalize to 0-1
        const phaseError = Math.min(Math.abs(phase - targetPhase), 1 - Math.abs(phase - targetPhase));
        
        this.rhythmMetrics.beatPhase.push({
            timestamp: performance.now(),
            responseTime: responseTime,
            beatTime: beatTime,
            phase: phase,
            phaseError: phaseError,
            synchronizationAccuracy: 1 - phaseError
        });
        
        this.rhythmMetrics.synchronizationError.push(phaseError);
        
        // Calculate entrainment strength (consistency of phase relationship)
        if (this.rhythmMetrics.beatPhase.length > 10) {
            const recentPhases = this.rhythmMetrics.beatPhase.slice(-10).map(b => b.phase);
            const phaseVariability = this.calculateCircularVariance(recentPhases);
            this.rhythmMetrics.entrainmentStrength = 1 - phaseVariability;
        }
        
        return {
            phase: phase,
            error: phaseError,
            accuracy: 1 - phaseError
        };
    }

    calculateCircularVariance(phases) {
        // Calculate circular variance for phase data (0-1)
        const sinSum = phases.reduce((sum, phase) => sum + Math.sin(2 * Math.PI * phase), 0);
        const cosSum = phases.reduce((sum, phase) => sum + Math.cos(2 * Math.PI * phase), 0);
        
        const r = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / phases.length;
        return 1 - r; // Circular variance
    }

    // Fatigue and motivation tracking
    analyzeFatigue() {
        if (this.metrics.reactionTimes.length < 50) return 0;
        
        // Split session into quartiles
        const quartileSize = Math.floor(this.metrics.reactionTimes.length / 4);
        const q1 = this.metrics.reactionTimes.slice(0, quartileSize).map(r => r.reactionTime);
        const q4 = this.metrics.reactionTimes.slice(-quartileSize).map(r => r.reactionTime);
        
        const q1Mean = this.calculateMean(q1);
        const q4Mean = this.calculateMean(q4);
        
        // Fatigue index (positive = getting slower)
        this.individualMetrics.fatigueIndex = (q4Mean - q1Mean) / q1Mean;
        
        return this.individualMetrics.fatigueIndex;
    }

    // Performance prediction and adaptation
    predictNextPerformance() {
        if (this.rollingWindows.shortTerm.length < 5) return null;
        
        const recentRTs = this.rollingWindows.shortTerm.map(r => r.reactionTime);
        const trend = this.calculateLinearTrend(recentRTs);
        const currentMean = this.calculateMean(recentRTs);
        const currentSD = this.calculateStandardDeviation(recentRTs);
        
        return {
            predictedRT: currentMean + trend,
            confidence: Math.max(0, 1 - (currentSD / currentMean)),
            trend: trend,
            recommendation: this.generatePerformanceRecommendation(trend, currentSD / currentMean)
        };
    }

    calculateLinearTrend(values) {
        const n = values.length;
        const xMean = (n - 1) / 2;
        const yMean = this.calculateMean(values);
        
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < n; i++) {
            const dx = i - xMean;
            numerator += dx * (values[i] - yMean);
            denominator += dx * dx;
        }
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    generatePerformanceRecommendation(trend, variability) {
        if (trend > 10 && variability > 0.2) {
            return 'Consider a short break - performance appears to be declining';
        } else if (variability > 0.3) {
            return 'Focus on consistency - response timing is variable';
        } else if (trend < -5 && variability < 0.15) {
            return 'Excellent performance - maintain current focus level';
        } else {
            return 'Performance is stable - continue current approach';
        }
    }

    // Comprehensive metric calculation
    updateDerivedMetrics() {
        this.statistics.lastUpdateTime = performance.now();
        
        if (this.metrics.reactionTimes.length === 0) return;
        
        // Calculate response consistency
        this.updateResponseConsistency();
        
        // Update individual difference measures
        this.updateIndividualMetrics();
    }

    updateResponseConsistency() {
        if (this.rollingWindows.mediumTerm.length < 10) return;
        
        const recentRTs = this.rollingWindows.mediumTerm.map(r => r.reactionTime);
        const mean = this.calculateMean(recentRTs);
        const sd = this.calculateStandardDeviation(recentRTs);
        const cv = sd / mean; // Coefficient of variation
        
        this.metrics.responseConsistency.push({
            timestamp: performance.now(),
            consistency: Math.max(0, 1 - cv), // Higher = more consistent
            coefficientOfVariation: cv,
            windowMean: mean,
            windowSD: sd,
            trialNumber: this.statistics.totalResponses
        });
    }

    updateIndividualMetrics() {
        // Learning curve analysis
        if (this.metrics.reactionTimes.length >= 20 && this.metrics.reactionTimes.length % 10 === 0) {
            const last10 = this.metrics.reactionTimes.slice(-10).map(r => r.reactionTime);
            const mean10 = this.calculateMean(last10);
            
            this.individualMetrics.learningCurve.push({
                trialNumber: this.statistics.totalResponses,
                meanRT: mean10,
                improvement: this.individualMetrics.baselineRT ? 
                    (this.individualMetrics.baselineRT - mean10) / this.individualMetrics.baselineRT : 0
            });
        }
    }

    // Export and summary methods
    generateComprehensiveReport() {
        const sessionDuration = (performance.now() - this.statistics.sessionStartTime) / 1000;
        
        return {
            sessionSummary: {
                duration: sessionDuration,
                totalResponses: this.statistics.totalResponses,
                correctResponses: this.statistics.correctResponses,
                accuracy: this.statistics.totalResponses > 0 ? this.statistics.correctResponses / this.statistics.totalResponses : 0,
                responseRate: this.statistics.totalResponses / (sessionDuration / 60) // per minute
            },
            
            reactionTimeAnalysis: this.analyzeReactionTimes(),
            attentionMetrics: this.analyzeAttentionMetrics(),
            motorControlMetrics: this.analyzeMotorMetrics(),
            cognitiveLoadAnalysis: this.analyzeCognitiveLoadMetrics(),
            rhythmicSynchronization: this.analyzeRhythmicMetrics(),
            individualDifferences: this.analyzeIndividualDifferences(),
            
            performancePrediction: this.predictNextPerformance(),
            recommendations: this.generateSessionRecommendations()
        };
    }

    analyzeReactionTimes() {
        if (this.metrics.reactionTimes.length === 0) return null;
        
        const rts = this.metrics.reactionTimes.map(r => r.reactionTime);
        const correctRTs = this.metrics.reactionTimes.filter(r => r.correct).map(r => r.reactionTime);
        const incorrectRTs = this.metrics.reactionTimes.filter(r => !r.correct).map(r => r.reactionTime);
        
        return {
            overall: {
                count: rts.length,
                mean: this.calculateMean(rts),
                median: this.calculateMedian(rts),
                std: this.calculateStandardDeviation(rts),
                min: Math.min(...rts),
                max: Math.max(...rts),
                percentiles: this.calculatePercentiles(rts)
            },
            correct: correctRTs.length > 0 ? {
                count: correctRTs.length,
                mean: this.calculateMean(correctRTs),
                median: this.calculateMedian(correctRTs),
                std: this.calculateStandardDeviation(correctRTs)
            } : null,
            incorrect: incorrectRTs.length > 0 ? {
                count: incorrectRTs.length,
                mean: this.calculateMean(incorrectRTs),
                median: this.calculateMedian(incorrectRTs),
                std: this.calculateStandardDeviation(incorrectRTs)
            } : null
        };
    }

    analyzeAttentionMetrics() {
        return {
            lapseCount: this.metrics.attentionLapses.length,
            lapseRate: this.statistics.totalResponses > 0 ? this.metrics.attentionLapses.length / this.statistics.totalResponses : 0,
            sustainedAttentionScore: this.attentionState.sustainedAttentionScore,
            vigilanceDecrement: this.attentionState.vigilanceDecrement,
            averageLapseDuration: this.metrics.attentionLapses.length > 0 ? 
                this.calculateMean(this.metrics.attentionLapses.filter(l => l.duration).map(l => l.duration)) : 0
        };
    }

    analyzeMotorMetrics() {
        if (this.metrics.motorVariability.length === 0) return null;
        
        const variabilities = this.metrics.motorVariability.map(m => m.variability);
        return {
            meanVariability: this.calculateMean(variabilities),
            variabilityTrend: this.calculateLinearTrend(variabilities),
            consistency: this.metrics.responseConsistency.length > 0 ? 
                this.calculateMean(this.metrics.responseConsistency.map(c => c.consistency)) : null
        };
    }

    analyzeCognitiveLoadMetrics() {
        if (this.metrics.cognitiveLoad.length === 0) return null;
        
        const loadIndices = this.metrics.cognitiveLoad.map(c => c.loadIndex);
        return {
            averageLoad: this.calculateMean(loadIndices),
            maxLoad: Math.max(...loadIndices),
            loadVariability: this.calculateStandardDeviation(loadIndices),
            overloadEpisodes: this.metrics.cognitiveLoad.filter(c => c.loadIndex > 0.7).length
        };
    }

    analyzeRhythmicMetrics() {
        if (this.rhythmMetrics.synchronizationError.length === 0) return null;
        
        return {
            meanSynchronizationError: this.calculateMean(this.rhythmMetrics.synchronizationError),
            entrainmentStrength: this.rhythmMetrics.entrainmentStrength,
            adaptationRate: this.rhythmMetrics.adaptationRate,
            synchronizationAccuracy: this.rhythmMetrics.beatPhase.length > 0 ?
                this.calculateMean(this.rhythmMetrics.beatPhase.map(b => b.synchronizationAccuracy)) : 0
        };
    }

    analyzeIndividualDifferences() {
        return {
            baselineRT: this.individualMetrics.baselineRT,
            fatigueIndex: this.individualMetrics.fatigueIndex,
            learningRate: this.calculateLearningRate(),
            adaptiveThreshold: this.thresholds.lapseThreshold
        };
    }

    calculateLearningRate() {
        if (this.individualMetrics.learningCurve.length < 3) return null;
        
        const improvements = this.individualMetrics.learningCurve.map(l => l.improvement);
        return this.calculateLinearTrend(improvements);
    }

    generateSessionRecommendations() {
        const recommendations = [];
        
        // Fatigue recommendations
        if (this.individualMetrics.fatigueIndex > 0.15) {
            recommendations.push('Consider taking a break - performance shows signs of fatigue');
        }
        
        // Attention recommendations
        if (this.attentionState.sustainedAttentionScore < 0.7) {
            recommendations.push('Focus on maintaining consistent attention throughout trials');
        }
        
        // Variability recommendations
        if (this.metrics.motorVariability.length > 0) {
            const meanVariability = this.calculateMean(this.metrics.motorVariability.map(m => m.variability));
            if (meanVariability > 0.3) {
                recommendations.push('Work on response consistency - timing is quite variable');
            }
        }
        
        return recommendations.length > 0 ? recommendations : ['Performance is good - maintain current approach'];
    }

    // Statistical utility methods
    calculateMean(values) {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = this.calculateMean(values);
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        return Math.sqrt(this.calculateMean(squareDiffs));
    }

    calculatePercentiles(values) {
        if (values.length === 0) return {};
        
        const sorted = [...values].sort((a, b) => a - b);
        return {
            p10: this.percentile(sorted, 10),
            p25: this.percentile(sorted, 25),
            p50: this.percentile(sorted, 50),
            p75: this.percentile(sorted, 75),
            p90: this.percentile(sorted, 90),
            p95: this.percentile(sorted, 95)
        };
    }

    percentile(sortedValues, p) {
        const index = (p / 100) * (sortedValues.length - 1);
        if (Math.floor(index) === index) {
            return sortedValues[index];
        } else {
            const lower = sortedValues[Math.floor(index)];
            const upper = sortedValues[Math.ceil(index)];
            return lower + (upper - lower) * (index - Math.floor(index));
        }
    }

    calculateConsistencyIndex() {
        if (this.metrics.reactionTimes.length < 5) return 0;
        
        const recentRTs = this.metrics.reactionTimes.slice(-20).map(r => r.reactionTime);
        const mean = this.calculateMean(recentRTs);
        const sd = this.calculateStandardDeviation(recentRTs);
        
        return sd / mean; // Coefficient of variation
    }

    // Reset and cleanup methods
    startNewTest() {
        this.statistics.testStartTime = performance.now();
        console.log('MetricsCollector: New test started');
    }

    resetSession() {
        // Clear all metrics but preserve thresholds
        Object.keys(this.metrics).forEach(key => {
            this.metrics[key] = [];
        });
        
        Object.keys(this.rollingWindows).forEach(key => {
            this.rollingWindows[key] = [];
        });
        
        // Reset statistics
        this.statistics = {
            totalResponses: 0,
            correctResponses: 0,
            totalErrors: 0,
            sessionStartTime: performance.now(),
            testStartTime: null,
            lastUpdateTime: performance.now()
        };
        
        // Reset state
        this.attentionState = {
            currentLapse: false,
            lapseStartTime: null,
            sustainedAttentionScore: 1.0,
            vigilanceDecrement: 0
        };
        
        // Reset individual metrics
        this.individualMetrics = {
            baselineRT: null,
            learningCurve: [],
            fatigueIndex: 0,
            motivationLevel: 1.0,
            strategicalChanges: []
        };
        
        console.log('MetricsCollector: Session reset');
    }

    getMemoryUsage() {
        const totalEntries = Object.keys(this.metrics).reduce((sum, key) => {
            return sum + (Array.isArray(this.metrics[key]) ? this.metrics[key].length : 0);
        }, 0);
        
        return {
            totalMetricEntries: totalEntries,
            reactionTimeCount: this.metrics.reactionTimes.length,
            attentionLapseCount: this.metrics.attentionLapses.length,
            estimatedMemoryKB: Math.round(totalEntries * 0.5) // Rough estimate
        };
    }
}
