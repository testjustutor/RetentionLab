# TODO

## Task: Fix transcription + diarization quality to match Teams VTT captions

Context: faster-whisper + Resemblyzer diarization collapsed both 1:1 speakers into SPEAKER_00 and produced more hallucinations than Teams VTT captions for the same session.

- [x] STEP 1 - Force speaker count: pipeline.run_pipeline defaults n_speakers=2; resemblyzer_diarizer strictly uses min(max(n,1),len(feats)) clusters + logs forcing num_speakers=N.
- [x] STEP 2 - Word-level alignment via WhisperX: new services/python_engine/whisperx_engine.py (whisper transcribe -> word align -> pyannote diarization with min/max_speakers=2 -> per-word speaker assignment, majority vote per segment). Installed whisperx. Pipeline prefers this path; falls back to faster-whisper+Resemblyzer when unavailable (PYTHON_ENGINE_USE_WHISPERX=0 to disable).
- [x] STEP 3 - Model upgrade + domain context: WhisperX default model large-v3 (PYTHON_ENGINE_MODEL_WHISPERX); initial_prompt per subject via SUBJECT_PROMPTS map (PYTHON_ENGINE_SUBJECT=math/science/english) with math prompt matching our content. Added keys to .env and .env.example.
- [x] STEP 4 - Audio preprocessing: new audio_preprocess.py - ffmpeg loudnorm volume normalization + noisereduce spectral denoise; writes prep/denoised wav, original untouched; wired as first pipeline step.
- [x] STEP 5 - Per-participant channels: ffprobe channel detection + split_stereo_channels(); when stereo L/R available each channel is transcribed independently (channel_transcriber.py) and merged by timestamp - diarization skipped entirely for these recordings.
- [x] STEP 6 - Diarization health check: new health_check.py computes per-speaker duration share; if one label >90% => unhealthy with reason; controller marks video_processing.status=needs_reprocessing (new model method markNeedsReprocessing) and returns needsReprocessing in the API response.
- [x] STEP 7 - Validation script: scripts/validate_transcription.py <audio.mp3> <captions.vtt> - parses Teams VTT, runs updated pipeline, reports % speaker-label match + WER vs VTT text (jiwer installed).
- [x] All python_engine files compile; controller passes node --check.

## Task: Lock in confirmed session facts + speed optimizations

Confirmed by user: ALL videos are 1:1 tutor-student, exactly 2 speakers, language is English, tutor teaches student. No VTT files exist for other recordings (validation script remains for reference only).

- [x] Language forced to English in all paths (pipeline default + whisper_engine + whisperx_engine) - skips auto-detection for speed and accuracy.
- [x] Role labels: speakers renamed to Tutor / Student instead of SPEAKER_00/01. Tutor = most total talk time (they teach); other = Student. Applied in whisperx path and fallback Resemblyzer path; channel path labels channel 1 = Tutor.
- [x] Speed/quality: condition_on_previous_text=False on all whisper backends (fewer hallucination cascades, faster), initial_prompt domain context also added to faster-whisper fallback path.
- [x] Verified: role labeling maps most-talk-time speaker to Tutor correctly; all python files compile; pipeline imports OK.

## Task: Move video_processing ALTERs into migration 060

- [x] database/migrations/060_create_video_processing_table.js: file_user_id / file_meeting_id / file_session_id now declared directly inside CREATE TABLE (no ALTER).
- [x] models/super_admin/settings/VideoProcessingModel.js: removed ensureColumns() and all runtime ALTER TABLE logic; ensureTable() CREATE TABLE IF NOT EXISTS now mirrors the full migration schema.
- [x] Verified: model + migration pass node --check; live table has all 21 columns incl. file_* ids so existing inserts keep working; zero ensureColumns/ALTER references left in app code.

## Task: Move remaining ALTER-only migrations into base table definitions

- [x] Confirmed 025_create_system_settings_table.js already declares is_editable TINYINT(1) DEFAULT 1 directly in CREATE TABLE.
- [x] Confirmed 010_create_rubric_indicators_table.js already declares benchmark TEXT + requires_video TINYINT(1) directly in CREATE TABLE.
- [x] Deleted 026_add_is_editable_to_system_settings.js and 063_add_benchmark_requires_video_to_rubric_indicators.js (ALTER-only, redundant - effects baked into base CREATE TABLE migrations).
- [x] Verified migration runner (database/reset-db.js) discovers files via readdirSync - no tracking table, so file removal is safe.
- [x] Verified zero references to the deleted files; all 62 remaining migrations pass node --check; zero ALTER TABLE statements remain in the migrations folder.

## Task: Verify video-processing page matches video_processing table schema

- [x] FIXED BUG: makeTrackRec returned snake_case keys (user_id/file_user_id/...) while VideoProcessingModel.saveProcessingRecord reads camelCase (userId/fileUserId/...) -> all tracking columns were inserting as NULL. Rewrote makeTrackRec to emit camelCase keys matching the model exactly.
- [x] Model now uses ALL table columns: saveProcessingRecord/updateProcessingRecord also write video_user_id, video_meeting_type, video_meeting_id, video_session_id, meeting_type; getProcessingHistory returns them.
- [x] Controller populates both id families: file-origin (file_user_id/file_meeting_id/file_session_id + legacy video_* duplicates) and resolved DB ids (user_id/meeting_id/session_id); video_meeting_type says which id the filename carried (session|meeting); meeting_type=teams.
- [x] Frontend Report button now keys off reportJsonExists (file on disk) instead of always-truthy reportJsonUrl.
- [x] Live insert test through the model confirmed every column family populates (file_user_id=1064, video_session_id=247410, user_id, meeting_type=teams, names/title); test row deleted.
- [x] node --check clean on model + controller; running server already had latest code; API correctly returns 401 without a super_admin session (auth working).
