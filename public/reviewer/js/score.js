/**
 * public/reviewer/js/score.js
 */

const saveStatusEl = document.getElementById('saveStatus');
const scoreForm = document.getElementById('scoreForm');
const lookupForm = document.getElementById('lookupForm');
const refreshScoresButton = document.getElementById('refreshScores');
const scoresResultEl = document.getElementById('scoresResult');
const loaderEl = document.getElementById('loader');

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

const setStatus = (message, success = true) => {
  if (!saveStatusEl) return;
  saveStatusEl.textContent = message;
  saveStatusEl.className = success ? 'text-sm text-emerald-400' : 'text-sm text-amber-800';
};

const renderScores = (scores) => {
  if (!scoresResultEl) return;
  if (!scores || scores.length === 0) {
    scoresResultEl.innerHTML = '<p class="text-slate-400">No scores found for this session.</p>';
    return;
  }

  scoresResultEl.innerHTML = scores.map(score => `
    <div class="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-2">
        <div>
          <p class="text-sm text-slate-500">Indicator</p>
          <p class="text-base font-semibold text-white">${score.indicator_name || score.indicator_id}</p>
        </div>
        <div class="text-right">
          <p class="text-sm text-slate-500">Score</p>
          <p class="text-lg font-semibold text-emerald-400">${score.score}</p>
        </div>
      </div>
      <p class="text-slate-400 text-sm mb-2">Category: ${score.category_name || 'Unknown'}</p>
      <p class="text-slate-400 text-sm mb-1">Type: ${score.score_type}</p>
      <p class="text-slate-400 text-sm">${score.comment || 'No comment provided.'}</p>
    </div>
  `).join('');
};

const lookupScores = async () => {
  if (!loaderEl || !scoresResultEl) return;

  const meetingId = document.getElementById('lookupMeetingId')?.value?.trim();
  const sessionId = document.getElementById('lookupSessionId')?.value?.trim();

  if (!meetingId || !sessionId) {
    setStatus('Please provide both Meeting ID and Session ID.', false);
    return;
  }

  loaderEl.classList.remove('hidden');
  scoresResultEl.innerHTML = '';
  setStatus('', true);

  try {
    const result = await apiGet(`/api/scores/session/${encodeURIComponent(meetingId)}/${encodeURIComponent(sessionId)}`);
    if (result && result.success === false) {
      setStatus(result.error || 'Failed to load scores.', false);
      scoresResultEl.innerHTML = '';
    } else {
      renderScores(result.data || []);
    }
  } catch (err) {
    setStatus('Unable to fetch scores. Please try again.', false);
    scoresResultEl.innerHTML = '';
  } finally {
    loaderEl.classList.add('hidden');
  }
};

if (scoreForm) {
  scoreForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const meetingId = document.getElementById('meetingId')?.value?.trim();
    const sessionId = document.getElementById('sessionId')?.value?.trim();
    const indicatorId = document.getElementById('indicatorId')?.value?.trim();
    const score = parseInt(document.getElementById('score')?.value, 10);
    const comment = document.getElementById('comment')?.value?.trim();

    if (!meetingId || !sessionId || !indicatorId || Number.isNaN(score)) {
      setStatus('Please complete every field before saving.', false);
      return;
    }

    setStatus('Saving score...', true);

    try {
      const response = await apiPost('/api/scores/session', {
        meeting_id: meetingId,
        session_id: parseInt(sessionId, 10),
        indicator_id: indicatorId,
        score,
        comment
      });

      if (response && response.changes >= 0) {
        setStatus('Score saved successfully!', true);
        if (document.getElementById('lookupMeetingId')?.value === meetingId && document.getElementById('lookupSessionId')?.value === sessionId) {
          await lookupScores();
        }
      } else {
        setStatus(response.error || 'Unable to save score.', false);
      }
    } catch (err) {
      setStatus('Save failed. Check console for details.', false);
      console.error(err);
    }
  });
}

if (refreshScoresButton) {
  refreshScoresButton.addEventListener('click', lookupScores);
}

if (lookupForm) {
  lookupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await lookupScores();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const meetingIdInput = document.getElementById('lookupMeetingId');
  const sessionIdInput = document.getElementById('lookupSessionId');

  if (meetingIdInput && sessionIdInput) {
    const urlParams = new URLSearchParams(window.location.search);
    const meeting = urlParams.get('meeting_id');
    const session = urlParams.get('session_id');
    if (meeting) meetingIdInput.value = meeting;
    if (session) sessionIdInput.value = session;
    if (meeting && session) {
      lookupScores();
    }
  }
});