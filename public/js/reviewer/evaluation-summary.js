/**
 * public/js/reviewer/evaluation-summary.js
 */

// ── Element refs ────────────────────────────────────────────────────────────
const evalSummaryForm = document.getElementById('evalSummaryForm');
const sessionSelect = document.getElementById('sessionSelect');
const sessionIdInput = document.getElementById('sessionId');
const reviewerIdInput = document.getElementById('reviewerId');
const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
const rubricContainerEl = document.getElementById('rubricContainer');
const saveStatusEl = document.getElementById('saveStatus');

const refreshSummaryBtn = document.getElementById('refreshSummary');
const lookupStatusEl = document.getElementById('lookupStatus');
const summaryResultEl = document.getElementById('summaryResult');
const summaryTableBodyEl = document.getElementById('summaryTableBody');

// State
let rubricCache = null;

// ── Helpers ─────────────────────────────────────────────────────────────────
const apiPost = async (path, body) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  return res.json();
};

const apiGet = async (path) => {
  const res = await fetch(path, { credentials: 'include' });
  return res.json();
};

const num = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

const dec = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const setSaveStatus = (message, ok = true) => {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message;
  saveStatusEl.className = ok ? 'text-sm text-emerald-400' : 'text-sm text-amber-500';
};

const setLookupStatus = (message, ok = true) => {
  if (!lookupStatusEl) return;
  lookupStatusEl.textContent = message;
  lookupStatusEl.className = ok ? 'text-sm text-emerald-400' : 'text-sm text-amber-500';
};

const escapeHtml = (s) => {
  if (s === null || s === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
};

const fmtPct = (value) => `${Number(value || 0).toFixed(2)}%`;

// ── Session + rubric loading ────────────────────────────────────────────────
async function loadSessions(preselectSessionId) {
  try {
    const data = await apiGet('/api/reviewer/evaluations/sessions');
    const sessions = (data && data.sessions) || [];
    rubricCache = null;

    sessionSelect.innerHTML = '<option value="">— Choose a session —</option>';
    sessions.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.session_id;
      opt.dataset.meetingId = s.meeting_id;
      const title = s.meeting_title ? `${s.meeting_title} (${s.session_status || 'session'})` : `Session #${s.session_id}`;
      opt.textContent = `#${s.session_id} · ${title}`;
      sessionSelect.appendChild(opt);
    });

    const params = new URLSearchParams(window.location.search);
    let target = preselectSessionId || params.get('session_id');
    if (!target && params.get('meeting_id')) {
      const wanted = params.get('meeting_id');
      const match = sessions.find((s) => String(s.meeting_id) === String(wanted));
      if (match) target = match.session_id;
    }
    if (target) {
      const match = sessions.find((s) => String(s.session_id) === String(target));
      if (match) {
        sessionSelect.value = match.session_id;
        await selectSession();
      }
    }

    // Lock Session / Session ID / Reviewer ID when deep-linked from the review queue
    const locked = !!(params.get('session_id') || params.get('meeting_id'));
    [sessionSelect, sessionIdInput, reviewerIdInput].forEach((el) => {
      if (!el) return;
      el.disabled = locked;
      el.classList.toggle('opacity-60', locked);
      el.classList.toggle('cursor-not-allowed', locked);
    });
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

async function loadRubric() {
  if (rubricCache) return rubricCache;
  const result = await apiGet('/api/reviewer/evaluations/rubric');
  rubricCache = (result && result.categories) || [];
  return rubricCache;
}

async function selectSession() {
  const sid = sessionSelect.value;
  const sessionTextEl = document.getElementById('sessionText');
  const sessionIdTextEl = document.getElementById('sessionIdText');
  if (!sid) {
    rubricContainerEl.innerHTML = '<div class="rounded-lg border border-dashed border-slate-700/70 bg-slate-900/40 px-4 py-8 text-center text-slate-500 text-xs">Choose a session above to load the rubric.</div>';
    sessionIdInput.value = '';
    if (sessionTextEl) sessionTextEl.textContent = '—';
    if (sessionIdTextEl) sessionIdTextEl.textContent = '—';
    return;
  }
  sessionIdInput.value = sid;
  if (sessionTextEl) sessionTextEl.textContent = sessionSelect.selectedOptions[0]?.textContent || `#${sid}`;
  if (sessionIdTextEl) sessionIdTextEl.textContent = sid;

  try {
    const categories = await loadRubric();
    const data = await apiGet(`/api/reviewer/evaluations/summary/${encodeURIComponent(sid)}?flow=submit`);
    const existing = data && data.summary ? data : null;
    renderScorer(categories, existing);
    const lookupSession = document.getElementById('lookupSessionId');
    if (lookupSession) lookupSession.value = sid;
    // Auto-show the stored summary when one exists; hide stale results otherwise.
    if (existing && existing.summary) await lookupSummary();
    else if (summaryResultEl) summaryResultEl.classList.add('hidden');
    if (existing && existing.summary) {
      setSaveStatus('A summary already exists for this session + flow — scores are pre-filled; save to overwrite.', true);
    } else {
      setSaveStatus('', true);
    }
  } catch (err) {
    console.error('selectSession error:', err);
    rubricContainerEl.innerHTML = '<div class="text-xs text-red-400">Failed to load rubric/summary.</div>';
  }
}

function renderScorer(categories, existing) {
  const existingCats = (existing && existing.categories) || [];
  const byId = {};
  existingCats.forEach((c) => { if (c.category_id) byId[c.category_id] = c; });

  rubricContainerEl.innerHTML = '';
  categories.forEach((cat) => {
    rubricContainerEl.appendChild(buildCategoryCard(cat, byId[cat.id] || null));
  });
  if (!categories.length) {
    rubricContainerEl.innerHTML = '<div class="text-xs text-slate-500">No active rubric categories found.</div>';
  }
}
function buildCategoryCard(cat, existingCat) {
  const card = document.createElement('div');
  card.className = 'category-card rounded-lg border border-slate-800/70 overflow-hidden';
  card.dataset.categoryId = cat.id || '';
  card.dataset.code = cat.category_code || '';
  card.dataset.name = cat.name || '';

  const header = document.createElement('div');
  header.className = 'px-3 py-2 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center gap-3';
  header.innerHTML = `
    <span class="text-xs font-semibold text-slate-200">${escapeHtml(cat.name || '')}</span>
    <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">${escapeHtml(cat.category_code || '')}</span>
    <span class="text-[10px] text-slate-600">${cat.id ? `#${cat.id}` : ''}</span>
    <div class="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
      <label class="flex flex-col gap-0.5 items-center text-slate-500" title="Snapshot only — not used in scoring">Weight
        <input type="number" step="0.01" min="0" class="weightInput input-field w-16 text-center opacity-60 cursor-not-allowed" value="${dec(cat.weight).toFixed(2)}" disabled>
      </label>
      <label class="flex flex-col gap-0.5 items-center text-emerald-500" title="Auto-calculated from the criterion marks below">Met
        <input type="number" min="0" class="count-met input-field w-16 text-center opacity-60 cursor-not-allowed" value="0" disabled>
      </label>
      <label class="flex flex-col gap-0.5 items-center text-amber-500" title="Auto-calculated from the criterion marks below">Not Met
        <input type="number" min="0" class="count-not-met input-field w-16 text-center opacity-60 cursor-not-allowed" value="0" disabled>
      </label>
      <label class="flex flex-col gap-0.5 items-center text-slate-500" title="Auto-calculated from the criterion marks below">N/A
        <input type="number" min="0" class="count-na input-field w-16 text-center opacity-60 cursor-not-allowed" value="0" disabled>
      </label>
      <span class="score-preview text-xs font-semibold text-emerald-400 px-2 py-1.5 rounded bg-emerald-900/20 border border-emerald-700/40">—</span>
    </div>
  `;
  card.appendChild(header);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'overflow-x-auto';
  const table = document.createElement('table');
  table.className = 'w-full';
  table.innerHTML = `
    <thead>
      <tr class="border-b border-slate-800/60 bg-slate-950/30">
        <th class="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">Criterion</th>
        <th class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-emerald-500">Met</th>
        <th class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-amber-500">Not Met</th>
        <th class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">N/A</th>
        <th class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500">Description</th>
      </tr>
    </thead>
    <tbody>
      ${(cat.indicators || []).map((ind) => {
        const name = `crit-${cat.id}-${ind.id}`;
        return `
        <tr class="border-b border-slate-800/40">
          <td class="px-3 py-1.5 text-xs text-slate-300">
            ${escapeHtml(ind.indicator_code || '')} · ${escapeHtml(ind.name || '')}
            ${ind.is_gate ? '<span class="ml-1 text-[9px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-300">GATE</span>' : ''}
          </td>
          <td class="px-3 py-1.5 text-center"><input type="radio" name="${name}" class="crit" data-status="1" data-cat="${cat.id}"></td>
          <td class="px-3 py-1.5 text-center"><input type="radio" name="${name}" class="crit" data-status="2" data-cat="${cat.id}"></td>
          <td class="px-3 py-1.5 text-center"><input type="radio" name="${name}" class="crit" data-status="3" data-cat="${cat.id}"></td>
          <td class="px-3 py-1.5"><input type="text" name="${name}-desc" class="crit-desc input-field w-full text-xs" placeholder="Required for Not Met / N/A" disabled></td>
        </tr>`;
      }).join('')}
    </tbody>
  `;
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  // Restore saved counts (criterion-level marks aren't persisted, only counts)
  if (existingCat) {
    card.querySelector('.count-met').value = existingCat.count_met || 0;
    card.querySelector('.count-not-met').value = existingCat.count_not_met || 0;
    card.querySelector('.count-na').value = existingCat.count_not_applicable || 0;
    if (existingCat.weight != null) card.querySelector('.weightInput').value = Number(existingCat.weight).toFixed(2);
  }

  const recompute = () => updateCategory(card);

  // Description box rules: disabled by default / on "Met";
  // enabled + mandatory on "Not Met" or "N/A".
  const syncDescState = (row) => {
    const checked = row.querySelector('input.crit:checked');
    const desc = row.querySelector('.crit-desc');
    if (!desc) return;
    if (checked && checked.dataset.status !== '1') {
      desc.disabled = false;
      desc.required = true;
      desc.classList.remove('opacity-60', 'cursor-not-allowed');
    } else {
      desc.disabled = true;
      desc.required = false;
      desc.value = '';
      desc.classList.add('opacity-60', 'cursor-not-allowed');
    }
  };

  card.querySelectorAll('input').forEach((el) => el.addEventListener('input', recompute));
  card.querySelectorAll('input[type="radio"]').forEach((el) => el.addEventListener('change', () => {
    const row = el.closest('tr');
    if (row) syncDescState(row);
    recompute();
  }));
  card.querySelectorAll('tbody tr').forEach((row) => { if (row.querySelector('input.crit')) syncDescState(row); });
  recompute();
  return card;
}
function updateCategory(card) {
  // Radios drive the counts; manual count edits remain usable for fine-tuning.
  const counts = { 1: 0, 2: 0, 3: 0 };
  card.querySelectorAll('input.crit:checked').forEach((el) => { counts[el.dataset.status] = counts[el.dataset.status] + 1; });
  if (counts[1] || counts[2] || counts[3]) {
    card.querySelector('.count-met').value = counts[1];
    card.querySelector('.count-not-met').value = counts[2];
    card.querySelector('.count-na').value = counts[3];
  }

  const met = num(card.querySelector('.count-met').value);
  const notMet = num(card.querySelector('.count-not-met').value);
  const na = num(card.querySelector('.count-na').value);
  const total = met + notMet + na;
  let pct = 0;
  if (total > 0 && na === total) pct = 100;
  else { const denom = total - notMet; if (denom > 0) pct = (met / denom) * 100; }
  card.querySelector('.score-preview').textContent = `${pct.toFixed(2)}%`;
}

function collectCategories() {
  const cats = [];
  document.querySelectorAll('.category-card').forEach((card) => {
    const met = num(card.querySelector('.count-met').value);
    const notMet = num(card.querySelector('.count-not-met').value);
    const na = num(card.querySelector('.count-na').value);
    const total = met + notMet + na;
    if (total === 0) return;
    cats.push({
      category_id: card.dataset.categoryId ? parseInt(card.dataset.categoryId, 10) : null,
      category_code: card.dataset.code,
      category_name: card.dataset.name,
      weight: dec(card.querySelector('.weightInput').value),
      total_criteria: total,
      count_met: met,
      count_not_met: notMet,
      count_not_applicable: na
    });
  });
  return cats;
}
function renderSummary(summary, categories) {
  if (!summaryResultEl || !summaryTableBodyEl) return;

  document.getElementById('displayFinalScore').textContent = fmtPct(summary.final_score_pct);
  document.getElementById('displayTotalCriteria').textContent = summary.total_criteria_all ?? 0;
  document.getElementById('displayFlow').textContent = summary.flow || 'submit';
  document.getElementById('displayRedFlag').textContent = summary.red_flag ? 'Yes' : 'No';
  document.getElementById('displaySavedAt').textContent = summary.updated_at
    ? new Date(summary.updated_at).toLocaleString()
    : '—';

  const rows = categories || [];
  if (rows.length === 0) {
    summaryTableBodyEl.innerHTML = `
      <tr>
        <td colspan="8" class="px-3 py-8 text-center text-slate-500 text-xs">
          No category rows stored for this summary.
        </td>
      </tr>`;
  } else {
    summaryTableBodyEl.innerHTML = rows.map((cat) => `
      <tr class="border-b border-indigo-200 hover:bg-indigo-50 transition-colors">
        <td class="px-3 py-2 text-xs font-bold text-slate-900">${cat.category_name || '—'}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${cat.category_code || '—'}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${Number(cat.weight || 0).toFixed(2)}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${cat.total_criteria ?? 0}</td>
        <td class="px-3 py-2 text-xs font-bold text-slate-900">${cat.count_met ?? 0}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${cat.count_not_met ?? 0}</td>
        <td class="px-3 py-2 text-xs font-semibold text-slate-700">${cat.count_not_applicable ?? 0}</td>
        <td class="px-3 py-2 text-right text-xs font-bold text-indigo-700">${fmtPct(cat.category_score_pct)}</td>
      </tr>
    `).join('');
  }

  summaryResultEl.classList.remove('hidden');
}

async function lookupSummary() {
  if (!lookupStatusEl) return;

  // Filters removed: the lookup always follows the session selected in the scorer above.
  const lookupSessionId = (sessionSelect && sessionSelect.value) || document.getElementById('lookupSessionId')?.value?.trim();
  if (!lookupSessionId) {
    setLookupStatus('Select a session above to view its stored summary.', false);
    if (summaryResultEl) summaryResultEl.classList.add('hidden');
    return;
  }

  setLookupStatus('Loading...', true);
  try {
    const result = await apiGet(`/api/reviewer/evaluations/summary/${encodeURIComponent(lookupSessionId)}`);

    if (result && result.success === false) {
      setLookupStatus(result.error || 'Failed to load summary.', false);
      if (summaryResultEl) summaryResultEl.classList.add('hidden');
      return;
    }
    if (result && result.summary) {
      renderSummary(result.summary, result.categories || []);
      setLookupStatus('', true);
    } else {
      setLookupStatus('No summary found for this session.', false);
      if (summaryResultEl) summaryResultEl.classList.add('hidden');
    }
  } catch (err) {
    setLookupStatus('Unable to fetch summary. Please try again.', false);
    console.error(err);
    if (summaryResultEl) summaryResultEl.classList.add('hidden');
  }
}

// ── Wiring ──────────────────────────────────────────────────────────────────
if (sessionSelect) {
  sessionSelect.addEventListener('change', selectSession);
}

if (refreshSessionsBtn) {
  refreshSessionsBtn.addEventListener('click', () => loadSessions(sessionSelect.value || undefined));
}

// Flow select was removed from the save form — summaries always save as 'submit'.
const flowSelect = null;

if (evalSummaryForm) {
  evalSummaryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sessionIdVal = sessionIdInput.value;
    const categories = collectCategories();
    if (!sessionIdVal || categories.length === 0) {
      setSaveStatus('Choose a session and score at least one category.', false);
      return;
    }

    // Description is mandatory for every criterion marked Not Met / N/A
    let missingDesc = 0;
    let firstMissing = null;
    document.querySelectorAll('.category-card tbody tr').forEach((tr) => {
      const desc = tr.querySelector('.crit-desc');
      if (!desc) return;
      if (!desc.disabled && !desc.value.trim()) {
        missingDesc += 1;
        desc.classList.add('border-rose-500');
        if (!firstMissing) firstMissing = desc;
      } else {
        desc.classList.remove('border-rose-500');
      }
    });
    if (missingDesc > 0) {
      setSaveStatus(`Description is required for ${missingDesc} criterion${missingDesc === 1 ? '' : 's'} marked Not Met / N/A.`, false);
      if (firstMissing) firstMissing.focus();
      return;
    }

    const reviewerId = document.getElementById('reviewerId')?.value?.trim();
    const flow = flowSelect ? flowSelect.value : 'submit';
    const redFlag = document.getElementById('redFlag')?.checked;
    const meetingId = sessionSelect.selectedOptions[0]?.dataset.meetingId || null;

    setSaveStatus('Saving...', true);
    try {
      const response = await apiPost('/api/reviewer/evaluations/summary', {
        session_id: parseInt(sessionIdVal, 10),
        reviewer_id: reviewerId ? parseInt(reviewerId, 10) : null,
        meeting_id: meetingId ? parseInt(meetingId, 10) : null,
        flow,
        red_flag: redFlag ? 1 : 0,
        categories
      });

      if (response && response.success) {
        setSaveStatus(
          response.review_completed ? 'Saved — review marked complete!' : 'Summary saved successfully!',
          true
        );
        await lookupSummary();
      } else {
        setSaveStatus(response.error || 'Unable to save summary.', false);
      }
    } catch (err) {
      setSaveStatus('Save failed. Check console for details.', false);
      console.error(err);
    }
  });
}

if (refreshSummaryBtn) {
  refreshSummaryBtn.addEventListener('click', lookupSummary);
}

// Init
document.addEventListener('DOMContentLoaded', () => loadSessions());