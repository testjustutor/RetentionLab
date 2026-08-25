/**
 * controllers/super_admin/settings/deepgramProcessingController.js
 *
 * SEPARATE Deepgram processing pipeline (services/python_deepgram).
 * Runs fully in parallel with videoProcessingController - different table
 * (deepgram_processing), different output folder (storage/deepgram_transcripts),
 * different API endpoints. No shared state with the video-processing flow.
 *
 * Flow:
 *   Convert  -> MoviePy MP4 -> MP3
 *   Process  -> Deepgram nova-3 API (diarize, English, Tutor/Student labels)
 *            -> saves .transcript.json / .transcript.txt in storage/deepgram_transcripts
 */
const fs = require('fs');
const path = require('path');
const DeepgramProcessingModel = require('../../../models/super_admin/settings/DeepgramProcessingModel');
const { convertVideoToMp3 } = require('../../../services/python_engine/runner');
const { transcribeWithDeepgram, deepgramAvailable } = require('../../../services/python_deepgram/runner');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const SCREEN_DIR = path.join(ROOT_DIR, 'storage', 'screen-recordings');
const CONVERTED_DIR = path.join(ROOT_DIR, 'storage', 'recordings');
const TRANSCRIPTS_DIR = path.join(ROOT_DIR, 'storage', 'deepgram_transcripts');

function toMp3Name(fileName) {
  return path.basename(fileName).replace(/\.mp4$/i, '.mp3');
}
function transcriptBaseName(mp3Name) {
  return mp3Name.replace(/\.mp3$/i, '');
}

/** File size in bytes, or null when missing/unreadable. */
function fileSizeOrNull(filePath) {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() ? st.size : null;
  } catch (_) {
    return null;
  }
}

/** GET / -> list videos + their Deepgram processing status */
async function getAllVideos(req, res) {
  try {
    await DeepgramProcessingModel.ensureTable();
    const files = fs.existsSync(SCREEN_DIR)
      ? fs.readdirSync(SCREEN_DIR).filter(f => /\.mp4$/i.test(f))
      : [];
    const videos = [];
    for (const fileName of files) {
      const record = await DeepgramProcessingModel.getLatestByFile(fileName).catch(() => null);
      const mp3Name = toMp3Name(fileName);
      const jsonName = `${transcriptBaseName(mp3Name)}.transcript.json`;
      const txtName = `${transcriptBaseName(mp3Name)}.transcript.txt`;
      const jsonPath = path.join(TRANSCRIPTS_DIR, jsonName);
      videos.push({
        fileName,
        videoPath: `/storage/screen-recordings/${encodeURIComponent(fileName)}`,
        videoSizeBytes: fileSizeOrNull(path.join(SCREEN_DIR, fileName)),
        mp3Exists: fs.existsSync(path.join(CONVERTED_DIR, mp3Name)),
        mp3SizeBytes: fileSizeOrNull(path.join(CONVERTED_DIR, mp3Name)),
        status: record ? record.status : (fs.existsSync(jsonPath) ? 'processed' : 'pending'),
        speakers: record ? record.speakers : null,
        turns: record ? record.turns : null,
        durationSec: record ? Number(record.duration_sec) : null,
        error: record ? record.error : null,
        processedAt: record ? record.updated_at : null,
        transcriptJsonUrl: `/storage/deepgram_transcripts/${encodeURIComponent(jsonName)}`,
        transcriptTxtUrl: `/storage/deepgram_transcripts/${encodeURIComponent(txtName)}`,
        transcriptExists: fs.existsSync(jsonPath),
      });
    }
    return res.json({ success: true, data: { engine: 'deepgram', available: deepgramAvailable(), videos } });
  } catch (err) {
    console.error('[DeepgramController] list error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /convert -> MP4 -> MP3 via MoviePy. */
async function convertAudio(req, res) {
  try {
    const fileName = req.body?.fileName || req.body?.videoPath;
    if (!fileName) return res.status(400).json({ success: false, error: 'fileName is required.' });
    const sourcePath = path.join(SCREEN_DIR, path.basename(fileName));
    if (!fs.existsSync(sourcePath)) return res.status(400).json({ success: false, error: 'Video file not found in storage/screen-recordings.' });
    if (!fs.existsSync(CONVERTED_DIR)) fs.mkdirSync(CONVERTED_DIR, { recursive: true });

    const mp3Name = toMp3Name(fileName);
    const targetPath = path.join(CONVERTED_DIR, mp3Name);

    if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 0) {
      await DeepgramProcessingModel.markStatus(fileName, 'converted', { mp3Path: targetPath, mp3Name }).catch(() => {});
      return res.json({ success: true, data: { success: true, alreadyExists: true, mp3Path: targetPath, audioPath: `/storage/recordings/${encodeURIComponent(mp3Name)}` } });
    }

    try {
      const converted = await convertVideoToMp3(sourcePath, targetPath);
      await DeepgramProcessingModel.markStatus(fileName, 'converted', { mp3Path: targetPath, mp3Name, durationSec: converted.duration || null }).catch(() => {});
      return res.json({ success: true, data: { success: true, alreadyExists: false, mp3Path: targetPath, duration: converted.duration || null, audioPath: `/storage/recordings/${encodeURIComponent(mp3Name)}` } });
    } catch (convErr) {
      await DeepgramProcessingModel.markStatus(fileName, 'failed', { error: convErr.message }).catch(() => {});
      return res.json({ success: false, data: { success: false, error: convErr.message } });
    }
  } catch (err) {
    console.error('[DeepgramController] convert error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /process -> Deepgram API transcription + diarization, files saved. */
async function processAudio(req, res) {
  try {
    const audioInput = req.body?.audioPath || req.body?.filePath || req.body?.fileName;
    if (!audioInput) return res.status(400).json({ success: false, error: 'audioPath or fileName is required.' });

    // Accept a bare mp3 name or the original video name.
    let mp3Name = path.basename(String(audioInput));
    if (!/\.mp3$/i.test(mp3Name)) mp3Name = toMp3Name(mp3Name);
    const sourceMp3 = path.join(CONVERTED_DIR, mp3Name);
    if (!fs.existsSync(sourceMp3)) {
      return res.status(400).json({ success: false, error: 'Converted MP3 not found. Click Convert first.' });
    }

    await DeepgramProcessingModel.ensureTable();
    await DeepgramProcessingModel.saveRecord({ fileName: mp3Name, mp3Name, mp3Path: sourceMp3, status: 'processing' });

    if (!deepgramAvailable()) {
      await DeepgramProcessingModel.markStatus(mp3Name, 'failed', { error: 'DEEPGRAM_API_KEY is not configured.' });
      return res.json({ success: false, data: { success: false, error: 'DEEPGRAM_API_KEY is not configured.' } });
    }

    console.log(`[DeepgramController] processing ${mp3Name} via Deepgram API...`);
    const result = await transcribeWithDeepgram(sourceMp3);

    if (!result || result.success === false) {
      const errMsg = (result && result.error) || 'Deepgram returned an error.';
      await DeepgramProcessingModel.markStatus(mp3Name, 'failed', { error: errMsg });
      return res.json({ success: false, data: { success: false, error: errMsg } });
    }

    // Save transcript artifacts (separate folder from python_engine outputs).
    if (!fs.existsSync(TRANSCRIPTS_DIR)) fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
    const base = transcriptBaseName(mp3Name);
    const jsonName = `${base}.transcript.json`;
    const txtName = `${base}.transcript.txt`;
    fs.writeFileSync(path.join(TRANSCRIPTS_DIR, jsonName), JSON.stringify(result, null, 2), 'utf-8');

    const fmt = t => new Date((t || 0) * 1000).toISOString().substring(11, 19);
    const lines = result.segments.map(s => `[${fmt(s.start)} - ${fmt(s.end)}] ${s.speaker}: ${s.text}`);
    const header = [
      '# Deepgram transcript',
      `# Audio     : ${mp3Name}`,
      `# Language  : ${result.language || 'en'}`,
      `# Engine    : ${result.backend || 'deepgram-nova-3'}`,
      `# Turns     : ${result.segments.length}`,
      '#',
      ...lines,
    ];
    fs.writeFileSync(path.join(TRANSCRIPTS_DIR, txtName), header.join('\n') + '\n', 'utf-8');

    const speakers = [...new Set(result.segments.map(s => s.speaker))];
    await DeepgramProcessingModel.markStatus(mp3Name, 'processed', {
      durationSec: result.duration || null,
      speakers: speakers.length,
      tutorLabel: speakers.includes('Tutor') ? 'Tutor' : (speakers[0] || null),
      studentLabel: speakers.includes('Student') ? 'Student' : (speakers[1] || null),
      turns: result.segments.length,
      transcriptJson: `/storage/deepgram_transcripts/${jsonName}`,
      transcriptTxt: `/storage/deepgram_transcripts/${txtName}`,
    });

    return res.json({
      success: true,
      data: {
        success: true,
        mp3Path: sourceMp3,
        segments: result.segments.length,
        speakers,
        duration: result.duration || null,
        transcriptJsonUrl: `/storage/deepgram_transcripts/${encodeURIComponent(jsonName)}`,
        transcriptTxtUrl: `/storage/deepgram_transcripts/${encodeURIComponent(txtName)}`,
      },
    });
  } catch (err) {
    console.error('[DeepgramController] process error:', err);
    try {
      const f = req.body?.fileName || req.body?.audioPath || req.body?.filePath;
      if (f) await DeepgramProcessingModel.markStatus(path.basename(String(f)).replace(/\.mp4$/i, '.mp3'), 'failed', { error: err.message });
    } catch (_) {}
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /history -> processing history rows. */
async function getHistory(req, res) {
  try {
    const rows = await DeepgramProcessingModel.getHistory(Number(req.query.limit) || 100);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getAllVideos, convertAudio, processAudio, getHistory };

