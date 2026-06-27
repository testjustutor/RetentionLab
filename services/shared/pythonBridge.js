/**
 * root/services/shared/pythonBridge.js
 *
 */
const appSettings = require('../../config/settings');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { logger } = require('../../utils/logger');
const MeetingAssetsModel = require('../../models/MeetingAssetsModel');

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

      logger.info(`[Bridge Initialization] Spawning ${scriptName}`);
      logger.info(`[Bridge CLI Arguments] target_file="${args[0]}", settings_size=${args[1]?.length || 0} bytes`);
      logger.info(`[Bridge System Path] Execution path: ${scriptPath}`);
      logger.info(`[Bridge Python Executable] ${pythonExecutable}`);

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
        logger.error(`[Bridge Critical Error] Failed to launch child process process: ${err.message}`);
        reject(err);
      });

      // Process Termination Lifecycle Handler
      pyProcess.on('close', (code) => {
        const standardOutCleaned = outputData.trim();
        logger.info(`[Bridge Engine Disconnect] Script ${scriptName} terminated with exit code: ${code}`);

        if (code !== 0) {
          logger.error(`[Bridge Pipeline Failure] Engine processing aborted. Reason: ${errorData || 'Check standard error diagnostics.'}`);
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
          logger.error('[Bridge Parsing Error] Process returned success but no structural JSON output block was recovered.');
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
  static async runFullAudioPipeline(fileName) {
    const meetingId = fileName.match(/^REC_(.+?)_Sess/)?.[1] || "UNKNOWN_MEETING";
    
    logger.info(`[Pipeline Orchestrator] Initializing high-performance single-invocation loop for ID: ${meetingId}`);
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

      logger.info(`[Pipeline Orchestrator] Dispatching tasks down the bridge to engine_main.py...`);
      
      // 2. Dispatch data package via arguments array matching positional criteria
      const standardJsonOutput = await this.runStage('engine_main.py', [fileName, stringifiedConfig]);
      
      // 3. Unpack complete analytical payload block
      
      logger.error('========== JSON PAYLOAD START ==========');
      logger.error(standardJsonOutput);
      logger.error('========== JSON PAYLOAD END ==========');

      const executionMatrix = JSON.parse(standardJsonOutput);
      logger.info(`[Pipeline Orchestrator] Execution data package parsed successfully.`);

      // 4. Handle sequential Database initialization tracking matching your model interface requirements
      logger.info(`[Database Syncing] Initializing storage asset references...`);
      await MeetingAssetsModel.initializeAssets(meetingId, fileName, executionMatrix.audio_path);

      logger.info(`[Database Syncing] Flushing final transcript and audit matrix indicators...`);
      await MeetingAssetsModel.updateAssets(meetingId, {
        transcript_path: executionMatrix.transcript_path || null,
        diarization_path: executionMatrix.transcript_path ? executionMatrix.transcript_path.replace('AUDIO_TRANS', 'DIAR').replace('cache_audio_transcripts', 'cache_diarization').replace('.txt', '.json') : null,
        talk_ratio_json_path: executionMatrix.sentiment_path || null, // Map downstream analytics safely
        audit_json_path: executionMatrix.audit_json_path || null,
        summary_path: executionMatrix.summary_path || null,
        oqi_score: executionMatrix.oqi_score || 0,
        evidence_quote: "Evaluation criteria completed successfully.",
        status: 'Completed'
      });

      logger.info(`[Pipeline Orchestrator] Transaction complete. Asset tracking record finalized for ${meetingId}.`);

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
        `[Pipeline Orchestrator Error] Structural collapse at ${meetingId}: ${
          error.stack || error.message
        }`
      );
      // Safely mark the failure flag in database storage
      try {
        await MeetingAssetsModel.updateAssets(meetingId, { status: 'Error' });
      } catch (dbErr) {
        logger.error(`[Database Critical Error] Failed to write failure flag trace context: ${dbErr.message}`);
      }
      
      throw error;
    }
  }
}

module.exports = PythonBridge;
