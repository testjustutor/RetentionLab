require('dotenv').config();
// Development server launcher - use `npm run start` for production, dashboard/calendar for meetings
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');

async function devReady() {
  try {
    logger.info('🚀 Development server ready!');
    logger.info('📋 Commands:');
    logger.info('  npm run start     # Production server + dashboard');
    logger.info('  npm run dashboard # Dashboard only');
    logger.info('  Visit http://localhost:3000/public/dashboard.html');
    logger.info('💡 Meetings launch ONLY from dashboard or calendar pages');
    
    // Init DB
    await initDB();
    logger.info('✅ Database ready');
    
    // Keep alive
    process.stdin.resume();
  } catch (err) {
    logger.error('Dev setup error:', err);
    process.exit(1);
  }
}

devReady();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Dev server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Dev server stopped');
  process.exit(0);
});

