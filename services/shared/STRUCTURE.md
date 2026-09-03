# Services Shared Structure Documentation

## Overview
The `services/shared/` directory contains reusable Python components for business logic. These are shared across different parts of the application.

## Folder Structure

```
services/shared/
├── ai_config.py
├── botManager.js
├── browserManager.js
└── pythonBridge.js
```

## Detailed Documentation

### Note

**All Python database operations now use `database/python_db.py`** (MySQL-only).

The `services/shared/` directory now only contains:
- **ai_config.py** - AI configuration utilities
- **botManager.js** - Bot management (JavaScript)
- **browserManager.js** - Browser management (JavaScript)
- **pythonBridge.js** - Python bridge (JavaScript)

## Migration Complete

✅ **services/shared/database/** - REMOVED
- All functionality migrated to `database/python_db.py`
- All Python files now use MySQL via `database/python_db.py`

✅ **services/shared/config/** - REMOVED
- Was not being used
- `database/python_db.py` reads environment variables directly

## Current Database Architecture

```
Python Controllers/Models
    ↓
database/python_db.py (MySQL connection pooling)
    ↓
MySQL Database
```

## Benefits

✅ **Simplified** - Single database module for all Python code
✅ **MySQL-only** - No Other compatibility overhead
✅ **Direct** - Reads environment variables directly
✅ **Modern** - Connection pooling, context managers, type hints
✅ **Maintainable** - Single source of truth for database connections

## Notes

- All Python database operations use `database/python_db.py`
- Node.js continues to use `database/db.js`
- All database connections are MySQL