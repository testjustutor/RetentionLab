# PIPELINE MIGRATION GUIDE
Legacy Monolith → DAG Microservice Orchestrator

---

# WHAT CHANGED

OLD:
services/engine/engine_main.py

Contained:
- media extraction
- transcription
- audit
- summary
- topics
- intel
- orchestration
- state management

inside ONE giant file.

---

NEW:

The pipeline is now split into:

services/engine/

├── orchestrator/
│   ├── engine_main.py
│   ├── execution_manager.py
│   ├── dependency_graph.py
│   ├── pipeline_context.py
│   └── task_registry.py
│
├── tasks/
│   ├── media/
│   ├── transcription/
│   ├── intel/
│   ├── audit/
│   ├── summary/
│   └── topics/

---

# WHY THIS CHANGE

The old architecture had:

❌ giant monolithic orchestration  
❌ difficult debugging  
❌ impossible scaling  
❌ no safe concurrency  
❌ tightly coupled AI systems  
❌ difficult feature isolation  

The new architecture provides:

✅ DAG execution  
✅ task isolation  
✅ safe concurrency  
✅ future distributed execution  
✅ cleaner debugging  
✅ microservice-ready structure  

---

# IMPORTANT:
# NODEJS COMPATIBILITY REMAINS IDENTICAL

NO CHANGES REQUIRED IN:

✅ pythonBridge.js  
✅ test-engine.js  
✅ routes  
✅ models  
✅ database schema  
✅ frontend calls  

Because:

services/engine/engine_main.py
still exists as the entrypoint wrapper.

---

# EXECUTION FLOW

NodeJS
   ↓
pythonBridge.js
   ↓
services/engine/engine_main.py
   ↓
orchestrator/engine_main.py
   ↓
ExecutionManager
   ↓
Task DAG Execution

---

# PARALLEL EXECUTION MODEL

Sequential barrier:

1. media
2. transcription

After transcription completes:

Parallel workers launch:
- intel
- audit
- summary
- topics

---

# WHY TRANSCRIPTION REMAINS SEQUENTIAL

WhisperX:
- CPU heavy
- memory intensive
- alignment sensitive

Running parallel AI tasks BEFORE transcription completes could:
❌ corrupt state
❌ starve CPU
❌ create race conditions

Therefore transcription acts as:
GLOBAL PIPELINE BARRIER

---

# THREAD SAFETY MODEL

Shared state exists ONLY inside:
PipelineContext

PipelineContext uses:
- threading.Lock()
- centralized updates
- execution tracking

This prevents:
- race conditions
- parallel mutation issues
- task corruption

---

# FUTURE SCALING PATH

CURRENT:
Single Python Process

FUTURE:
Distributed Workers

Example:

NodeJS
  ↓
RabbitMQ
  ↓
Worker Pool
  ├── Media Worker
  ├── Transcription Worker
  ├── Audit Worker
  ├── Summary Worker
  └── Intel Worker

This architecture already supports that migration.

---

# FEATURE FLAGS

Current flags:

media_extraction
transcription
intel_extraction
ai_audit
summary_generation
topic_clustering

Mapped automatically through:
task_registry.py

---

# SAFE FAILURE ISOLATION

If one parallel worker fails:

Example:
- summary fails

Then:
✅ audit still completes
✅ intel still completes
✅ topics still complete

This was impossible in the old monolith.

---

# OUTPUT CONTRACTS REMAIN IDENTICAL

Returned JSON structure remains:

{
  "success": true,
  "meeting_id": "...",
  "audio_path": "...",
  "transcript_path": "...",
  "sentiment_path": "...",
  "vector_path": "...",
  "audit_json_path": "...",
  "summary_path": "...",
  "oqi_score": 0
}

No frontend changes required.

---

# IMPORTANT PYTHON ENVIRONMENT NOTES

Required:
- Python 3.10.11

Mandatory libraries:
- torch
- whisperx
- openai-whisper
- huggingface_hub

External dependency:
- ffmpeg

---

# IMPORTANT NODE ENVIRONMENT NOTES

Required:
- NodeJS v22.19.0
- Puppeteer

No runtime contract changes required.

---

# DEPLOYMENT BENEFITS

The new architecture enables:

✅ Kubernetes
✅ Celery
✅ RabbitMQ
✅ Ray
✅ GPU workers
✅ autoscaling
✅ observability
✅ distributed inference

without rewriting the business logic.

---