"""
Python Database Connection Module
Provides MySQL database connection pooling and query interface.
Similar to database/db.js but for Python code.

Location: database/python_db.py
"""

import mysql.connector
from mysql.connector import pooling
from typing import Optional, Dict, Any, List
import logging
from contextlib import contextmanager
import os

# Configure logger
logger = logging.getLogger(__name__)

# Global connection pool
_pool: Optional[pooling.MySQLConnectionPool] = None


def init_pool(
    host: Optional[str] = None,
    port: Optional[int] = None,
    user: Optional[str] = None,
    password: Optional[str] = None,
    database: Optional[str] = None,
    pool_size: int = 10
) -> pooling.MySQLConnectionPool:
    """
    Initialize MySQL connection pool.
    Reads configuration from environment variables if not provided.
    
    Args:
        host: Database host (defaults to DB_HOST env var or 'localhost')
        port: Database port (defaults to DB_PORT env var or 3306)
        user: Database user (defaults to DB_USER env var or 'root')
        password: Database password (defaults to DB_PASSWORD env var or '')
        database: Database name (defaults to DB_NAME env var or 'retention_lab')
        pool_size: Connection pool size (defaults to DB_POOL_SIZE env var or 10)
    
    Returns:
        MySQLConnectionPool instance
    """
    global _pool
    
    # Read from environment variables if not provided
    host = host or os.getenv('DB_HOST', 'localhost')
    port = port or int(os.getenv('DB_PORT', '3306'))
    user = user or os.getenv('DB_USER', 'root')
    password = password or os.getenv('DB_PASSWORD', '')
    database = database or os.getenv('DB_NAME', 'retention_lab')
    pool_size = pool_size or int(os.getenv('DB_POOL_SIZE', '10'))
    
    try:
        _pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name='retention_lab_pool',
            pool_size=pool_size,
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            autocommit=False,  # We'll manage transactions manually
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
        
        # Test connection
        conn = _pool.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.close()
        conn.close()
        
        logger.info(f"✓ MySQL connection pool initialized: {host}:{port}/{database}")
        return _pool
    
    except Exception as e:
        logger.error(f"✗ MySQL connection pool initialization failed: {str(e)}")
        raise


def get_pool() -> pooling.MySQLConnectionPool:
    """
    Get or create global connection pool.
    Reads configuration from environment variables.
    
    Returns:
        MySQLConnectionPool instance
    """
    global _pool
    if _pool is None:
        _pool = init_pool()
    return _pool


def get_connection():
    """
    Get a connection from the pool.
    
    Returns:
        MySQLConnection instance
    """
    pool = get_pool()
    return pool.get_connection()


@contextmanager
def get_cursor():
    """
    Context manager for database cursor.
    Automatically handles connection lifecycle.
    
    Usage:
        with get_cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = %s", (1,))
            result = cursor.fetchone()
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)  # Return rows as dictionaries
    
    try:
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database operation failed, rolling back: {str(e)}")
        raise
    finally:
        cursor.close()
        conn.close()


def execute(sql: str, params: tuple = ()) -> int:
    """
    Execute SQL statement (INSERT, UPDATE, DELETE).
    
    Args:
        sql: SQL query string
        params: Query parameters tuple
    
    Returns:
        Number of affected rows
    """
    with get_cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.rowcount


def fetch_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    """
    Fetch single row as dictionary.
    
    Args:
        sql: SQL query string
        params: Query parameters tuple
    
    Returns:
        Row as dict or None if not found
    """
    try:
        with get_cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchone()
    except Exception as e:
        logger.error(f"Fetch one error: {str(e)}")
        return None


def fetch_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """
    Fetch all rows as list of dictionaries.
    
    Args:
        sql: SQL query string
        params: Query parameters tuple
    
    Returns:
        List of rows as dicts
    """
    try:
        with get_cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Fetch all error: {str(e)}")
        return []


def insert(sql: str, params: tuple = ()) -> int:
    """
    Insert record and return last insert ID.
    
    Args:
        sql: INSERT SQL statement
        params: Query parameters tuple
    
    Returns:
        Last inserted row ID
    """
    with get_cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.lastrowid


def update(sql: str, params: tuple = ()) -> int:
    """
    Update records and return number of affected rows.
    
    Args:
        sql: UPDATE SQL statement
        params: Query parameters tuple
    
    Returns:
        Number of rows updated
    """
    return execute(sql, params)


def delete(sql: str, params: tuple = ()) -> int:
    """
    Delete records and return number of affected rows.
    
    Args:
        sql: DELETE SQL statement
        params: Query parameters tuple
    
    Returns:
        Number of rows deleted
    """
    return execute(sql, params)


# ─── MySQL Database Interface ──────────────────────────────────────────────

class MySQLDB:
    """
    MySQL database interface.
    Provides simple methods for database operations.
    """
    
    @staticmethod
    def fetch_one(sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        """Fetch single row as dictionary."""
        return fetch_one(sql, params)
    
    @staticmethod
    def fetch_all(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
        """Fetch all rows as list of dictionaries."""
        return fetch_all(sql, params)
    
    @staticmethod
    def execute(sql: str, params: tuple = ()) -> int:
        """Execute SQL and return affected rows."""
        return execute(sql, params)
    
    @staticmethod
    def insert(sql: str, params: tuple = ()) -> int:
        """Insert record and return last insert ID."""
        return insert(sql, params)
    
    @staticmethod
    def update(sql: str, params: tuple = ()) -> int:
        """Update records and return affected rows."""
        return execute(sql, params)
    
    @staticmethod
    def delete(sql: str, params: tuple = ()) -> int:
        """Delete records and return affected rows."""
        return execute(sql, params)


# Create db object
db = MySQLDB()


# ─── Utilities ──────────────────────────────────────────────────────────────

def close_db() -> None:
    """
    Close all connections in the pool.
    Note: MySQL connection pools don't have a close method in the same way.
    This is a placeholder for API compatibility.
    """
    global _pool
    _pool = None
    logger.info("✓ Database connection pool reference cleared")


def init_db() -> bool:
    """
    Initialize database connection.
    Reads configuration from environment variables.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        get_pool()
        return True
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        return False


def migrate_db() -> None:
    """
    Run database migrations.
    Placeholder for future implementation.
    """
    logger.info("No pending migrations for MySQL")


# ─── Module Exports ─────────────────────────────────────────────────────────

__all__ = [
    'db',
    'init_pool',
    'get_pool',
    'get_connection',
    'get_cursor',
    'execute',
    'fetch_one',
    'fetch_all',
    'insert',
    'update',
    'delete',
    'close_db',
    'init_db',
    'migrate_db',
    'MySQLDB'
]