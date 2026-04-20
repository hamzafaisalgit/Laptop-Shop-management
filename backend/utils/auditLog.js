const AuditLog = require('../models/AuditLog');

const logAction = async (user, action, entity, entityId, changes) => {
  try {
    await AuditLog.create({
      user: user?._id || user,
      action,
      entity,
      entityId,
      changes,
    });
  } catch (err) {
    console.error('AuditLog error:', err.message);
  }
};

module.exports = logAction;
