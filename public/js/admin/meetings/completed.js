var COL = ['violet','emerald','amber','rose','sky'];
var PLAT = { 'google-meet':'Google Meet', 'zoom':'Zoom', 'teams':'Teams' };

function fmtTime(iso) { if (!iso) return '--'; var d = new Date(iso); return d.toLocaleDateString([],{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }
function fmtDuration(start, end) { if (!start||!end) return '--'; var m = Math.round((new Date(end)-new Date(start))/60000); if (m<60) return m+'m'; var h=Math.floor(m/60); m=m%60; return h+'h'+ (m>0?' '+m+'m':''); }

async function loadCompleted() {
  var c = document.getElementById('completedContainer');
  c.innerHTML = '<div class="flex items-center justify-center py-20"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Loading completed sessions...</span></div>';
  try {
    var json = await apiFetch('/api/meeting-schedule/completed?hours='+document.getElementById('hoursSelect').value);
    var users = json.users || [];
    var total = json.totalEvents || 0;
    var totalDur = 0;
    var completedCount = 0;
    users.forEach(function(u){ u.events.forEach(function(e){ if(e.start&&e.end) totalDur += Math.round((new Date(e.end)-new Date(e.start))/60000); }); });
    document.getElementById('statConnected').textContent = json.connectedUsers || 0;
    document.getElementById('statMeetings').textContent = total;
    document.getElementById('statCompleted').textContent = total;
    document.getElementById('statDuration').textContent = totalDur >= 60 ? Math.floor(totalDur/60)+'h '+totalDur%60+'m' : totalDur+'m';

    if (!total) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><p class="text-sm">No completed sessions in this period</p></div>'; return; }

    var html = '';
    for (var i = 0; i < users.length; i++) {
      var u = users[i]; var color = COL[i%COL.length]; var events = (u.events||[]).sort(function(a,b){return new Date(b.start)-new Date(a.start);});
      html += '<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden animate-fade-up" style="animation-delay:'+(i*80)+'ms">';
      html += '<div class="p-3 border-b border-slate-800 flex items-center gap-2 bg-'+color+'-500/5">';
      html += '<div class="w-8 h-8 rounded-md bg-'+color+'-500/10 border border-'+color+'-500/20 flex items-center justify-center text-'+color+'-800 font-bold text-[10px]">'+(u.email||'?').charAt(0).toUpperCase()+'</div>';
      html += '<div class="flex-1 min-w-0"><p class="text-xs font-semibold truncate">'+escHtml(u.email)+'</p><p class="text-[10px] text-slate-500">'+escHtml(u.role_name||'instructor')+' &middot; '+events.length+' completed</p></div>';
      html += '<span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-'+color+'-500/10 text-'+color+'-800 border border-'+color+'-500/20">'+events.length+'</span></div>';
      html += '<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider"><th class="py-2 px-3">Meeting</th><th class="py-2 px-3">Date & Time</th><th class="py-2 px-3">Duration</th><th class="py-2 px-3">Platform</th><th class="py-2 px-3 text-right">Status</th></tr></thead><tbody class="divide-y divide-slate-800/50">';

      for (var j = 0; j < events.length; j++) {
        var e = events[j]; var dur = fmtDuration(e.start, e.end); var status = e.status || 'completed';
        var statusCls = status==='completed'?'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':status==='failed'?'bg-red-500/10 text-red-400 border-red-500/20':'bg-amber-500/10 text-amber-800 border-amber-500/20';
        var platName = PLAT[e.platform] || (e.platform||'Unknown');
        html += '<tr class="hover:bg-slate-800/30 transition-colors">';
        html += '<td class="py-2 px-3"><p class="font-medium truncate max-w-[150px]">'+escHtml(e.title||'Untitled')+'</p></td>';
        html += '<td class="py-2 px-3 text-slate-400">'+fmtTime(e.start)+'</td>';
        html += '<td class="py-2 px-3 text-slate-400">'+dur+'</td>';
        html += '<td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">'+escHtml(platName)+'</span></td>';
        html += '<td class="py-2 px-3 text-right"><span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium '+statusCls+'">'+status+'</span></td>';
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }
    c.innerHTML = html;
  } catch(err) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>'; }
}

document.getElementById('hoursSelect').addEventListener('change', loadCompleted);
loadCompleted();