/**
 * controllers/super_admin/content/archives/manageArchivesController.js
 * Archives & Transcripts controllers — no business logic/SQL here,
 * all data access goes through ManageArchivesModel.
 */
const ManageArchivesModel = require('../../../../models/super_admin/content/archives/ManageArchivesModel');

const controller = {
  /**
   * POST /api/super_admin/content/archives/meetings
   */
  async getMeetings(req, res) {
    try {
      const {
        from = null,
        to = null,
        limit,
        search = '',
        instructorId = null,
        page = 1,
        pageSize = 20
      } = req.body || {};

      const result = await ManageArchivesModel.getMeetings({
        limit: limit ? Number(limit) : 50,
        from,
        to,
        search,
        instructorId: instructorId ? Number(instructorId) : null,
        page: Math.max(1, Number(page) || 1),
        pageSize: Math.max(1, Math.min(100, Number(pageSize) || 20))
      });

      return res.json({
        status: 'success',
        meetings: result.meetings || [],
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || 20,
        totalPages: result.totalPages || 0
      });
    } catch (err) {
      console.error('[ManageArchives] getMeetings error:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  },

  /**
   * GET /api/super_admin/content/archives/instructors
   */
  async getInstructors(req, res) {
    try {
      const instructors = await ManageArchivesModel.getInstructors();
      return res.json({ status: 'success', instructors });
    } catch (err) {
      console.error('[ManageArchives] getInstructors error:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }
};

module.exports = controller;
