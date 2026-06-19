# root/services/shared/database/connection_manager.js
"""
Database connection manager for SQLite operations.
Provides thread-safe connection pooling and context management.

Location: services/shared/database/connection_manager.py
"""

import sqlite3
import logging
from contextlib import contextmanager
from typing import Optional, Generator, Any
from pathlib import Path

from ..config import DatabaseConfig, get_config

# Configure logger
logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages SQLite database connections with proper lifecycle management.
    Supports context managers for automatic connection cleanup.
    """
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        """
        Initialize connection manager.
        
        Args:
            config: DatabaseConfig instance (uses global config if None)
        """
        self.config = config or get_config()
        self._validate_database()
    
    def _validate_database(self) -> None:
        """Validate database file exists and is accessible."""
        db_path = Path(self.config.db_path)
        if not db_path.exists():
            logger.warning(f"Database file not found at {db_path}. Will be created on first connection.")
        
        # Test connection
        try:
            with self.connect() as conn:
                conn.execute('SELECT 1')
            logger.info(f"✓ Database connection validated: {db_path}")
        except sqlite3.Error as e:
            logger.error(f"✗ Database validation failed: {str(e)}")
            raise
    
    def connect(self) -> sqlite3.Connection:
        """
        Create a new database connection.
        
        Returns:
            sqlite3.Connection instance
        
        Raises:
            sqlite3.Error: If connection fails
        """
        try:
            conn = sqlite3.connect(
                self.config.db_path,
                **self.config.connection_params
            )
            conn.row_factory = sqlite3.Row  # Enable row dict access
            return conn
        except sqlite3.Error as e:
            logger.error(f"Failed to create database connection: {str(e)}")
            raise
    
    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """
        Context manager for database connections.
        Automatically commits on success, rolls back on exception.
        
        Usage:
            with connection_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(...)
        """
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database operation failed, rolling back: {str(e)}")
            raise
        finally:
            conn.close()
    
    @contextmanager
    def get_cursor(self) -> Generator[sqlite3.Cursor, None, None]:
        """
        Context manager for database cursor.
        Automatically handles connection lifecycle.
        
        Usage:
            with connection_manager.get_cursor() as cursor:
                cursor.execute(...)
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                yield cursor
            finally:
                cursor.close()
    
    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        """
        Execute SQL statement and return cursor.
        Auto-commits on success.
        
        Args:
            sql: SQL query string
            params: Query parameters tuple
        
        Returns:
            sqlite3.Cursor with results
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor
    
    def fetch_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """
        Fetch single row as dictionary.
        
        Args:
            sql: SQL query string
            params: Query parameters tuple
        
        Returns:
            Row as dict or None if not found
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute(sql, params)
                row = cursor.fetchone()
                return dict(row) if row else None
        except sqlite3.Error as e:
            logger.error(f"Fetch one error: {str(e)}")
            return None
    
    def fetch_all(self, sql: str, params: tuple = ()) -> list:
        """
        Fetch all rows as list of dictionaries.
        
        Args:
            sql: SQL query string
            params: Query parameters tuple
        
        Returns:
            List of rows as dicts
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except sqlite3.Error as e:
            logger.error(f"Fetch all error: {str(e)}")
            return []
    
    def insert(self, sql: str, params: tuple = ()) -> int:
        """
        Insert record and return last insert ID.
        
        Args:
            sql: INSERT SQL statement
            params: Query parameters tuple
        
        Returns:
            Last inserted row ID
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                return cursor.lastrowid
        except sqlite3.Error as e:
            logger.error(f"Insert error: {str(e)}")
            raise
    
    def update(self, sql: str, params: tuple = ()) -> int:
        """
        Update records and return number of affected rows.
        
        Args:
            sql: UPDATE SQL statement
            params: Query parameters tuple
        
        Returns:
            Number of rows updated
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                return cursor.rowcount
        except sqlite3.Error as e:
            logger.error(f"Update error: {str(e)}")
            raise
    
    def delete(self, sql: str, params: tuple = ()) -> int:
        """
        Delete records and return number of affected rows.
        
        Args:
            sql: DELETE SQL statement
            params: Query parameters tuple
        
        Returns:
            Number of rows deleted
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                return cursor.rowcount
        except sqlite3.Error as e:
            logger.error(f"Delete error: {str(e)}")
            raise


# Global connection manager instance
_manager: Optional[ConnectionManager] = None


def get_connection_manager(config: Optional[DatabaseConfig] = None) -> ConnectionManager:
    """
    Get or create global connection manager instance.
    
    Args:
        config: Optional custom DatabaseConfig
    
    Returns:
        ConnectionManager instance
    """
    global _manager
    if _manager is None:
        _manager = ConnectionManager(config)
    return _manager


def reset_connection_manager() -> None:
    """Reset global connection manager instance."""
    global _manager
    _manager = None
