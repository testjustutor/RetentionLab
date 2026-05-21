# AI Engine DAG Orchestrator Architecture

This folder contains the new production-grade orchestration layer
for the meeting intelligence pipeline.

The architecture is designed around:

- Modular execution
- Task isolation
- Safe concurrency
- Dependency graph execution
- AI microservice orchestration
- Future distributed scaling

---

# PIPELINE FLOW

                    ┌─────────────┐
                    │ MEDIA TASK  │
                    └──────┬──────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │ TRANSCRIPTION    │
                 └────────┬─────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
 ┌────────────┐   ┌────────────┐   ┌────────────┐
 │ AUDIT TASK │   │ SUMMARY    │   │ INTEL TASK │
 └────────────┘   └────────────┘   └────────────┘
                          │
                          ▼
                   ┌────────────┐
                   │ TOPICS     │
                   └────────────┘

---

# CORE COMPONENTS

## pipeline_context.py

Shared runtime state container.

Stores:
- generated paths
- transcripts
- audit outputs
- embeddings
- metadata
- execution status

Thread-safe via internal locks.

---

## task_registry.py

Central task definition map.

Defines:
- dependencies
- execution type
- feature flag mapping
- parallel eligibility

---

## dependency_graph.py

Validates:
- dependency completion
- task readiness
- parallel safety

---

## execution_manager.py

Primary DAG runtime executor.

Responsibilities:
- sequential barriers
- thread pool management
- parallel AI execution
- task lifecycle tracking
- failure isolation

---

# TASK LAYER

Each task is independently executable.

Example:

services/engine/tasks/audit/audit_task.py

Each task:
- receives shared PipelineContext
- updates shared artifacts
- remains isolated
- can later become remote worker

---

# CURRENT EXECUTION STRATEGY

SEQUENTIAL:
- media
- transcription

PARALLEL:
- intel
- audit
- summary
- topics

---

# WHY THIS ARCHITECTURE

This architecture avoids:

❌ giant monolithic pipeline files  
❌ tightly coupled AI logic  
❌ blocking execution  
❌ unsafe shared memory usage  
❌ impossible debugging  

And enables:

✅ DAG execution  
✅ modular AI services  
✅ future queue workers  
✅ future Kubernetes scaling  
✅ future Celery/RabbitMQ migration  
✅ parallel AI inference  
✅ production observability  

---

# FUTURE SCALE PATH

Current:
NodeJS -> Python Process -> DAG Tasks

Future:
NodeJS
   ↓
Task Queue (RabbitMQ/Kafka)
   ↓
Distributed Workers
   ├── Media Worker
   ├── Transcription Worker
   ├── Audit Worker
   ├── Summary Worker
   └── Intel Worker

---

# IMPORTANT RUNTIME NOTES

WhisperX + Torch currently run on:
- CPU
- int8 compute
- Python 3.10.11

Node runtime:
- NodeJS v22.19.0
- Puppeteer automation

Mandatory stack:
- torch
- whisperx
- openai-whisper
- huggingface_hub
- ffmpeg

---

# SAFE CONCURRENCY NOTES

Parallel execution starts ONLY after transcription completes.

This avoids:
- GPU contention
- audio race conditions
- transcript mutation conflicts

Current parallel workers are safe because they are:
- read-only consumers of transcript data

---

# MIGRATION SAFETY

Existing:
- variable names
- response formats
- output paths
- Node bridge contracts

remain unchanged.

This ensures:
✅ pythonBridge.js compatibility
✅ test-engine.js compatibility
✅ database compatibility
✅ downstream audit compatibility

---