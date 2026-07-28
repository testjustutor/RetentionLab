"""
Session Scores Model
Wrapper for SessionScoresRepository providing business logic and data transformation.
"""

from typing import Dict, Any, List, Optional
from database.python_db import get_cursor, fetch_one, fetch_all, execute, insert

# Configure logger
import logging
logger = logging.getLogger(__name__)


class SessionScoresModel:
    """
    Model layer for session scores.
    Uses MySQL database via python_db.py
    """
    
    def upsert_score(self, meeting_id: str, session_id: int, indicator_id: str,
                     score: int, comment: Optional[str] = None,
                     score_type: str = 'AI', reviewer_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Upsert a single session score.
        
        Business Logic:
        - Validates score range
        - Normalizes data
        - Inserts/updates in database
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
            indicator_id: Rubric indicator ID
            score: Score value (0-100)
            comment: Optional explanation
            score_type: 'AI' or 'MANUAL'
            reviewer_id: Optional reviewer user ID
        
        Returns:
            Dict with success status and data
        """
        try:
            # Validate score range
            if not isinstance(score, (int, float)):
                score = 0
            
            score = max(0, min(100, int(score)))  # Clamp to 0-100
            
            # Normalize score_type
            score_type = score_type.upper() if score_type else 'AI'
            if score_type not in ['AI', 'MANUAL']:
                score_type = 'AI'
            
            # Use MySQL INSERT ... ON DUPLICATE KEY UPDATE
            sql = """
                INSERT INTO meeting_session_scores 
                (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id, scored_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    score = VALUES(score),
                    comment = VALUES(comment),
                    score_type = VALUES(score_type),
                    reviewer_id = VALUES(reviewer_id),
                    scored_at = NOW()
            """
            
            params = (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id)
            execute(sql, params)
            
            logger.info(
                f"✓ Score upserted: meeting={meeting_id}, session={session_id}, "
                f"indicator={indicator_id}, score={score}"
            )
            
            return {
                'success': True,
                'meeting_id': meeting_id,
                'session_id': session_id,
                'indicator_id': indicator_id,
                'score': score,
                'message': 'Score stored successfully'
            }
        
        except Exception as e:
            logger.error(f"Model upsert_score failed: {str(e)}")
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }
    
    def upsert_batch(self, meeting_id: str, session_id: int,
                     scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Upsert multiple session scores in batch.
        
        Business Logic:
        - Validates batch input
        - Normalizes each score
        - Inserts/updates in database
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
            scores: List of score dictionaries
        
        Returns:
            Dict with batch operation results
        """
        try:
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
            
            for score_data in scores:
                try:
                    indicator_id = score_data.get('indicator_id')
                    if not indicator_id:
                        failed += 1
                        errors.append('Missing indicator_id')
                        continue
                    
                    score = max(0, min(100, int(score_data.get('score', 0))))
                    score_type = score_data.get('score_type', 'AI').upper()
                    if score_type not in ['AI', 'MANUAL']:
                        score_type = 'AI'
                    
                    sql = """
                        INSERT INTO meeting_session_scores 
                        (meeting_id, session_id, indicator_id, score, score_type, comment, reviewer_id, scored_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE
                            score = VALUES(score),
                            comment = VALUES(comment),
                            score_type = VALUES(score_type),
                            reviewer_id = VALUES(reviewer_id),
                            scored_at = NOW()
                    """
                    
                    params = (
                        meeting_id, 
                        session_id, 
                        indicator_id, 
                        score, 
                        score_type,
                        score_data.get('comment'),
                        score_data.get('reviewer_id')
                    )
                    
                    execute(sql, params)
                    stored += 1
                    
                except Exception as e:
                    failed += 1
                    errors.append(str(e))
            
            logger.info(f"✓ Batch upsert: {stored} stored, {failed} failed")
            
            return {
                'success': failed == 0,
                'stored': stored,
                'failed': failed,
                'errors': errors if errors else None,
                'message': f'Stored {stored} scores with {failed} failures'
            }
        
        except Exception as e:
            logger.error(f"Model upsert_batch failed: {str(e)}")
            return {
                'success': False,
                'stored': 0,
                'failed': len(scores) if scores else 0,
                'message': f'Batch error: {str(e)}'
            }
    
    def get_by_session(self, meeting_id: str, session_id: int) -> Dict[str, Any]:
        """
        Retrieve all scores for a specific session.
        
        Business Logic:
        - Validates parameters
        - Transforms data for API response
        - Adds computed fields
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
        
        Returns:
            Dict with scores data
        """
        try:
            if not meeting_id or session_id is None:
                return {
                    'success': False,
                    'data': [],
                    'count': 0
                }
            
            sql = """
                SELECT 
                    s.*,
                    i.name AS indicator_name,
                    c.name AS category_name,
                    c.weight AS category_weight
                FROM meeting_session_scores s
                LEFT JOIN rubric_indicators i ON s.indicator_id = i.indicator_id
                LEFT JOIN rubric_categories c ON i.category_id = c.category_id
                WHERE s.meeting_id = %s AND s.session_id = %s
                ORDER BY c.name ASC, i.name ASC
            """
            
            data = fetch_all(sql, (meeting_id, session_id))
            
            logger.debug(f"✓ Retrieved {len(data)} scores for session {session_id}")
            
            return {
                'success': True,
                'data': data,
                'count': len(data),
                'meeting_id': meeting_id,
                'session_id': session_id
            }
        
        except Exception as e:
            logger.error(f"Model get_by_session failed: {str(e)}")
            return {
                'success': False,
                'data': [],
                'count': 0
            }
    
    def get_by_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """
        Retrieve all scores for a specific meeting.
        
        Business Logic:
        - Validates parameters
        - Groups by session
        - Transforms data
        
        Args:
            meeting_id: Meeting UUID
        
        Returns:
            Dict with scores grouped by session
        """
        try:
            if not meeting_id:
                return {
                    'success': False,
                    'data': [],
                    'count': 0
                }
            
            sql = """
                SELECT 
                    s.*,
                    i.name AS indicator_name,
                    c.name AS category_name
                FROM meeting_session_scores s
                LEFT JOIN rubric_indicators i ON s.indicator_id = i.indicator_id
                LEFT JOIN rubric_categories c ON i.category_id = c.category_id
                WHERE s.meeting_id = %s
                ORDER BY s.session_id ASC, c.name ASC, i.name ASC
            """
            
            data = fetch_all(sql, (meeting_id,))
            
            return {
                'success': True,
                'data': data,
                'count': len(data),
                'meeting_id': meeting_id
            }
        
        except Exception as e:
            logger.error(f"Model get_by_meeting failed: {str(e)}")
            return {
                'success': False,
                'data': [],
                'count': 0
            }
    
    def delete_by_session(self, meeting_id: str, session_id: int) -> Dict[str, Any]:
        """
        Delete all scores for a specific session.
        
        Business Logic:
        - Validates parameters
        - Logs warning for audit trail
        - Deletes from database
        
        Args:
            meeting_id: Meeting UUID
            session_id: Session number
        
        Returns:
            Dict with deletion result
        """
        try:
            if not meeting_id or session_id is None:
                return {
                    'success': False,
                    'deleted': 0
                }
            
            # Log warning for audit trail
            logger.warning(f"Deleting scores for meeting={meeting_id}, session={session_id}")
            
            sql = "DELETE FROM meeting_session_scores WHERE meeting_id = %s AND session_id = %s"
            deleted = execute(sql, (meeting_id, session_id))
            
            logger.info(f"✓ Deleted {deleted} scores for session {session_id}")
            
            return {
                'success': True,
                'deleted': deleted
            }
        
        except Exception as e:
            logger.error(f"Model delete_by_session failed: {str(e)}")
            return {
                'success': False,
                'deleted': 0
            }
    
    def delete_by_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """
        Delete all scores for an entire meeting.
        
        Business Logic:
        - Validates parameters
        - Logs warning for audit trail
        - Deletes from database
        
        Args:
            meeting_id: Meeting UUID
        
        Returns:
            Dict with deletion result
        """
        try:
            if not meeting_id:
                return {
                    'success': False,
                    'deleted': 0
                }
            
            # Log warning for audit trail
            logger.warning(f"Deleting ALL scores for meeting={meeting_id}")
            
            sql = "DELETE FROM meeting_session_scores WHERE meeting_id = %s"
            deleted = execute(sql, (meeting_id,))
            
            logger.warning(f"⚠ Deleted {deleted} scores for entire meeting {meeting_id}")
            
            return {
                'success': True,
                'deleted': deleted
            }
        
        except Exception as e:
            logger.error(f"Model delete_by_meeting failed: {str(e)}")
            return {
                'success': False,
                'deleted': 0
            }
    
    def get_statistics(self, meeting_id: str, session_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get scoring statistics for meeting or session.
        
        Business Logic:
        - Validates parameters
        - Transforms statistics for API
        - Adds computed fields
        
        Args:
            meeting_id: Meeting UUID
            session_id: Optional session number
        
        Returns:
            Dict with statistics
        """
        try:
            if not meeting_id:
                return {'success': False, 'statistics': {}}
            
            if session_id is not None:
                sql = """
                    SELECT
                        COUNT(*) as total_scores,
                        AVG(CAST(score AS FLOAT)) as avg_score,
                        MIN(score) as min_score,
                        MAX(score) as max_score,
                        COUNT(DISTINCT score_type) as score_types,
                        COUNT(DISTINCT indicator_id) as indicator_count
                    FROM meeting_session_scores
                    WHERE meeting_id = %s AND session_id = %s
                """
                params = (meeting_id, session_id)
            else:
                sql = """
                    SELECT
                        COUNT(*) as total_scores,
                        COUNT(DISTINCT session_id) as session_count,
                        AVG(CAST(score AS FLOAT)) as avg_score,
                        MIN(score) as min_score,
                        MAX(score) as max_score
                    FROM meeting_session_scores
                    WHERE meeting_id = %s
                """
                params = (meeting_id,)
            
            stats = fetch_one(sql, params)
            
            if stats:
                transformed_stats = {
                    'total_scores': stats.get('total_scores', 0),
                    'session_count': stats.get('session_count'),
                    'avg_score': round(stats.get('avg_score', 0), 2) if stats.get('avg_score') else 0,
                    'min_score': stats.get('min_score'),
                    'max_score': stats.get('max_score'),
                    'score_types': stats.get('score_types'),
                    'indicator_count': stats.get('indicator_count')
                }
                
                return {
                    'success': True,
                    'statistics': transformed_stats
                }
            else:
                return {
                    'success': True,
                    'statistics': {}
                }
        
        except Exception as e:
            logger.error(f"Model get_statistics failed: {str(e)}")
            return {
                'success': False,
                'statistics': {}
            }


# Global model instance
_model: Optional[SessionScoresModel] = None


def get_session_scores_model() -> SessionScoresModel:
    """
    Get or create global session scores model instance.
    
    Returns:
        SessionScoresModel instance
    """
    global _model
    if _model is None:
        _model = SessionScoresModel()
    return _model


# Initialize database on module load
def init_model() -> bool:
    """
    Initialize model and database connection.
    
    Returns:
        True if successful, False otherwise
    """
    try:
        from database.python_db import init_db
        return init_db()
    except Exception as e:
        logger.error(f"Failed to initialize model: {str(e)}")
        return False
