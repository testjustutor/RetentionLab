/**
 * public/js/admin/meetings/live.js
 * Live meetings dashboard — bot status tracking (DB-driven), detected
 * participants, transcript/audio activity.
 *
 * All state is read ONLY from the DB via GET /api/admin/meeting-schedule/live
 * (no direct bot access). The page silently re-polls every few seconds so a
 * newly detected participant / status change appears automatically inside that
 * meeting's card.
 */

window._liveMeetingData = {};

var LIVE_POLL_MS = 5000; // silent auto-refresh interval

// meetings.status (bot join lifecycle) -> UI state
var BOT_STATUS = {
  queued:            { label: 'Queued - waiting to launch', color: 'slate', pulse: false },
  scheduled:         { label: 'Scheduled - not launched', color: 'slate', pulse: false },
  launching:         { label: 'Bot is joining...', color: 'amber', pulse: true },
  starting:          { label: 'Bot is joining...', color: 'amber', pulse: true },
  joining:           { label: 'Bot is joining...', color: 'amber', pulse: true },
  bot_launching:     { label: 'Bot is joining...', color: 'amber', pulse: true },
  waiting_for_host:  { label: 'Waiting for host to allow in...', color: 'amber', pulse: true },
  joined:            { label: 'Bot joined the meeting', color: 'emerald', pulse: false },
  host_rejected:     { label: 'Host rejected the bot', color: 'rose', pulse: false },
  waiting_timeout:   { label: 'Waiting-room timeout', color: 'rose', pulse: false },
  failed:            { label: 'Bot failed to join', color: 'rose', pulse: false },
  stopped:           { label: 'Bot stopped', color: 'rose', pulse: false },
  cancelled:         { label: 'Cancelled', color: 'rose', pulse: false },
  error:             { label: 'Bot error', color: 'rose', pulse: false },
  active:            { label: 'Bot active', color: 'amber', pulse: true },
  expired:           { label: 'Expired', color: 'rose', pulse: false },
  completed:         { label: 'Bot ended', color: 'slate', pulse: false }
};

// Bot lifecycle classification (meetings.status)
var BOT_BUSY_STATUSES   = ['queued', 'launching', 'starting', 'joining', 'bot_launching', 'waiting_for_host', 'active'];
var BOT_STOPPED_STATUSES = ['failed', 'error', 'cancelled', 'stopped', 'host_rejected', 'waiting_timeout', 'expired', 'completed'];
var SESSION_ENDED_STATUSES = ['completed', 'no_activity', 'failed'];

function isBotBusy(status)    { return BOT_BUSY_STATUSES.indexOf(status) !== -1; }
function isBotStopped(status) { return BOT_STOPPED_STATUSES.indexOf(status) !== -1; }
// A session row exists only after a human is detected; when the latest session is
// terminal, the bot's conversation for this meeting has finished (stopped).
function isSessionEnded(session) {
  return !!session && SESSION_ENDED_STATUSES.indexOf(session.session_status || '') !== -1;
}

// Non-clickable label shown in place of the Join Bot button when the bot is stopped.
var STOP_BTN_LABELS = {
  stopped:         'Bot stopped',
  failed:          'Bot failed',
  error:           'Bot error',
  cancelled:       'Cancelled',
  host_rejected:   'Host rejected',
  waiting_timeout: 'Timed out',
  expired:         'Expired',
  completed:       'Meeting ended'
};

var STATUS_COLORS = {
  emerald: { text: 'text-emerald-600' },
  amber:   { text: 'text-amber-600' },
  rose:    { text: 'text-rose-600' },
  sky:     { text: 'text-sky-600' },
  slate:   { text: 'text-slate-500' },
  violet:  { text: 'text-violet-500' }
};

// ── Adaptive polling ──────────────────────────────────────────────────
// The auto-refresh timer only stays ON while at least one bot is still
// running / joining / in a waiting room / active session. Once every bot for
// the shown meetings has stopped or ended, the timer is cleared so the
// /api/admin/meeting-schedule/live endpoint stops being called until the
// user refreshes manually or launches a bot again.
var _pollTimer = null;

function hasLiveActivity(users) {
  for (var i = 0; i < (users || []).length; i++) {
    var events = users[i].events || [];
    for (var j = 0; j < events.length; j++) {
      var ev = events[j];
      var s = ev.bot_status || ev.status || '';
      if (BOT_BUSY_STATUSES.indexOf(s) !== -1) return true;             // joining / waiting room / launching
      var sessionActive = !!ev.session && !isSessionEnded(ev.session);  // session row exists and is not terminal
      if (sessionActive) return true;                                    // active conversation in progress
      if (s === 'joined' && !ev.session) {
        // Bot joined but no human detected yet (no session row). The backend
        // now writes meetings.status='stopped' when the bot stops, so 'joined'
        // always flips on stop. Crash backstop (server-computed, TZ-safe):
        // keep polling only while the meeting window is still current (no more
        // than 15 minutes past its scheduled end).
        var remainingSecs = Number(ev.remaining_seconds);
        if (!ev.remaining_seconds || isNaN(remainingSecs) || remainingSecs > -15 * 60) return true;
      }
    }
  }
  return false;
}

function ensureLivePolling() {
  if (!_pollTimer) _pollTimer = setInterval(function(){ loadLive(true); }, LIVE_POLL_MS);
}

function pauseLivePolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  var ticker = document.getElementById('liveUpdated');
  if (ticker) ticker.textContent = 'Auto-refresh paused - no active bot';
}

function syncPolling(users) {
  if (hasLiveActivity(users)) ensureLivePolling();
  else pauseLivePolling();
}

function statusChip(status, withBotPrefix) {
  var meta = BOT_STATUS[status] || { label: status || 'scheduled', color: 'slate', pulse: false };
  var cls = STATUS_COLORS[meta.color] || STATUS_COLORS.slate;
  var label = (withBotPrefix ? '[BOT] ' : '') + (meta.label || '');
  return '<span class="whitespace-nowrap text-xs font-bold ' + cls.text + (meta.pulse ? ' animate-pulse' : '') + '">' + escHtml(label) + '</span>';
}

function activityChip(label, color, pulse) {
  var cls = STATUS_COLORS[color] || STATUS_COLORS.slate;
  return '<span class="whitespace-nowrap text-xs font-bold ' + cls.text + (pulse ? ' animate-pulse' : '') + '">' + escHtml(label) + '</span>';
}

/**
 * Activity chips derived from the DB session state. A meeting_sessions row
 * only exists after a human participant is detected, so its presence is the
 * "human detected" signal:
 *   - transcript running  = transcript_file_name set (first real caption linked)
 *   - audio recording     = session still active AND audio_file_name not yet
 *                           saved (audio_file_name is written when recording
 *                           stops / the file is persisted)
 */
function activityChips(session) {
  if (!session) return [];
  var s = session.session_status || 'human_detected';
  var active = (s === 'human_detected' || s === 'processing');
  var out = [];

  if (session.transcript_file_name) {
    out.push(activityChip(active ? '[TRANSCRIPT] Transcript running' : '[TRANSCRIPT] Transcript saved', 'sky', active));
  } else if (active) {
    out.push(activityChip('[TRANSCRIPT] Waiting for transcript...', 'sky', true));
  }

  if (session.audio_file_name) {
    out.push(activityChip('[AUDIO] Audio saved', 'amber', false));
  } else if (active) {
    out.push(activityChip('[AUDIO] Audio recording...', 'amber', true));
  }
  return out;
}

/** Format an ISO/timestamp value as a short '12:34 PM' time ('' when absent). */
function fmtSessionTime(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h24 = d.getHours();
    var h = h24 % 12; if (h === 0) h = 12;
    var m = d.getMinutes();
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + (h24 >= 12 ? 'PM' : 'AM');
  } catch (e) { return ''; }
}

/** Participants detected for this meeting (DB roster — bot is never stored). */
function participantsPanel(participants) {
  var list = participants || [];
  var html = '<div class="mt-1.5 pt-1.5 border-t border-slate-700/40">';
  html += '<p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Participants (' + (list.length || 0) + ')</p>';
  if (!list.length) {
    html += '<p class="text-xs text-slate-500 mt-0.5">No participants detected yet.</p>';
  } else {
    html += '<ul class="mt-0.5 space-y-0.5">';
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var isJoined = (p.status === 'joined');
      var markCls = isJoined ? 'text-emerald-600' : 'text-rose-600';
      // Join/leave timeline from participant_attendance_sessions (joined_at /
      // left_at), with participants.created_at as the join-time fallback.
      var joinTime = fmtSessionTime(p.joined_at);
      var leftTime = fmtSessionTime(p.left_at);
      html += '<li class="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">' +
        '<span class="font-bold ' + markCls + '">' + (isJoined ? '+' : '-') + '</span>' +
        '<span class="text-slate-200 font-medium truncate max-w-[150px]">' + escHtml(p.name || 'Unknown') + '</span>';
      if (joinTime) html += '<span class="' + markCls + ' font-semibold">joined ' + joinTime + '</span>';
      if (leftTime) html += '<span class="text-rose-600 font-semibold">left ' + leftTime + '</span>';
      if (!joinTime && !leftTime) html += '<span class="' + markCls + '">' + (isJoined ? 'in meeting' : 'left') + '</span>';
      html += '</li>';
    }
    html += '</ul>';
  }
  html += '</div>';
  return html;
}

async function startBot(btn, statusId, m) {
  var statusEl = document.getElementById(statusId);
  // Re-join guards (state is DB-driven). Prevent double-launching a bot that is
  // already in the meeting, joining, or has stopped.
  if (m.botStopped) { showBotStatus(statusEl, 'error', 'Bot has stopped for this meeting.'); return; }
  if (m.botJoined || m.botBusy) { showBotStatus(statusEl, 'error', 'Bot is already in this meeting.'); return; }
  var payload = {
    platform:   (m.platform || '').toLowerCase(),
    meetingId:  m.meetingId || m.id || m.meeting_id || '',
    passcode:   m.passcode || m.password || '',
    meetingUrl: m.meetingUrl || m.link || m.meeting_link || '',
    webhookUrl: ''
  };
  if (!payload.meetingId || !payload.platform) {
    showBotStatus(statusEl, 'error', 'Missing meeting ID or platform.');
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<svg class="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg> Launching...';
  btn.classList.replace('bg-violet-600','bg-slate-700'); btn.classList.replace('hover:bg-violet-500','hover:bg-slate-700');
  showBotStatus(statusEl, 'info', 'Sending bot to meeting...');

  try {
    var res = await fetch('/api/bot/start-bot', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    var data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'HTTP '+res.status);
    if (data.success) {
      // Persist launched state so the 5s re-render keeps showing "Bot launched".
      var mkey = btn.getAttribute && btn.getAttribute('data-mkey');
      if (mkey && window._liveMeetingData[mkey]) window._liveMeetingData[mkey].launched = true;
      ensureLivePolling(); // bot is launching -> resume the auto-refresh timer
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Joined';
      btn.classList.replace('bg-slate-700','bg-emerald-600'); btn.classList.add('cursor-default');
      showBotStatus(statusEl, 'success', data.message || 'Bot joined the meeting.');
    } else { throw new Error(data.message || 'Bot failed to join.'); }
  } catch(err) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" x2="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg> Retry';
    btn.classList.replace('bg-slate-700','bg-rose-600'); btn.classList.replace('hover:bg-slate-700','hover:bg-rose-500'); btn.classList.remove('cursor-default');
    showBotStatus(statusEl, 'error', err.message);
  }
}

function showBotStatus(el, type, msg) {
  var styles = { info:'background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);color:#818cf8', success:'background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);color:#34d399', error:'background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.25);color:#fb7185' };
  el.setAttribute('style', styles[type]+';border-radius:8px;padding:6px 10px;font-size:11px;font-weight:500');
  el.textContent = msg; el.classList.remove('hidden');
}

function updateTicker() {
  var ticker = document.getElementById('liveUpdated');
  if (ticker) ticker.textContent = 'Auto-refresh every ' + (LIVE_POLL_MS/1000) + 's - updated just now';
}

async function loadLive(silent) {
  var container = document.getElementById('liveContainer');
  if (!silent) {
    container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Checking live sessions...</span></div>';
  }
  try {
    var json = await apiFetch('/api/admin/meeting-schedule/live');
    var users = json.users || [];
    var totalEvents = json.totalEvents || 0;
    document.getElementById('liveCount').textContent = totalEvents + ' Live';
    updateTicker();
    syncPolling(users);

    if (!totalEvents) {
      container.innerHTML = '<div class="bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-200 rounded-lg shadow-md overflow-hidden">' +
        '<div class="px-4 py-3 border-b-2 border-slate-200 bg-slate-200">' +
          '<h3 class="text-[13px] font-bold text-slate-900 uppercase tracking-wide">Live Sessions</h3>' +
        '</div>' +
        '<div class="overflow-x-auto overflow-y-auto max-h-96 custom-scrollbar">' +
          '<table class="w-full">' +
            '<thead class="sticky top-0">' +
              '<tr class="text-xs font-bold text-slate-950 uppercase border-b-2 border-slate-300 bg-slate-200">' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Instructor</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Meeting</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Time</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Status</th>' +
                '<th class="py-2 px-3 text-left font-bold tracking-wide">Action</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              '<tr>' +
                '<td colspan="5" class="px-4 py-12 bg-slate-20">' +
                  '<div class="flex flex-col items-center justify-center">' +
                    '<div class="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-3">' +
                      '<svg class="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' +
                        '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>' +
                      '</svg>' +
                    '</div>' +
                    '<p class="text-sm font-medium text-slate-700 mb-1">No Live Sessions</p>' +
                    '<p class="text-sm text-slate-600 text-center max-w-sm">There are no active live meetings at the moment. Meetings will appear here when instructors start their sessions.</p>' +
                  '</div>' +
                '</td>' +
              '</tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
      return;
    }

    var html = '';
    var colorList = ['emerald','violet','amber','rose','sky'];

    for (var uIdx = 0; uIdx < users.length; uIdx++) {
      var u = users[uIdx];
      var color = colorList[uIdx % colorList.length];
      var events = (u.events || []).sort(function(a,b){ return new Date(a.start)-new Date(b.start); });

      html += '<div class="bg-slate-900 border border-emerald-500/20 rounded-lg overflow-hidden animate-fade-up" style="animation-delay:'+(uIdx*100)+'ms">';
      html += '<div class="p-3 border-b border-emerald-500/10 flex items-center gap-2 bg-emerald-500/5">';
      html += '<div class="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-sm">'+(u.email||'?').charAt(0).toUpperCase()+'</div>';
      html += '<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">'+escHtml(u.email)+'</p><p class="text-xs text-emerald-600">'+escHtml(u.role_name||'instructor')+' &middot; '+events.length+' live meeting'+(events.length!==1?'s':'')+'</p></div>';
      html += '<span class="animate-pulse inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">LIVE</span>';
      html += '</div><div class="p-3 space-y-2">';

      for (var eIdx = 0; eIdx < events.length; eIdx++) {
        var e = events[eIdx];
        var start = new Date(e.start);
        var end = e.end ? new Date(e.end) : null;
        var now = new Date();
        var elapsedMin = Math.floor((now-start)/60000);
        var remainingMin = end ? Math.floor((end-now)/60000) : null;
        var timeStr = start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        var endStr = end ? ' - '+end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
        var statusId = 'bot-status-live-'+uIdx+'-'+eIdx;
        var mKey = 'live-meeting-'+(e.id || e.meeting_id || (uIdx+'-'+eIdx));

        // Preserve join/launch state across re-renders (polling rebuilds the DOM).
        var stored = window._liveMeetingData[mKey] || {};
        var botStatus = e.bot_status || e.status || 'scheduled';
        var botStopped = isBotStopped(botStatus) || isSessionEnded(e.session);
        var botJoined = (botStatus === 'joined') && !isSessionEnded(e.session);
        var botBusy = isBotBusy(botStatus);
        window._liveMeetingData[mKey] = {
          platform: e.platform || 'google-meet',
          meetingId: e.meeting_id || e.id || '',
          passcode: e.passcode || '',
          meetingUrl: e.meeting_link || e.link || '',
          launched: stored.launched || false,
          botStatus: botStatus,
          botJoined: botJoined,
          botBusy: botBusy,
          botStopped: botStopped
        };

        html += '<div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">';
        html += '<div class="flex items-start justify-between gap-2">';
        html += '<div class="flex-1 min-w-0">';
        html += '<p class="text-sm font-bold text-slate-100 truncate">'+escHtml(e.title||'Untitled Meeting')+'</p>';
        html += '</div>';

        // Join Bot action state (DB-driven):
        //   stopped -> "Bot stopped" (no re-join) | joined -> "Bot joined" (disabled)
        //   busy -> "Bot joining..." (disabled)   | launched this page session -> "Bot launched"
        if (botStopped) {
          var stopLabel = STOP_BTN_LABELS[botStatus] || 'Bot stopped';
          var stopCls = (botStatus === 'completed' || botStatus === 'expired') ? 'bg-slate-600' : 'bg-rose-600';
          html += '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ' + stopCls + ' text-white cursor-not-allowed">' + stopLabel + '</span>';
        } else if (botJoined) {
          html += '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white cursor-default">Bot joined</span>';
        } else if (botBusy) {
          html += '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-600 text-white cursor-default animate-pulse">Bot joining...</span>';
        } else if (stored.launched) {
          html += '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white cursor-default">Bot launched</span>';
        } else {
          html += '<button data-mkey="'+mKey+'" onclick="startBot(this,\''+statusId+'\',window._liveMeetingData[\''+mKey+'\'])" class="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-violet-600 hover:bg-violet-500 active:scale-95 text-white border border-violet-500/50 transition-all duration-150">';
          html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" x2="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>Join Bot';
          html += '</button>';
        }
        html += '</div>';

        // Row 2 — one compact meta line: time range | started | remaining | platform
        html += '<div class="flex flex-wrap items-center gap-1.5 mt-1">';
        html += '<span class="text-xs text-slate-300">'+timeStr+endStr+'</span>';
        html += '<span class="text-slate-500 text-xs whitespace-nowrap">|</span>';
        html += '<span class="text-xs text-slate-400">Started '+elapsedMin+'m ago</span>';
        if (remainingMin !== null) {
          html += '<span class="text-slate-500 text-xs whitespace-nowrap">|</span>';
          html += '<span class="text-xs text-amber-600">'+remainingMin+'m remaining</span>';
        }
        if (e.platform) html += '<span class="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">'+escHtml(e.platform)+'</span>';
        html += '</div>';

        // ---- Live tracking (all DB-sourced) ----
        // Single-line status strip: [BOT] status + [TRANSCRIPT]/[AUDIO] activity.
        var statusParts = [statusChip(e.bot_status || e.status, true)].concat(activityChips(e.session));
        html += '<div class="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-700/40 min-w-0 overflow-hidden">' + statusParts.join('<span class="text-slate-600 text-xs whitespace-nowrap">|</span>') + '</div>';

        // Detected participants (roster excludes the bot)
        html += participantsPanel(e.participants);

        html += '<div id="'+statusId+'" class="hidden mt-2 text-sm"></div>';

        // Meeting progress bar — fraction of the meeting window that has
        // elapsed (defaults to a 60-minute window when there is no scheduled
        // end time, and stays capped at 100% once the meeting is over).
        var totalMin = (remainingMin !== null && (elapsedMin + remainingMin) > 0) ? (elapsedMin + remainingMin) : 60;
        var progressPct = Math.max(0, Math.min(100, (elapsedMin / Math.max(1, totalMin)) * 100));
        html += '<div class="w-full bg-slate-700 rounded-full h-1 mt-2 overflow-hidden">';
        html += '<div class="h-full bg-gradient-to-r from-emerald-500 to-violet-500 rounded-full" style="width:' + progressPct + '%"></div>';
        html += '</div>';

        html += '</div>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;
  } catch(err) {
    if (!silent) container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-400"><p>Failed to load</p><p class="text-sm mt-1">'+escHtml(err.message)+'</p></div>';
  }
}

// Initial load. The 5s auto-refresh timer is started/paused automatically
// inside loadLive() based on detected bot activity (see syncPolling) - so no
// API calls happen when there is no active bot for the shown meetings.
loadLive(false);