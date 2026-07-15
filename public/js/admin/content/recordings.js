var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

async function loadUsers() {
  var sel = document.getElementById('userSelect');
  try {
    var json = await apiFetch('/api/recordings/users');
    var users = json.users || [];
    sel.innerHTML = '<option value="">Select an instructor...</option>' + users.map(function(u){return '<option value="'+u.user_id+'">'+escHtml(u.email)+' ('+escHtml(u.role_name||'instructor')+')</option>';}).join('');
  } catch(e) { sel.innerHTML = '<option value="">Failed to load</option>'; }
}

async function loadRecordings() {
  var userId = document.getElementById('userSelect').value;
  var c = document.getElementById('recordingsContainer');
  if (!userId) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><p class="text-sm">Select an instructor</p></div>'; return; }
  c.innerHTML = '<div class="flex items-center justify-center py-16"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Loading recordings...</span></div>';
  try {
    var json = await apiFetch('/api/recordings/by-user/' + userId);
    var recs = json.recordings || [];
    if (!recs.length) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><p class="text-sm">No recordings found</p></div>'; return; }
    var selOpt = document.getElementById('userSelect').selectedOptions[0];
    var label = selOpt ? selOpt.textContent : 'Instructor';
    var html = '<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden animate-fade-up"><div class="p-3 border-b border-slate-800 flex items-center justify-between"><div><p class="text-xs font-semibold text-white">'+label+'</p><p class="text-[10px] text-slate-500">'+recs.length+' recording'+(recs.length!==1?'s':'')+'</p></div></div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider"><th class="py-2 px-3">Meeting</th><th class="py-2 px-3">Date & Time</th><th class="py-2 px-3">Duration</th><th class="py-2 px-3">Platform</th><th class="py-2 px-3">Recording</th><th class="py-2 px-3">Status</th><th class="py-2 px-3 text-right">Play</th></tr></thead><tbody class="divide-y divide-slate-800/50">';
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i]; var dur = fmtDuration(r.start_time, r.end_time);
      var rs = r.has_recording ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700';
      var rl = r.has_recording ? 'Available' : (r.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
      var sc = r.status==='completed'?'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':'bg-amber-500/10 text-amber-800 border-amber-500/20';
      html += '<tr class="hover:bg-slate-800/30 transition-colors">';
      html += '<td class="py-2 px-3"><p class="font-medium truncate max-w-[150px]">'+escHtml(r.title||'Untitled')+'</p></td>';
      html += '<td class="py-2 px-3 text-slate-400">'+fmtTime(r.start_time)+'</td>';
      html += '<td class="py-2 px-3 text-slate-400">'+dur+'</td>';
      html += '<td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">'+escHtml(PLAT[r.platform]||r.platform||'Unknown')+'</span></td>';
      html += '<td class="py-2 px-3"><span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium '+rs+'">'+rl+'</span></td>';
      html += '<td class="py-2 px-3"><span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium '+sc+'">'+(r.status||'unknown')+'</span></td>';
      html += '<td class="py-2 px-3 text-right">' + (r.has_recording && r.play_url ? '<audio controls preload="none" class="h-6 w-32"><source src="'+r.play_url+'" type="audio/wav"></audio>' : '<span class="text-[10px] text-slate-600">--</span>') + '</td></tr>';
    }
    html += '</tbody></table></div></div>';
    c.innerHTML = html;
  } catch(err) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>'; }
}

loadUsers();