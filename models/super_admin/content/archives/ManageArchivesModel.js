/**
 * models/super_admin/content/archives/ManageArchivesModel.js
 * Data access for the Super Admin "Archives & Transcripts" (content/archives) feature.
 * All SQL lives in models — never in controllers/routes. Reuses ArchivesModel.
 */
const ArchivesModel = require('../../../archives/ArchivesModel');

class ManageArchivesModel {
  /**
   * List completed meetings with transcripts (server-side pagination/filters).
   * @returns {Promise<{meetings,total,page,pageSize,totalPages}>}
   */
  static getMeetings({ limit = 50, from = null, to = null, search = '', instructorId = null, page = 1, pageSize = 20 } = {}) {
    return ArchivesModel.getCompletedMeetingsWithTranscripts({ limit, from, to, search, instructorId, page, pageSize });
  }

  /**
   * All instructors (instructor / solo_instructor roles).
   * @returns {Promise<Array<{id,name,email}>>}
   */
  static getInstructors() {
    return ArchivesModel.getInstructors();
  }
}

module.exports = ManageArchivesModel;
