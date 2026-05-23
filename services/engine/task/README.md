# AI TASK EXECUTION LAYER

This directory contains isolated executable AI pipeline tasks.

Each task acts like an independent microservice worker.

---

# DESIGN PRINCIPLES

Each task must:

✅ receive shared PipelineContext  
✅ be independently executable  
✅ avoid mutating unrelated state  
✅ support future queue execution  
✅ support future containerization  
✅ support isolated debugging  

---

# CURRENT TASKS

## media/

Responsible for:
- FFmpeg extraction
- WAV conversion
- media validation
- audio caching

Produces:
- audio_path

---

## transcription/

Responsible for:
- WhisperX decoding
- alignment
- diarization normalization
- transcript formatting
- analytics generation

Produces:
- transcript_path
- labeled_transcript
- talk_ratio
- diarization_data

---

## intel/

Responsible for:
- sentiment analysis
- vector embeddings
- local NLP intelligence

Produces:
- sentiment_path
- vector_path

---

## audit/

Responsible for:
- rubric evaluation
- AI scoring
- OQI generation

Produces:
- audit_json_path
- oqi_score

---

## summary/

Responsible for:
- meeting summarization
- key point extraction
- AI report generation

Produces:
- summary_path

---

## topics/

Responsible for:
- chronological clustering
- conversation segmentation
- thematic grouping

Produces:
- topic clusters

---

# EXECUTION MODEL

Sequential:
1. media
2. transcription

Parallel:
3. intel
4. audit
5. summary
6. topics

---

# FUTURE EVOLUTION

Current:
Local Python Tasks

Future:
- Celery workers
- RabbitMQ workers
- Kubernetes Jobs
- Ray distributed execution
- GPU worker pools
- remote AI inference nodes

---

# WHY TASK ISOLATION MATTERS

Without isolation:
❌ giant unmaintainable pipeline  
❌ hard debugging  
❌ impossible scaling  
❌ shared-state corruption  
❌ blocking AI execution  

With isolation:
✅ clean architecture  
✅ AI worker scaling  
✅ better observability  
✅ safer concurrency  
✅ easier testing  

---

# THREAD SAFETY

All tasks operate through:
PipelineContext

PipelineContext contains:
- internal locks
- execution tracking
- centralized state management

This prevents:
- race conditions
- shared memory corruption
- unsafe parallel writes

---

# IMPORTANT COMPATIBILITY NOTE

Existing NodeJS bridge contracts remain unchanged.

Compatible with:
- pythonBridge.js
- test-engine.js
- MeetingAssetsModel
- existing database schemas

No API response changes required.

---