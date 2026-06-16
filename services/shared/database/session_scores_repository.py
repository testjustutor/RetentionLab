# root/services/shared/database/session_scores_repository.js
"""
Repository for meeting session scores operations.
Implements data access layer for session-level indicator scoring.

Location: services/shared/database/session_scores_repository.py
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from .connection_manager import get_connection_manager, ConnectionManager
from ..config import DatabaseConfig, get_config

# Configure logger
logger = logging.getLogger(__name__)


class SessionScoresRepository:
    """
    Data access object for meeting session scores.
    Handles CRUD operations for meeting_session_scores table.
    """
    
    # Table and column definitions
    TABLE_NAME = 'meeting_session_scores'
    COLUMNS = [
        'id', 'meeting_id', 'session_id', 'indicator_id', 'reviewer_id',
        'score', 'score_type', 'comment', 'scored_at'
    ]
    
    def __init__(self, conn_manager: Optional[ConnectionManager] = None):
        """
        Initialize repository.
        
        Args:
            conn_manager: ConnectionManager instance (uses global if None)
        """
        self.conn_manager = conn_manager or get_connection_manager()
        self.table = self.TABLE_NAME
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    def upsert(
        self,
        meeting_id: str,
        session_id: int,
        indicator_id: str,
        score: int,
        comment: Optional[str] = None,
        score_type: str = 'AI',
        reviewer_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Insert or update a session score.
        Uses SQLite's ON CONFLICT for upsert behavior.
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
            indicator_id: Rubric indicator ID
            score: Score value (typically 0-100)
            comment: Optional explanation/comment
            score_type: 'AI' or 'MANUAL' (default: 'AI')
            reviewer_id: Optional user/reviewer ID
        
        Returns:
            Dict with success status, ID, and message
        """
        if not all([meeting_id, session_id is not None, indicator_id]):
            return {
                'success': False,
                'message': 'Missing required: meeting_id, session_id, indicator_id'
            }
        
        try:
            sql = f"""
                INSERT INTO {self.table}
                (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id, scored_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(meeting_id, session_id, indicator_id) DO UPDATE SET
                    score = excluded.score,
                    comment = excluded.comment,
                    score_type = excluded.score_type,
                    reviewer_id = excluded.reviewer_id,
                    scored_at = CURRENT_TIMESTAMP
            """
            
            params = (meeting_id, session_id, indicator_id, int(score), score_type, comment, reviewer_id)
            last_id = self.conn_manager.insert(sql, params)
            
            self.logger.info(
                f"✓ Score upserted: meeting={meeting_id}, session={session_id}, "
                f"indicator={indicator_id}, score={score}"
            )
            
            return {
                'success': True,
                'id': last_id,
                'meeting_id': meeting_id,
                'session_id': session_id,
                'indicator_id': indicator_id,
                'message': 'Score stored successfully'
            }
        
        except Exception as e:
            self.logger.error(f"Upsert failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }
    
    def upsert_batch(
        self,
        meeting_id: str,
        session_id: int,
        scores: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Insert or update multiple session scores in single transaction.
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
            scores: List of score dicts with keys:
                - indicator_id (required)
                - score (required, default 0)
                - comment (optional)
                - score_type (optional, default 'AI')
                - reviewer_id (optional)
        
        Returns:
            Dict with success status, count of stored/failed
        """
        if not meeting_id or session_id is None or not scores:
            return {
                'success': False,
                'stored': 0,
                'failed': 0,
                'message': 'Invalid parameters'
            }
        
        stored = 0
        failed = 0
        errors = []
        
        try:
            for score_data in scores:
                try:
                    indicator_id = score_data.get('indicator_id')
                    if not indicator_id:
                        failed += 1
                        errors.append('Missing indicator_id')
                        continue
                    
                    result = self.upsert(
                        meeting_id=meeting_id,
                        session_id=session_id,
                        indicator_id=indicator_id,
                        score=score_data.get('score', 0),
                        comment=score_data.get('comment'),
                        score_type=score_data.get('score_type', 'AI'),
                        reviewer_id=score_data.get('reviewer_id')
                    )
                    
                    if result['success']:
                        stored += 1
                    else:
                        failed += 1
                        errors.append(result.get('message', 'Unknown error'))
                
                except Exception as e:
                    failed += 1
                    errors.append(str(e))
            
            self.logger.info(f"✓ Batch upsert: {stored} stored, {failed} failed")
            
            return {
                'success': failed == 0,
                'stored': stored,
                'failed': failed,
                'errors': errors if errors else None,
                'message': f'Stored {stored} scores with {failed} failures'
            }
        
        except Exception as e:
            self.logger.error(f"Batch upsert failed: {str(e)}")
            return {
                'success': False,
                'stored': 0,
                'failed': len(scores),
                'message': f'Batch error: {str(e)}'
            }
    
    def get_by_session(self, meeting_id: str, session_id: int) -> Dict[str, Any]:
        """
        Retrieve all scores for a specific session with rubric details.
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
        
        Returns:
            Dict with success status and list of scores
        """
        if not meeting_id or session_id is None:
            return {
                'success': False,
                'data': [],
                'count': 0
            }
        
        try:
            sql = f"""
                SELECT 
                    s.*,
                    i.name AS indicator_name,
                    c.name AS category_name,
                    c.weight AS category_weight
                FROM {self.table} s
                LEFT JOIN rubric_indicators i ON s.indicator_id = i.indicator_id
                LEFT JOIN rubric_categories c ON i.category_id = c.category_id
                WHERE s.meeting_id = ? AND s.session_id = ?
                ORDER BY c.name ASC, i.name ASC
            """
            
            data = self.conn_manager.fetch_all(sql, (meeting_id, session_id))
            
            self.logger.debug(f"✓ Retrieved {len(data)} scores for session {session_id}")
            
            return {
                'success': True,
                'data': data,
                'count': len(data),
                'meeting_id': meeting_id,
                'session_id': session_id
            }
        
        except Exception as e:
            self.logger.error(f"Get by session failed: {str(e)}")
            return {
                'success': False,
                'data': [],
                'count': 0
            }
    
    def get_by_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """
        Retrieve all scores for a specific meeting.
        
        Args:
            meeting_id: Meeting UUID
        
        Returns:
            Dict with success status and list of scores grouped by session
        """
        if not meeting_id:
            return {
                'success': False,
                'data': [],
                'count': 0
            }
        
        try:
            sql = f"""
                SELECT 
                    s.*,
                    i.name AS indicator_name,
                    c.name AS category_name
                FROM {self.table} s
                LEFT JOIN rubric_indicators i ON s.indicator_id = i.indicator_id
                LEFT JOIN rubric_categories c ON i.category_id = c.category_id
                WHERE s.meeting_id = ?
                ORDER BY s.session_id ASC, c.name ASC, i.name ASC
            """
            
            data = self.conn_manager.fetch_all(sql, (meeting_id,))
            
            return {
                'success': True,
                'data': data,
                'count': len(data),
                'meeting_id': meeting_id
            }
        
        except Exception as e:
            self.logger.error(f"Get by meeting failed: {str(e)}")
            return {
                'success': False,
                'data': [],
                'count': 0
            }
    
    def get_by_indicator(self, meeting_id: str, indicator_id: str) -> Dict[str, Any]:
        """
        Retrieve all scores for a specific indicator across sessions.
        
        Args:
            meeting_id: Meeting UUID
            indicator_id: Rubric indicator ID
        
        Returns:
            Dict with success status and list of scores
        """
        if not meeting_id or not indicator_id:
            return {
                'success': False,
                'data': [],
                'count': 0
            }
        
        try:
            sql = f"""
                SELECT * FROM {self.table}
                WHERE meeting_id = ? AND indicator_id = ?
                ORDER BY session_id ASC, scored_at DESC
            """
            
            data = self.conn_manager.fetch_all(sql, (meeting_id, indicator_id))
            
            return {
                'success': True,
                'data': data,
                'count': len(data)
            }
        
        except Exception as e:
            self.logger.error(f"Get by indicator failed: {str(e)}")
            return {
                'success': False,
                'data': [],
                'count': 0
            }
    
    def delete_by_session(self, meeting_id: str, session_id: int) -> Dict[str, Any]:
        """
        Delete all scores for a specific session.
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
        
        Returns:
            Dict with success status and number deleted
        """
        if not meeting_id or session_id is None:
            return {
                'success': False,
                'deleted': 0
            }
        
        try:
            sql = f"DELETE FROM {self.table} WHERE meeting_id = ? AND session_id = ?"
            deleted = self.conn_manager.delete(sql, (meeting_id, session_id))
            
            self.logger.info(f"✓ Deleted {deleted} scores for session {session_id}")
            
            return {
                'success': True,
                'deleted': deleted
            }
        
        except Exception as e:
            self.logger.error(f"Delete by session failed: {str(e)}")
            return {
                'success': False,
                'deleted': 0
            }
    
    def delete_by_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """
        Delete all scores for a specific meeting.
        
        Args:
            meeting_id: Meeting UUID
        
        Returns:
            Dict with success status and number deleted
        """
        if not meeting_id:
            return {
                'success': False,
                'deleted': 0
            }
        
        try:
            sql = f"DELETE FROM {self.table} WHERE meeting_id = ?"
            deleted = self.conn_manager.delete(sql, (meeting_id,))
            
            self.logger.warning(f"⚠ Deleted {deleted} scores for entire meeting {meeting_id}")
            
            return {
                'success': True,
                'deleted': deleted
            }
        
        except Exception as e:
            self.logger.error(f"Delete by meeting failed: {str(e)}")
            return {
                'success': False,
                'deleted': 0
            }
    
    def get_statistics(self, meeting_id: str, session_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get scoring statistics for meeting or session.
        
        Args:
            meeting_id: Meeting UUID
            session_id: Optional session number (if not provided, stats for entire meeting)
        
        Returns:
            Dict with statistics
        """
        if not meeting_id:
            return {'success': False}
        
        try:
            if session_id is not None:
                sql = f"""
                    SELECT
                        COUNT(*) as total_scores,
                        AVG(CAST(score AS FLOAT)) as avg_score,
                        MIN(score) as min_score,
                        MAX(score) as max_score,
                        COUNT(DISTINCT score_type) as score_types,
                        COUNT(DISTINCT indicator_id) as indicator_count
                    FROM {self.table}
                    WHERE meeting_id = ? AND session_id = ?
                """
                params = (meeting_id, session_id)
            else:
                sql = f"""
                    SELECT
                        COUNT(*) as total_scores,
                        COUNT(DISTINCT session_id) as session_count,
                        AVG(CAST(score AS FLOAT)) as avg_score,
                        MIN(score) as min_score,
                        MAX(score) as max_score
                    FROM {self.table}
                    WHERE meeting_id = ?
                """
                params = (meeting_id,)
            
            stats = self.conn_manager.fetch_one(sql, params)
            
            return {
                'success': True,
                'statistics': stats or {}
            }
        
        except Exception as e:
            self.logger.error(f"Get statistics failed: {str(e)}")
            return {
                'success': False,
                'statistics': {}
            }


# Global repository instance
_repository: Optional[SessionScoresRepository] = None


def get_session_scores_repository() -> SessionScoresRepository:
    """
    Get or create global session scores repository instance.
    
    Returns:
        SessionScoresRepository instance
    """
    global _repository
    if _repository is None:
        _repository = SessionScoresRepository()
    return _repository
