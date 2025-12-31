// js/config/test-suites.js - Test Suite Configurations
// Two distinct test suites optimized for ~17 min each (with 3 music conditions)

const TEST_SUITES = {
    // Suite 1: Reaction & Inhibition (~4 min per condition × 3 = 12 min + overhead)
    reactionInhibition: {
        id: 'reaction-inhibition',
        name: 'Reaction & Inhibition',
        description: 'Measures processing speed, response inhibition, and selective attention',
        estimatedTime: '17 minutes',
        tests: ['simple-reaction', 'go-nogo', 'stroop'],
        recommended: true
    },
    
    // Suite 2: Cognitive Load (~5.5 min per condition × 3 = 16.5 min + overhead)
    cognitiveLoad: {
        id: 'cognitive-load',
        name: 'Cognitive Load',
        description: 'Measures decision making, working memory capacity, and memory updating',
        estimatedTime: '17 minutes',
        tests: ['choice-reaction', 'digit-span', 'n-back']
    }
};

// Individual test configurations with reduced durations
const TEST_CONFIGURATIONS = {
    // === SUITE 1: Reaction & Inhibition ===
    
    'simple-reaction': {
        name: 'Simple Reaction Time',
        suite: 'reaction-inhibition',
        duration: 60000,        // 1 minute
        targetTrials: 18,       // ~3 sec average interval
        minInterval: 2000,      // 2 sec minimum between stimuli
        maxInterval: 4000,      // 4 sec maximum between stimuli
        buttonConfig: 'single',
        description: 'Press the button as quickly as possible when the stimulus appears',
        metrics: ['meanRT', 'medianRT', 'sdRT', 'lapses', 'falseStarts'],
        cognitiveConstruct: 'Processing Speed'
    },
    
    'go-nogo': {
        name: 'Go/No-Go Task',
        suite: 'reaction-inhibition',
        duration: 90000,        // 1.5 minutes
        targetTrials: 45,       // ~2 sec per trial
        goTrialProbability: 0.75,  // 75% go trials (prepotent response)
        stimulusDuration: 500,
        responseWindow: 1000,
        minInterval: 1200,
        maxInterval: 2000,
        buttonConfig: 'single',
        description: 'Press for GREEN, do NOT press for RED',
        metrics: ['goRT', 'goAccuracy', 'nogoAccuracy', 'commissionErrors', 'omissionErrors'],
        cognitiveConstruct: 'Response Inhibition'
    },
    
    'stroop': {
        name: 'Stroop Test',
        suite: 'reaction-inhibition',
        duration: 90000,        // 1.5 minutes
        targetTrials: 36,       // ~2.5 sec per trial
        trialTypes: {
            congruent: 0.33,    // Word matches color
            incongruent: 0.34,  // Word conflicts with color
            neutral: 0.33       // Colored rectangles
        },
        stimulusDuration: 2500,
        minInterval: 500,
        maxInterval: 1000,
        buttonConfig: 'all_four',
        description: 'Press the button matching the COLOR of the text, ignore what the word says',
        metrics: ['congruentRT', 'incongruentRT', 'stroopEffect', 'accuracy'],
        cognitiveConstruct: 'Cognitive Control / Selective Attention'
    },
    
    // === SUITE 2: Cognitive Load ===
    
    'choice-reaction': {
        name: 'Choice Reaction Time',
        suite: 'cognitive-load',
        duration: 90000,        // 1.5 minutes
        targetTrials: 36,       // ~2.5 sec per trial
        stimulusDuration: 2000,
        minInterval: 1000,
        maxInterval: 1500,
        buttonConfig: 'all_four',
        description: 'Press the button that matches the lit LED color',
        metrics: ['meanRT', 'accuracy', 'errorRate'],
        cognitiveConstruct: 'Decision Speed'
    },
    
    'digit-span': {
        name: 'Digit Span',
        suite: 'cognitive-load',
        duration: 120000,       // 2 minutes
        startingLength: 3,
        maxLength: 9,
        digitDisplayDuration: 800,
        interDigitInterval: 400,
        trialsPerLength: 2,
        phases: ['forward'],    // Forward only to save time (remove backward)
        buttonConfig: 'all_four',
        description: 'Watch the sequence of lights, then reproduce it in the same order',
        metrics: ['maxSpan', 'accuracy', 'longestCorrect'],
        cognitiveConstruct: 'Working Memory Capacity'
    },
    
    'n-back': {
        name: 'N-Back (2-Back)',
        suite: 'cognitive-load',
        duration: 120000,       // 2 minutes
        nBack: 2,
        targetTrials: 40,       // ~3 sec per stimulus
        stimulusDuration: 500,
        interStimulusInterval: 2500,
        matchProbability: 0.30, // 30% of trials are matches
        buttonConfig: 'single',
        description: 'Press when the current stimulus matches the one from 2 positions back',
        metrics: ['hits', 'misses', 'falseAlarms', 'correctRejections', 'dPrime', 'accuracy'],
        cognitiveConstruct: 'Working Memory Updating'
    }
};

// Music conditions for the study
const MUSIC_CONDITIONS = [
    {
        id: 'silence',
        name: 'Silence',
        type: 'control',
        file: null,
        description: 'Baseline condition with no audio'
    },
    {
        id: 'classical-80bpm',
        name: '80 BPM Classical',
        type: 'music',
        file: 'audio/classical-80bpm.mp3',
        tempo: 80,
        description: 'Low tempo classical music'
    },
    {
        id: 'electronic-140bpm',
        name: '140 BPM Electronic',
        type: 'music',
        file: 'audio/electronic-140bpm.mp3',
        tempo: 140,
        description: 'High tempo electronic music'
    }
];

// Alternative condition sets (can swap in)
const ALTERNATIVE_CONDITIONS = {
    'classical-120bpm': {
        id: 'classical-120bpm',
        name: '120 BPM Classical',
        type: 'music',
        file: 'audio/classical-120bpm.mp3',
        tempo: 120,
        description: 'Medium tempo classical music'
    },
    'white-noise': {
        id: 'white-noise',
        name: 'White Noise',
        type: 'noise',
        file: null,  // Generated programmatically
        description: 'Constant white noise (masking)'
    },
    'ambient': {
        id: 'ambient',
        name: 'Ambient',
        type: 'music',
        file: 'audio/ambient.mp3',
        description: 'Low arousal ambient soundscape'
    },
    'binaural': {
        id: 'binaural',
        name: 'Binaural Beats',
        type: 'special',
        file: 'audio/binaural.mp3',
        description: 'Binaural beats (claimed cognitive effects)'
    }
};

// Session timing estimates
const TIMING_ESTIMATES = {
    formCompletion: 120000,      // 2 minutes
    testTransition: 5000,        // 5 seconds between tests
    conditionTransition: 10000,  // 10 seconds between conditions
    resultsReview: 60000         // 1 minute
};

// Calculate total session time
function estimateSessionTime(selectedSuites, numConditions = 3) {
    let totalTestTime = 0;
    
    selectedSuites.forEach(suiteId => {
        const suite = TEST_SUITES[suiteId];
        suite.tests.forEach(testId => {
            totalTestTime += TEST_CONFIGURATIONS[testId].duration;
        });
    });
    
    // Multiply by conditions
    const testTimeWithConditions = totalTestTime * numConditions;
    
    // Add overhead
    const numTests = selectedSuites.reduce((sum, s) => sum + TEST_SUITES[s].tests.length, 0);
    const transitions = (numTests * numConditions - 1) * TIMING_ESTIMATES.testTransition;
    const conditionChanges = (numConditions - 1) * TIMING_ESTIMATES.conditionTransition;
    
    const total = TIMING_ESTIMATES.formCompletion 
                + testTimeWithConditions 
                + transitions 
                + conditionChanges 
                + TIMING_ESTIMATES.resultsReview;
    
    return {
        totalMs: total,
        totalMinutes: Math.ceil(total / 60000),
        breakdown: {
            form: TIMING_ESTIMATES.formCompletion / 60000,
            testing: testTimeWithConditions / 60000,
            transitions: (transitions + conditionChanges) / 60000,
            results: TIMING_ESTIMATES.resultsReview / 60000
        }
    };
}

// Export for use in platform
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TEST_SUITES,
        TEST_CONFIGURATIONS,
        MUSIC_CONDITIONS,
        ALTERNATIVE_CONDITIONS,
        TIMING_ESTIMATES,
        estimateSessionTime
    };
}
