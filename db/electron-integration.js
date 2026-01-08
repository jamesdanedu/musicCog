/**
 * Electron Main Process Integration
 * Add this to your main.js to integrate the database
 */

const { app, ipcMain } = require('electron');
const path = require('path');
const CognitionDatabase = require('./CognitionDatabase');

let db = null;

// Initialize database when app is ready
app.whenReady().then(async () => {
    const dbPath = path.join(app.getPath('userData'), 'cognition_data.db');
    db = await new CognitionDatabase(dbPath).initialize();
    console.log('Database initialized at:', dbPath);
});

// Save database when app closes
app.on('before-quit', () => {
    if (db) {
        db.close();
    }
});

// ========================================
// IPC HANDLERS - Add these to main.js
// ========================================

// Participant handlers
ipcMain.handle('db:getNextParticipantCode', async () => {
    try {
        return { success: true, result: db.getNextParticipantCode() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:createParticipant', async (event, data) => {
    try {
        return { success: true, result: db.createParticipant(data) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getParticipant', async (event, idOrCode) => {
    try {
        return { success: true, result: db.getParticipant(idOrCode) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getAllParticipants', async () => {
    try {
        return { success: true, result: db.getAllParticipants() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Session handlers
ipcMain.handle('db:createSession', async (event, participantId, deviceInfo) => {
    try {
        return { success: true, result: db.createSession(participantId, deviceInfo) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:endSession', async (event, sessionId, notes) => {
    try {
        db.endSession(sessionId, notes);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Test run handlers
ipcMain.handle('db:createTestRun', async (event, sessionId, testType, musicCondition, config) => {
    try {
        return { success: true, result: db.createTestRun(sessionId, testType, musicCondition, config) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:endTestRun', async (event, testRunId, trialCount) => {
    try {
        db.endTestRun(testRunId, trialCount);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Trial handlers
ipcMain.handle('db:recordTrial', async (event, testRunId, trialData) => {
    try {
        db.recordTrial(testRunId, trialData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:recordTrials', async (event, testRunId, trials) => {
    try {
        db.recordTrials(testRunId, trials);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Summary handlers
ipcMain.handle('db:createTestSummary', async (event, testRunId) => {
    try {
        return { success: true, result: db.createTestSummary(testRunId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Analytics handlers
ipcMain.handle('db:getPerformanceByCondition', async (event, participantId) => {
    try {
        return { success: true, result: db.getPerformanceByCondition(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getPerformanceByTestType', async (event, participantId) => {
    try {
        return { success: true, result: db.getPerformanceByTestType(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getConditionComparison', async (event, testType, participantId) => {
    try {
        return { success: true, result: db.getConditionComparison(testType, participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:getParticipantStats', async (event, participantId) => {
    try {
        return { success: true, result: db.getParticipantStats(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:compareByMusicalBackground', async () => {
    try {
        return { success: true, result: db.compareByMusicalBackground() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Export handlers
ipcMain.handle('db:exportParticipantData', async (event, participantId) => {
    try {
        return { success: true, result: db.exportParticipantData(participantId) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db:exportAllData', async () => {
    try {
        return { success: true, result: db.exportAllData() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

module.exports = { db };
