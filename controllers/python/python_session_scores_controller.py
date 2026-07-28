"""
Session Scores Controller
Handles business logic for meeting session scores API endpoints.
"""

from typing import Dict, Any, List, Optional
from models.python.python_session_scores_model import SessionScoresModel, get_session_scores_model
from config import get_config
from flask import jsonify, request

# Configure logger
import logging
logger = logging.getLogger(__name__)


class SessionScoresController:
    """
    Controller for session scores business logic.
    Orchestrates between API layer and Model/Repository layer.
    """
    
    def __init__(self):
        self.model = SessionScoresModel()
        self.config = get_config()
    
    def upsert_score(self, req) -> Any:
        """
        POST /api/scores/session
        Upsert a single session score.
        """
        try:
            data = req.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Request body is required'
                }), 400
            
            # Extract parameters
            meeting_id = data.get('meeting_id')
            session_id = data.get('session_id')
            indicator_id = data.get('indicator_id')
            score = data.get('score', 0)
            comment = data.get('comment')
            score_type = data.get('score_type', 'AI')
            reviewer_id = data.get('reviewer_id')
            
            # Validation
            if not meeting_id or session_id is None or not indicator_id:
                return jsonify({
                    'success': False,
                    'error': 'Missing required fields: meeting_id, session_id, indicator_id'
                }), 400
            
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                return jsonify({
                    'success': False,
                    'error': 'Score must be a number between 0 and 100'
                }), 400
            
            # Delegate to model
            result = self.model.upsert_score(
                meeting_id=meeting_id,
                session_id=session_id,
                indicator_id=indicator_id,
                score=score,
                comment=comment,
                score_type=score_type,
                reviewer_id=reviewer_id
            )
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result,
                    'message': 'Score saved successfully'
                }), 201
            else:
                return jsonify({
                    'success': False,
                    'error': result.get('message', 'Failed to save score')
                }), 500
        
        except Exception as e:
            logger.error(f"Controller upsert_score failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            }), 500
    
    def upsert_batch(self, req) -> Any:
        """
        POST /api/scores/session/batch
        Upsert multiple session scores in batch.
        """
        try:
            data = req.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Request body is required'
                }), 400
            
            # Extract parameters
            meeting_id = data.get('meeting_id')
            session_id = data.get('session_id')
            scores = data.get('scores', [])
            
            if not meeting_id or session_id is None or not scores:
                return jsonify({
                    'success': False,
                    'error': 'Invalid parameters: meeting_id, session_id, and scores[] required'
                }), 400
            
            # Delegate to model
            result = self.model.upsert_batch(meeting_id, session_id, scores)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result,
                    'message': f"Batch operation completed: {result.get('stored', 0)} stored, {result.get('failed', 0)} failed"
                }), 201
            else:
                return jsonify({
                    'success': False,
                    'error': result.get('message', 'Batch operation failed'),
                    'data': result
                }), 500
        
        except Exception as e:
            logger.error(f"Controller upsert_batch failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            }), 500
    
    def get_session_scores(self, meeting_id: str, session_id: int) -> Any:
        """
        GET /api/scores/session/:meeting_id/:session_id
        Retrieve all indicator scores for a specific session.
        """
        try:
            if not meeting_id or session_id is None:
                return jsonify({
                    'success': False,
                    'error': 'Missing required fields: meeting_id, session_id'
                }), 400
            
            # Delegate to model
            result = self.model.get_by_session(meeting_id, session_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result['data'],
                    'count': result['count'],
                    'meeting_id': meeting_id,
                    'session_id': session_id
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to retrieve scores'
                }), 500
        
        except Exception as e:
            logger.error(f"Controller get_session_scores failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}',
                'data': [],
                'count': 0
            }), 500
    
    def get_meeting_scores(self, meeting_id: str) -> Any:
        """
        GET /api/scores/session/meeting/:meeting_id
        Retrieve all scores for a specific meeting.
        """
        try:
            if not meeting_id:
                return jsonify({
                    'success': False,
                    'error': 'Missing required field: meeting_id'
                }), 400
            
            # Delegate to model
            result = self.model.get_by_meeting(meeting_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result['data'],
                    'count': result['count'],
                    'meeting_id': meeting_id
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to retrieve meeting scores'
                }), 500
        
        except Exception as e:
            logger.error(f"Controller get_meeting_scores failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}',
                'data': [],
                'count': 0
            }), 500
    
    def delete_session_scores(self, meeting_id: str, session_id: int) -> Any:
        """
        DELETE /api/scores/session/:meeting_id/:session_id
        Delete all scores for a specific session.
        """
        try:
            if not meeting_id or session_id is None:
                return jsonify({
                    'success': False,
                    'error': 'Missing required fields: meeting_id, session_id'
                }), 400
            
            # Delegate to model
            result = self.model.delete_by_session(meeting_id, session_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result,
                    'message': f"Deleted {result.get('deleted', 0)} scores"
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to delete scores'
                }), 500
        
        except Exception as e:
            logger.error(f"Controller delete_session_scores failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}',
                'deleted': 0
            }), 500
    
    def delete_meeting_scores(self, meeting_id: str) -> Any:
        """
        DELETE /api/scores/session/meeting/:meeting_id
        Delete all scores for an entire meeting.
        """
        try:
            if not meeting_id:
                return jsonify({
                    'success': False,
                    'error': 'Missing required field: meeting_id'
                }), 400
            
            # Delegate to model
            result = self.model.delete_by_meeting(meeting_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result,
                    'message': f"Deleted {result.get('deleted', 0)} scores for meeting"
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to delete meeting scores'
                }), 500
        
        except Exception as e:
            logger.error(f"Controller delete_meeting_scores failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}',
                'deleted': 0
            }), 500
    
    def get_statistics(self, meeting_id: str, session_id: Optional[int] = None) -> Any:
        """
        GET /api/scores/statistics/:meeting_id
        Get scoring statistics for meeting or session.
        """
        try:
            if not meeting_id:
                return jsonify({
                    'success': False,
                    'error': 'Missing required field: meeting_id'
                }), 400
            
            # Delegate to model
            result = self.model.get_statistics(meeting_id, session_id)
            
            if result['success']:
                return jsonify({
                    'success': True,
                    'data': result['statistics'],
                    'meeting_id': meeting_id,
                    'session_id': session_id
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to retrieve statistics'
                }), 500
        
        except Exception as e:
            logger.error(f"Controller get_statistics failed: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Internal server error: {str(e)}',
                'data': {}
            }), 500


# Global controller instance
_controller: Optional[SessionScoresController] = None


def get_session_scores_controller() -> SessionScoresController:
    """
    Get or create global session scores controller instance.
    
    Returns:
        SessionScoresController instance
    """
    global _controller
    if _controller is None:
        _controller = SessionScoresController()
    return _controller