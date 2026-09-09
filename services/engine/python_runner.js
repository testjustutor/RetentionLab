/**
 * services/engine/python_runner.js
 *
 * NOTE: this used to also export runPythonEngine(), which spawned the
 * standalone `python -m services.engine.python_main` engine (pipeline.py)
 * for the video-processing "Process" action. That action now calls
 * PythonBridge.runFullAudioPipeline() (services/shared/pythonBridge.js)
 * instead, converging onto the same engine_main.py pipeline the meeting bot
 * uses - so runPythonEngine/python_main.py/pipeline.py are no longer used
 * and were removed. This module still provides convertVideoToMp3(), which
 * the video-processing "Convert" action still uses for video -> mp3.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ENGINE_DIR = __dirname;                 // services/engine
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
 * Convert a video file to MP3 using MoviePy inside python_engine.
 * Spawns: python -m services.engine.video_convert <video> <mp3>
 */
function convertVideoToMp3(videoPath, mp3Path, { timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', 'services.engine.video_convert',
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

module.exports = { convertVideoToMp3, resolveAudioPath, resolvePython };