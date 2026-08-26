"""
services/python_engine/pipeline.py

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
from typing import Any, Dict, Optional

from utils.logger_util import log_with_type

from .whisper_engine import WhisperEngine, parse_ai_config, resolve_audio_path
from .resemblyzer_diarizer import ResemblyzerDiarizer
from .storage_output import save_diarization_result
from .audio_preprocess import AudioPreprocessor

__version__ = "1.0.0"


def _emit_progress(pct: int, stage: str) -> None:
    """Emit a lightweight machine-readable progress line for the Node runner.

    Format: PROGRESS <pct> <stage>   (never large data)
    The runner turns these into a single-line progress bar.
    """
    pct = int(max(0, min(100, pct)))
    print(f"PROGRESS {pct} {stage}", flush=True)


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
    model_size: str = "base",
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

    # STEP 4/5: preprocess audio (loudnorm + denoise) and detect per-participant
    # channels (stereo L/R == 2 speakers). Falls back to the original on failure.
    prep_info: Dict[str, Any] = {}
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
    except Exception as exc:
        log_with_type("warning", f"python_engine: preprocessing failed ({exc}) - using original audio", "PYTHON_ENGINE")
        prep_info = {}
        channel_files = None

    def whisper_progress(pct):
        # Map transcription 0-100 -> overall 10-65
        _emit_progress(10 + int(pct * 0.55), "Transcribing")

    transcript = None
    diarization: List[Dict[str, Any]] = []
    diar_available = False
    diar_error = None
    words: List[Dict[str, Any]] = []

    # ==================================================================
    # STEP 5 (preferred): per-participant audio channels available ->
    # transcribe EACH CHANNEL independently and merge by timestamp.
    # Diarization is SKIPPED entirely - real per-mic audio is more accurate
    # than any diarization model (this is how Teams captions are generated).
    # ==================================================================
    if not transcript and channel_files:
        try:
            from .channel_transcriber import transcribe_channels
            log_with_type("info", "python_engine: per-participant channels detected -> transcribing each channel (no diarization)", "PYTHON_ENGINE")
            ch_result = transcribe_channels(
                channel_files,
                model_size=os.getenv("PYTHON_ENGINE_MODEL_CHANNELS") or "small",
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
        except Exception as exc:
            log_with_type("warning", f"python_engine: channel transcription failed ({exc}) -> falling back", "PYTHON_ENGINE")
            transcript = None

    # ==================================================================
    # STEP 2/3/4/5: preferred path - WhisperX word-level alignment +
    # pyannote diarization with FORCED 2 speakers + domain initial_prompt.
    # Falls back to faster-whisper + Resemblyzer if whisperx is unavailable.
    # ==================================================================
    use_whisperx = str(
        config.get("use_whisperx", os.getenv("PYTHON_ENGINE_USE_WHISPERX", "1"))
    ).lower() not in ("0", "false", "no")

    if not transcript and use_whisperx:
        try:
            from .whisperx_engine import WhisperXEngine
            log_with_type("info", "python_engine: attempting WhisperX path (preferred)", "PYTHON_ENGINE")

            wx_model = config.get("model_size") or os.getenv("PYTHON_ENGINE_MODEL_WHISPERX") or "large-v3"
            subject = config.get("subject")
            wx_model = config.get("model_size") or os.getenv("PYTHON_ENGINE_MODEL_WHISPERX") or "large-v3"
            subject = config.get("subject")
            engine = WhisperXEngine(
                model_size=wx_model,
                device=config.get("device", "auto"),
                language=language,
                num_speakers=n_speakers,
                subject=subject,
                speaker_names=config.get("speaker_names") or ["Speaker 1", "Speaker 2"],
                progress_cb=whisper_progress,
            )
            log_with_type("info", f"python_engine: using WhisperX word-level pipeline (model={wx_model})", "PYTHON_ENGINE")
            transcript = engine.transcribe_and_diarize(audio_path)
            segments = transcript.get("segments", [])
            words = transcript.get("words", []) or []
            language = transcript.get("language") or "en"
            diarization = [
                {"start": s["start"], "end": s["end"], "speaker": s["speaker"]}
                for s in segments
            ]
            diar_available = True
            _emit_progress(70, "Transcription complete")
            log_with_type(
                "info",
                f"python_engine: whisperx done -> {len(segments)} segments, {len(words)} words, lang={language}",
                "PYTHON_ENGINE",
            )
        except Exception as exc:
            transcript = None
            # NOTE: this was logged at "warning" level only, which made WhisperX
            # silently falling back to the coarse legacy path (no word-level
            # speaker turns, segments merged across multiple speaker turns like
            # a single VAD chunk) invisible unless someone was tailing logs.
            # Bump to "error" and include the exception type so missing deps
            # (whisperx not installed) vs missing HF_TOKEN (pyannote gated model)
            # vs actual runtime failures are distinguishable.
            import traceback
            log_with_type(
                "error",
                f"python_engine: whisperx unavailable/failed ({type(exc).__name__}: {exc}) -> "
                f"falling back to faster-whisper + Resemblyzer (segments will be coarser, "
                f"not per-speaker-turn). Trace: {traceback.format_exc(limit=3)}",
                "PYTHON_ENGINE",
            )

    # Fallback path (legacy): faster-whisper transcription, then Resemblyzer
    if not transcript:
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
        except Exception as exc:
            log_with_type("error", f"python_engine: Whisper transcription failed -> {exc}", "PYTHON_ENGINE")
            return {
                "success": False,
                "engine": "python_engine",
                "error": f"Whisper transcription failed: {exc}",
            }

        # Diarize (forced 2 speakers; may degrade to a single speaker)
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
        except Exception as exc:
            diarization = []
            diar_available = False
            diar_error = str(exc)
            log_with_type("error", f"python_engine: diarization failed -> {exc}", "PYTHON_ENGINE")

    labeled_segments = _align_diarization(segments, diarization)
    plain_text = "\n".join(s["text"] for s in segments).strip()
    _emit_progress(92, "Running AI audit")

    # STEP 6: diarization health check (one label >90% of speech = collapsed)
    diar_health = None
    try:
        from .health_check import check_diarization_health
        diar_health = check_diarization_health(labeled_segments)
        if diar_health.get("healthy"):
            log_with_type("info", f"python_engine: diarization health OK -> {diar_health.get('speakers')}", "PYTHON_ENGINE")
        else:
            log_with_type("warning", f"python_engine: DIARIZATION HEALTH CHECK FAILED -> {diar_health.get('reason')}", "PYTHON_ENGINE")
    except Exception as exc:
        log_with_type("warning", f"python_engine: health check error -> {exc}", "PYTHON_ENGINE")

    # ---- AI audit (rubric-driven) using the isolated python_engine audit ----
    audit_result = None
    report_result = None
    if plain_text:
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
        except Exception as exc:
            log_with_type("error", f"python_engine: audit step failed -> {exc}", "PYTHON_ENGINE")
            audit_result = None

        # PDF-style observation report (saved to storage/video_diarization/*.report.*)
        try:
            report_result = audit_svc.process_audit_report(
                plain_text,
                audio_name=os.path.basename(audio_path),
                meeting_id=meeting_id,
                session_id=session_id,
            )
        except Exception as exc:
            log_with_type("error", f"python_engine: report step failed -> {exc}", "PYTHON_ENGINE")
            report_result = None

    # Write the line-by-line speaker-labelled transcript to storage/video_diarization/
    _emit_progress(98, "Saving results")
    output_path = save_diarization_result({
        "success": True,
        "audio_file": os.path.basename(audio_path),
        "language": language,
        "whisper_backend": transcript.get("backend"),
        "diarization_available": diar_available,
        "segments": labeled_segments,
    })
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
        "audit": audit_result,
        "report": report_result,
        "diarization_health": diar_health,
    }