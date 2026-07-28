/**
 * controllers/archives/archivesController.js
 * Archives controller - handles archive requests
 */
const ArchivesModel = require('../../models/archives/ArchivesModel');
const { logger } = require('../../utils/logger');

const controller = {
  async getArchives(req, res) {
    try {
      const {
        from,
        to,
        limit,
        q,
        search,
        instructorId,
        page = 1,
        pageSize = 20
      } = req.body || {};

      const nowIsoDate = new Date().toISOString();
      const limitNum = Number(limit) > 0 ? Number(limit) : 50;

      const fromDate = from ? new Date(from) : new Date(nowIsoDate);
      const toDate = to ? new Date(to) : new Date(nowIsoDate);

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Invalid from/to date' });
      }

      const searchTerm = (search || q || '').toString().trim();
      const instructorIdNum = instructorId ? Number(instructorId) : null;
      const pageNum = Math.max(1, Number(page) || 1);
      const pageSizeNum = Math.max(1, Math.min(100, Number(pageSize) || 20));

      const result = await ArchivesModel.getCompletedMeetingsWithTranscripts({
        limit: limitNum,
        from: fromDate,
        to: toDate,
        search: searchTerm,
        instructorId: instructorIdNum,
        page: pageNum,
        pageSize: pageSizeNum
      });

      res.json({
        status: 'success',
        meetings: result.meetings || [],
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || 20,
        totalPages: result.totalPages || 0
      });
    } catch (err) {
      logger.error('Controller(archives): Error fetching meetings:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  },

  async getInstructors(req, res) {
    try {
      const instructors = await ArchivesModel.getInstructors();
      res.json({ status: 'success', instructors });
    } catch (err) {
      logger.error('Controller(archives): Error fetching instructors:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  }
};

module.exports = controller;