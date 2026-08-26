/**
 * services/python_engine/runner.js
 *
 * Node->Python caller for the ISOLATED python_engine (Whisper + Resemblyzer).
 *
 * This runner is the ONLY bridge the controller uses for the video-processing
 * "Process" action. It lives inside this folder (no dependency on
 * services/shared/pythonBridge or services/engine). It spawns:
 *
 *     python -m services.python_engine.main <audio_path> [ai_settings_json]
 *
 * and returns the parsed JSON payload.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENGINE_DIR = __dirname;                 // services/python_engine
const PROJECT_ROOT = path.join(__dirname, '..', '..');

/** Resolve the Python executable: prefer the project venv, else system python. */
function resolvePython() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  const venvPy = path.join(PROJECT_ROOT, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPy)) return venvPy;
  return 'python';
}

/** Resolve a possibly '/storage/...' web path or bare file name to disk. */
function resolveAudioPath(input) {
  const leaf = path.basename(String(input).replace(/\\/g, '/'));
  const candidates = [
    path.join(PROJECT_ROOT, 'storage', 'recordings', leaf),
    path.join(PROJECT_ROOT, 'storage', 'screen-recordings', leaf),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return candidates[0];
}

/**
 * Run the isolated python_engine on an audio file.
 * @param {string} audioInput - absolute path, /storage/... link, or file name
 * @param {object} [opts] - { aiSettings, model }
 * @param {number} [timeoutMs] - hard timeout (default 0 = none)
 * @returns {Promise<object>} parsed JSON result from python_engine
 */
function runPythonEngine(audioInput, opts = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const audioPath = resolveAudioPath(audioInput);
    const py = resolvePython();
    const aiSettings = typeof opts.aiSettings === 'string'
      ? opts.aiSettings
      : JSON.stringify(opts.aiSettings || {});

    const args = ['-u', '-m', 'services.python_engine.main', audioPath, aiSettings];
    if (opts.model) args.push('--model', String(opts.model));

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;

    const proc = spawn(py, args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: PROJECT_ROOT,
      },
    });

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
        reject(new Error(`python_engine timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    let lastLine = '';       // last echoed line (dedupe identical consecutive)
    let lastProgress = '';   // last PROGRESS pct+stage (skip no-change repeats)
    let lineBuf = '';        // partial-line buffer across data chunks

    /** Classify + print ONE complete line as PLAIN TEXT (never large data,
     *  never an in-place bar - every progress update is its own line). */
    const handleLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      // Progress marker: PROGRESS <pct> <stage...> -> print as a simple line.
      const pm = line.match(/^PROGRESS\s+(\d{1,3})\s+(.+)$/);
      if (pm) {
        const key = `${pm[1]}|${pm[2]}`;
        if (key !== lastProgress) {
          console.log(`[python_engine] ${line}`);
          lastProgress = key;
          lastLine = '';
        }
        return;
      }
      // Never echo large JSON payloads (final result, arrays, etc.)
      // NOTE: text log lines like "[STEP] ..." also start with "[" - only
      // suppress when it's actually a JSON array/object payload.
      const isJsonPayload = line.startsWith('{') || /^\[\s*[{\"]/.test(line);
      if (isJsonPayload) return;

      // Keep normal log lines short (truncate anything huge)
      const shown = line.length > 200 ? line.slice(0, 200) + '…' : line;
      if (shown !== lastLine) {
        console.log(`[python_engine] ${shown}`);
        lastLine = `[python_engine] ${shown}`;
      }
    };

    proc.stdout.on('data', (d) => {
      const text = d.toString();
      stdout += text;
      // Buffer partial lines: a single huge JSON line (e.g. the final result)
      // can arrive split across several OS pipe chunks. Without buffering,
      // its middle chunks don't start with '{' and would leak to the terminal
      // as large data dumps. Splitting only on COMPLETE lines prevents that.
      lineBuf += text;
      const lines = lineBuf.split(/\r?\n/);
      lineBuf = lines.pop(); // keep the trailing (possibly incomplete) piece
      lines.forEach(handleLine);
    });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
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

      // The engine writes log lines AND the final result to stdout. Log lines
      // may contain braces (e.g. "speakers=[{'speaker': ...}]"), so the old
      // first-'{'..last-'}' slice broke. The result is always printed as ONE
      // complete single-line JSON object LAST - scan lines from the END and
      // take the first line that parses as a JSON object.
      const outLines = stdout.trim().split(/\r?\n/);
      for (let i = outLines.length - 1; i >= 0; i--) {
        const candidate = outLines[i].trim();
        if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;
        try {
          const parsed = JSON.parse(candidate);
          resolve(parsed);
          return;
        } catch (_) { /* a log line with braces - keep scanning backwards */ }
      }

      if (code !== 0) {
        reject(new Error(`python_engine failed (exit ${code}): ${stderr.trim().slice(0, 500)}`));
        return;
      }
      reject(new Error(
        `python_engine returned no valid JSON result (exit ${code}). stderr: ${stderr.trim().slice(0, 300)}`
      ));
    });
  });
}

/**
 * Convert a video file to MP3 using MoviePy inside python_engine.
 * Spawns: python -m services.python_engine.video_convert <video> <mp3>
 */
function convertVideoToMp3(videoPath, mp3Path, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', 'services.python_engine.video_convert',
      path.resolve(videoPath),
      path.resolve(mp3Path),
    ];
    const proc = spawn(resolvePython(), args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONPATH: PROJECT_ROOT },
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;
    if (timeoutMs) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        proc.kill();
        reject(new Error(`video_convert timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
    }

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      // Surface progress lines in the Node terminal without large dumps.
      d.toString().split(/\r?\n/).filter(Boolean).slice(-3).forEach((l) => {
        console.log(`[python_engine] ${String(l).slice(0, 200)}`);
      });
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
      if (parsed && parsed.success) {
        resolve(parsed);
      } else if (parsed) {
        reject(new Error(parsed.error || 'MoviePy conversion failed'));
      } else {
        reject(new Error(`video_convert failed (exit ${code}): ${(stderr || trimmed).trim().slice(0, 300)}`));
      }
    });
  });
}

module.exports = { runPythonEngine, convertVideoToMp3, resolveAudioPath, resolvePython };