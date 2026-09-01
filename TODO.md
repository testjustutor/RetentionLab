- [x] COMPLETED: meeting_session_scores FK fix verified. TutorEvaluationService._resolve_admin_indicator_ids dynamically maps master rubric_indicators.id -> admin_rubric_indicators.id (meeting owner -> created_by admin -> same-company admin fallback), no hardcoded ids. Live check: meetings 2/3/4 -> owner 5 -> created_by 2 -> 94 admin copies. Score loop writes admin_indicator_id and skips indicators with no admin copy. py_compile clean.

# TODO — Remove `meeting_scores` table usage (replaced by `meeting_session_scores`)

## Context
The `meeting_scores` table (migration 033) has been removed and replaced by
`meeting_session_scores` (migration 034). All models/controllers that still
reference `meeting_scores` must point at `meeting_session_scores`.

- [x] Add this TODO file
- [x] `models/reviews/MeetingScoresModel.js` — upsert + getScoresByMeeting
- [x] `controllers/reviewers/reviewersController.js` — pass session_id in scoreUpsert
- [x] `models/rubrics/RubricModel.js` — saveMeetingScores + getMeetingReport
- [x] `controllers/scores/scoresController.js` — bulkSave passes session_id
- [x] `models/rubrics/RubricAdminModel.js` — getMeetingReportWithAdmin + calculateAdminWeightedScore
- [x] `models/settings/MeetingSettingsModel.js` — totalReviews count
- [x] `models/settings/OrganizationModel.js` — totalScores count
- [x] Dead inline SQL: `reviewerReviewsController.js`, `reviewerSessionsController.js`, `reviewController.js`
- [x] Verify — node syntax check on all edited files
- [x] Stale comments updated: `auditReportController.js`, `reports/auditReportController.js`, `reviewController.js`

## Notes
- No runtime SQL references `meeting_scores` anymore. Remaining hits are non-runtime:
  - Endpoint/method names for the meeting-level session-score APIs (`get_meeting_scores`,
    `delete_meeting_scores` in `app.py`, `routes/session_scores.py`,
    `controllers/python/python_session_scores_controller.py`) — names only, not table references。
  - `database/manual-seeder/12_seed_meeting_scores.js` — orphan dev seeder that
    inserts into the dropped `meeting_scores` table. It is not wired into the runtime;
    the current session-score seeder is `13_seed_meeting_session_scores.js`. Consider
    deleting `12_seed_meeting_scores.js` (kept out of scope for this fix).
  - `project_structure_only.txt` — historical structure listing./docs。
  - `database/migrations/033...` no longer exists (removed by the user;, ensuring the
    `meeting_scores` table is never created).
