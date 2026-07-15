var COLORS = { google: 'red', zoom: 'blue', teams: 'violet' };
var LABELS = { google: 'Google Calendar', zoom: 'Zoom', teams: 'Microsoft Teams' };

function fmtDate(iso) { if(!iso) return '--'; var d = new Date(iso); return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); }

async function loadConnections() {
  var c = document.getElementById('connectionsContainer');
  c.innerHTML = '<div class="flex items-center justify-center py-16"><div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div><span class="ml-3 text-sm text-slate-400">Loading...</span></div>';
  try {
    var json = await apiFetch('/api/instructor-calendar/connections');
    var conns = json.data || [];
    var active = conns.filter(function(x){return x.status==='active';});
    var providers = {};
    conns.forEach(function(x){ if(x.provider) providers[x.provider]=true; });

    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statTotal').textContent = conns.length;
    document.getElementById('statProviders').textContent = Object.keys(providers).length;

    if (!conns.length) {
      c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-500"><div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p class="text-sm">No calendar accounts connected</p><p class="text-xs mt-1">Connect instructor calendars from the Users page</p></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < conns.length; i++) {
      var x = conns[i];
      var color = COLORS[x.provider] || 'slate';
      var label = LABELS[x.provider] || (x.provider||'Calendar');
      var statusCls = x.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 border-amber-500/20';
      html += '<div class="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3">';
      html += '<div class="w-8 h-8 rounded-md bg-'+color+'-500/10 border border-'+color+'-500/20 flex items-center justify-center flex-shrink-0 text-'+color+'-800 font-bold text-[10px]">'+(x.email||'?').charAt(0).toUpperCase()+'</div>';
      html += '<div class="flex-1 min-w-0">';
      html += '<p class="text-xs font-semibold text-white truncate">'+escHtml(x.email)+'</p>';
      html += '<p class="text-[10px] text-slate-900">'+escHtml(label)+' &middot; Updated '+fmtDate(x.updated_at)+'</p>';
      if (x.role_name) html += '<p class="text-[10px] text-slate-600">Role: '+escHtml(x.role_name)+'</p>';
      html += '</div>';
      html += '<span class="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium '+statusCls+'">'+(x.status||'unknown')+'</span>';
      html += '<button onclick="disconnect(\''+escHtml(x.email)+'\')" class="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors flex-shrink-0">Disconnect</button>';
      html += '</div>';
    }
    c.innerHTML = '<div class="space-y-3">'+html+'</div>';
  } catch(err) {
    c.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-red-400"><p>Failed to load</p><p class="text-xs mt-1">'+escHtml(err.message)+'</p></div>';
  }
}

window.disconnect = async function(email) {
  if (!confirm('Disconnect '+email+'?')) return;
  try {
    await apiFetch('/api/instructor-calendar/disconnect', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email}) });
    showToast('Calendar disconnected');
    loadConnections();
  } catch(err) { showToast(err.message, true); }
};

loadConnections();