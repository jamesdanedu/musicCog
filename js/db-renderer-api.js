/**
 * Renderer Process Database API
 * Use this in your frontend code to interact with the database
 * 
 * Usage in renderer:
 * const dbAPI = require('./db-renderer-api');
 * const participant = await dbAPI.createParticipant({ ... });
 */

const { ipcRenderer } = require('electron');

const dbAPI = {
    // ========================================
    // PARTICIPANTS
    // ========================================
    
    /**
     * Get the next participant code (P000001, P000002, etc.)
     * Call this to display the ID before creating the participant
     */
    async getNextParticipantCode() {
        const result = await ipcRenderer.invoke('db:getNextParticipantCode');
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async createParticipant(data) {
        const result = await ipcRenderer.invoke('db:createParticipant', data);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async getParticipant(idOrCode) {
        const result = await ipcRenderer.invoke('db:getParticipant', idOrCode);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async getAllParticipants() {
        const result = await ipcRenderer.invoke('db:getAllParticipants');
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    // ========================================
    // SESSIONS
    // ========================================
    
    async createSession(participantId, deviceInfo = null) {
        const result = await ipcRenderer.invoke('db:createSession', participantId, deviceInfo);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async endSession(sessionId, notes = null) {
        const result = await ipcRenderer.invoke('db:endSession', sessionId, notes);
        if (!result.success) throw new Error(result.error);
    },
    
    // ========================================
    // TEST RUNS
    // ========================================
    
    async createTestRun(sessionId, testType, musicCondition, config = null) {
        const result = await ipcRenderer.invoke('db:createTestRun', sessionId, testType, musicCondition, config);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async endTestRun(testRunId, trialCount) {
        const result = await ipcRenderer.invoke('db:endTestRun', testRunId, trialCount);
        if (!result.success) throw new Error(result.error);
    },
    
    // ========================================
    // TRIALS
    // ========================================
    
    async recordTrial(testRunId, trialData) {
        const result = await ipcRenderer.invoke('db:recordTrial', testRunId, trialData);
        if (!result.success) throw new Error(result.error);
    },
    
    async recordTrials(testRunId, trials) {
        const result = await ipcRenderer.invoke('db:recordTrials', testRunId, trials);
        if (!result.success) throw new Error(result.error);
    },
    
    // ========================================
    // SUMMARIES
    // ========================================
    
    async createTestSummary(testRunId) {
        const result = await ipcRenderer.invoke('db:createTestSummary', testRunId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    // ========================================
    // ANALYTICS
    // ========================================
    
    async getPerformanceByCondition(participantId = null) {
        const result = await ipcRenderer.invoke('db:getPerformanceByCondition', participantId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async getPerformanceByTestType(participantId = null) {
        const result = await ipcRenderer.invoke('db:getPerformanceByTestType', participantId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async getConditionComparison(testType, participantId = null) {
        const result = await ipcRenderer.invoke('db:getConditionComparison', testType, participantId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async getParticipantStats(participantId) {
        const result = await ipcRenderer.invoke('db:getParticipantStats', participantId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async compareByMusicalBackground() {
        const result = await ipcRenderer.invoke('db:compareByMusicalBackground');
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    // ========================================
    // EXPORT
    // ========================================
    
    async exportParticipantData(participantId) {
        const result = await ipcRenderer.invoke('db:exportParticipantData', participantId);
        if (!result.success) throw new Error(result.error);
        return result.result;
    },
    
    async exportAllData() {
        const result = await ipcRenderer.invoke('db:exportAllData');
        if (!result.success) throw new Error(result.error);
        return result.result;
    }
};

module.exports = dbAPI;

// ========================================
// EXAMPLE USAGE IN TEST CODE
// ========================================
/*
// When showing the participant form, get the next ID to display:
const nextCode = await dbAPI.getNextParticipantCode();
document.getElementById('displayParticipantId').textContent = nextCode;

// When submitting the participant form:
const participant = await dbAPI.createParticipant({
    // participant_code is auto-generated if not provided
    age_category: document.getElementById('ageCategory').value,
    gender: document.getElementById('gender').value,
    dominant_hand: document.getElementById('dominantHand').value,
    musical_background: document.getElementById('musicalBackground').value,
    current_music_engagement: document.getElementById('currentMusicEngagement').value,
    hearing_impairment: document.getElementById('hearingImpairment').value,
    medications: document.getElementById('medications').value,
    caffeine_source: document.getElementById('caffeineSource').value,
    caffeine_amount: document.getElementById('caffeineAmount').value,
    sleep_hours: document.getElementById('sleepHours').value,
    notes: document.getElementById('notes').value
});
// participant.participant_code will be "P000001", "P000002", etc.

const session = await dbAPI.createSession(participant.id);

// When starting a test:
const testRun = await dbAPI.createTestRun(
    session.id,
    'simple_reaction',
    'classical',
    { trialCount: 30, stimulusDuration: 500 }
);

// During the test, record each trial:
await dbAPI.recordTrial(testRun.id, {
    trial_number: trialNum,
    stimulus_type: 'visual',
    expected_response: 'button_0',
    actual_response: response,
    is_correct: response === 'button_0',
    reaction_time_ms: reactionTime,
    button_pressed: buttonIndex
});

// When test completes:
const summary = await dbAPI.createTestSummary(testRun.id);
await dbAPI.endTestRun(testRun.id, totalTrials);

// When session ends:
await dbAPI.endSession(session.id);

// For analytics dashboard:
const conditionPerf = await dbAPI.getPerformanceByCondition();
const musicalComparison = await dbAPI.compareByMusicalBackground();
*/