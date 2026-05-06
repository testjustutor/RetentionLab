require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { Server } = require('socket.io');
const { logger } = require('./utils/logger');
const { initDB } = require('./database/db');
const botManager = require('./services/shared/botManager');
const TranscriptModel = require('./models/transcriptModel');

async function pathExists(pathToCheck) {
  try {
    await fsPromises.access(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function readDirRecursive(dirPath) {
  const results = [];
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...await readDirRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.DASHBOARD_PORT || 3001;
const transcriptDir = path.join(__dirname, 'storage', 'transcript');
const transcriptWatchers = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));

function extractMeetingId(content) {
  const match = content.match(/Meeting\s*ID\s*:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

async function findTranscriptFile(meetingId) {
  if (!await pathExists(transcriptDir)) return null;
  meetingId = typeof meetingId === 'string' ? meetingId.trim() : '';

  if (meetingId) {
    try {
      const fileName = await TranscriptModel.getTranscriptFilePathByMeeting(meetingId);
      if (fileName) {
        const filePath = path.join(transcriptDir, fileName);
        if (await pathExists(filePath)) {
          return filePath;
        }
      }
    } catch (err) {
      logger.warn('Transcript DB lookup failed:', err.message);
    }
  }

  const files = await fsPromises.readdir(transcriptDir);
  const exactMatches = [];
  const noIdMatches = [];
  const allTranscripts = [];

  for (const filename of files) {
    if (!filename.endsWith('.txt')) continue;
    const filePath = path.join(transcriptDir, filename);
    let content;
    try {
      content = await fsPromises.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const fileStat = await fsPromises.stat(filePath);
    const fileMeetingId = extractMeetingId(content);
    const matchesMeetingId = meetingId && fileMeetingId === meetingId;
    const matchesFileName = meetingId && filename.includes(meetingId);
    if (matchesMeetingId || matchesFileName) {
      exactMatches.push({ filePath, mtime: fileStat.mtimeMs });
    }
    if (fileMeetingId === 'no-id' || filename.includes('no-id')) {
      noIdMatches.push({ filePath, mtime: fileStat.mtimeMs });
    }

    allTranscripts.push({ filePath, mtime: fileStat.mtimeMs });
  }

  if (exactMatches.length) {
    exactMatches.sort((a, b) => b.mtime - a.mtime);
    return exactMatches[0].filePath;
  }

  if (noIdMatches.length) {
    noIdMatches.sort((a, b) => b.mtime - a.mtime);
    return noIdMatches[0].filePath;
  }

  if (allTranscripts.length) {
    allTranscripts.sort((a, b) => b.mtime - a.mtime);
    return allTranscripts[0].filePath;
  }

  return null;
}

function watchTranscriptFile(filePath, socket) {
  if (!transcriptWatchers.has(filePath)) {
    const entry = { sockets: new Set([socket]), initialized: false };
    entry.watcher = () => {
      fsPromises.readFile(filePath, 'utf8')
        .then(content => {
          for (const s of entry.sockets) {
            s.emit('transcriptUpdate', { content, fileName: path.basename(filePath) });
          }
        })
        .catch(() => {});
    };
    transcriptWatchers.set(filePath, entry);
    fs.watchFile(filePath, { interval: 1000 }, entry.watcher);
  } else {
    transcriptWatchers.get(filePath).sockets.add(socket);
  }
}

function unwatchTranscriptFile(filePath, socket) {
  const entry = transcriptWatchers.get(filePath);
  if (!entry) return;
  entry.sockets.delete(socket);
  if (entry.sockets.size === 0) {
    fs.unwatchFile(filePath, entry.watcher);
    transcriptWatchers.delete(filePath);
  }
}

io.on('connection', (socket) => {
  socket.on('joinTranscript', async ({ meetingId }) => {
    const filePath = await findTranscriptFile(meetingId);
    if (!filePath) {
      socket.emit('transcriptError', { message: 'No transcript file found for this meeting.' });
      return;
    }

    if (!await pathExists(filePath)) {
      socket.emit('transcriptError', { message: 'Transcript file path does not exist.' });
      return;
    }

    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      socket.emit('transcriptMeta', { meetingId, fileName: path.basename(filePath) });
      socket.emit('transcriptUpdate', { content, fileName: path.basename(filePath) });
      watchTranscriptFile(filePath, socket);
    } catch (err) {
      logger.error(`Transcript read failed for ${filePath}:`, err);
      socket.emit('transcriptError', { message: 'Unable to read transcript file.' });
    }
  });

  socket.on('disconnect', () => {
    for (const [filePath, entry] of transcriptWatchers.entries()) {
      if (entry.sockets.has(socket)) {
        unwatchTranscriptFile(filePath, socket);
      }
    }
  });
});

// ============ BOT MANAGEMENT ENDPOINTS ============

// GET /api/bot/instances - Dashboard frontend compatibility
app.get('/api/bot/instances', async (req, res) => {
  try {
    const stats = botManager.getStats();
    const allInstances = botManager.listInstances ? botManager.listInstances() : [];
    const activeCount = allInstances.filter(i => 
      ['running', 'joining', 'live', 'starting'].includes(i.currentStatus)
    ).length;
    
    res.json({
      activeCount,
      totalCount: allInstances.length,
      maxConcurrent: stats.maxConcurrent,
      instances: allInstances
    });
  } catch (err) {
    logger.error('Error listing bot instances:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /bot/list - List ALL bot instances (including starting/error)
app.get('/bot/list', async (req, res) => {
  try {
    const stats = botManager.getStats();
    const allInstances = botManager.listInstances ? botManager.listInstances() : [];
    const activeCount = allInstances.filter(i => 
      ['running', 'joining', 'live', 'starting'].includes(i.currentStatus)
    ).length;
    
    res.json({
      activeCount,
      totalCount: allInstances.length,
      maxConcurrent: stats.maxConcurrent,
      instances: allInstances
    });
  } catch (err) {
    logger.error('Error listing bots:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /bot/start-bot - Start a new bot instance
app.post('/bot/start-bot', async (req, res) => {
  try {
    const { meetingId, passcode, webhookUrl, meetingUrl } = req.body;
    
    if (!meetingId) {
      return res.status(400).json({ error: 'meetingId is required' });
    }

    logger.info(`Dashboard: Starting bot for meeting ${meetingId}`);
    
    const result = await botManager.startBot(meetingId, passcode, webhookUrl, meetingUrl);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    logger.error('Error starting bot:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /bot/stop-bot/:meetingId - Stop a bot instance
app.delete('/bot/stop-bot/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    logger.info(`Dashboard: Stopping bot for meeting ${meetingId}`);
    
    const result = await botManager.stopBot(meetingId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    logger.error('Error stopping bot:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /bot/status/:meetingId - Get bot instance status
app.get('/bot/status/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const status = botManager.getStatus(meetingId);
    res.json(status);
  } catch (err) {
    logger.error('Error getting bot status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ STORAGE ENDPOINTS ============

// GET /storage/stats - Get storage statistics
app.get('/storage/stats', async (req, res) => {
  try {
    const storageDir = path.join(__dirname, 'storage');
    let totalSize = 0;

    if (await pathExists(storageDir)) {
      const files = await readDirRecursive(storageDir);
      for (const filePath of files) {
        const stat = await fsPromises.stat(filePath);
        if (stat.isFile()) totalSize += stat.size;
      }
    }

    const totalKB = Math.round(totalSize / 1024);
    const totalMB = (totalKB / 1024).toFixed(2);

    res.json({
      total: totalMB > 1 ? `${totalMB} MB` : `${totalKB} KB`,
      bytes: totalSize,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Error getting storage stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ LOGS ENDPOINTS ============

// GET /logs - List available logs
app.get('/logs', async (req, res) => {
  try {
    const logsDir = path.join(__dirname, 'logs');
    const filter = req.query.filter || '';

    if (!await pathExists(logsDir)) {
      return res.json({ logs: [], total: 0 });
    }

    let files = await fsPromises.readdir(logsDir);
    
    if (filter) {
      files = files.filter(f => f.includes(filter));
    }

    const logs = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(logsDir, filename);
        const stat = await fs.stat(filePath);
        return {
          filename,
          size: stat.size,
          modified: stat.mtime
        };
      })
    );

    res.json({
      logs: logs.sort((a, b) => b.modified - a.modified),
      total: logs.length
    });
  } catch (err) {
    logger.error('Error listing logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /logs/:filename - Read specific log file
app.get('/logs/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, 'logs', filename);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ filename, content });
  } catch (err) {
    logger.error('Error reading log file:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ CALENDAR API PROXY (for calendar.html) ============
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ============ GLOBAL ERROR HANDLER ============
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    status: 'error', 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============ 404 HANDLER ============
app.use('*', (req, res) => {
  res.status(404).json({ 
    status: 'error', 
    message: `Route not found: ${req.originalUrl}` 
  });
});

// ============ SERVER START ============

async function startDashboardServer() {
  try {
    await initDB();
    logger.info("✅ Database ready");

    await ensureDir(path.join(__dirname, 'storage/recordings'));
    await ensureDir(path.join(__dirname, 'storage/transcript'));
    await ensureDir(path.join(__dirname, 'logs'));

    server.listen(PORT, () => {
      logger.info(`🎯 Dashboard Server running on http://localhost:${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
      logger.info(`✅ API ready at http://localhost:${PORT}/bot/* | /storage/* | /logs/*`);
    });
  } catch (err) {
    logger.error('Failed to start dashboard server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startDashboardServer();
}

module.exports = app;
