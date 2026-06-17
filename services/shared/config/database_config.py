# root/services/shared/config/database_config.js
"""
Configuration module for database connections and environment settings.
Provides centralized configuration management for database operations across services.

Location: services/shared/config/database_config.py
"""

import os
from pathlib import Path
from typing import Optional
import json

# Get base directories
SERVICES_DIR = Path(__file__).parent.parent.parent
PROJECT_ROOT = SERVICES_DIR.parent
DB_DIR = PROJECT_ROOT

# Environment variables with defaults
DEFAULT_DB_PATH = str(DB_DIR / 'retention_lab.db')
DEFAULT_LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
DEFAULT_TIMEOUT = int(os.getenv('DB_TIMEOUT', '30'))


class DatabaseConfig:
    """
    Centralized database configuration management.
    Supports environment-based configuration for development, testing, and production.
    """
    
    def __init__(
        self,
        db_path: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
        check_same_thread: bool = False,
        isolation_level: str = 'DEFERRED',
        log_level: str = DEFAULT_LOG_LEVEL
    ):
        """
        Initialize database configuration.
        
        Args:
            db_path: Path to SQLite database (defaults to retention_lab.db)
            timeout: Connection timeout in seconds
            check_same_thread: SQLite same-thread safety flag
            isolation_level: Transaction isolation level
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        self.db_path = db_path or DEFAULT_DB_PATH
        self.timeout = timeout
        self.check_same_thread = check_same_thread
        self.isolation_level = isolation_level
        self.log_level = log_level
        self.environment = self._detect_environment()
        
        # Validate database path exists or can be created
        self._validate_db_path()
    
    def _detect_environment(self) -> str:
        """Detect current environment (development, testing, production)."""
        env = os.getenv('ENVIRONMENT', 'development').lower()
        if env not in ['development', 'testing', 'production']:
            env = 'development'
        return env
    
    def _validate_db_path(self) -> None:
        """Validate database path and create parent directories if needed."""
        db_file = Path(self.db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)
    
    @property
    def connection_params(self) -> dict:
        """Get connection parameters for sqlite3.connect()."""
        return {
            'timeout': self.timeout,
            'check_same_thread': self.check_same_thread,
            'isolation_level': self.isolation_level
        }
    
    def to_dict(self) -> dict:
        """Export configuration as dictionary."""
        return {
            'db_path': self.db_path,
            'timeout': self.timeout,
            'check_same_thread': self.check_same_thread,
            'isolation_level': self.isolation_level,
            'log_level': self.log_level,
            'environment': self.environment
        }
    
    def __repr__(self) -> str:
        return (
            f"DatabaseConfig(environment='{self.environment}', "
            f"db_path='{self.db_path}', timeout={self.timeout}s)"
        )


# Global configuration instance
_config: Optional[DatabaseConfig] = None


def get_config(reset: bool = False) -> DatabaseConfig:
    """
    Get or create global database configuration.
    
    Args:
        reset: Force create new configuration instance
    
    Returns:
        DatabaseConfig instance
    """
    global _config
    if _config is None or reset:
        _config = DatabaseConfig()
    return _config


def set_config(config: DatabaseConfig) -> None:
    """Set custom database configuration."""
    global _config
    _config = config


def reset_config() -> None:
    """Reset configuration to defaults."""
    global _config
    _config = None
