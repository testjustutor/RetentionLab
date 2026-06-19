"""
Professional integration guide for session scores database operations.
Demonstrates usage of the database layer for Python services.

Location: services/USAGE_GUIDE.md
"""

# Session Scores Database Integration Guide

## 📁 Professional Structure

```
services/
├── shared/
│   ├── config/
│   │   ├── __init__.py
│   │   └── database_config.py          # Configuration management
│   └── database/
│       ├── __init__.py
│       ├── connection_manager.py       # Connection handling & pooling
│       └── session_scores_repository.py # Data access layer
├── engine/
│   ├── intelligence/
│   ├── quality/
│   └── ...                             # Your AI services
└── USAGE_GUIDE.md                      # This file
```

## 🔧 Configuration

### Default Configuration
```python
from services.shared.config import get_config

# Automatically uses:
# - Database: retention_lab.db (from project root)
# - Environment: development/testing/production
# - Timeout: 30 seconds
config = get_config()
```

### Custom Configuration
```python
from services.shared.config import DatabaseConfig, set_config

config = DatabaseConfig(
    db_path='/custom/path/database.db',
    timeout=60,
    log_level='DEBUG'
)
set_config(config)
```

## 📊 Basic Usage

### Single Score Storage
```python
from services.shared.database import get_session_scores_repository

repo = get_session_scores_repository()

# Store AI-generated score
result = repo.upsert(
    meeting_id='meeting_uuid_123',
    session_id=1,
    indicator_id='engagement',
    score=85,
    comment='High engagement detected in discussion segments',
    score_type='AI'  # Marks as AI-generated
)

if result['success']:
    print(f"✓ Score stored: {result['id']}")
else:
    print(f"✗ Error: {result['message']}")
```

### Batch Score Storage
```python
scores = [
    {
        'indicator_id': 'engagement',
        'score': 85,
        'comment': 'High engagement'
    },
    {
        'indicator_id': 'clarity',
        'score': 78,
        'comment': 'Could be clearer'
    },
    {
        'indicator_id': 'participation',
        'score': 90,
        'comment': 'All participants contributed'
    }
]

result = repo.upsert_batch(
    meeting_id='meeting_uuid_123',
    session_id=1,
    scores=scores
)

print(f"✓ Stored: {result['stored']}, Failed: {result['failed']}")
```

### Retrieve Scores
```python
# Get all scores for a session
session_scores = repo.get_by_session('meeting_uuid_123', 1)
for score in session_scores['data']:
    print(f"{score['indicator_name']}: {score['score']}")

# Get all scores for a meeting
meeting_scores = repo.get_by_meeting('meeting_uuid_123')
print(f"Total scores: {meeting_scores['count']}")

# Get scores for specific indicator
indicator_scores = repo.get_by_indicator('meeting_uuid_123', 'engagement')
print(f"Engagement scores across sessions: {indicator_scores['count']}")
```

### Statistics
```python
# Session-level statistics
session_stats = repo.get_statistics('meeting_uuid_123', session_id=1)
stats = session_stats['statistics']
print(f"Avg Score: {stats['avg_score']:.1f}")
print(f"Min/Max: {stats['min_score']}/{stats['max_score']}")

# Meeting-level statistics
meeting_stats = repo.get_statistics('meeting_uuid_123')
stats = meeting_stats['statistics']
print(f"Total scores: {stats['total_scores']}")
print(f"Sessions: {stats['session_count']}")
```

## 🔄 Integration Examples

### Example 1: AI Engagement Analyzer
```python
from services.shared.database import get_session_scores_repository
import logging

logger = logging.getLogger(__name__)

def analyze_engagement(meeting_id, session_id, transcript_data):
    """AI service that analyzes engagement and stores results."""
    
    repo = get_session_scores_repository()
    
    # Your AI analysis logic
    engagement_score = calculate_engagement(transcript_data)
    
    # Store result
    result = repo.upsert(
        meeting_id=meeting_id,
        session_id=session_id,
        indicator_id='engagement',
        score=engagement_score,
        comment='AI analysis of participant engagement',
        score_type='AI'
    )
    
    if result['success']:
        logger.info(f"✓ Engagement score stored: {engagement_score}")
    else:
        logger.error(f"✗ Failed to store score: {result['message']}")
    
    return result
```

### Example 2: Quality Checker Service
```python
from services.shared.database import get_session_scores_repository

def run_quality_checks(meeting_id, session_id, meeting_data):
    """Comprehensive quality analysis with multi-score storage."""
    
    repo = get_session_scores_repository()
    
    # Run multiple AI analyses
    quality_assessments = [
        {
            'indicator_id': 'clarity',
            'score': run_clarity_check(meeting_data),
            'comment': 'Speech clarity assessment'
        },
        {
            'indicator_id': 'structure',
            'score': run_structure_check(meeting_data),
            'comment': 'Meeting structure analysis'
        },
        {
            'indicator_id': 'decision_making',
            'score': run_decision_check(meeting_data),
            'comment': 'Decision quality evaluation'
        }
    ]
    
    # Batch store all
    result = repo.upsert_batch(
        meeting_id=meeting_id,
        session_id=session_id,
        scores=quality_assessments
    )
    
    return result
```

### Example 3: Post-Processing Dashboard Data
```python
def get_meeting_summary(meeting_id):
    """Fetch all quality metrics for dashboard display."""
    
    repo = get_session_scores_repository()
    
    # Get all scores and stats
    all_scores = repo.get_by_meeting(meeting_id)
    stats = repo.get_statistics(meeting_id)
    
    # Prepare dashboard data
    dashboard_data = {
        'meeting_id': meeting_id,
        'summary': stats['statistics'],
        'sessions': group_by_session(all_scores['data'])
    }
    
    return dashboard_data
```

## 🛡️ Error Handling

```python
from services.shared.database import get_session_scores_repository
import logging

logger = logging.getLogger(__name__)

def safe_store_score(meeting_id, session_id, indicator_id, score):
    """Store score with comprehensive error handling."""
    
    try:
        # Validate inputs
        if not all([meeting_id, session_id is not None, indicator_id]):
            raise ValueError("Missing required parameters")
        
        if not 0 <= score <= 100:
            raise ValueError("Score must be between 0-100")
        
        # Store
        repo = get_session_scores_repository()
        result = repo.upsert(
            meeting_id=meeting_id,
            session_id=session_id,
            indicator_id=indicator_id,
            score=score
        )
        
        if not result['success']:
            logger.error(f"Storage failed: {result['message']}")
            raise Exception(result['message'])
        
        return result
    
    except ValueError as e:
        logger.warning(f"Invalid input: {str(e)}")
        return {'success': False, 'message': str(e)}
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {'success': False, 'message': str(e)}
```

## 🔌 Direct API Integration

The stored data is accessible via Node.js endpoints:

```
POST   /api/scores/session              # Store single score
POST   /api/scores/session              # (from API with full data)
GET    /api/scores/session/:id/:sessionId  # Retrieve scores
DELETE /api/scores/session/meeting/:id     # Clear meeting scores
```

## 📝 Database Schema Reference

```sql
CREATE TABLE meeting_session_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT NOT NULL,
    session_id INTEGER NOT NULL,
    indicator_id TEXT NOT NULL,
    reviewer_id INTEGER,
    score INTEGER DEFAULT 0,
    score_type TEXT CHECK(score_type IN ('AI', 'MANUAL')) DEFAULT 'AI',
    comment TEXT,
    scored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meeting_sessions(meeting_id),
    FOREIGN KEY (indicator_id) REFERENCES rubric_indicators(indicator_id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    UNIQUE(meeting_id, session_id, indicator_id)
)
```

## 🚀 Performance Tips

1. **Batch Operations**: Use `upsert_batch()` for multiple scores
2. **Transactions**: Context managers auto-handle commits/rollbacks
3. **Indexes**: Database has indexes on meeting_id + session_id
4. **Connection Pooling**: Reuse `get_session_scores_repository()`

## 📚 API Reference

See individual module docstrings for detailed method signatures:
- `services/shared/config/database_config.py` - Configuration
- `services/shared/database/connection_manager.py` - Connections
- `services/shared/database/session_scores_repository.py` - Operations
