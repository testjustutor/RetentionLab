/**
 * Renumber migration files in proper dependency order.
 * Run: node database/renumber_migrations.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'migrations');

// Correct dependency order (no FK conflicts when run sequentially)
const ORDER = [
  // Level 0: No dependencies
  { num: '001', name: 'roles' },
  { num: '002', name: 'companies' },
  { num: '003', name: 'permissions' },
  { num: '004', name: 'calendar_providers' },
  { num: '005', name: 'email_logs' },
  { num: '006', name: 'header_configs' },
  { num: '007', name: 'rubric_categories' },

  // Level 1: Depends on Level 0
  { num: '008', name: 'users' },                    // roles, companies
  { num: '009', name: 'departments' },               // companies
  { num: '010', name: 'rubric_indicators' },          // rubric_categories

  // Level 2: Depends on Level 1
  { num: '011', name: 'role_permissions' },           // roles, permissions
  { num: '012', name: 'user_permissions' },           // users, permissions
  { num: '013', name: 'department_members' },         // departments, users
  { num: '014', name: 'meetings' },                   // users
  { num: '015', name: 'user_settings' },              // users
  { num: '016', name: 'header_role_configs' },        // roles
  { num: '017', name: 'header_page_configs' },        // roles
  { num: '018', name: 'header_menu_items' },          // roles
  { num: '019', name: 'calendar_integrations' },      // users
  { num: '020', name: 'calendar_verifications' },     // users
  { num: '021', name: 'calendar_credentials' },       // users
  { num: '022', name: 'google_oauth_credentials' },   // users
  { num: '023', name: 'user_invitations' },           // users
  { num: '024', name: 'subscriptions' },              // companies
  { num: '025', name: 'system_settings' },            // companies
  { num: '026', name: 'admin_rubric_categories' },    // users
  { num: '027', name: 'rubric_assignments' },         // users
  { num: '028', name: 'rubric_audit_log' },           // users

  // Level 3: Depends on Level 2
  { num: '029', name: 'meeting_sessions' },           // meetings
  { num: '030', name: 'participants' },               // meetings
  { num: '031', name: 'meeting_assets' },             // meetings
  { num: '032', name: 'meeting_reviewers' },          // meetings, users
  { num: '033', name: 'meeting_scores' },             // meetings, users
  { num: '034', name: 'meeting_session_scores' },     // meetings, users
  { num: '035', name: 'session_metadata' },           // meetings, users
  { num: '036', name: 'transcripts' },                // meetings
  { num: '037', name: 'next_session_plan' },          // meetings (legacy)
  { num: '038', name: 'session_quality_reports' },    // meetings (legacy)
  { num: '039', name: 'student_learning_impact' },    // meetings (legacy)
  { num: '040', name: 'teacher_coaching_feedback' },  // meetings (legacy)
  { num: '041', name: 'teacher_better_alternatives' },// meetings (legacy)
  { num: '042', name: 'archives' },                   // meetings, users
  { num: '043', name: 'admin_rubric_indicators' },    // admin_rubric_categories
  { num: '044', name: 'participant_sessions' },       // meetings
  { num: '045', name: 'participant_attendance_sessions' }, // meetings, participants

  // Level 4: Depends on Level 3
  { num: '046', name: 'session_snapshot' },           // meeting_sessions
  { num: '047', name: 'session_analysis' },           // meeting_sessions
  { num: '048', name: 'session_learning_impact' },    // meeting_sessions
  { num: '049', name: 'session_parent_summary' },     // meeting_sessions
  { num: '050', name: 'session_coaching_feedback' },  // meeting_sessions
  { num: '051', name: 'session_better_alternatives' },// meeting_sessions
  { num: '052', name: 'session_next_plan' },          // meeting_sessions
  { num: '053', name: 'session_quality_flags' },      // meeting_sessions
  { num: '054', name: 'session_final_evaluation' },   // meeting_sessions
  { num: '055', name: 'ai_audit_results' },           // meetings, rubric_indicators

  // Level 5: Depends on Level 4
  { num: '056', name: 'session_rubric_evaluations' }, // meeting_sessions, rubric_indicators
  { num: '057', name: 'session_rubric_summary' },     // meeting_sessions
];

// Build lookup: old filename -> new filename
const oldFiles = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== '000_comprehensive_schema.js');

// Map old names to new names
const renameMap = {};
for (const entry of ORDER) {
  const oldPattern = `_create_${entry.name}_table.js`;
  const newName = `${entry.num}_create_${entry.name}_table.js`;
  
  const found = oldFiles.find(f => f.includes(entry.name));
  if (found) {
    renameMap[found] = newName;
  } else {
    console.log(`⚠️  No existing file found for: ${entry.name}`);
  }
}

// Check for files not in the order
for (const f of oldFiles) {
  if (!renameMap[f]) {
    console.log(`⚠️  Not in order: ${f}`);
  }
}

// Rename files
console.log('Renaming migration files...\n');
let renamed = 0;
for (const [oldName, newName] of Object.entries(renameMap)) {
  if (oldName === newName) {
    console.log(`   = ${oldName} (already correct)`);
    continue;
  }
  const oldPath = path.join(dir, oldName);
  const newPath = path.join(dir, newName);
  
  if (fs.existsSync(newPath)) {
    console.log(`   ⚠️  SKIP ${oldName} -> ${newName} (target exists)`);
    continue;
  }
  
  fs.renameSync(oldPath, newPath);
  console.log(`   ✓ ${oldName} -> ${newName}`);
  renamed++;
}

console.log(`\n✅ Renamed ${renamed} files`);
console.log('Now run: node -e "const path=require(\'path\');const fs=require(\'fs\');const d=path.resolve(\'database/migrations\');const files=fs.readdirSync(d).filter(f=>f.endsWith(\'.js\')).sort();files.forEach(f=>{try{require(path.join(d,f));console.log(\'OK: \'+f)}catch(e){console.log(\'FAIL: \'+f+\' -> \'+(e.message||\'\').split(\'\\n\')[0].slice(0,80))}});console.log(\'Done\')"');