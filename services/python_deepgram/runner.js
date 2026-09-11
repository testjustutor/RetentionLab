/**
 * services/python_deepgram/runner.js
 *
 * Node -> Python caller for the ISOLATED python_deepgram engine
 * (Deepgram nova-3 API transcription + diarization).
 * Spawns: python -m services.python_deepgram.main <audio_path>
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function resolvePython() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  const venvPy = path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPy)) return venvPy;
  return 'python';
}

/** True when a Deepgram key is configured -> API engine can be used. */
function deepgramAvailable() {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

/**
 * Transcribe local audio via Deepgram API.
 *   {success, segments:[{start,end,text,speaker}], words, diarization,
 *    plain_text, language:'en', backend, teacher_name, student_name,
 *    student_name_confidence, student_name_source, participants_db}
 *
 * meetingId/sessionId: pass these when known so the Python side can save
 * the detected teacher name (from the filename) and student name (from the
 * transcript) into the `participants` table - see
 * services/python_deepgram/participants_repo.py. Omit them and the Python
 * side falls back to auto-deriving both from a REC_<meetingId>_
 * Sess<sessionId>_... filename when the recording follows that convention;
 * otherwise the names still come back in the resolved object, just without
 * a DB write.
 */
function transcribeWithDeepgram(audioPath, { timeoutMs = 30 * 60 * 1000, meetingId = null, sessionId = null } = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'services.python_deepgram.main', path.resolve(audioPath)];
    if (meetingId !== null && meetingId !== undefined) args.push('--meeting-id', String(meetingId));
    if (sessionId !== null && sessionId !== undefined) args.push('--session-id', String(sessionId));

    const proc = spawn(
      resolvePython(),
      args,
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: PROJECT_ROOT },
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;
    if (timeoutMs) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill();
        reject(new Error(`deepgram transcription timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
    }

    proc.stdout.on('data', (d) => {
      const text = d.toString();
      for (const l of text.split(/\r?\n/)) {
        if (!l.trim()) continue;
        // Status/log lines go to terminal; the final JSON line is captured only.
        if (!l.trim().startsWith('{')) console.log(`[python_deepgram] ${l.slice(0, 200)}`);
      }
      stdout += text;
    });
    proc.stderr.on('data', (d) => {
      const text = d.toString();
      stderr += text;
      text.split(/\r?\n/).filter(Boolean).slice(-2).forEach((l) =>
        console.log(`[python_deepgram] ${String(l).slice(0, 200)}`));
    });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const trimmed = stdout.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      let parsed = null;
      if (jsonStart !== -1 && jsonEnd >= jsonStart) {
        try { parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)); } catch (_) {}
      }
      if (parsed && parsed.success) resolve(parsed);
      else if (parsed) reject(new Error(parsed.error || 'Deepgram transcription failed'));
      else reject(new Error(`deepgram failed (exit ${code}): ${(stderr || trimmed).trim().slice(0, 300)}`));
    });
  });
}

module.exports = { transcribeWithDeepgram, deepgramAvailable };
