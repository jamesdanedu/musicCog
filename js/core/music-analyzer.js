// js/core/music-analyzer.js - Real-time Music Analysis for Cognitive Research

class MusicAnalyzer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // Audio analysis nodes
        this.analyzer = audioContext.createAnalyser();
        this.analyzer.fftSize = 2048;
        this.analyzer.smoothingTimeConstant = 0.8;
        
        // Frequency analysis
        this.bufferLength = this.analyzer.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        this.frequencyData = new Float32Array(this.bufferLength);
        this.timeData = new Float32Array(this.analyzer.fftSize);
        
        // Sampling rate and frequency resolution
        this.sampleRate = audioContext.sampleRate;
        this.frequencyResolution = this.sampleRate / this.analyzer.fftSize;
        
        // Tempo detection
        this.tempoDetector = new TempoDetector(this.sampleRate);
        this.onsetDetector = new OnsetDetector(this.sampleRate);
        this.beatTracker = new BeatTracker();
        
        // Analysis windows and history
        this.analysisInterval = 50; // ms between analyses
        this.historyLength = 200; // Number of analysis frames to keep
        this.analysisHistory = [];
        this.currentAnalysis = null;
        
        // Feature extractors
        this.spectralFeatures = new SpectralFeatureExtractor();
        this.rhythmicFeatures = new RhythmicFeatureExtractor();
        this.perceptualFeatures = new PerceptualFeatureExtractor();
        
        // Musical structure analysis
        this.keyDetector = new KeyDetector();
        this.chordDetector = new ChordDetector();
        this.structureAnalyzer = new MusicalStructureAnalyzer();
        
        // Real-time metrics
        this.metrics = {
            tempo: 0,
            key: null,
            mode: null,
            energy: 0,
            valence: 0,
            arousal: 0,
            complexity: 0,
            rhythmicStability: 0,
            harmonicComplexity: 0,
            spectralCentroid: 0,
            spectralRolloff: 0,
            zeroCrossingRate: 0,
            mfccs: new Array(13).fill(0),
            chromaVector: new Array(12).fill(0)
        };
        
        // Cognitive relevance metrics
        this.cognitiveMetrics = {
            distractionPotential: 0,
            cognitiveLoad: 0,
            attentionalDemand: 0,
            memorabilityIndex: 0,
            emotionalIntensity: 0,
            arousalLevel: 0,
            focusCompatibility: 0
        };
        
        // Analysis state
        this.isAnalyzing = false;
        this.analysisTimer = null;
        this.connectedSource = null;
        
        console.log('MusicAnalyzer initialized');
        console.log(`Sample rate: ${this.sampleRate}Hz, FFT size: ${this.analyzer.fftSize}, Frequency resolution: ${this.frequencyResolution.toFixed(2)}Hz`);
    }

    // Connection and Control
    connectSource(audioNode) {
        if (this.connectedSource) {
            this.disconnectSource();
        }
        
        this.connectedSource = audioNode;
        audioNode.connect(this.analyzer);
        
        console.log('Audio source connected to analyzer');
        
        // Start analysis if not already running
        if (!this.isAnalyzing) {
            this.startAnalysis();
        }
    }

    disconnectSource() {
        if (this.connectedSource) {
            try {
                this.connectedSource.disconnect(this.analyzer);
                this.connectedSource = null;
                console.log('Audio source disconnected from analyzer');
            } catch (error) {
                console.warn('Error disconnecting audio source:', error);
            }
        }
    }

    startAnalysis() {
        if (this.isAnalyzing) return;
        
        this.isAnalyzing = true;
        console.log('Starting real-time music analysis...');
        
        // Start analysis loop
        this.analysisTimer = setInterval(() => {
            this.performAnalysis();
        }, this.analysisInterval);
        
        // Initialize detectors
        this.tempoDetector.reset();
        this.onsetDetector.reset();
        this.beatTracker.reset();
    }

    stopAnalysis() {
        if (!this.isAnalyzing) return;
        
        this.isAnalyzing = false;
        console.log('Stopping music analysis');
        
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
    }

    // Core Analysis Method
    performAnalysis() {
        if (!this.connectedSource || this.audioContext.state !== 'running') {
            return;
        }
        
        // Get frequency and time domain data
        this.analyzer.getByteFrequencyData(this.dataArray);
        this.analyzer.getFloatFrequencyData(this.frequencyData);
        this.analyzer.getFloatTimeDomainData(this.timeData);
        
        const timestamp = performance.now();
        
        // Perform comprehensive analysis
        const analysis = {
            timestamp: timestamp,
            audioTime: this.audioContext.currentTime,
            
            // Spectral features
            spectral: this.spectralFeatures.extract(this.frequencyData, this.sampleRate),
            
            // Rhythmic features
            rhythmic: this.rhythmicFeatures.extract(this.timeData, this.dataArray),
            
            // Perceptual features
            perceptual: this.perceptualFeatures.extract(this.dataArray, this.timeData),
            
            // Musical structure
            harmonic: this.extractHarmonicFeatures(),
            
            // Raw data (for detailed analysis)
            rawFrequency: new Uint8Array(this.dataArray),
            rawTime: new Float32Array(this.timeData)
        };
        
        // Update current analysis
        this.currentAnalysis = analysis;
        
        // Add to history
        this.analysisHistory.push(analysis);
        if (this.analysisHistory.length > this.historyLength) {
            this.analysisHistory.shift();
        }
        
        // Update real-time metrics
        this.updateMetrics(analysis);
        
        // Update cognitive relevance metrics
        this.updateCognitiveMetrics(analysis);
        
        // Tempo and beat detection
        this.updateTempoDetection(analysis);
        
        // Musical structure analysis
        this.updateStructuralAnalysis(analysis);
    }

    // Spectral Feature Extraction
    extractHarmonicFeatures() {
        // Pitch detection using autocorrelation
        const pitch = this.detectPitch(this.timeData);
        
        // Harmonic analysis
        const harmonics = this.analyzeHarmonics(this.frequencyData);
        
        // Chord detection
        const chord = this.chordDetector.detect(this.frequencyData);
        
        // Key detection (requires longer analysis window)
        let key = null;
        if (this.analysisHistory.length >= 20) {
            key = this.keyDetector.detectKey(this.analysisHistory.slice(-20));
        }
        
        return {
            fundamentalFreq: pitch,
            harmonics: harmonics,
            chord: chord,
            key: key,
            harmonicity: this.calculateHarmonicity(harmonics),
            inharmonicity: this.calculateInharmonicity(harmonics)
        };
    }

    detectPitch(timeData) {
        // Autocorrelation-based pitch detection
        const autocorr = this.autocorrelate(timeData);
        
        // Find the first significant peak after the origin
        let maxCorr = 0;
        let bestPeriod = 0;
        
        const minPeriod = Math.floor(this.sampleRate / 800); // 800 Hz max
        const maxPeriod = Math.floor(this.sampleRate / 80);  // 80 Hz min
        
        for (let period = minPeriod; period < maxPeriod; period++) {
            if (autocorr[period] > maxCorr && autocorr[period] > 0.3) {
                maxCorr = autocorr[period];
                bestPeriod = period;
            }
        }
        
        return bestPeriod > 0 ? this.sampleRate / bestPeriod : 0;
    }

    autocorrelate(buffer) {
        const size = buffer.length;
        const result = new Array(size).fill(0);
        
        for (let lag = 0; lag < size; lag++) {
            for (let i = 0; i < size - lag; i++) {
                result[lag] += buffer[i] * buffer[i + lag];
            }
        }
        
        // Normalize
        if (result[0] > 0) {
            for (let i = 0; i < size; i++) {
                result[i] /= result[0];
            }
        }
        
        return result;
    }

    analyzeHarmonics(frequencyData) {
        const harmonics = [];
        const threshold = -60; // dB threshold
        
        // Find peaks in frequency spectrum
        const peaks = this.findSpectralPeaks(frequencyData, threshold);
        
        // Identify harmonic relationships
        peaks.forEach(peak => {
            const freq = peak.frequency;
            const magnitude = peak.magnitude;
            
            // Check if this frequency is a harmonic of a lower frequency
            let harmonicNumber = 1;
            for (const harmonic of harmonics) {
                const ratio = freq / harmonic.frequency;
                if (Math.abs(ratio - Math.round(ratio)) < 0.05) {
                    harmonicNumber = Math.round(ratio);
                    break;
                }
            }
            
            harmonics.push({
                frequency: freq,
                magnitude: magnitude,
                harmonicNumber: harmonicNumber
            });
        });
        
        return harmonics;
    }

    findSpectralPeaks(frequencyData, threshold) {
        const peaks = [];
        const minDistance = 3; // Minimum distance between peaks
        
        for (let i = minDistance; i < frequencyData.length - minDistance; i++) {
            if (frequencyData[i] > threshold) {
                let isPeak = true;
                
                // Check if it's a local maximum
                for (let j = i - minDistance; j <= i + minDistance; j++) {
                    if (j !== i && frequencyData[j] >= frequencyData[i]) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    peaks.push({
                        frequency: i * this.frequencyResolution,
                        magnitude: frequencyData[i],
                        bin: i
                    });
                }
            }
        }
        
        return peaks.sort((a, b) => b.magnitude - a.magnitude);
    }

    calculateHarmonicity(harmonics) {
        if (harmonics.length < 2) return 0;
        
        let harmonicStrength = 0;
        let totalEnergy = 0;
        
        harmonics.forEach(harmonic => {
            const energy = Math.pow(10, harmonic.magnitude / 20);
            totalEnergy += energy;
            
            if (harmonic.harmonicNumber > 1) {
                harmonicStrength += energy;
            }
        });
        
        return totalEnergy > 0 ? harmonicStrength / totalEnergy : 0;
    }

    calculateInharmonicity(harmonics) {
        if (harmonics.length < 3) return 0;
        
        let inharmonicity = 0;
        let count = 0;
        
        const fundamental = harmonics.find(h => h.harmonicNumber === 1);
        if (!fundamental) return 0;
        
        harmonics.forEach(harmonic => {
            if (harmonic.harmonicNumber > 1) {
                const expectedFreq = fundamental.frequency * harmonic.harmonicNumber;
                const deviation = Math.abs(harmonic.frequency - expectedFreq) / expectedFreq;
                inharmonicity += deviation;
                count++;
            }
        });
        
        return count > 0 ? inharmonicity / count : 0;
    }

    // Metric Updates
    updateMetrics(analysis) {
        this.metrics.energy = analysis.spectral.rms;
        this.metrics.spectralCentroid = analysis.spectral.centroid;
        this.metrics.spectralRolloff = analysis.spectral.rolloff;
        this.metrics.zeroCrossingRate = analysis.spectral.zcr;
        this.metrics.mfccs = analysis.perceptual.mfccs;
        this.metrics.chromaVector = analysis.perceptual.chroma;
        
        if (analysis.harmonic.key) {
            this.metrics.key = analysis.harmonic.key.key;
            this.metrics.mode = analysis.harmonic.key.mode;
        }
        
        // Calculate complexity metrics
        this.metrics.complexity = this.calculateComplexity(analysis);
        this.metrics.harmonicComplexity = analysis.harmonic.inharmonicity || 0;
        
        // Perceptual metrics
        this.metrics.valence = analysis.perceptual.valence;
        this.metrics.arousal = analysis.perceptual.arousal;
    }

    calculateComplexity(analysis) {
        // Multi-dimensional complexity measure
        const spectralComplexity = analysis.spectral.spectralComplexity || 0;
        const rhythmicComplexity = analysis.rhythmic.complexity || 0;
        const harmonicComplexity = this.metrics.harmonicComplexity;
        
        return (spectralComplexity * 0.4) + (rhythmicComplexity * 0.4) + (harmonicComplexity * 0.2);
    }

    updateCognitiveMetrics(analysis) {
        // Distraction potential based on sudden changes and complexity
        this.cognitiveMetrics.distractionPotential = this.calculateDistractionPotential(analysis);
        
        // Cognitive load based on information density
        this.cognitiveMetrics.cognitiveLoad = this.calculateCognitiveLoad(analysis);
        
        // Attentional demand based on unpredictability
        this.cognitiveMetrics.attentionalDemand = this.calculateAttentionalDemand(analysis);
        
        // Focus compatibility (lower values = better for concentration)
        this.cognitiveMetrics.focusCompatibility = this.calculateFocusCompatibility(analysis);
        
        // Arousal level from perceptual features
        this.cognitiveMetrics.arousalLevel = analysis.perceptual.arousal;
        
        // Emotional intensity
        this.cognitiveMetrics.emotionalIntensity = Math.sqrt(
            Math.pow(analysis.perceptual.valence, 2) + Math.pow(analysis.perceptual.arousal, 2)
        );
    }

    calculateDistractionPotential(analysis) {
        let distraction = 0;
        
        // Sudden energy changes
        if (this.analysisHistory.length > 5) {
            const recentEnergies = this.analysisHistory.slice(-5).map(a => a.spectral.rms);
            const energyVariability = this.calculateVariability(recentEnergies);
            distraction += energyVariability * 0.3;
        }
        
        // High-frequency content (can be distracting)
        const highFreqEnergy = this.calculateHighFrequencyEnergy(analysis.rawFrequency);
        distraction += highFreqEnergy * 0.2;
        
        // Rhythmic irregularity
        distraction += (1 - this.metrics.rhythmicStability) * 0.3;
        
        // Spectral complexity
        distraction += this.metrics.complexity * 0.2;
        
        return Math.min(1, distraction);
    }

    calculateCognitiveLoad(analysis) {
        // Information-theoretic approach to cognitive load
        const spectralEntropy = this.calculateSpectralEntropy(analysis.rawFrequency);
        const rhythmicComplexity = analysis.rhythmic.complexity || 0;
        const harmonicComplexity = this.metrics.harmonicComplexity;
        
        return Math.min(1, (spectralEntropy * 0.4) + (rhythmicComplexity * 0.4) + (harmonicComplexity * 0.2));
    }

    calculateAttentionalDemand(analysis) {
        // Based on unpredictability and change detection
        let demand = 0;
        
        if (this.analysisHistory.length >= 10) {
            // Calculate predictability of recent features
            const recent = this.analysisHistory.slice(-10);
            
            // Energy predictability
            const energies = recent.map(a => a.spectral.rms);
            const energyPredictability = 1 - this.calculateVariability(energies);
            
            // Spectral centroid predictability
            const centroids = recent.map(a => a.spectral.centroid);
            const centroidPredictability = 1 - this.calculateVariability(centroids);
            
            demand = 1 - ((energyPredictability + centroidPredictability) / 2);
        }
        
        return Math.min(1, Math.max(0, demand));
    }

    calculateFocusCompatibility(analysis) {
        // Lower values = better for sustained attention tasks
        let incompatibility = 0;
        
        // High arousal is bad for focus
        incompatibility += analysis.perceptual.arousal * 0.3;
        
        // High complexity is distracting
        incompatibility += this.metrics.complexity * 0.3;
        
        // Sudden changes break focus
        incompatibility += this.cognitiveMetrics.distractionPotential * 0.4;
        
        return Math.min(1, incompatibility);
    }

    calculateHighFrequencyEnergy(frequencyData) {
        // Energy in frequencies above 4kHz
        const startBin = Math.floor(4000 / this.frequencyResolution);
        let highFreqEnergy = 0;
        let totalEnergy = 0;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const energy = Math.pow(frequencyData[i] / 255, 2);
            totalEnergy += energy;
            
            if (i >= startBin) {
                highFreqEnergy += energy;
            }
        }
        
        return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    }

    calculateSpectralEntropy(frequencyData) {
        // Shannon entropy of the frequency spectrum
        let entropy = 0;
        let totalEnergy = 0;
        
        // Normalize to probability distribution
        const probabilities = [];
        for (let i = 0; i < frequencyData.length; i++) {
            const energy = Math.pow(frequencyData[i] / 255, 2);
            totalEnergy += energy;
            probabilities[i] = energy;
        }
        
        if (totalEnergy > 0) {
            for (let i = 0; i < probabilities.length; i++) {
                probabilities[i] /= totalEnergy;
                if (probabilities[i] > 0) {
                    entropy -= probabilities[i] * Math.log2(probabilities[i]);
                }
            }
        }
        
        // Normalize by maximum possible entropy
        return entropy / Math.log2(frequencyData.length);
    }

    calculateVariability(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        return mean > 0 ? stdDev / mean : 0; // Coefficient of variation
    }

    // Tempo and Beat Detection
    updateTempoDetection(analysis) {
        // Update onset detection
        const onset = this.onsetDetector.detectOnset(analysis.spectral.spectralFlux);
        
        if (onset) {
            this.beatTracker.addOnset(analysis.timestamp);
            
            // Update tempo estimate
            const tempo = this.beatTracker.estimateTempo();
            if (tempo > 0) {
                this.metrics.tempo = tempo;
            }
            
            // Update rhythmic stability
            this.metrics.rhythmicStability = this.beatTracker.getRhythmicStability();
        }
    }

    updateStructuralAnalysis(analysis) {
        // Long-term structural analysis (requires longer history)
        if (this.analysisHistory.length >= 100) {
            const structure = this.structureAnalyzer.analyze(this.analysisHistory.slice(-100));
            
            // Update structural metrics
            this.cognitiveMetrics.memorabilityIndex = structure.memorability || 0;
        }
    }

    // Public API Methods
    getCurrentAnalysis() {
        return this.currentAnalysis;
    }

    getMetrics() {
        return { ...this.metrics };
    }

    getCognitiveMetrics() {
        return { ...this.cognitiveMetrics };
    }

    getDetailedAnalysis() {
        return {
            timestamp: performance.now(),
            audioTime: this.audioContext.currentTime,
            metrics: this.getMetrics(),
            cognitiveMetrics: this.getCognitiveMetrics(),
            currentAnalysis: this.getCurrentAnalysis(),
            historyLength: this.analysisHistory.length,
            isAnalyzing: this.isAnalyzing
        };
    }

    // Export analysis data for research
    exportAnalysisHistory() {
        return {
            metadata: {
                sampleRate: this.sampleRate,
                fftSize: this.analyzer.fftSize,
                analysisInterval: this.analysisInterval,
                exportTime: new Date().toISOString(),
                historyLength: this.analysisHistory.length
            },
            history: this.analysisHistory,
            finalMetrics: this.getMetrics(),
            finalCognitiveMetrics: this.getCognitiveMetrics()
        };
    }

    // Research-specific analysis methods
    analyzeCorrelationWithPerformance(performanceData) {
        // Correlate music features with cognitive performance
        const correlations = {};
        
        if (this.analysisHistory.length === 0 || performanceData.length === 0) {
            return correlations;
        }
        
        // Align music analysis with performance data by timestamp
        const alignedData = this.alignMusicAndPerformance(performanceData);
        
        if (alignedData.length < 10) {
            console.warn('Insufficient aligned data for correlation analysis');
            return correlations;
        }
        
        // Calculate correlations for key metrics
        const musicMetrics = ['energy', 'complexity', 'arousal', 'tempo', 'spectralCentroid'];
        const perfMetrics = ['reactionTime', 'accuracy', 'consistency'];
        
        musicMetrics.forEach(musicMetric => {
            perfMetrics.forEach(perfMetric => {
                const musicValues = alignedData.map(d => d.music[musicMetric]).filter(v => v !== undefined);
                const perfValues = alignedData.map(d => d.performance[perfMetric]).filter(v => v !== undefined);
                
                if (musicValues.length === perfValues.length && musicValues.length > 5) {
                    const correlation = this.calculateCorrelation(musicValues, perfValues);
                    correlations[`${musicMetric}_${perfMetric}`] = correlation;
                }
            });
        });
        
        return correlations;
    }

    alignMusicAndPerformance(performanceData) {
        const aligned = [];
        const timeWindow = 1000; // 1 second alignment window
        
        performanceData.forEach(perfPoint => {
            // Find closest music analysis
            const musicPoint = this.analysisHistory.find(analysis => 
                Math.abs(analysis.timestamp - perfPoint.timestamp) < timeWindow
            );
            
            if (musicPoint) {
                aligned.push({
                    timestamp: perfPoint.timestamp,
                    music: {
                        energy: musicPoint.spectral.rms,
                        complexity: this.metrics.complexity,
                        arousal: musicPoint.perceptual.arousal,
                        tempo: this.metrics.tempo,
                        spectralCentroid: musicPoint.spectral.centroid
                    },
                    performance: perfPoint
                });
            }
        });
        
        return aligned;
    }

    calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length < 2) return 0;
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator !== 0 ? numerator / denominator : 0;
    }

    // Cleanup
    destroy() {
        console.log('Destroying MusicAnalyzer...');
        
        this.stopAnalysis();
        this.disconnectSource();
        
        // Clear history to free memory
        this.analysisHistory = [];
        this.currentAnalysis = null;
    }
}

// Supporting Classes (simplified implementations)

class SpectralFeatureExtractor {
    extract(frequencyData, sampleRate) {
        const spectralCentroid = this.calculateSpectralCentroid(frequencyData, sampleRate);
        const spectralRolloff = this.calculateSpectralRolloff(frequencyData, sampleRate, 0.85);
        const rms = this.calculateRMS(frequencyData);
        const spectralFlux = this.calculateSpectralFlux(frequencyData);
        
        return {
            centroid: spectralCentroid,
            rolloff: spectralRolloff,
            rms: rms,
            spectralFlux: spectralFlux,
            spectralComplexity: this.calculateSpectralComplexity(frequencyData)
        };
    }
    
    calculateSpectralCentroid(frequencyData, sampleRate) {
        let numerator = 0;
        let denominator = 0;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const magnitude = Math.pow(10, frequencyData[i] / 20);
            const frequency = i * sampleRate / (2 * frequencyData.length);
            
            numerator += frequency * magnitude;
            denominator += magnitude;
        }
        
        return denominator > 0 ? numerator / denominator : 0;
    }
    
    calculateSpectralRolloff(frequencyData, sampleRate, threshold) {
        const totalEnergy = frequencyData.reduce((sum, val) => sum + Math.pow(10, val / 20), 0);
        const targetEnergy = totalEnergy * threshold;
        
        let cumulativeEnergy = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            cumulativeEnergy += Math.pow(10, frequencyData[i] / 20);
            if (cumulativeEnergy >= targetEnergy) {
                return i * sampleRate / (2 * frequencyData.length);
            }
        }
        
        return sampleRate / 2;
    }
    
    calculateRMS(frequencyData) {
        const sumSquares = frequencyData.reduce((sum, val) => {
            const linear = Math.pow(10, val / 20);
            return sum + linear * linear;
        }, 0);
        
        return Math.sqrt(sumSquares / frequencyData.length);
    }
    
    calculateSpectralFlux(frequencyData) {
        if (!this.previousSpectrum) {
            this.previousSpectrum = new Float32Array(frequencyData);
            return 0;
        }
        
        let flux = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const diff = frequencyData[i] - this.previousSpectrum[i];
            flux += Math.max(0, diff);
        }
        
        this.previousSpectrum.set(frequencyData);
        return flux;
    }
    
    calculateSpectralComplexity(frequencyData) {
        // Simple measure based on spectral entropy
        let entropy = 0;
        let totalEnergy = 0;
        
        const probabilities = frequencyData.map(val => {
            const energy = Math.pow(10, val / 20);
            totalEnergy += energy;
            return energy;
        });
        
        if (totalEnergy > 0) {
            probabilities.forEach(prob => {
                prob /= totalEnergy;
                if (prob > 0) {
                    entropy -= prob * Math.log2(prob);
                }
            });
        }
        
        return entropy / Math.log2(frequencyData.length);
    }
}

class RhythmicFeatureExtractor {
    extract(timeData, frequencyData) {
        const zcr = this.calculateZeroCrossingRate(timeData);
        const complexity = this.calculateRhythmicComplexity(frequencyData);
        
        return {
            zcr: zcr,
            complexity: complexity
        };
    }
    
    calculateZeroCrossingRate(timeData) {
        let crossings = 0;
        for (let i = 1; i < timeData.length; i++) {
            if (Math.sign(timeData[i]) !== Math.sign(timeData[i - 1])) {
                crossings++;
            }
        }
        return crossings / timeData.length;
    }
    
    calculateRhythmicComplexity(frequencyData) {
        // Simplified rhythmic complexity based on low-frequency variation
        const lowFreqBins = Math.min(20, Math.floor(frequencyData.length * 0.1));
        let variation = 0;
        
        for (let i = 1; i < lowFreqBins; i++) {
            variation += Math.abs(frequencyData[i] - frequencyData[i - 1]);
        }
        
        return variation / lowFreqBins;
    }
}

class PerceptualFeatureExtractor {
    extract(frequencyData, timeData) {
        const mfccs = this.calculateMFCCs(frequencyData);
        const chroma = this.calculateChromaVector(frequencyData);
        const valence = this.estimateValence(frequencyData, timeData);
        const arousal = this.estimateArousal(frequencyData);
        
        return {
            mfccs: mfccs,
            chroma: chroma,
            valence: valence,
            arousal: arousal
        };
    }
    
    calculateMFCCs(frequencyData, numCoeffs = 13) {
        // Simplified MFCC calculation
        const mfccs = new Array(numCoeffs).fill(0);
        
        // Apply mel filter bank (simplified)
        const melBands = this.applyMelFilterBank(frequencyData);
        
        // DCT (simplified)
        for (let i = 0; i < numCoeffs; i++) {
            let sum = 0;
            for (let j = 0; j < melBands.length; j++) {
                sum += Math.log(Math.max(melBands[j], 1e-10)) * Math.cos(i * (j + 0.5) * Math.PI / melBands.length);
            }
            mfccs[i] = sum;
        }
        
        return mfccs;
    }
    
    applyMelFilterBank(frequencyData, numBands = 26) {
        const bands = new Array(numBands).fill(0);
        const bandsPerOctave = 12;
        
        for (let i = 0; i < frequencyData.length; i++) {
            const band = Math.floor(Math.log2(i + 1) * bandsPerOctave) % numBands;
            bands[band] += Math.pow(10, frequencyData[i] / 20);
        }
        
        return bands;
    }
    
    calculateChromaVector(frequencyData) {
        const chroma = new Array(12).fill(0);
        const freqPerBin = 22050 / frequencyData.length; // Assuming 44.1kHz sample rate
        
        for (let i = 0; i < frequencyData.length; i++) {
            const freq = i * freqPerBin;
            if (freq > 80 && freq < 5000) { // Focus on musical range
                const note = this.frequencyToNote(freq);
                chroma[note] += Math.pow(10, frequencyData[i] / 20);
            }
        }
        
        // Normalize
        const sum = chroma.reduce((a, b) => a + b, 0);
        return sum > 0 ? chroma.map(c => c / sum) : chroma;
    }
    
    frequencyToNote(frequency) {
        const A4 = 440;
        const semitone = Math.round(12 * Math.log2(frequency / A4));
        return ((semitone % 12) + 12) % 12;
    }
    
    estimateValence(frequencyData, timeData) {
        // Simplified valence estimation based on harmonic content
        const harmonicStrength = this.calculateHarmonicContent(frequencyData);
        const brightness = this.calculateSpectralBrightness(frequencyData);
        
        return (harmonicStrength * 0.6) + (brightness * 0.4);
    }
    
    estimateArousal(frequencyData) {
        // Arousal based on energy and high-frequency content
        const totalEnergy = frequencyData.reduce((sum, val) => sum + Math.pow(10, val / 20), 0);
        const highFreqEnergy = frequencyData.slice(Math.floor(frequencyData.length * 0.7))
            .reduce((sum, val) => sum + Math.pow(10, val / 20), 0);
        
        const energyRatio = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
        return Math.min(1, Math.sqrt(totalEnergy) * 0.1 + energyRatio * 0.5);
    }
    
    calculateHarmonicContent(frequencyData) {
        // Look for harmonic peaks
        let harmonicStrength = 0;
        for (let i = 2; i < frequencyData.length / 4; i++) {
            if (frequencyData[i] > frequencyData[i - 1] && frequencyData[i] > frequencyData[i + 1]) {
                harmonicStrength += Math.pow(10, frequencyData[i] / 20);
            }
        }
        return Math.min(1, harmonicStrength * 0.01);
    }
    
    calculateSpectralBrightness(frequencyData) {
        const cutoff = Math.floor(frequencyData.length * 0.5);
        const lowEnergy = frequencyData.slice(0, cutoff).reduce((sum, val) => sum + Math.pow(10, val / 20), 0);
        const highEnergy = frequencyData.slice(cutoff).reduce((sum, val) => sum + Math.pow(10, val / 20), 0);
        
        return (lowEnergy + highEnergy) > 0 ? highEnergy / (lowEnergy + highEnergy) : 0;
    }
}

// Placeholder classes for advanced features
class TempoDetector {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.onsetTimes = [];
    }
    
    reset() {
        this.onsetTimes = [];
    }
    
    addOnset(time) {
        this.onsetTimes.push(time);
        if (this.onsetTimes.length > 100) {
            this.onsetTimes.shift();
        }
    }
    
    estimateTempo() {
        if (this.onsetTimes.length < 4) return 0;
        
        const intervals = [];
        for (let i = 1; i < this.onsetTimes.length; i++) {
            intervals.push(this.onsetTimes[i] - this.onsetTimes[i - 1]);
        }
        
        // Simple tempo estimation from median interval
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        
        return medianInterval > 0 ? 60000 / medianInterval : 0; // BPM
    }
}

class OnsetDetector {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.threshold = 0.3;
        this.lastFlux = 0;
    }
    
    reset() {
        this.lastFlux = 0;
    }
    
    detectOnset(spectralFlux) {
        const onset = spectralFlux > this.threshold && spectralFlux > this.lastFlux;
        this.lastFlux = spectralFlux;
        return onset;
    }
}

class BeatTracker {
    constructor() {
        this.onsets = [];
        this.tempo = 0;
    }
    
    reset() {
        this.onsets = [];
        this.tempo = 0;
    }
    
    addOnset(timestamp) {
        this.onsets.push(timestamp);
        if (this.onsets.length > 50) {
            this.onsets.shift();
        }
    }
    
    estimateTempo() {
        if (this.onsets.length < 4) return 0;
        
        // Calculate intervals and find most common tempo
        const intervals = [];
        for (let i = 1; i < this.onsets.length; i++) {
            intervals.push(this.onsets[i] - this.onsets[i - 1]);
        }
        
        // Simple histogram-based tempo detection
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        this.tempo = medianInterval > 0 ? 60000 / medianInterval : 0;
        
        return this.tempo;
    }
    
    getRhythmicStability() {
        if (this.onsets.length < 4) return 0;
        
        const intervals = [];
        for (let i = 1; i < this.onsets.length; i++) {
            intervals.push(this.onsets[i] - this.onsets[i - 1]);
        }
        
        const mean = intervals.reduce((a, b) => a + b) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
        const cv = Math.sqrt(variance) / mean;
        
        return Math.max(0, 1 - cv); // Higher values = more stable
    }
}

class KeyDetector {
    detectKey(analysisHistory) {
        // Placeholder key detection
        return { key: 'C', mode: 'major', confidence: 0.5 };
    }
}

class ChordDetector {
    detect(frequencyData) {
        // Placeholder chord detection
        return { chord: 'C', confidence: 0.5 };
    }
}

class MusicalStructureAnalyzer {
    analyze(analysisHistory) {
        // Placeholder structure analysis
        return { memorability: 0.5, structure: 'verse-chorus' };
    }
}
