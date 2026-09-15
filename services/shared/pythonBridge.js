/**
 * services/shared/pythonBridge.js
 *
 */
const appSettings = require('../../config/settings');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');
const MettingAssetController = require('../../controllers/meetings/assets/meetingAssetController');
const MeetingAssetModel = require('../../models/meetings/assets/meetingAssetModel');

class PythonBridge {
  /**
   * Spawns the monolithic Python engine with strict positional arguments.
   * @param {string} scriptName - Target execution script (engine_main.py).
   * @param {Array<string>} args - Exactly: [input_file, ai_settings_json]
   * @returns {Promise<string>} Captured stdout JSON payload block string.
   */
  static runStage(scriptName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../engine/', scriptName);
      const projectRoot = path.join(__dirname, '../..');
      const venvPython = process.env.VIRTUAL_ENV
        ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe')
        : path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE
        || (fs.existsSync(venvPython) ? venvPython : 'python');

      logger.info(`[Python Bridge Initialization] Spawning ${scriptName}`);
      logger.info(`[Python Bridge CLI Arguments] target_file="${args[0]}", settings_size=${args[1]?.length || 0} bytes`);
      logger.info(`[Python Bridge System Path] Execution path: ${scriptPath}`);
      logger.info(`[Python Bridge Python Executable] ${pythonExecutable}`);

      const pyProcess = spawn(pythonExecutable, ['-u', scriptPath, ...args], {
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONPATH: projectRoot
        }
      });

      let outputData = '';
      let errorData = '';

      // Real-time Standard Output Processing
      pyProcess.stdout.on('data', (data) => {
        const streamStr = data.toString();
        outputData += streamStr;

        const lines = streamStr.trim().split(/\r?\n/);
        lines.forEach((line) => {
          if (line) {
            // Distinctly style standard engine outputs in console
            console.log(`\x1b[36m[Python Engine]:\x1b[0m ${line}`);
            if (line.includes('[') || line.includes('%') || line.includes('PROGRESS')) {
              logger.info(`[Engine Runtime Log] ${line}`);
            }
          }
        });
      });

      // Real-time Error Stream Logging - Python writes normal progress
      // output (tqdm progress bars, warnings.warn()) to stderr by design,
      // not just actual errors, so this is colored blue (not red) to avoid
      // looking like a failure. Actual failures still surface separately via
      // the exit-code check below (logger.error on the 'close' handler).
      pyProcess.stderr.on('data', (data) => {
        const errStr = data.toString();
        errorData += errStr;
        console.error(`\x1b[34m[Python STDERR Tracing]:\x1b[0m ${errStr.trim()}`);
      });

      pyProcess.on('error', (err) => {
        logger.error(`[Python Bridge Critical Error] Failed to launch child process process: ${err.message}`);
        reject(err);
      });

      // Process Termination Lifecycle Handler
      pyProcess.on('close', (code) => {
        const standardOutCleaned = outputData.trim();
        logger.info(`[Python Bridge Engine Disconnect] Script ${scriptName} terminated with exit code: ${code}`);

        if (code !== 0) {
          logger.error(`[Python Bridge Pipeline Failure] Engine processing aborted. Reason: ${errorData || 'Check standard error diagnostics.'}`);
          return reject(new Error(`Engine execution crashed with exit code ${code}`));
        }

        // Extracts the last valid JSON payload from mixed stdout text.
        const extractTrailingJsonContext = (text) => {
          if (!text) return '';
          const trimmed = text.trim();
          if (!trimmed) return '';

          // Attempt parse from the last opening brace backwards until we find valid JSON
          let index = trimmed.lastIndexOf('{');
          while (index !== -1) {
            const candidate = trimmed.slice(index).trim();
            try {
              JSON.parse(candidate);
              return candidate;
            } catch (_err) {
              index = trimmed.lastIndexOf('{', index - 1);
            }
          }

          return '';
        };

        const jsonPayload = extractTrailingJsonContext(standardOutCleaned);
        if (!jsonPayload) {
          logger.error('[Python Bridge Parsing Error] Process returned success but no structural JSON output block was recovered.');
          return reject(new Error('Invalid engine standard stream response footprint'));
        }

        return resolve(jsonPayload);
      });
    });
  }

  /**
   * Resolve meeting_id + session_id for the asset DB-sync.
   * Prefers the values passed by the caller; then prefers the engine's OWN
   * resolved fields (executionMatrix.meeting_id / .session_id, now returned
   * directly by pipeline_context.py's build_final_response - see FIX below);
   * and only falls back to regex-parsing the legacy "<ext>_SessN_..." string
   * shape for engines that don't yet supply session_id explicitly.
   *
   * FIX 6: this now returns a tagged result instead of silently returning
   * null on every failure path. Callers that NEED ids (i.e. weren't given
   * both meetingIdInput/sessionIdInput up front) can now distinguish
   * "intentionally skippable" (e.g. ad-hoc screen recording with no DB
   * session at all) from "should have resolved but didn't" (regex/DB lookup
   * failed unexpectedly) and react accordingly instead of always just
   * logging a warn and moving on.
   *
   * FIX (this pass): pipeline_context.py's build_final_response() used to
   * return the filename-derived base_id as "meeting_id" (e.g.
   * "82014705313_Sess159_2026-06-12_16-01"), so this function had to
   * regex-parse that string to recover the session id, then look the real
   * meeting id up in the DB a SECOND time even though Python had already
   * resolved it. Now that the engine returns the already-resolved numeric
   * meeting_id AND session_id directly, we use those first and only fall
   * back to the old regex path for engine responses that predate this fix.
   */
  static async resolveMeetingContext(meetingIdInput, sessionIdInput, engineMeetingId, engineSessionId) {
    if (meetingIdInput && sessionIdInput) {
      return { meetingId: meetingIdInput, sessionId: sessionIdInput, resolved: true, reason: 'caller_supplied' };
    }

    // FIX: prefer the engine's own resolved session_id field directly -
    // no regex needed when the engine already tells us.
    let sessionId = sessionIdInput || engineSessionId || null;
    let parseFailed = false;

    if (!sessionId && engineMeetingId) {
      // Legacy fallback: older engine responses (or callers still passing
      // the filename-shaped string) encode the session in the meeting_id
      // string itself as "<ext>_SessN_...".
      const m = /^[^_]+_Sess(\d+)_/.exec(String(engineMeetingId));
      if (m) {
        sessionId = Number(m[1]);
      } else {
        // FIX 6: previously this just silently left sessionId null with no
        // distinction from "there was genuinely no engineMeetingId to parse".
        parseFailed = true;
      }
    }

    if (!sessionId) {
      return {
        meetingId: null,
        sessionId: null,
        resolved: false,
        // FIX 6: distinguishes "nothing to resolve from" (expected for
        // ad-hoc runs with no engineMeetingId at all) from "regex could not
        // parse the engine's meeting_id format" (an unexpected format
        // change that deserves attention, not a silent skip).
        reason: parseFailed ? 'session_id_parse_failed' : 'no_session_id_available'
      };
    }

    // FIX: if the engine already resolved a numeric meeting_id (i.e. it's
    // not just the filename-shaped base_id string), trust it directly and
    // skip the redundant DB round-trip below entirely.
    if (engineMeetingId && /^\d+$/.test(String(engineMeetingId))) {
      return { meetingId: Number(engineMeetingId), sessionId, resolved: true, reason: 'engine_resolved' };
    }

    // meeting_sessions.meeting_id references meetings.id (the internal ID).
    // This is the authoritative source — no meeting id is created here.
    let row = null;
    let dbLookupFailed = false;
    try {
      row = await MeetingAssetModel.getMeetingIdBySessionId(sessionId);
    } catch (err) {
      dbLookupFailed = true;
      logger.error(`[Python Bridge] resolveMeetingContext: DB lookup for sessionId=${sessionId} threw: ${err.message}`);
    }

    if (row && row.meeting_id) {
      return { meetingId: row.meeting_id, sessionId, resolved: true, reason: 'db_lookup' };
    }

    return {
      meetingId: null,
      sessionId,
      resolved: false,
      // FIX 6: separates "DB lookup threw an error" from "DB lookup ran
      // fine but found no matching row" — both used to collapse into the
      // same silent `null` return before.
      reason: dbLookupFailed ? 'db_lookup_error' : 'db_row_not_found'
    };
  }

  /**
   * Fully coordinates single-pass asset processing, running everything from
   * track extraction to parsing and structural audits in one smooth process.
   * @param {string} fileName - Absolute base filename target.
   */
  static async runFullAudioPipeline(meetingId, sessionId, fileName) {
    logger.info(`[Python Bridge] Initializing high-performance single-invocation loop for ID: ${meetingId} session ${sessionId}`);
    const aiProfile = appSettings.ai || {};

    try {
      // 1. Pack environmental parameters into configuration payload mapping
      // CONVERGENCE FIX: forward the caller-supplied meeting_id/session_id
      // through to PipelineContext (services/engine/orchestrator/pipeline_context.py),
      // which now prefers these explicit ids over its own filename-regex
      // resolution. Both production callers already have the real DB ids at
      // this point (SocraticBot for bot recordings, videoProcessingController
      // for admin-uploaded videos) - passing them through makes meeting/session
      // resolution authoritative instead of re-derived, and is REQUIRED for
      // admin video filenames whose external_meeting_id segment can be a
      // generic, non-unique token (e.g. "Regular"). test-engine.js ad-hoc runs
      // still pass null/null here, so the engine's filename-regex fallback is
      // unaffected for that case.
      const runtimeSettings = {
        ...aiProfile,
        pipeline_features: appSettings.pipeline_features || {},
        execution_context: "automated_test_engine",
        initialized_at: new Date().toISOString(),
        hf_token_configured: !!appSettings.HF_TOKEN,
        hf_token: appSettings.HF_TOKEN || null,
        meeting_id: meetingId || null,
        session_id: sessionId || null
      };
      const stringifiedConfig = JSON.stringify(runtimeSettings);

      logger.info(`[Python Bridge] Dispatching tasks down the bridge to engine_main.py...`);
      
      // 2. Dispatch data package via arguments array matching positional criteria
      const standardJsonOutput = await this.runStage('engine_main.py', [fileName, stringifiedConfig]);
      
      // 3. Unpack complete analytical payload block
      
      logger.info('========== JSON PAYLOAD START ==========');
      logger.info(standardJsonOutput);
      logger.info('========== JSON PAYLOAD END ==========');

      const executionMatrix = JSON.parse(standardJsonOutput);
      logger.info(`[Python Bridge] Execution data package parsed successfully.`);

      // Pre-audit transcript validation (services/engine/transcript_validation.py,
      // run from transcription_task.py) found this recording empty/near-empty or
      // single-speaker-only. The engine already skipped the AI audit, summary
      // generation, and its own DB persistence for exactly this reason - mirror
      // that here by skipping the "Completed" + oqi_score asset DB-sync too,
      // instead of falsely marking a skipped session as a completed report.
      if (executionMatrix.skipped) {
        logger.info(`[Python Bridge] Engine reported processing skipped reason="${executionMatrix.skip_reason}" for meetingId=${meetingId} sessionId=${sessionId} - skipping AI audit + asset DB-sync (transcript validation).`);
        return {
          success: true,
          skipped: true,
          skipReason: executionMatrix.skip_reason || null,
          skipMessage: executionMatrix.skip_message || 'Processing was skipped for this recording.',
          meetingId: meetingId || executionMatrix.meeting_id || null,
          sessionId: sessionId || executionMatrix.session_id || null
        };
      }

      // Resolve meetingId/sessionId from the engine payload when the caller did
      // not supply them (e.g. socraticbot test runs), so the asset DB-sync below
      // is never skipped for a parseable meeting id.
      // FIX: pass executionMatrix.session_id through directly (now returned
      // by pipeline_context.py's build_final_response) instead of relying
      // solely on regex-parsing executionMatrix.meeting_id.
      const resolution = await this.resolveMeetingContext(
        meetingId,
        sessionId,
        executionMatrix.meeting_id,
        executionMatrix.session_id
      );
      const syncMeetingId = resolution.resolved ? resolution.meetingId : meetingId;
      const syncSessionId = resolution.resolved ? resolution.sessionId : sessionId;

      // FIX 6: hard-fail loudly when resolution was EXPECTED to succeed
      // (i.e. the engine gave us a meeting_id to parse, meaning this wasn't
      // an intentional caller-less/no-context run) but didn't, instead of
      // silently logging a warn and quietly skipping the DB asset sync as
      // before. A parse or DB-lookup failure on a real meeting id is a bug,
      // not a no-op case, and should surface as a thrown error so callers
      // (and monitoring/alerting) actually see it.
      const wasExpectedToResolve = !!executionMatrix.meeting_id &&
        (resolution.reason === 'session_id_parse_failed' || resolution.reason === 'db_lookup_error');

      if (wasExpectedToResolve) {
        const failureMsg = `[Python Bridge] Asset DB-sync FAILED unexpectedly (reason: ${resolution.reason}). ` +
          `engine meeting_id="${executionMatrix.meeting_id}", inputMeetingId="${meetingId}", inputSessionId="${sessionId}".`;
        logger.error(failureMsg);
        throw new Error(failureMsg);
      }

      // 4. Handle sequential Database initialization tracking matching your model interface requirements.
      //    Screen recordings (REC_*.mp3) may not have seeded meeting/session, so this is best-effort
      //    and skips gracefully ONLY when ids genuinely can't exist (no engine meeting_id at all).
      if (syncMeetingId && syncSessionId) {
        logger.info(`[Python Bridge Database Syncing] Initializing storage asset references...`);
        logger.info(`[Python Bridge Database Syncing] Flushing final audit matrix indicators...`);
        await MettingAssetController.updateAssets(syncMeetingId, syncSessionId, {
          summary_path: executionMatrix.summary_path || null,
          oqi_score: executionMatrix.oqi_score || 0,
          audit_completed_at: new Date(),
          status: 'Completed'
        });

        logger.info(`[Python Bridge] Transaction complete. Asset tracking record finalized for ${syncMeetingId}.`);
      } else {
        logger.warn(`[Python Bridge] Skipping asset DB-sync: no meeting/session context available for "${syncMeetingId}" / "${syncSessionId}" (reason: ${resolution.reason}).`);
      }

      // Match data resolution format expected back in test-engine.js
      return {
        success: true,
        meetingId: syncMeetingId,
        sessionId: syncSessionId,
        auditResult: {
          oqi_score: executionMatrix.oqi_score,
          audit_json_path: executionMatrix.audit_json_path
        }
      };

    } catch (error) {
      logger.error(
        `[Python Bridge Error] Structural collapse at ${meetingId}: ${
          error.stack || error.message
        }`
      );
      // Safely mark the failure flag in database storage (only when ids are present)
      if (meetingId && sessionId) {
        try {
          await MettingAssetController.updateAssets(meetingId, sessionId, { status: 'Error' });
        } catch (dbErr) {
          logger.error(`[Python Bridge Database Critical Error] Failed to write failure flag trace context: ${dbErr.message}`);
        }
      }
      
      throw error;
    }
  }
}

module.exports = PythonBridge;