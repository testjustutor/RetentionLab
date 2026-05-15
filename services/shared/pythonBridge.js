require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../../utils/logger');
const MeetingAssetsModel = require('../../models/MeetingAssetsModel');

class PythonBridge {
  static runStage(scriptName, args) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../engine/', scriptName);

      logger.info(`[Bridge Debug] Spawning ${scriptName} with args: ${JSON.stringify(args)}`);
      logger.info(`[Bridge Debug] Script path: ${scriptPath}`);

      const pyProcess = spawn('python', ['-u', scriptPath, ...args], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let outputData = '';
      let errorData = '';

      pyProcess.on('error', (err) => {
        logger.error(`[Bridge Debug] Failed to spawn ${scriptName}: ${err.message}`);
      });

      pyProcess.stdout.on('data', (data) => {
        const str = data.toString();
        outputData += str;

        logger.info(`[Bridge Debug] stdout chunk from ${scriptName}: `);

        const lines = str.trim().split(/\r?\n/);
        lines.forEach((line) => {
          if (line) {
            console.log(`\x1b[36m[${scriptName}]:\x1b[0m ${line}`);
            if (line.includes('[') || line.includes('%')) {
              logger.info(`[Engine] ${line}`);
            }
          }
        });
      });

      pyProcess.stderr.on('data', (data) => {
        const errStr = data.toString();
        errorData += errStr;

        logger.error(`[Bridge Debug] stderr chunk from `);
        console.error(`\x1b[31m[Python STDERR]:\x1b[0m ${errStr.trim()}`);
      });

      pyProcess.on('close', (code) => {
        const out = outputData.trim();

        logger.info(`[Bridge Debug] ${scriptName} exited with code: ${code}`);
        logger.info(`[Bridge Debug] ${scriptName} full stdout: ${out.slice(0, 50)}`);
        logger.info(`[Bridge Debug] ${scriptName} full stderr: ${errorData.slice(0, 50)}`);

        const extractLastJson = (text) => {
          if (!text) return text;
          const matches = text.match(/\{[\s\S]*\}\s*$/);
          return matches && matches[0] ? matches[0].trim() : text;
        };

        const hasSuccessPipe = out.includes('SUCCESS |');
        const isJsonSuccess = out.includes('"success"') && out.includes('"success": true');

        logger.info(`[Bridge Debug] ${scriptName} hasSuccessPipe=${hasSuccessPipe}, isJsonSuccess=${isJsonSuccess}`);

        if (code === 0 && (hasSuccessPipe || isJsonSuccess)) {
          if (hasSuccessPipe) {
            const lines = out.split(/\r?\n/);
            const successLine = lines.reverse().find((l) => l.includes('SUCCESS |'));
            const result = successLine ? successLine.split('SUCCESS |')[1].trim() : out;

            logger.info(`[Bridge Debug] ${scriptName} resolved SUCCESS payload: ${result} `);
            return resolve(result);
          }

          const extracted = extractLastJson(out);
          logger.info(`[Bridge Debug] ${scriptName} extracted JSON payload: `);
          return resolve(extracted);
        }

        logger.error(
          `[Engine Error] ${scriptName} failed: ${errorData || 'Check Python Console'}` +
            (out ? ` | Output: ${out.slice(0, 200)}` : '')
        );
        reject(new Error(`Stage ${scriptName} failed with code ${code}`));
      });
    });
  }

  static async step1_Media(fileName) {
    logger.info(`[Bridge] Starting Stage 1: Media Check for ${fileName}`);
    const result = await this.runStage('bridge_media.py', [fileName]);
    logger.info(`[Bridge Debug] Stage 1 result: `);
    return result;
  }

  static async step2_Transcription(audioPath) {
    logger.info(`[Bridge] Starting Stage 2: AI Pipeline (Whisper/Pyannote)`);

    const result = await this.runStage('bridge_pipeline.py', [audioPath]);

    logger.info(`[Bridge Debug] Stage 2 raw result type: ${typeof result}`);
    logger.info(`[Bridge Debug] Stage 2 raw result value: ${String(result).slice(0, 80)}`);
    logger.info(`[Bridge Debug] Stage 2 raw result length: ${String(result || '').length}`);

    try {
      if (!result || String(result).trim() === '') {
        throw new Error('Empty Stage 2 result');
      }

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;

      logger.info(`[Bridge Debug] Stage 2 parsed result keys: ${Object.keys(parsed || {}).join(', ')}`);
      return parsed;
    } catch (e) {
      logger.error(`[Bridge Debug] Stage 2 JSON parse failed: ${e.message}`);
      throw e;
    }
  }

  static async step3_Audit(transcriptText) {
    logger.info(`[Bridge] Starting Stage 3: Educational Audit`);
    const result = await this.runStage('bridge_audit.py', [transcriptText]);
    logger.info(`[Bridge Debug] Stage 3 raw result: `);
    return typeof result === 'string' ? JSON.parse(result) : result;
  }

  static async runFullAudioPipeline(fileName) {

    const meetingId = fileName.match(/^REC_(.+?)_Sess/)?.[1];

    logger.info(`[Bridge Debug] fileName=${fileName}`);
    logger.info(`[Bridge Debug] runFullAudioPipeline started for meetingId=${meetingId}`);

    try {
      const wav_audio_path = await this.step1_Media(fileName);
      logger.info(`[Bridge Debug] wav_audio_path=${wav_audio_path}`);

      await MeetingAssetsModel.initializeAssets(meetingId, fileName,  wav_audio_path);

      logger.info(`[Bridge Debug] Saved Stage 1 assets for ${meetingId}`);

      const stage2Result = await this.step2_Transcription(wav_audio_path);
      logger.info(`[Bridge Debug] stage2Result`);

      await MeetingAssetsModel.updateAssets(meetingId, {
        transcript_path: stage2Result.transcript_path || null,
        diarization_path: stage2Result.diarization_path || null,
        talk_ratio_json_path: stage2Result.talk_ratio_path || null,
        status: 'Processing'
      });
      logger.info(`[Bridge Debug] Saved Stage 2 assets for ${meetingId}`);

      const transcriptText = stage2Result.transcript_text || stage2Result.transcript_path || '';
      logger.info(`[Bridge Debug] transcriptText preview=`);

      const auditResult = await this.step3_Audit(transcriptText);
      logger.info(`[Bridge Debug] auditResult=`);

      await MeetingAssetsModel.updateAssets(meetingId, {
        audit_json_path: auditResult.audit_json_path || null,
        oqi_score: auditResult.oqi_score || 0,
        evidence_quote: auditResult.evidence_quote || null,
        status: 'Completed'
      });
      logger.info(`[Bridge Debug] Saved Stage 3 assets for ${meetingId}`);

      return {
        success: true,
        meetingId,
        wav_audio_path,
        stage2Result,
        auditResult
      };
    } catch (error) {
      logger.error(`[Bridge] Roadmap Failed at ${meetingId}: ${error.message}`);
      await MeetingAssetsModel.updateAssets(meetingId, { status: 'Error' });
      throw error;
    }
  }
}

module.exports = PythonBridge;