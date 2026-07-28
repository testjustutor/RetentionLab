"""
Flask Application Factory for Session Scores API
Registers all Python service blueprints.
"""

from flask import Flask
import logging
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global Flask app instance
_flask_app: Optional[Flask] = None


def create_app() -> Flask:
    """
    Create and configure Flask application.
    
    Returns:
        Configured Flask app instance
    """
    global _flask_app
    
    if _flask_app is not None:
        return _flask_app
    
    app = Flask(__name__)
    
    # Configure Flask
    app.config['JSON_SORT_KEYS'] = False
    app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True
    
    # Register blueprints
    register_blueprints(app)
    
    # Add health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        return {
            'status': 'healthy',
            'service': 'session-scores-api',
            'version': '1.0.0'
        }, 200
    
    # Add root endpoint
    @app.route('/', methods=['GET'])
    def root():
        return {
            'service': 'RetentionLab Session Scores API',
            'version': '1.0.0',
            'endpoints': {
                'upsert_score': 'POST /api/scores/session',
                'upsert_batch': 'POST /api/scores/session/batch',
                'get_session_scores': 'GET /api/scores/session/<meeting_id>/<session_id>',
                'get_meeting_scores': 'GET /api/scores/session/meeting/<meeting_id>',
                'delete_session_scores': 'DELETE /api/scores/session/<meeting_id>/<session_id>',
                'delete_meeting_scores': 'DELETE /api/scores/session/meeting/<meeting_id>',
                'get_statistics': 'GET /api/scores/statistics/<meeting_id>'
            }
        }, 200
    
    _flask_app = app
    logger.info("✓ Flask app created and configured")
    
    return app


def register_blueprints(app: Flask) -> None:
    """
    Register all blueprints with the Flask app.
    
    Args:
        app: Flask application instance
    """
    try:
        # Import and register session scores routes
        from routes.session_scores import register_session_scores_routes
        register_session_scores_routes(app)
        
        logger.info("✓ All blueprints registered")
    except Exception as e:
        logger.error(f"Failed to register blueprints: {str(e)}")
        raise

# Add sys.path for Python imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'services' / 'shared'))


def get_app() -> Optional[Flask]:
    """
    Get the global Flask app instance.
    
    Returns:
        Flask app instance or None if not created
    """
    return _flask_app


# For running directly with Python
if __name__ == '__main__':
    app = create_app()
    
    # Run Flask dev server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )