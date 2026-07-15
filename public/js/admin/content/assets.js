var PLAT = { 'google-meet':'Google Meet','zoom':'Zoom','teams':'Teams' };
function fmtTime(iso){if(!iso)return'--';var d=new Date(iso);return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDur(s,e){if(!s||!e)return'--';var m=Math.round((new Date(e)-new Date(s))/60000);if(m<60)return m+'m';var h=Math.floor(m/60);m=m%60;return h+'h'+(m>0?' '+m+'m':'');}

var ASSET_TYPES = [
  {key:'audit_json_path',icon:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',label:'Audit Log',color:'rose'},
  {key:'whisper_path',icon:'<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',label:'AI Transcript',color:'violet'},
  {key:'captions_raw_path',icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="7 10 10 13 17 6"/>',label:'Captions',color:'emerald'},
  {key:'diarization_path',icon:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',label:'Diarization',color:'sky'},
  {key:'embeddings_path',icon:'<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>',label:'Embeddings',color:'amber'},
  {key:'llm_prompts_path',icon:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',label:'LLM Prompts',color:'fuchsia'},
  {key:'talk_ratio_json_path',icon:'<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',label:'Talk Ratio',color:'indigo'},
  {key:'sentiment_analysis_path',icon:'<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',label:'Sentiment',color:'green'},
  {key:'action_items_path',icon:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',label:'Action Items',color:'lime'},
  {key:'user_silence_duration_path',icon:'<circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',label:'Silence Track',color:'orange'},
  {key:'questions_asked_count_path',icon:'<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',label:'Questions',color:'teal'},
  {key:'topic_clusters_path',icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',label:'Topic Clusters',color:'cyan'}
];

async function loadUsers() {
  var sel = document.getElementById('userSelect');
  try {
    var json = await apiFetch('/api/recordings/users');
    var users = json.users || [];
    sel.innerHTML = '<option value="">Select an instructor...</option>' + users.map(function(u){return '<option value="'+u.user_id+'">'+escHtml(u.email)+' ('+escHtml(u.role_name||'instructor')+')</option>';}).join('');
  } catch(e) { sel.innerHTML = '<option value="">Failed to load</option>'; }
}

async function loadAssets() {
  var userId = document.getElementById('userSelect').value;
  var c = document.getElementById('assetsContainer');
  if (!userId) { c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><p class="text-sm">Select an instructor to view AI assets</p></div>'; return; }
  c.innerHTML = '<div class="flex items-center justify-center py-16"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Loading assets...</span></div>';
  try {
    var json = await apiFetch('/api/recordings/assets/' + userId);
    var meetings = json.meetings || [];
    if (!meetings.length) {
      c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><p class="text-sm">No AI assets found</p><p class="text-xs mt-1">Assets are generated after bot joins and AI processes the meeting</p></div>';
      return;
    }

    var totalFiles = 0;
    var html = '<div class="space-y-6">';
    for (var i = 0; i < meetings.length; i++) {
      var m = meetings[i];
      var dur = fmtDur(m.start_time, m.end_time);
      var files = m.files || [];
      if (!files.length) continue;
      totalFiles += files.length;
      var color = ['violet','emerald','amber','rose','sky'][i % 5];

      html += '<div class="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden animate-fade-up" style="animation-delay:'+(i*60)+'ms">';
      html += '<div class="p-3 border-b border-slate-800 flex items-center gap-2 bg-'+color+'-500/5">';
      html += '<div class="w-8 h-8 rounded-md bg-'+color+'-500/10 border border-'+color+'-500/20 flex items-center justify-center text-'+color+'-800 font-bold text-[10px]">'+(m.title||'?').charAt(0).toUpperCase()+'</div>';
      html += '<div class="flex-1 min-w-0">';
      html += '<p class="text-xs font-semibold  truncate">'+escHtml(m.title||'Untitled Meeting')+'</p>';
      html += '<p class="text-[10px] text-slate-500">'+fmtTime(m.start_time)+' &middot; '+dur+' &middot; '+escHtml(PLAT[m.platform]||m.platform||'Unknown')+' &middot; '+files.length+' file'+(files.length!==1?'s':'')+'</p>';
      html += '</div>';
      html += '<span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-'+color+'-500/10 text-'+color+'-800 border border-'+color+'-500/20">'+files.length+' files</span></div>';
      html += '<div class="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">';

      for (var j = 0; j < files.length; j++) {
        var f = files[j];
        html += '<a href="'+f.url+'" target="_blank" class="file-chip flex flex-col items-center gap-1 p-2 rounded-md bg-slate-400/40 border border-slate-700/50 hover:bg-slate-600/10 hover:border-slate-400/30 transition-all text-center">';
        html += '<svg class="w-4 h-4 text-'+f.color+'-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">'+f.icon+'</svg>';
        html += '<span class="text-[10px] text-slate-300 font-medium leading-tight">'+escHtml(f.label)+'</span>';
        html += '<span class="text-[9px] text-slate-500">'+escHtml(f.type||'file')+'</span>';
        html += '</a>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    var selOpt = document.getElementById('userSelect').selectedOptions[0];
    var label = selOpt ? selOpt.textContent : 'Instructor';
    if (totalFiles) html = '<p class="text-xs text-slate-500 mb-3">'+totalFiles+' AI-generated file'+(totalFiles!==1?'s':'')+' for '+label+'</p>' + html;
    c.innerHTML = html;
  } catch(err) {
    c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>';
  }
}

loadUsers();