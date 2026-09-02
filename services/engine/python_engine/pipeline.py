"""
services/engine/python_engine/pipeline.py

Whisper + Resemblyzer end-to-end pipeline for a single audio file.
Produces a JSON-serializable dict compatible with what a Node bridge expects:

{
  "success": true,
  "engine": "python_engine",
  "version": "1.0.0",
  "audio_file": "<name>",
  "language": "en",
  "segments": [{"start":.., "end":.., "text":"..", "speaker":"SPEAKER_00"}],
  "diarization": [{"start":..,"end":..,"speaker":".."}],
  "plain_text": "...."
}
"""
from __future__ import annotations

import os
import sys

PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import threading
import time
from typing import Any, Dict, Optional


from utils.logger_util import log_with_type

from .whisper_engine import WhisperEngine, parse_ai_config, resolve_audio_path
from .resemblyzer_diarizer import ResemblyzerDiarizer
from .storage_output import save_diarization_result, save_plain_transcript
from .audio_preprocess import AudioPreprocessor

__version__ = "1.0.0"


def _emit_progress(pct: int, stage: str) -> None:
    """Log a lightweight progress update (never large data)."""
    pct = int(max(0, min(100, pct)))
    _LAST_PROGRESS["pct"] = pct
    _LAST_PROGRESS["stage"] = stage
    log_with_type("info", f"[PROGRESS] {pct}% - {stage}", "PYTHON_ENGINE")


# ---- Liveness tracking (so a hung step is obvious in the terminal) ---------
_CURRENT_STEP: Dict[str, Any] = {"name": None, "started": 0.0}
_LAST_PROGRESS: Dict[str, Any] = {"pct": 5, "stage": "Starting"}
_PIPELINE_STARTED = 0.0


def _heartbeat_loop(interval: float = 20.0) -> None:
    """Background watchdog: while a step runs longer than `interval`, log how
    long we've been inside it. A LIVE process keeps emitting this line every
    `interval` seconds; if the last line FREEZES, the process is genuinely
    stuck (or dead) and should be timed out / killed."""
    while True:
        time.sleep(interval)
        step = _CURRENT_STEP.get("name")
        if not step:
            continue
        waited = int(time.time() - _CURRENT_STEP.get("started", time.time()))
        total = int(time.time() - _PIPELINE_STARTED)
        log_with_type(
            "warning",
            f"[HEARTBEAT] still working: '{step}' for {waited}s (total {total}s)",
            "PYTHON_ENGINE",
        )


def _step(step: str, status: str, detail: str = "") -> None:
    """Emit ONE simple text line per pipeline step (STARTED / COMPLETED /
    FAILED / SKIPPED) so each stage is visible in the Node terminal on its own
    line - the runner closes the progress bar before echoing text lines, so
    these never glue onto the percentage line. Also goes to the log file.
    COMPLETED/FAILED lines include how long the step took."""
    global _PIPELINE_STARTED
    msg = f"[STEP] {step} : {status}"
    if status == "STARTED":
        _CURRENT_STEP["name"] = step
        _CURRENT_STEP["started"] = time.time()
        if not _PIPELINE_STARTED:
            _PIPELINE_STARTED = time.time()
    else:
        _CURRENT_STEP["name"] = None
        took = time.time() - _CURRENT_STEP.get("started", time.time())
        if took > 0:
            msg += f" (took {took:.0f}s)"
    if detail:
        msg += f" ({detail})" if "took" not in msg else f" - {detail}"
    log_with_type("info", f"python_engine: {msg}", "PYTHON_ENGINE")


def _align_diarization(segments, diarization):
    """Attach a speaker label to each transcript segment by finding the
    diarization span that overlaps the segment's midpoint."""
    if not diarization:
        return segments
    labeled = []
    for seg in segments:
        mid = (seg["start"] + seg["end"]) / 2.0
        speaker = "Speaker 1"
        for span in diarization:
            end = span.get("end")
            if span["start"] <= mid and (end is None or mid <= end):
                speaker = span["speaker"]
                break
        labeled.append({**seg, "speaker": speaker})
    return labeled


def run_pipeline(
    audio_input: str,
    ai_settings_json: Optional[str] = None,
    model_size: str = "large-v3",
    n_speakers: Optional[int] = None,
) -> Dict[str, Any]:
    """Run Whisper transcription + diarization. Never raises;
    always returns a JSON-friendly dict (on success or graceful degradation).

    NOTE: recordings are always 1:1 tutor-student calls, so diarization is
    forced to exactly 2 speakers (num_speakers=2) instead of relying on
    auto-detection, which was collapsing both speakers into SPEAKER_00.
    """
    # STEP 1: force speaker count (tutor + student) and language (English).
    # Language is confirmed English for all sessions -> skipping auto-detection
    # makes transcription faster AND more accurate (no wrong-language guesses).
    if n_speakers is None:
        n_speakers = 2
    audio_path = resolve_audio_path(audio_input)
    config = parse_ai_config(ai_settings_json)
    n_speakers = int(config.get("n_speakers") or n_speakers or 2)
    # Confirmed: all sessions are in English
    language = config.get("language") or os.getenv("PYTHON_ENGINE_LANGUAGE") or "en"

    if not audio_path or not os.path.exists(audio_path):
        log_with_type("error", f"python_engine: audio file not found -> {audio_input}", "PYTHON_ENGINE")
        return {
            "success": False,
            "engine": "python_engine",
            "error": f"Audio file not found: {audio_input}",
        }

    log_with_type("info", f"python_engine: pipeline started -> {audio_path}", "PYTHON_ENGINE")
    _emit_progress(5, "Starting")

    # Liveness watchdog: refreshes the progress bar every ~20s while a step is
    # running ("still working: '<step>' for Ns"), so a FROZEN bar means the
    # process is genuinely stuck. Daemon thread -> dies with the process.
    threading.Thread(target=_heartbeat_loop, args=(20.0,), daemon=True).start()

    # STEP 4/5: preprocess audio (loudnorm + denoise) and detect per-participant
    # channels (stereo L/R == 2 speakers). Falls back to the original on failure.
    prep_info: Dict[str, Any] = {}
    _step("Audio preprocessing", "STARTED")
    try:
        pre = AudioPreprocessor(
            enabled=str(config.get("preprocess", os.getenv("PYTHON_ENGINE_PREPROCESS", "1"))).lower()
            not in ("0", "false", "no"),
            denoise=str(config.get("denoise", os.getenv("PYTHON_ENGINE_DENOISE", "1"))).lower()
            not in ("0", "false", "no"),
        )
        audio_path, prep_info = pre.preprocess(audio_path)
        if prep_info.get("preprocessed"):
            log_with_type("info", f"python_engine: audio preprocessed -> {os.path.basename(audio_path)} channels={prep_info.get('channels')} split={prep_info.get('split_channels')}", "PYTHON_ENGINE")
        channel_files = (prep_info or {}).get("channel_files") or None
        _step("Audio preprocessing", "COMPLETED", f"channels={prep_info.get('channels', 1)}, split={bool(channel_files)}")
    except Exception as exc:
        log_with_type("warning", f"python_engine: preprocessing failed ({exc}) - using original audio", "PYTHON_ENGINE")
        prep_info = {}
        channel_files = None
        _step("Audio preprocessing", "FAILED", f"{exc} - using original audio")

    def whisper_progress(pct):
        # Map transcription 0-100 -> overall 10-65
        _emit_progress(10 + int(pct * 0.55), "Transcribing")

    transcript = None
    diarization: List[Dict[str, Any]] = []
    diar_available = False
    diar_error = None
    words: List[Dict[str, Any]] = []

    # ==================================================================
    # STEP 0 (highest priority, opt-in): AssemblyAI managed backend.
    # Replaces the local WhisperX + channel-split + Resemblyzer stack.
    # AssemblyAI does transcription + forced-2-speaker diarization (single
    # channel) or per-channel transcription (stereo L/R tutor/student mics)
    # server-side, so the local alignment/channel-split machinery is skipped.
    # Enable with PYTHON_ENGINE_USE_ASSEMBLYAI=1 (or config.use_assemblyai=1).
    # Default OFF -> no behaviour change.
    # ==================================================================
    use_assemblyai = str(
        config.get("use_assemblyai", os.getenv("PYTHON_ENGINE_USE_ASSEMBLYAI", "0"))
    ).lower() not in ("0", "false", "no")

    if not transcript and use_assemblyai:
        # Known names/terms to boost (fixes proper-name errors like
        # "Abir" -> "Abhijit"). Source: aiSettings.word_boost, else env list.
        boost = config.get("word_boost")
        if not boost and os.getenv("PYTHON_ENGINE_WORD_BOOST"):
            boost = [w.strip() for w in os.getenv("PYTHON_ENGINE_WORD_BOOST", "").split(",") if w.strip()]
        _step("AssemblyAI transcription", "STARTED", f"multichannel={bool((prep_info or {}).get('channels', 1) >= 2)}, num_speakers={n_speakers}, word_boost={boost or []}")
        try:
            from .assemblyai_engine import AssemblyAIEngine
            is_multichannel = bool((prep_info or {}).get("channels", 1) >= 2)
            engine = AssemblyAIEngine(
                num_speakers=n_speakers,
                language=language,
                multichannel=is_multichannel,
                speaker_names=config.get("speaker_names") or ["Speaker 1", "Speaker 2"],
                word_boost=boost,
            )
            # NOTE: pass the ORIGINAL prepped (loudnorm/denoised) stereo file,
            # NOT channel_files - AssemblyAI's multichannel=True handles per-channel
            # separation itself, replacing channel_transcriber.py's ffmpeg split.
            result = engine.transcribe_and_diarize(audio_path)
            transcript = result
            segments = result.get("segments", [])
            words = result.get("words", []) or []
            language = result.get("language") or "en"
            diarization = [
                {"start": s["start"], "end": s["end"], "speaker": s["speaker"]}
                for s in segments
            ]
            diar_available = True
            _emit_progress(70, "AssemblyAI transcription complete")
            log_with_type(
                "info",
                f"python_engine: assemblyai done -> {len(segments)} segments, "
                f"{len(words)} words, lang={language}",
                "PYTHON_ENGINE",
            )
            _step("AssemblyAI transcription", "COMPLETED", f"{len(segments)} segments, {len(words)} words")
        except Exception as exc:
            log_with_type(
                "error",
                f"python_engine: assemblyai unavailable/failed "
                f"({type(exc).__name__}: {exc}) -> falling back",
                "PYTHON_ENGINE",
            )
            _step("AssemblyAI transcription", "FAILED", f"{type(exc).__name__}: {exc} - falling back")
            transcript = None

    # ==================================================================
    # STEP 5 (preferred): per-participant audio channels available ->
    # transcribe EACH CHANNEL independently and merge by timestamp.
    # Diarization is SKIPPED entirely - real per-mic audio is more accurate
    # than any diarization model (this is how Teams captions are generated).
    # ==================================================================
    if not transcript and channel_files:
        _step("Channel transcription", "STARTED", f"{len(channel_files)} channels")
        try:
            from .channel_transcriber import transcribe_channels
            log_with_type("info", "python_engine: per-participant channels detected -> transcribing each channel (no diarization)", "PYTHON_ENGINE")
            ch_result = transcribe_channels(
                channel_files,
                # Heaviest-by-default: dedicated env wins over aiSettings so a
                # caller cannot silently downgrade quality (mirrors WhisperX branch).
                model_size=os.getenv("PYTHON_ENGINE_MODEL_CHANNELS")
                or config.get("model_size")
                or "large-v3",
                language=language,
                progress_cb=whisper_progress,
                # Speaker labels: first channel/most talk time = Speaker 1
                speaker_names=config.get("channel_speaker_names") or ["Speaker 1", "Speaker 2"],
            )
            if ch_result and ch_result.get("segments"):
                transcript = {
                    "segments": ch_result["segments"],
                    "words": ch_result.get("words", []),
                    "language": ch_result.get("language") or "en",
                    "backend": "channels",
                    "num_speakers_forced": len(channel_files),
                }
                segments = ch_result["segments"]
                words = ch_result.get("words", []) or []
                language = ch_result.get("language") or "en"
                diarization = [
                    {"start": s["start"], "end": s["end"], "speaker": s["speaker"]}
                    for s in segments
                ]
                diar_available = True  # speakers came from real channels, not a model
                _emit_progress(70, "Channel transcription complete")
                log_with_type("info", f"python_engine: channel transcription done -> {len(segments)} merged segments", "PYTHON_ENGINE")
                _step("Channel transcription", "COMPLETED", f"{len(segments)} merged segments")
        except Exception as exc:
            log_with_type("warning", f"python_engine: channel transcription failed ({exc}) -> falling back", "PYTHON_ENGINE")
            _step("Channel transcription", "FAILED", f"{exc} - falling back")
            transcript = None

    # Fallback path (legacy): faster-whisper transcription, then Resemblyzer
    if not transcript:
        _step("Whisper transcription", "STARTED")
        try:
            from .whisperx_engine import get_initial_prompt

            fallback_names = config.get("speaker_names") or ["Speaker 1", "Speaker 2"]
            whisper = WhisperEngine(
                model_size=config.get("model_size") or model_size,
                device=config.get("device", "auto"),
                language=language,
                progress_cb=whisper_progress,
                initial_prompt=get_initial_prompt(config.get("subject")),
            )
            log_with_type("info", f"python_engine: transcribing via Whisper (model={config.get('model_size') or model_size})", "PYTHON_ENGINE")
            transcript = whisper.transcribe(audio_path)
            segments = transcript.get("segments", [])
            language = transcript.get("language") or "en"
            _emit_progress(66, "Transcription complete")
            log_with_type("info", f"python_engine: whisper done -> {len(segments)} segments, lang={language}, backend={transcript.get('backend')}", "PYTHON_ENGINE")
            _step("Whisper transcription", "COMPLETED", f"{len(segments)} segments")
        except Exception as exc:
            log_with_type("error", f"python_engine: Whisper transcription failed -> {exc}", "PYTHON_ENGINE")
            _step("Whisper transcription", "FAILED", str(exc))
            return {
                "success": False,
                "engine": "python_engine",
                "error": f"Whisper transcription failed: {exc}",
            }

        # Diarize (forced 2 speakers; may degrade to a single speaker)
        _step("Speaker diarization", "STARTED", f"num_speakers={n_speakers}")
        try:
            def diar_progress(pct):
                # Map diarization 0-100 -> overall 70-90
                _emit_progress(70 + int(pct * 0.20), "Diarizing speakers")

            diarizer = ResemblyzerDiarizer(
                n_speakers=n_speakers,
                progress_cb=diar_progress,
            )
            log_with_type("info", "python_engine: diarizing via Resemblyzer", "PYTHON_ENGINE")
            diar = diarizer.diarize(audio_path)
            diarization = diar.get("diarization", [])
            diar_available = diar.get("available", False)
            diar_error = diar.get("error")
            log_with_type("info", f"python_engine: diarization done -> speakers={len(set(s['speaker'] for s in diarization))}, available={diar_available}", "PYTHON_ENGINE")

            # Apply confirmed role labels (Tutor / Student) by talk-time dominance.
            # IMPORTANT: relabel the DIARIZATION SPANS (which carry the real
            # SPEAKER_xx cluster ids), then let _align_diarization map those to the
            # Whisper segments by time overlap. Applying it to the raw Whisper
            # segments instead corrupted every speaker to null.
            try:
                from .whisperx_engine import WhisperXEngine as _WXE
                diarization = _WXE._apply_role_labels(diarization, fallback_names)
                log_with_type("info", f"python_engine: role labels applied -> {sorted(set(s['speaker'] for s in diarization))}", "PYTHON_ENGINE")
            except Exception as exc:
                log_with_type("warning", f"python_engine: role labeling skipped ({exc})", "PYTHON_ENGINE")
            _step("Speaker diarization", "COMPLETED", f"{len(set(s['speaker'] for s in diarization))} speakers, available={diar_available}")
        except Exception as exc:
            diarization = []
            diar_available = False
            diar_error = str(exc)
            log_with_type("error", f"python_engine: diarization failed -> {exc}", "PYTHON_ENGINE")
            _step("Speaker diarization", "FAILED", str(exc))

    # Segments from diarization-backed backends already carry correct per-speaker
    # labels: `channels` (real per-mic audio) and `assemblyai` (real diarization
    # or real channels). Re-deriving a label via midpoint overlap would hit the
    # collision/gap bug (a segment whose midpoint lands in a timing gap gets
    # force-reset to "Speaker 1"), so use them as-is and skip _align_diarization.
    # WhisperX segments are also pre-labelled but their diarization spans are
    # built FROM those same segments, so alignment there is a safe identity;
    # left unchanged to avoid altering that path.
    if transcript and transcript.get("backend") in ("assemblyai", "channels"):
        labeled_segments = segments
    else:
        labeled_segments = _align_diarization(segments, diarization)
    plain_text = "\n".join(s["text"] for s in segments).strip()
    _emit_progress(92, "Running AI audit")

    # STEP 6: diarization health check (one label >90% of speech = collapsed)
    diar_health = None
    _step("Diarization health check", "STARTED")
    try:
        from .health_check import check_diarization_health
        diar_health = check_diarization_health(labeled_segments)
        if diar_health.get("healthy"):
            log_with_type("info", f"python_engine: diarization health OK -> {diar_health.get('speakers')}", "PYTHON_ENGINE")
            _step("Diarization health check", "COMPLETED", f"healthy, speakers={diar_health.get('speakers')}")
        else:
            log_with_type("warning", f"python_engine: DIARIZATION HEALTH CHECK FAILED -> {diar_health.get('reason')}", "PYTHON_ENGINE")
            _step("Diarization health check", "FAILED", diar_health.get("reason") or "unhealthy")
    except Exception as exc:
        log_with_type("warning", f"python_engine: health check error -> {exc}", "PYTHON_ENGINE")
        _step("Diarization health check", "FAILED", str(exc))

    # ---- AI audit (rubric-driven) using the isolated python_engine audit ----
    audit_result = None
    report_result = None
    if plain_text:
        _step("AI audit", "STARTED")
        try:
            meeting_id = config.get("meeting_id")
            session_id = config.get("session_id")
            from .audit import AuditService
            audit_svc = AuditService()
            audit_result = audit_svc.process_audit(
                plain_text,
                meeting_id=meeting_id,
                session_id=session_id,
            )
            log_with_type("info", f"python_engine: audit complete oqi={audit_result.get('oqi_score')}", "PYTHON_ENGINE")
            _step("AI audit", "COMPLETED", f"oqi={audit_result.get('oqi_score')}")
        except Exception as exc:
            log_with_type("error", f"python_engine: audit step failed -> {exc}", "PYTHON_ENGINE")
            _step("AI audit", "FAILED", str(exc))
            audit_result = None

        # PDF-style observation report (saved to storage/video_diarization/*.report.*)
        _step("Observation report", "STARTED")
        try:
            report_result = audit_svc.process_audit_report(
                plain_text,
                audio_name=os.path.basename(audio_path),
                meeting_id=meeting_id,
                session_id=session_id,
            )
            _step("Observation report", "COMPLETED", f"total={report_result.get('total_score')}/{report_result.get('total_marks')}")
        except Exception as exc:
            log_with_type("error", f"python_engine: report step failed -> {exc}", "PYTHON_ENGINE")
            _step("Observation report", "FAILED", str(exc))
            report_result = None

    # Write the line-by-line speaker-labelled transcript to storage/video_diarization/
    _emit_progress(98, "Saving results")
    _step("Save results", "STARTED")
    output_path = None
    plain_output_path = None
    try:
        save_payload = {
            "success": True,
            "audio_file": os.path.basename(audio_path),
            "language": language,
            "whisper_backend": transcript.get("backend"),
            "diarization_available": diar_available,
            "segments": labeled_segments,
            # Same string already computed for the audit step - audio-only text,
            # no speaker labels / timestamps. Reused, never re-derived.
            "plain_text": plain_text,
        }
        output_path = save_diarization_result(save_payload)
        plain_output_path = save_plain_transcript(save_payload)
        _step(
            "Save results",
            "COMPLETED",
            f"diarization={output_path or 'n/a'}, transcript={plain_output_path or 'n/a'}",
        )
    except Exception as exc:
        # Never lose the transcript silently: log + surface it, then continue -
        # the JSON result still carries all segments/words for the caller.
        log_with_type("error", f"python_engine: failed to save results file -> {type(exc).__name__}: {exc}", "PYTHON_ENGINE")
        _step("Save results", "FAILED", f"{type(exc).__name__}: {exc}")
    _emit_progress(100, "Done")

    # ---- Clear completion summary log ---------------------------------------
    try:
        n_speakers = len(set((s.get("speaker") or "none") for s in labeled_segments))
    except Exception:
        n_speakers = 0
    audit_oqi = None
    if audit_result:
        audit_oqi = audit_result.get("oqi_score")
    report_total = None
    report_marks = None
    if report_result:
        report_total = report_result.get("total_score")
        report_marks = report_result.get("total_marks")

    diar_status = ("OK (%d speakers)" % n_speakers) if diar_available else "unavailable"
    audit_status = ("OK (OQI=%s)" % audit_oqi) if audit_oqi is not None else "skipped"
    report_status = ("OK (%s/%s)" % (report_total, report_marks)) if report_total is not None else "n/a"

    log_with_type(
        "info",
        "########## PROCESS COMPLETED ########## "
        "file=%s | transcription=OK | diarization=%s | segments=%d | "
        "AI audit=%s | report=%s | output=%s"
        % (
            os.path.basename(audio_path),
            diar_status,
            len(labeled_segments),
            audit_status,
            report_status,
            output_path or "n/a",
        ),
        "PYTHON_ENGINE",
    )

    return {
        "success": True,
        "engine": "python_engine",
        "version": __version__,
        "audio_file": os.path.basename(audio_path),
        "language": language,
        "whisper_backend": transcript.get("backend"),
        "diarization_available": diar_available,
        "diarization_error": diar_error,
        "segments": labeled_segments,
        "words": words,
        "diarization": diarization,
        "plain_text": plain_text,
        "output_path": output_path,
        "plain_output_path": plain_output_path,
        "audit": audit_result,
        "report": report_result,
        "diarization_health": diar_health,
    }