/**
 * models/super_admin/content/assets/ManageAssetsModel.js
 * Data access for the Super Admin "Media Assets" (content/assets) feature.
 * File-system listing/reading lives here — never in controllers/routes.
 */
const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

class ManageAssetsModel {
  static _storageRoot() {
    // models/super_admin/content/assets -> project root -> storage
    return path.resolve(__dirname, '../../../../storage');
  }

  /** Resolve a safe path under storage, or null if it escapes. */
  static _resolveSafe(...segments) {
    const root = ManageAssetsModel._storageRoot();
    const target = path.resolve(root, ...segments);
    const relative = path.relative(root, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return target;
  }

  /** List files in a storage folder. */
  static listFolder(folderName) {
    const targetPath = ManageAssetsModel._resolveSafe(folderName);
    if (!targetPath) {
      const err = new Error('Invalid folder name.');
      err.statusCode = 400;
      throw err;
    }
    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isDirectory()) {
      const err = new Error('Folder not found.');
      err.statusCode = 404;
      throw err;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const filePath = path.join(targetPath, entry.name);
        const stats = fs.statSync(filePath);
        const ext = path.extname(entry.name).toUpperCase() || '';
        const type = ext === '.MP3' || ext === '.WAV' ? 'Audio' : ext === '.JSON' ? 'JSON' : ext === '.TXT' ? 'Text' : 'File';
        return { name: entry.name, size: formatBytes(stats.size), type, ext };
      });

    return { folders: [], currentPath: `/storage/${folderName}`, files };
  }

  /** Read a file — returns { stream: path } for audio, else { content, mime }. */
  static getFile(folderName, fileName) {
    const targetPath = ManageAssetsModel._resolveSafe(folderName, fileName);
    if (!targetPath) {
      const err = new Error('Invalid file path.');
      err.statusCode = 400;
      throw err;
    }
    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) {
      const err = new Error('File not found.');
      err.statusCode = 404;
      throw err;
    }

    const ext = path.extname(targetPath).toLowerCase();
    if (['.mp3', '.wav', '.m4a', '.ogg'].includes(ext)) {
      return { stream: true, path: targetPath };
    }
    const content = fs.readFileSync(targetPath, { encoding: 'utf8' });
    const mime = ext === '.json' ? 'application/json' : 'text/plain';
    return { content, mime };
  }
}

module.exports = ManageAssetsModel;
