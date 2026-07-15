var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

async function loadUsers() {
  var sel = document.getElementById('userSelect');
  try {
    var json = await apiFetch('/api/recordings/users');
    var users = json.users || [];
    sel.innerHTML = '<option value="">Select an instructor...</option>' + users.map(function(u){return '<option value="'+u.user_id+'">'+escHtml(u.email)+' ('+escHtml(u.role_name||'instructor')+')</option>';}).join('');
  } catch(e) { sel.innerHTML = '<option value="">Failed to load</option>'; }
}

async function loadSummaries() {
  var userId = document.getElementById('userSelect').value;
  var c = document.getElementById('summariesContainer');
  if (!userId) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div><p class="text-sm">Select an instructor</p></div>'; return; }
  c.innerHTML = '<div class="flex items-center justify-center py-16"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Loading summaries...</span></div>';
  try {
    var json = await apiFetch('/api/recordings/summaries/' + userId);
    var sums = json.summaries || [];
    if (!sums.length) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div><p class="text-sm">No summaries found</p></div>'; return; }
    var selOpt = document.getElementById('userSelect').selectedOptions[0];
    var label = selOpt ? selOpt.textContent : 'Instructor';
    var html = '<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden animate-fade-up"><div class="p-3 border-b border-slate-800 flex items-center justify-between"><div><p class="text-xs font-semibold text-white">'+label+'</p><p class="text-[10px] text-slate-500">'+sums.length+' summary item'+(sums.length!==1?'s':'')+'</p></div></div><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider"><th class="py-2 px-3">Meeting</th><th class="py-2 px-3">Date & Time</th><th class="py-2 px-3">Platform</th><th class="py-2 px-3">OQI Score</th><th class="py-2 px-3">Artifacts</th><th class="py-2 px-3">Status</th><th class="py-2 px-3 text-right">View</th></tr></thead><tbody class="divide-y divide-slate-800/50">';
    for (var i = 0; i < sums.length; i++) {
      var s = sums[i];
      var ss = s.has_summary ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700';
      var sl = s.has_summary ? 'Available' : (s.asset_status === 'Conversion' ? 'Processing' : 'Not Started');
      var sc = s.status==='completed'?'bg-emerald-500/10 text-emerald-600 border-emerald-500/20':'bg-amber-500/10 text-amber-800 border-amber-500/20';
      var od = s.oqi_score ? (Number(s.oqi_score).toFixed(1)+'/10') : '--';
      var oc = s.oqi_score >= 8 ? 'text-emerald-600' : s.oqi_score >= 6 ? 'text-amber-800' : 'text-red-400';
      var ab = [];
      if (s.summary_url) ab.push('<a href="'+s.summary_url+'" target="_blank" class="text-violet-400 hover:text-violet-300">Summary</a>');
      if (s.action_items_url) ab.push('<a href="'+s.action_items_url+'" target="_blank" class="text-amber-800 hover:text-amber-300">Actions</a>');
      if (s.topic_clusters_url) ab.push('<a href="'+s.topic_clusters_url+'" target="_blank" class="text-emerald-600 hover:text-emerald-300">Topics</a>');
      var viewBtn = s.has_summary && s.summary_url ? '<a href="'+s.summary_url+'" target="_blank" class="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-slate-800 transition-colors">View</a>' : '<span class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium '+ss+'">'+sl+'</span>';
      html += '<tr class="hover:bg-slate-800/30 transition-colors"><td class="py-2 px-3"><p class="font-medium truncate max-w-[150px]">'+escHtml(s.title||'Untitled')+'</p>'+(s.evidence_quote?'<p class="text-[10px] text-slate-600 italic mt-0.5 truncate max-w-[150px]">"'+escHtml(s.evidence_quote.slice(0,80))+'..."</p>':'')+'</td><td class="py-2 px-3 text-slate-400">'+fmtTime(s.start_time)+'</td><td class="py-2 px-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">'+escHtml(PLAT[s.platform]||s.platform||'Unknown')+'</span></td><td class="py-2 px-3"><span class="font-mono font-bold '+oc+'">'+od+'</span></td><td class="py-2 px-3"><div class="flex gap-1.5">'+(ab.length?ab.join('<span class="text-slate-700">|</span>'):'<span class="text-[10px] text-slate-600">--</span>')+'</div></td><td class="py-2 px-3"><span class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium '+sc+'">'+(s.status||'unknown')+'</span></td><td class="py-2 px-3 text-right">'+viewBtn+'</td></tr>';
    }
    html += '</tbody></table></div></div>';
    c.innerHTML = html;
  } catch(err) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>'; }
}

loadUsers();