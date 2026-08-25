/**
 * public/js/super_admin/settings/deepgram-processing.js
 *
 * SEPARATE Deepgram pipeline page (parallel to video-processing).
 * API base: /api/super_admin/settings/deepgram-processing
 */
const API_BASE = '/api/super_admin/settings/deepgram-processing';

document.addEventListener('DOMContentLoaded', () => {
  loadVideos();
  document.getElementById('transcriptClose').addEventListener('click', closeTranscriptModal);
  document.getElementById('transcriptModal').addEventListener('click', e => {
    if (e.target.id === 'transcriptModal') closeTranscriptModal();
  });
});

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!res.ok && !(body && body.success === false)) {
    throw new Error(`Request failed (${res.status})`);
  }
  return body;
}

async function loadVideos() {
  const tbody = document.getElementById('videosBody');
  try {
    const json = await apiFetch(`${API_BASE}/`);
    const data = json.data || {};
    renderEngineStatus(data.available === true);
    const videos = data.videos || [];
    if (!videos.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No videos found in storage/screen-recordings.</td></tr>';
      return;
    }
    tbody.innerHTML = videos.map((v, i) => rowHtml(v, i + 1)).join('');
    bindButtons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-cell">Failed to load: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderEngineStatus(available) {
  const el = document.getElementById('engineStatus');
  el.textContent = available ? 'Deepgram API: connected' : 'Deepgram API: key missing';
  el.className = available
    ? 'inline-block text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded border-2 border-emerald-300 bg-emerald-50 text-emerald-700'
    : 'inline-block text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded border-2 border-red-300 bg-red-50 text-red-700';
}

function statusBadge(status) {
  const map = {
    processed: ['bg-violet-50 text-violet-700 border-violet-300', 'Processed'],
    converted: ['bg-cyan-50 text-cyan-700 border-cyan-300', 'Converted'],
    processing: ['bg-amber-50 text-amber-700 border-amber-300', 'Processing...'],
    pending: ['bg-slate-100 text-slate-500 border-slate-300', 'Pending'],
    failed: ['bg-red-50 text-red-700 border-red-300', 'Failed'],
  };
  const [cls, label] = map[status] || map.pending;
  return `<span class="inline-block px-1.5 py-0.5 rounded border ${cls} font-semibold">${label}</span>`;
}

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '-';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function rowHtml(v, idx) {
  const safeName = escapeHtml(v.fileName);
  return `
  <tr>
    <td>${idx}</td>
    <td class="file-cell" title="${safeName}">${safeName}</td>
    <td>${statusBadge(v.status)}${v.error ? `<div class="err-line" title="${escapeHtml(v.error)}">${escapeHtml(v.error.slice(0, 60))}</div>` : ''}</td>
    <td>${v.speakers ?? '-'}</td>
    <td>${v.turns ?? '-'}</td>
    <td>${fmtDuration(v.durationSec)}</td>
    <td style="text-align:right; white-space:nowrap;">
      <button class="act-convert px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold" data-file="${safeName}" ${v.mp3Exists ? 'disabled title="Already converted"' : ''}>Convert</button>
      <button class="act-process px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold" data-file="${safeName}" ${v.mp3Exists ? '' : 'disabled title="Convert first"'}>Process</button>
      <button class="act-transcript px-2 py-1 rounded bg-violet-600 hover:bg-violet-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold" data-url="${v.transcriptJsonUrl}" data-txt="${v.transcriptTxtUrl}" data-name="${safeName}" ${v.transcriptExists ? '' : 'disabled title="No transcript yet"'}>Transcript</button>
    </td>
  </tr>`;
}

function bindButtons() {
  document.querySelectorAll('.act-convert').forEach(b =>
    b.addEventListener('click', () => doConvert(b.dataset.file, b)));
  document.querySelectorAll('.act-process').forEach(b =>
    b.addEventListener('click', () => doProcess(b.dataset.file, b)));
  document.querySelectorAll('.act-transcript').forEach(b =>
    b.addEventListener('click', () => openTranscriptModal(b.dataset.url, b.dataset.txt, b.dataset.name)));
}

function setBusy(btn, busy, busyLabel) {
  if (!btn) return;
  if (busy) { btn.dataset.orig = btn.textContent; btn.textContent = busyLabel || 'Working...'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.orig || btn.textContent; btn.disabled = false; }
}

async function doConvert(fileName, btn) {
  setBusy(btn, true, 'Converting...');
  try {
    const json = await apiFetch(`${API_BASE}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (!json.success) throw new Error(json.data?.error || 'Conversion failed.');
    loadVideos();
  } catch (err) {
    alert('Convert error: ' + err.message);
    setBusy(btn, false);
  }
}

async function doProcess(fileName, btn) {
  setBusy(btn, true, 'Processing...');
  try {
    const json = await apiFetch(`${API_BASE}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (!json.success) throw new Error(json.data?.error || 'Processing failed.');
    const d = json.data;
    alert(`Deepgram done!\nSpeakers: ${(d.speakers || []).join(', ')}\nTurns: ${d.segments}\nDuration: ${fmtDuration(d.duration)}`);
    loadVideos();
  } catch (err) {
    alert('Process error: ' + err.message);
    setBusy(btn, false);
  }
}

async function openTranscriptModal(jsonUrl, txtUrl, name) {
  const modal = document.getElementById('transcriptModal');
  const content = document.getElementById('transcriptContent');
  document.getElementById('transcriptTitle').textContent = name;
  content.textContent = 'Loading...';
  modal.style.display = 'flex';
  try {
    // Prefer the pretty .txt; fall back to rendering the JSON turns.
    const res = await fetch(txtUrl);
    if (res.ok) { content.textContent = await res.text(); return; }
    const res2 = await fetch(jsonUrl);
    const data = await res2.json();
    const segs = (data.segments || []).map(s => {
      const f = t => new Date((t || 0) * 1000).toISOString().substring(11, 19);
      return `[${f(s.start)} - ${f(s.end)}] ${s.speaker}: ${s.text}`;
    });
    content.textContent = segs.join('\n') || '(empty transcript)';
  } catch (err) {
    content.textContent = 'Failed to load transcript: ' + err.message;
  }
}

function closeTranscriptModal() {
  document.getElementById('transcriptModal').style.display = 'none';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


