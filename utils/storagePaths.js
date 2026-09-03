'use strict';

const path = require('path');

const FOLDERS = {
  audio: 'storage/recordings',
  transcript: 'storage/transcripts',
  summary: 'storage/summaries',
  video: 'storage/screen-recordings'
};

function kindCheck(kind) {
  if (!FOLDERS[kind]) throw new Error('storagePaths: unknown kind "' + kind + '"');
}

function normalizeStorageRef(kind, input) {
  kindCheck(kind);
  if (!input) return '';
  const s = String(input).split(/[\\/]/).pop();
  if (!s) return '';
  return FOLDERS[kind] + '/' + s;
}

function resolveStoragePath(baseDir, storageRef, kind) {
  kindCheck(kind);
  if (!storageRef) return '';
  let ref = String(storageRef);
  if (!ref.startsWith('storage/') && !ref.startsWith('storage\\')) {
    ref = normalizeStorageRef(kind, ref);
  }
  return path.join(...[baseDir].concat(ref.split(/[\\/]/)));
}

module.exports = {
  FOLDERS,
  normalizeStorageRef,
  resolveStoragePath
};