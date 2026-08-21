/**
 * models/super_admin/people/manage-rubrics/ManageRubricsModel.js
 * Data access for the Super Admin "Permission Rubrics" (manage-rubrics) feature.
 * All SQL lives in models — never in controllers/routes. Reuses MasterRubricModel
 * so master rubric CRUD stays consistent app-wide.
 */
const MasterRubricModel = require('../../../rubrics/MasterRubricModel');

class ManageRubricsModel {
  // ── Categories ──────────────────────────────────────────────────────────
  static listCategories() {
    return MasterRubricModel.getCategories(null, true);
  }

  static createCategory(data) {
    return MasterRubricModel.createCategory({
      category_code: data.category_code || data.category_id || 'CAT_' + Date.now(),
      name: data.name,
      weight: parseFloat(data.weight) || 0,
      status: data.status || 'active'
    });
  }

  static updateCategory(id, data) {
    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.weight !== undefined) updates.weight = parseFloat(data.weight) || 0;
    if (data.status !== undefined) updates.status = data.status;
    if (Object.keys(updates).length === 0) return Promise.resolve({ updated: false });
    return MasterRubricModel.updateCategory(id, updates);
  }

  static deleteCategory(id) {
    return MasterRubricModel.deleteCategory(id);
  }

  // ── Indicators ──────────────────────────────────────────────────────────
  static listIndicators() {
    return MasterRubricModel.getIndicators();
  }

  static createIndicator(data) {
    return MasterRubricModel.createIndicator({
      indicator_code: data.indicator_code || data.indicator_id || 'IND_' + Date.now(),
      category_id: data.category_id,
      name: data.name,
      type: data.type || 'HUMAN',
      is_gate: data.is_gate ? 1 : 0,
      value: parseFloat(data.value) || 1,
      status: data.status || 'active',
      subgroup_name: data.subgroup_name,
      benchmark: data.benchmark,
      requires_video: data.requires_video ? 1 : 0
    });
  }

  static updateIndicator(id, data) {
    const updates = {};
    if (data.category_id !== undefined) updates.category_id = data.category_id;
    if (data.name !== undefined) updates.name = data.name;
    if (data.type !== undefined) updates.type = data.type;
    if (data.is_gate !== undefined) updates.is_gate = data.is_gate ? 1 : 0;
    if (data.value !== undefined) updates.value = parseFloat(data.value) || 1;
    if (data.status !== undefined) updates.status = data.status;
    if (Object.keys(updates).length === 0) return Promise.resolve({ updated: false });
    return MasterRubricModel.updateIndicator(id, updates);
  }

  static deleteIndicator(id) {
    return MasterRubricModel.deleteIndicator(id);
  }
}

module.exports = ManageRubricsModel;
