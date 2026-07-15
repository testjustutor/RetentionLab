window._liveMeetingData = {};

async function startBot(btn, statusId, m) {
  var statusEl = document.getElementById(statusId);
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

async function loadLive() {
  var container = document.getElementById('liveContainer');
  container.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Checking live sessions...</span></div>';
  try {
    var json = await apiFetch('/api/meeting-schedule/live');
    var users = json.users || [];
    var totalEvents = json.totalEvents || 0;
    document.getElementById('liveCount').textContent = totalEvents + ' Live';

    if (!totalEvents) {
      container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p class="text-sm">No live sessions right now</p></div>';
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
      html += '<div class="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-xs">'+(u.email||'?').charAt(0).toUpperCase()+'</div>';
      html += '<div class="flex-1 min-w-0"><p class="text-xs font-semibold text-white truncate">'+escHtml(u.email)+'</p><p class="text-[10px] text-emerald-600">'+escHtml(u.role_name||'instructor')+' &middot; '+events.length+' live meeting'+(events.length!==1?'s':'')+'</p></div>';
      html += '<span class="live-pulse inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">LIVE</span>';
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
        var mKey = 'live-meeting-'+uIdx+'-'+eIdx;
        window._liveMeetingData[mKey] = { platform:e.platform||'google-meet', meetingId:e.id, passcode:'', meetingUrl:e.link||'' };

        html += '<div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">';
        html += '<div class="flex items-start justify-between gap-2 mb-2">';
        html += '<div class="flex-1 min-w-0">';
        html += '<p class="text-xs font-semibold text-white truncate">'+escHtml(e.title||'Untitled Meeting')+'</p>';
        html += '<p class="text-[10px] text-slate-400 mt-0.5">'+timeStr+endStr+'</p>';
        html += '<div class="flex items-center gap-2 mt-1.5">';
        html += '<span class="text-[10px] text-slate-500">Started '+elapsedMin+'m ago</span>';
        if (remainingMin !== null) html += '<span class="text-[10px] text-amber-800">'+remainingMin+'m remaining</span>';
        if (e.platform) html += '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">'+escHtml(e.platform)+'</span>';
        html += '</div></div>';
        html += '<button onclick="startBot(this,\''+statusId+'\',window._liveMeetingData[\''+mKey+'\'])" class="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-violet-600 hover:bg-violet-500 active:scale-95 text-white border border-violet-500/50 transition-all duration-150">';
        html += '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" x2="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/></svg>Join Bot';
        html += '</button></div>';
        html += '<div id="'+statusId+'" class="hidden mt-2 text-xs"></div>';
        html += '<div class="w-full bg-slate-700 rounded-full h-1 overflow-hidden"><div class="h-full bg-gradient-to-r from-emerald-500 to-violet-500 rounded-full" style="width:'+Math.min(100,(elapsedMin/(elapsedMin+(remainingMin||elapsedMin)))*100)+'%"></div></div>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;
  } catch(err) {
    container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>';
  }
}

loadLive();
setInterval(loadLive, 30000);