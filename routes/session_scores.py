"""
Session Scores API Routes
Flask routes for meeting session scores endpoints.
"""

from flask import Blueprint, request
from controllers.python.python_session_scores_controller import get_session_scores_controller

# Get controller instance
controller = get_session_scores_controller()

# Create blueprint
session_scores_bp = Blueprint('session_scores', __name__, url_prefix='/api/scores')


@session_scores_bp.route('/session', methods=['POST'])
def upsert_score():
    return controller.upsert_score(request)


@session_scores_bp.route('/session/batch', methods=['POST'])
def upsert_batch():
    return controller.upsert_batch(request)


@session_scores_bp.route('/session/<meeting_id>/<int:session_id>', methods=['GET'])
def get_session_scores(meeting_id: str, session_id: int):
    return controller.get_session_scores(meeting_id, session_id)


@session_scores_bp.route('/session/meeting/<meeting_id>', methods=['GET'])
def get_meeting_scores(meeting_id: str):
    return controller.get_meeting_scores(meeting_id)


@session_scores_bp.route('/session/<meeting_id>/<int:session_id>', methods=['DELETE'])
def delete_session_scores(meeting_id: str, session_id: int):
    return controller.delete_session_scores(meeting_id, session_id)


@session_scores_bp.route('/session/meeting/<meeting_id>', methods=['DELETE'])
def delete_meeting_scores(meeting_id: str):
    return controller.delete_meeting_scores(meeting_id)


@session_scores_bp.route('/statistics/<meeting_id>', methods=['GET'])
def get_statistics(meeting_id: str):
    session_id = request.args.get('session_id', type=int)
    return controller.get_statistics(meeting_id, session_id)


# Register blueprint function
def register_session_scores_routes(app):
    """
    Register session scores routes with Flask app.
    
    Args:
        app: Flask application instance
    """
    app.register_blueprint(session_scores_bp)