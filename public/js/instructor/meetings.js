/**
 * public/js/instructor/meetings.js
 *
 * Extracted from an inline <script type="module"> block that used to live
 * directly in public/instructor/meetings.html, to match this codebase's
 * convention of one external, same-named JS file per HTML page (see e.g.
 * public/js/instructor/dashboard.js, public/js/reviewer/dashboard.js).
 * Behavior is unchanged - only the auth.js import path was adjusted for
 * this file's new location (was '../js/auth.js' relative to the HTML page
 * under public/instructor/; is '../auth.js' relative to this file under
 * public/js/instructor/ - both resolve to public/js/auth.js).
 */
import { getCachedUser } from '../auth.js';

(function() {
  var API = "/api/instructor/meetings";
  var listEl = document.getElementById("meetingsList");
  var emptyEl = document.getElementById("emptyState");
  var statUpcoming = document.getElementById("stat-upcoming");
  var statLive = document.getElementById("stat-live");
  var statCompleted = document.getElementById("stat-completed");
  var currentTab = "upcoming";

  function api(p) { return fetch(API + p, { credentials: "include" }).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function platformIcon(p) {
    var m = {
      zoom: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-blue-500\/10 text-blue-400 border border-blue-500\/20">Zoom</span>',
      teams: '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-indigo-500\/10 text-indigo-400 border border-indigo-500\/20">Teams</span>',
      "google-meet": '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-cyan-500\/10 text-cyan-400 border border-cyan-500\/20">Google Meet</span>'
    };
    return m[p] || '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium bg-slate-800 text-slate-300 border border-slate-700">' + (p || "Unknown") + "</span>";
  }

  function statusBadge(s) {
    var m = {
      queued: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-amber-500\/10 text-amber-800 border border-amber-500\/20">Queued</span>',
      joining: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-blue-500\/10 text-blue-400 border border-blue-500\/20">Joining</span>',
      active: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-emerald-500\/10 text-emerald-400 border border-emerald-500\/20">Active</span>',
      completed: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-slate-500\/10 text-slate-300 border border-slate-600">Completed</span>',
      cancelled: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-red-500\/10 text-red-400 border border-red-500\/20">Cancelled</span>',
      failed: '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-red-500\/10 text-red-400 border border-red-500\/20">Failed</span>'
    };
    return m[s] || '<span class="px-2 py-0.5 rounded text-[12px] font-medium bg-slate-800 text-slate-300 border border-slate-700">' + s + "</span>";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso); if (isNaN(d)) return iso;
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function render(meetings) {
    listEl.innerHTML = "";
    if (!meetings.length) { emptyEl.classList.remove("hidden"); return; }
    emptyEl.classList.add("hidden");
    meetings.forEach(function(m) {
      var card = document.createElement("div");
      card.className = "rounded-xl bg-slate-900 border border-slate-800 p-4";
      var lk = m.meetingLink
        ? '<a href="' + esc(m.meetingLink) + '" target="_blank" rel="noopener" class="link-button text-xs">Join</a>'
        : '<span class="text-xs text-slate-600">No link</span>';
 card.innerHTML = '<div class="flex items-start justify-between gap-3"><div class="min-w-0 flex-1"><p class="text-sm font-medium truncate">' + esc(m.title || "Untitled Meeting") + "</p>" +
        '<p class="text-xs text-slate-400 mt-1">' + fmtDate(m.startTime) + (m.endTime ? " → " + fmtDate(m.endTime) : "") + "</p>" +
        '<div class="flex items-center gap-2 mt-2">' + platformIcon(m.platform) + statusBadge(m.status) + "</div>" +
      "</div><div class=\"flex-shrink-0\">" + lk + "</div></div>";
      listEl.appendChild(card);
    });
  }

  function loadStats() {
    api("/stats").then(function(d) {
      if (d.success) {
        statUpcoming.textContent = d.upcomingCount || 0;
        statLive.textContent = d.liveCount || 0;
        statCompleted.textContent = d.completedCount || 0;
      }
    }).catch(function() {});
  }

  function loadMeetings() {
    api("/" + currentTab).then(function(d) { if (d.success) render(d.meetings || []); });
  }

  function refreshAll() { Promise.all([loadStats(), loadMeetings()]); }

  document.querySelectorAll(".tab-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".tab-btn").forEach(function(b) {
        b.classList.remove("active");
 // FIX: original was `.replace(//g, "text-slate-300 hover: hover:bg-slate-800")`.
 // `//g` is not a valid empty-regex literal in JS - the lexer reads `//` as a
 // line comment unconditionally, so everything through the end of this line
 // (including the real closing `)` and `;`) was silently swallowed. That left
 // the whole <script type="module"> block (this file, before extraction) with
 // an unclosed function call - a hard SyntaxError that prevented the ENTIRE
 // inline script from parsing or running at all, so this page's tab
 // switching, stats, and meeting list never worked in production. Rewritten
 // to mirror the symmetric "activate" line below it (strip the active-tab
 // classes via regex, then append the inactive-tab classes as a literal
 // string) rather than chaining a second .replace().
 b.className = b.className.replace(/bg-violet-600.*?rounded-md/g, "") + " text-slate-300 hover: hover:bg-slate-800";
      });
      btn.classList.add("active");
 btn.className = btn.className.replace(/text-slate-300 hover: hover:bg-slate-800/g, "") + " bg-violet-600 rounded-md";
      currentTab = btn.dataset.tab;
      loadMeetings();
    });
  });

  var ia = document.querySelector(".tab-btn.active");
 if (ia) ia.className = ia.className.replace("text-slate-300 hover: hover:bg-slate-800", "").replace("rounded-md", "") + " bg-violet-600 rounded-md";

  // Initialize immediately with cached user data
  refreshAll();
})();
