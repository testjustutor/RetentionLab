require('dotenv').config();
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');

async function devReady() {
  try {    
    await initDB();
    logger.info('Database ready');
    
    process.stdin.resume();
  } catch (err) {
    logger.error('Dev setup error:', err);
    process.exit(1);
  }
}

devReady();

process.on('SIGINT', () => {
  logger.info('Dev server stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Dev server stopped');
  process.exit(0);
});

