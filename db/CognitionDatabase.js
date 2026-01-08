/**
 * Music Cognition Testing Platform - Database Module
 * Uses SQL.js (SQLite compiled to WebAssembly)
 * No native dependencies - pure JavaScript
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class CognitionDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || path.join(__dirname, 'cognition_data.db');
        this.db = null;
        this.SQL = null;
    }

    /**
     * Initialize the database
     */
    async initialize() {
        // Initialize SQL.js
        this.SQL = await initSqlJs();
        
        // Load existing database or create new one
        if (fs.existsSync(this.dbPath)) {
            console.log(`Loading existing database: ${this.dbPath}`);
            const fileBuffer = fs.readFileSync(this.dbPath);
            this.db = new this.SQL.Database(fileBuffer);
        } else {
            console.log(`Creating new database: ${this.dbPath}`);
            this.db = new this.SQL.Database();
            this.createTables();
        }
        
        return this;
    }

    /**
     * Create all database tables
     */
    createTables() {
        // Participants table - all demographic and metadata
        this.db.run(`
            CREATE TABLE IF NOT EXISTS participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                participant_code TEXT UNIQUE NOT NULL,
                age_category TEXT,
                gender TEXT,
                dominant_hand TEXT,
                musical_background TEXT,
                current_music_engagement TEXT,
                hearing_impairment TEXT,
                medications TEXT,
                caffeine_source TEXT,
                caffeine_amount TEXT,
                sleep_hours REAL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Sessions table - each testing session
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_code TEXT UNIQUE NOT NULL,
                participant_id INTEGER NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                status TEXT DEFAULT 'in_progress',
                device_info TEXT,
                notes TEXT,
                FOREIGN KEY (participant_id) REFERENCES participants(id)
            )
        `);

        // Test runs table - each test within a session
        this.db.run(`
            CREATE TABLE IF NOT EXISTS test_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                test_type TEXT NOT NULL,
                music_condition TEXT NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                trial_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'in_progress',
                config_json TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        `);

        // Trials table - individual trial data
        this.db.run(`
            CREATE TABLE IF NOT EXISTS trials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                trial_number INTEGER NOT NULL,
                stimulus_type TEXT,
                stimulus_value TEXT,
                expected_response TEXT,
                actual_response TEXT,
                is_correct BOOLEAN,
                reaction_time_ms REAL,
                stimulus_onset_time INTEGER,
                response_time INTEGER,
                button_pressed INTEGER,
                extra_data_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (test_run_id) REFERENCES test_runs(id)
            )
        `);

        // Test summaries table - aggregated results per test run
        this.db.run(`
            CREATE TABLE IF NOT EXISTS test_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER UNIQUE NOT NULL,
                total_trials INTEGER,
                correct_trials INTEGER,
                accuracy_percent REAL,
                mean_rt_ms REAL,
                median_rt_ms REAL,
                std_rt_ms REAL,
                min_rt_ms REAL,
                max_rt_ms REAL,
                omission_errors INTEGER,
                commission_errors INTEGER,
                extra_metrics_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (test_run_id) REFERENCES test_runs(id)
            )
        `);

        // Music analysis table - store music features during tests
        this.db.run(`
            CREATE TABLE IF NOT EXISTS music_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_run_id INTEGER NOT NULL,
                timestamp INTEGER,
                energy REAL,
                tempo REAL,
                spectral_centroid REAL,
                complexity REAL,
                arousal REAL,
                valence REAL,
                distraction_potential REAL,
                cognitive_load REAL,
                FOREIGN KEY (test_run_id) REFERENCES test_runs(id)
            )
        `);

        // Create indexes for performance
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_participant ON sessions(participant_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_test_runs_session ON test_runs(session_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_trials_test_run ON trials(test_run_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_trials_correct ON trials(is_correct)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_test_runs_type ON test_runs(test_type)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_test_runs_condition ON test_runs(music_condition)`);

        console.log('Database tables created successfully');
    }

    /**
     * Save database to file
     */
    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
        console.log(`Database saved to ${this.dbPath}`);
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }

    // ========================================
    // PARTICIPANT METHODS
    // ========================================

    /**
     * Generate next participant code (P000001, P000002, etc.)
     */
    generateParticipantCode() {
        const result = this.db.exec(`
            SELECT participant_code FROM participants 
            WHERE participant_code LIKE 'P%' 
            ORDER BY participant_code DESC 
            LIMIT 1
        `);
        
        let nextNum = 1;
        
        if (result.length > 0 && result[0].values.length > 0) {
            const lastCode = result[0].values[0][0]; // e.g., "P000042"
            const numPart = lastCode.substring(1); // e.g., "000042"
            const parsed = parseInt(numPart, 10);
            if (!isNaN(parsed)) {
                nextNum = parsed + 1;
            }
        }
        
        return 'P' + String(nextNum).padStart(6, '0');
    }

    /**
     * Get the next participant code without creating a participant
     */
    getNextParticipantCode() {
        return this.generateParticipantCode();
    }

    /**
     * Create a new participant
     */
    createParticipant(data) {
        // Auto-generate code if not provided
        const code = data.participant_code || this.generateParticipantCode();
        
        const stmt = this.db.prepare(`
            INSERT INTO participants (
                participant_code, age_category, gender, dominant_hand,
                musical_background, current_music_engagement, hearing_impairment,
                medications, caffeine_source, caffeine_amount, sleep_hours, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
            code,
            data.age_category || data.ageCategory || null,
            data.gender || null,
            data.dominant_hand || data.dominantHand || null,
            data.musical_background || data.musicalBackground || null,
            data.current_music_engagement || data.currentMusicEngagement || null,
            data.hearing_impairment || data.hearingImpairment || null,
            data.medications || null,
            data.caffeine_source || data.caffeineSource || null,
            data.caffeine_amount || data.caffeineAmount || null,
            data.sleep_hours || data.sleepHours || null,
            data.notes || null
        ]);
        stmt.free();
        
        const id = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        this.save();
        
        return { id, participant_code: code };
    }

    /**
     * Get participant by ID or code
     */
    getParticipant(idOrCode) {
        const result = this.db.exec(`
            SELECT * FROM participants 
            WHERE id = ? OR participant_code = ?
        `, [idOrCode, idOrCode]);
        
        if (result.length === 0 || result[0].values.length === 0) {
            return null;
        }
        
        return this._rowToObject(result[0]);
    }

    /**
     * Get all participants
     */
    getAllParticipants() {
        const result = this.db.exec(`SELECT * FROM participants ORDER BY created_at DESC`);
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * Update participant
     */
    updateParticipant(id, data) {
        const fields = [];
        const values = [];
        
        const fieldMap = {
            age_category: 'age_category',
            ageCategory: 'age_category',
            gender: 'gender',
            dominant_hand: 'dominant_hand',
            dominantHand: 'dominant_hand',
            musical_background: 'musical_background',
            musicalBackground: 'musical_background',
            current_music_engagement: 'current_music_engagement',
            currentMusicEngagement: 'current_music_engagement',
            hearing_impairment: 'hearing_impairment',
            hearingImpairment: 'hearing_impairment',
            medications: 'medications',
            caffeine_source: 'caffeine_source',
            caffeineSource: 'caffeine_source',
            caffeine_amount: 'caffeine_amount',
            caffeineAmount: 'caffeine_amount',
            sleep_hours: 'sleep_hours',
            sleepHours: 'sleep_hours',
            notes: 'notes'
        };
        
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (data[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(data[key]);
            }
        }
        
        if (fields.length === 0) return false;
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        this.db.run(`UPDATE participants SET ${fields.join(', ')} WHERE id = ?`, values);
        this.save();
        return true;
    }

    // ========================================
    // SESSION METHODS
    // ========================================

    /**
     * Create a new session
     */
    createSession(participantId, deviceInfo = null) {
        const code = `S${Date.now()}`;
        
        this.db.run(`
            INSERT INTO sessions (session_code, participant_id, device_info)
            VALUES (?, ?, ?)
        `, [code, participantId, deviceInfo ? JSON.stringify(deviceInfo) : null]);
        
        const id = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        this.save();
        
        return { id, session_code: code };
    }

    /**
     * Get session by ID
     */
    getSession(id) {
        const result = this.db.exec(`SELECT * FROM sessions WHERE id = ?`, [id]);
        if (result.length === 0 || result[0].values.length === 0) return null;
        return this._rowToObject(result[0]);
    }

    /**
     * Get all sessions for a participant
     */
    getParticipantSessions(participantId) {
        const result = this.db.exec(`
            SELECT * FROM sessions 
            WHERE participant_id = ? 
            ORDER BY start_time DESC
        `, [participantId]);
        
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * End a session
     */
    endSession(sessionId, notes = null) {
        this.db.run(`
            UPDATE sessions 
            SET end_time = CURRENT_TIMESTAMP, status = 'completed', notes = COALESCE(?, notes)
            WHERE id = ?
        `, [notes, sessionId]);
        this.save();
    }

    // ========================================
    // TEST RUN METHODS
    // ========================================

    /**
     * Create a new test run
     */
    createTestRun(sessionId, testType, musicCondition, config = null) {
        this.db.run(`
            INSERT INTO test_runs (session_id, test_type, music_condition, config_json)
            VALUES (?, ?, ?, ?)
        `, [sessionId, testType, musicCondition, config ? JSON.stringify(config) : null]);
        
        const id = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        this.save();
        
        return { id };
    }

    /**
     * Get test run by ID
     */
    getTestRun(id) {
        const result = this.db.exec(`SELECT * FROM test_runs WHERE id = ?`, [id]);
        if (result.length === 0 || result[0].values.length === 0) return null;
        return this._rowToObject(result[0]);
    }

    /**
     * Get all test runs for a session
     */
    getSessionTestRuns(sessionId) {
        const result = this.db.exec(`
            SELECT * FROM test_runs 
            WHERE session_id = ? 
            ORDER BY start_time ASC
        `, [sessionId]);
        
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * End a test run
     */
    endTestRun(testRunId, trialCount) {
        this.db.run(`
            UPDATE test_runs 
            SET end_time = CURRENT_TIMESTAMP, status = 'completed', trial_count = ?
            WHERE id = ?
        `, [trialCount, testRunId]);
        this.save();
    }

    // ========================================
    // TRIAL METHODS
    // ========================================

    /**
     * Record a trial
     */
    recordTrial(testRunId, trialData) {
        this.db.run(`
            INSERT INTO trials (
                test_run_id, trial_number, stimulus_type, stimulus_value,
                expected_response, actual_response, is_correct, reaction_time_ms,
                stimulus_onset_time, response_time, button_pressed, extra_data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            testRunId,
            trialData.trial_number || trialData.trialNumber,
            trialData.stimulus_type || trialData.stimulusType || null,
            trialData.stimulus_value || trialData.stimulusValue || null,
            trialData.expected_response || trialData.expectedResponse || null,
            trialData.actual_response || trialData.actualResponse || null,
            trialData.is_correct !== undefined ? (trialData.is_correct ? 1 : 0) : 
                (trialData.isCorrect !== undefined ? (trialData.isCorrect ? 1 : 0) : null),
            trialData.reaction_time_ms || trialData.reactionTime || null,
            trialData.stimulus_onset_time || trialData.stimulusOnsetTime || null,
            trialData.response_time || trialData.responseTime || null,
            trialData.button_pressed || trialData.buttonPressed || null,
            trialData.extra_data ? JSON.stringify(trialData.extra_data) : null
        ]);
        
        // Auto-save every 10 trials for safety
        if ((trialData.trial_number || trialData.trialNumber) % 10 === 0) {
            this.save();
        }
    }

    /**
     * Record multiple trials at once
     */
    recordTrials(testRunId, trials) {
        for (const trial of trials) {
            this.recordTrial(testRunId, trial);
        }
        this.save();
    }

    /**
     * Get all trials for a test run
     */
    getTestRunTrials(testRunId) {
        const result = this.db.exec(`
            SELECT * FROM trials 
            WHERE test_run_id = ? 
            ORDER BY trial_number ASC
        `, [testRunId]);
        
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    // ========================================
    // SUMMARY METHODS
    // ========================================

    /**
     * Create test summary from trial data
     */
    createTestSummary(testRunId) {
        const trials = this.getTestRunTrials(testRunId);
        
        if (trials.length === 0) {
            return null;
        }
        
        const correctTrials = trials.filter(t => t.is_correct === 1);
        const reactionTimes = trials
            .filter(t => t.reaction_time_ms !== null && t.reaction_time_ms > 0)
            .map(t => t.reaction_time_ms);
        
        const summary = {
            total_trials: trials.length,
            correct_trials: correctTrials.length,
            accuracy_percent: (correctTrials.length / trials.length) * 100,
            mean_rt_ms: reactionTimes.length > 0 ? this._mean(reactionTimes) : null,
            median_rt_ms: reactionTimes.length > 0 ? this._median(reactionTimes) : null,
            std_rt_ms: reactionTimes.length > 0 ? this._std(reactionTimes) : null,
            min_rt_ms: reactionTimes.length > 0 ? Math.min(...reactionTimes) : null,
            max_rt_ms: reactionTimes.length > 0 ? Math.max(...reactionTimes) : null,
            omission_errors: trials.filter(t => t.actual_response === null || t.actual_response === 'none').length,
            commission_errors: trials.filter(t => t.is_correct === 0 && t.actual_response !== null).length
        };
        
        // Delete existing summary if present
        this.db.run(`DELETE FROM test_summaries WHERE test_run_id = ?`, [testRunId]);
        
        // Insert new summary
        this.db.run(`
            INSERT INTO test_summaries (
                test_run_id, total_trials, correct_trials, accuracy_percent,
                mean_rt_ms, median_rt_ms, std_rt_ms, min_rt_ms, max_rt_ms,
                omission_errors, commission_errors
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            testRunId,
            summary.total_trials,
            summary.correct_trials,
            summary.accuracy_percent,
            summary.mean_rt_ms,
            summary.median_rt_ms,
            summary.std_rt_ms,
            summary.min_rt_ms,
            summary.max_rt_ms,
            summary.omission_errors,
            summary.commission_errors
        ]);
        
        this.save();
        return summary;
    }

    /**
     * Get test summary
     */
    getTestSummary(testRunId) {
        const result = this.db.exec(`SELECT * FROM test_summaries WHERE test_run_id = ?`, [testRunId]);
        if (result.length === 0 || result[0].values.length === 0) return null;
        return this._rowToObject(result[0]);
    }

    // ========================================
    // ANALYTICS METHODS
    // ========================================

    /**
     * Get performance by music condition
     */
    getPerformanceByCondition(participantId = null) {
        let query = `
            SELECT 
                tr.music_condition,
                COUNT(DISTINCT tr.id) as test_count,
                AVG(ts.accuracy_percent) as avg_accuracy,
                AVG(ts.mean_rt_ms) as avg_reaction_time,
                AVG(ts.std_rt_ms) as avg_rt_variability
            FROM test_runs tr
            JOIN test_summaries ts ON tr.id = ts.test_run_id
            JOIN sessions s ON tr.session_id = s.id
        `;
        
        const params = [];
        if (participantId) {
            query += ` WHERE s.participant_id = ?`;
            params.push(participantId);
        }
        
        query += ` GROUP BY tr.music_condition ORDER BY avg_accuracy DESC`;
        
        const result = this.db.exec(query, params);
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * Get performance by test type
     */
    getPerformanceByTestType(participantId = null) {
        let query = `
            SELECT 
                tr.test_type,
                COUNT(DISTINCT tr.id) as test_count,
                AVG(ts.accuracy_percent) as avg_accuracy,
                AVG(ts.mean_rt_ms) as avg_reaction_time,
                MIN(ts.mean_rt_ms) as best_reaction_time,
                MAX(ts.accuracy_percent) as best_accuracy
            FROM test_runs tr
            JOIN test_summaries ts ON tr.id = ts.test_run_id
            JOIN sessions s ON tr.session_id = s.id
        `;
        
        const params = [];
        if (participantId) {
            query += ` WHERE s.participant_id = ?`;
            params.push(participantId);
        }
        
        query += ` GROUP BY tr.test_type ORDER BY test_type`;
        
        const result = this.db.exec(query, params);
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * Get condition comparison for a specific test type
     */
    getConditionComparison(testType, participantId = null) {
        let query = `
            SELECT 
                tr.music_condition,
                COUNT(*) as trial_count,
                AVG(ts.accuracy_percent) as accuracy,
                AVG(ts.mean_rt_ms) as mean_rt,
                AVG(ts.median_rt_ms) as median_rt,
                AVG(ts.std_rt_ms) as rt_variability
            FROM test_runs tr
            JOIN test_summaries ts ON tr.id = ts.test_run_id
            JOIN sessions s ON tr.session_id = s.id
            WHERE tr.test_type = ?
        `;
        
        const params = [testType];
        if (participantId) {
            query += ` AND s.participant_id = ?`;
            params.push(participantId);
        }
        
        query += ` GROUP BY tr.music_condition`;
        
        const result = this.db.exec(query, params);
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * Get participant summary statistics
     */
    getParticipantStats(participantId) {
        const result = this.db.exec(`
            SELECT 
                p.participant_code,
                p.age_category,
                p.musical_background,
                COUNT(DISTINCT s.id) as total_sessions,
                COUNT(DISTINCT tr.id) as total_tests,
                SUM(ts.total_trials) as total_trials,
                AVG(ts.accuracy_percent) as overall_accuracy,
                AVG(ts.mean_rt_ms) as overall_mean_rt
            FROM participants p
            LEFT JOIN sessions s ON p.id = s.participant_id
            LEFT JOIN test_runs tr ON s.id = tr.session_id
            LEFT JOIN test_summaries ts ON tr.id = ts.test_run_id
            WHERE p.id = ?
            GROUP BY p.id
        `, [participantId]);
        
        if (result.length === 0 || result[0].values.length === 0) return null;
        return this._rowToObject(result[0]);
    }

    /**
     * Compare musical vs non-musical participants
     */
    compareByMusicalBackground() {
        const result = this.db.exec(`
            SELECT 
                CASE 
                    WHEN p.musical_background IN ('none', 'casual') THEN 'non-musical'
                    ELSE 'musical'
                END as group_type,
                COUNT(DISTINCT p.id) as participant_count,
                AVG(ts.accuracy_percent) as avg_accuracy,
                AVG(ts.mean_rt_ms) as avg_reaction_time,
                AVG(ts.std_rt_ms) as avg_variability
            FROM participants p
            JOIN sessions s ON p.id = s.participant_id
            JOIN test_runs tr ON s.id = tr.session_id
            JOIN test_summaries ts ON tr.id = ts.test_run_id
            GROUP BY group_type
        `);
        
        if (result.length === 0) return [];
        return this._rowsToObjects(result[0]);
    }

    /**
     * Export all data for a participant
     */
    exportParticipantData(participantId) {
        const participant = this.getParticipant(participantId);
        const sessions = this.getParticipantSessions(participantId);
        
        const data = {
            participant,
            sessions: sessions.map(session => {
                const testRuns = this.getSessionTestRuns(session.id);
                return {
                    ...session,
                    testRuns: testRuns.map(testRun => ({
                        ...testRun,
                        summary: this.getTestSummary(testRun.id),
                        trials: this.getTestRunTrials(testRun.id)
                    }))
                };
            })
        };
        
        return data;
    }

    /**
     * Export all data as JSON
     */
    exportAllData() {
        const participants = this.getAllParticipants();
        return participants.map(p => this.exportParticipantData(p.id));
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    _rowToObject(result) {
        const columns = result.columns;
        const values = result.values[0];
        const obj = {};
        columns.forEach((col, i) => {
            obj[col] = values[i];
        });
        return obj;
    }

    _rowsToObjects(result) {
        const columns = result.columns;
        return result.values.map(values => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = values[i];
            });
            return obj;
        });
    }

    _mean(arr) {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    _median(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    _std(arr) {
        const mean = this._mean(arr);
        const squareDiffs = arr.map(x => Math.pow(x - mean, 2));
        return Math.sqrt(this._mean(squareDiffs));
    }
}

module.exports = CognitionDatabase;
