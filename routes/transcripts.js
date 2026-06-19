/**
 * root/routes/transcripts.js
 */
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const TranscriptModel = require('../models/transcriptModel');

const { generateCSV, generateTXT } = require('../utils/transcriptUtils');

const fs = require('fs');
const path = require('path');


module.exports = router;
