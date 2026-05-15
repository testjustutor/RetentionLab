require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../../utils/logger');
const MeetingAssetsModel = require('../../models/MeetingAssetsModel');

class PythonBridge {
  /**
   * Internal helper to run a specific Python script from the engine folder.
   * @param {string} scriptName - The bridge file (e.g., 'bridge_media.py')
   * @param {string[]} args - Arguments for the script
   */
  static runStage(scriptName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../engine/', scriptName);

      // '-u' flag forces Python to send output immediately (unbuffered)
      const pyProcess = spawn('python', ['-u', scriptPath, ...args], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        shell: true
      });

      let outputData = '';
      let errorData = '';

      // Captures every line Python prints in real-time
      pyProcess.stdout.on('data', (data) => {
        const str = data.toString();
        outputData += str;

        // Clean up the string and split into lines to handle rapid updates
        const lines = str.trim().split(/\r?\n/);
        lines.forEach((line) => {
          if (line) {
            // This displays EVERYTHING in your terminal as it happens
            // We use a different color (Cyan) for the engine logs
            console.log(`\x1b[36m[${scriptName}]:\x1b[0m ${line}`);

            // Keep the logger informed too
            if (line.includes('[') || line.includes('%')) {
              logger.info(`[Engine] ${line}`);
            }
          }
        });
      });

      pyProcess.stderr.on('data', (data) => {
        const errStr = data.toString();
        errorData += errStr;
        // Print errors in Red immediately
        console.error(`\x1b[31m[Python Error]:\x1b[0m ${errStr.trim()}`);
      });

      pyProcess.on('close', (code) => {
        const out = outputData.trim();
        const extractLastJson = (text) => {
          if (!text) return text;
          const matches = text.match(/\{[\s\S]*\}\s*$/);
          return matches && matches[0] ? matches[0].trim() : text;
        };


        // Support two output formats:
        // 1) "SUCCESS | <payload>" used by bridge_* scripts
        // 2) Raw JSON like {"success": true, ...} used by engine_main.py
        const hasSuccessPipe = out.includes('SUCCESS |');
        const isJsonSuccess = out.includes('"success"') && out.includes('"success": true');

        if (code === 0 && (hasSuccessPipe || isJsonSuccess)) {
          if (hasSuccessPipe) {
            const lines = out.split(/\r?\n/);
            const successLine = lines.reverse().find((l) => l.includes('SUCCESS |'));
            const result = successLine ? successLine.split('|')[1].trim() : out;
            return resolve(result);
          }

          // For JSON output, resolve only the last JSON object (engine_main.py prints logs + JSON)
          return resolve(extractLastJson(out));

        }

        logger.error(
          `[Engine Error] ${scriptName} failed: ${errorData || 'Check Python Console'}` +
            (out ? ` | Output: ${out.slice(0, 200)}` : '')
        );
        reject(new Error(`Stage ${scriptName} failed with code ${code}`));
      });
    });
  }

  /**
   * STAGE 1: Media Processing
   * Handles .mp4 (converts to .wav) or .mp3 (returns original path).
   */
  static async step1_Media(fileName) {
    logger.info(`[Bridge] Starting Stage 1: Media Check for ${fileName}`);
    return await this.runStage('bridge_media.py', [fileName]);
  }

  /**
   * STAGE 2: AI Pipeline
   * Runs Whisper & Pyannote. Receives audio path, returns transcript text.
   */
  static async step2_Transcription(audioPath) {
    logger.info(`[Bridge] Starting Stage 2: AI Pipeline (Whisper/Pyannote)`);
    return await this.runStage('bridge_pipeline.py', [audioPath]);
  }

  /**
   * STAGE 3: Educational Audit
   * Receives transcript text, returns JSON audit results.
   */
  static async step3_Audit(transcriptText) {
    logger.info(`[Bridge] Starting Stage 3: Educational Audit`);
    const result = await this.runStage('bridge_audit.py', [transcriptText]);
    return JSON.parse(result);
  }

  /**
   * A consolidated method that runs all steps but allows for per-stage failure handling.
   */
  static async runFullAudioPipeline(fileName) {
      
    const baseId = fileName.replace('REC_', '').split('.')[0];

    try {

      const engineResultRaw = await this.runStage('engine_main.py', [fileName]);
      const engineResult = typeof engineResultRaw === 'string' ? JSON.parse(engineResultRaw) : engineResultRaw;

      if (!engineResult || !engineResult.success) {
        throw new Error(engineResult.error || "Python engine failed.");
      }

      await MeetingAssetsModel.saveAssets(baseId, {
        // Step 1 Update
        wav_audio_path: engineResult.audio_path, 
        
        // Step 2 Update
        diarization_path: engineResult.transcript_path, 
        
        // Step 3 Update
        transcript_path: engineResult.transcript_path, 
        
        // Step 4 Updates (Intelligence)
        sentiment_analysis_path: engineResult.sentiment_path || null,
        talk_ratio_json_path: engineResult.talk_ratio_path || null,
        
        // Step 5 Updates (Audit)
        audit_json_path: engineResult.audit_json_path,
        summary_path: engineResult.summary_path,
        oqi_score: engineResult.oqi_score,
        
        // FINAL DB UPDATE
        status: 'Completed' 
      });

      logger.info(`[Bridge] Roadmap Step 5 Reached: Audit complete and status set to 'Completed' for ${baseId}`);

      return engineResult;

    } catch (error) {
      logger.error(`[Bridge] Roadmap Failed at ${baseId}: ${error.message}`);
      // Update DB to show exactly where it failed if possible, or just 'Error'
      await MeetingAssetsModel.update(baseId, { status: 'Error' });
      throw error;
    }
  }
}

module.exports = PythonBridge;


