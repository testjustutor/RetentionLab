/**
 * services/assemblyai_engine/runner.js
 * Node->Python bridge for the isolated AssemblyAI engine.
 */
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function resolvePython() {
  if (process.env.PYTHON_EXECUTABLE) return process.env.PYTHON_EXECUTABLE;
  return 'python';
}

function runAssemblyAIEngine(audioPath, opts = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const optsJson = JSON.stringify(opts || {});
    const args = ['-u', '-m', 'services.assemblyai_engine.main', audioPath, optsJson];

    let stdout = '', stderr = '', settled = false, timer = null;
    const proc = spawn(resolvePython(), args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONPATH: PROJECT_ROOT },
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { proc.kill('SIGKILL'); } catch (e) {}
        reject(new Error(`assemblyai_engine timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => { if (!settled) { settled = true; if (timer) clearTimeout(timer); reject(err); } });
    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const trimmed = stdout.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        reject(new Error(`assemblyai_engine failed (exit ${code}): ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)));
      } catch (err) {
        reject(new Error(`assemblyai_engine returned invalid JSON: ${trimmed.slice(0, 300)}`));
      }
    });
  });
}

module.exports = { runAssemblyAIEngine };