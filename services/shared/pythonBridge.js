/**
 * root/services/shared/pythonBridge.js
 *
 */
const appSettings = require('../../config/settings');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');
const MettingAssetController = require('../../controllers/meetings/assets/meetingAssetController');

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

      // Real-time Error Stream Logging
      pyProcess.stderr.on('data', (data) => {
        const errStr = data.toString();
        errorData += errStr;
        console.error(`\x1b[31m[Python STDERR Tracing]:\x1b[0m ${errStr.trim()}`);
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
   * Fully coordinates single-pass asset processing, running everything from
   * track extraction to transcript parsing and structural audits in one smooth process.
   * @param {string} fileName - Absolute base filename target.
   */
  static async runFullAudioPipeline(meetingId, sessionId, fileName) {
    logger.info(`[Python Bridge] Initializing high-performance single-invocation loop for ID: ${meetingId} session ${sessionId}`);
    const aiProfile = appSettings.ai || {};

    try {
      // 1. Pack environmental parameters into configuration payload mapping
      const runtimeSettings = {
        ...aiProfile,
        pipeline_features: appSettings.pipeline_features || {},
        execution_context: "automated_test_engine",
        initialized_at: new Date().toISOString(),
        hf_token_configured: !!appSettings.HF_TOKEN,
        hf_token: appSettings.HF_TOKEN || null
      };
      const stringifiedConfig = JSON.stringify(runtimeSettings);

      logger.info(`[Python Bridge] Dispatching tasks down the bridge to engine_main.py...`);
      
      // 2. Dispatch data package via arguments array matching positional criteria
      const standardJsonOutput = await this.runStage('engine_main.py', [fileName, stringifiedConfig]);
      
      // 3. Unpack complete analytical payload block
      
      logger.error('========== JSON PAYLOAD START ==========');
      logger.error(standardJsonOutput);
      logger.error('========== JSON PAYLOAD END ==========');

      const executionMatrix = JSON.parse(standardJsonOutput);
      logger.info(`[Python Bridge] Execution data package parsed successfully.`);

      // 4. Handle sequential Database initialization tracking matching your model interface requirements.
      //    Screen recordings (REC_*.mp3) have no seeded meeting/session, so meetingId/sessionId may be
      //    null. The DB asset-sync is best-effort only — skip it gracefully when ids are absent.
      if (meetingId && sessionId) {
        logger.info(`[Python Bridge Database Syncing] Initializing storage asset references...`);
        await MettingAssetController.updateAssets(meetingId, sessionId, { audio_path: executionMatrix.audio_path });

        logger.info(`[Python Bridge Database Syncing] Flushing final transcript and audit matrix indicators...`);
        await MettingAssetController.updateAssets(meetingId, sessionId, {
          transcript_path: executionMatrix.transcript_path || null,
          summary_path: executionMatrix.summary_path || null,
          oqi_score: executionMatrix.oqi_score || 0,
          status: 'Completed'
        });

        logger.info(`[Python Bridge] Transaction complete. Asset tracking record finalized for ${meetingId}.`);
      } else {
        logger.warn(`[Python Bridge] Skipping asset DB-sync: missing meetingId/sessionId for "${meetingId}" / "${sessionId}".`);
      }

      // Match data resolution format expected back in test-engine.js
      return {
        success: true,
        meetingId,
        wav_audio_path: executionMatrix.audio_path,
        stage2Result: {
          transcript_path: executionMatrix.transcript_path,
          transcript_text: "Transcript files generated on disk."
        },
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
