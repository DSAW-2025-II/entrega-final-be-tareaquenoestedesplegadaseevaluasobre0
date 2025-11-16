const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authenticate = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/authenticate');
const adminController = require('../controllers/adminController');
const validateRequest = require('../middlewares/validateRequest');
const { listTripsQuery, listBookingsQuery, listRefundsQuery, suspendUserSchema, forceCancelTripSchema, publishBanSchema } = require('../validation/adminSchemas');
const { correctBookingStateSchema } = require('../validation/adminSchemas');
const { moderationNoteSchema, evidenceUploadRequestSchema, listModerationNotesQuery, listAuditQuery, exportAuditQuery, listReportsQuery, updateReportStatusSchema, sendMessageToUserSchema } = require('../validation/adminSchemas');

const reportIdParamSchema = Joi.object({
  reportId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'reportId must be a valid MongoDB ObjectId',
      'any.required': 'reportId is required'
    })
}).options({ abortEarly: false });

// GET /admin/users
router.get('/users', authenticate, requireRole(['admin']), adminController.listUsers);

// GET /admin/trips
// GET /admin/trips
router.get('/trips', authenticate, requireRole(['admin']), validateRequest(listTripsQuery, 'query'), adminController.listTrips);

// GET /admin/bookings
// GET /admin/bookings
router.get('/bookings', authenticate, requireRole(['admin']), validateRequest(listBookingsQuery, 'query'), adminController.listBookings);

// GET /admin/refunds
// GET /admin/refunds
router.get('/refunds', authenticate, requireRole(['admin']), validateRequest(listRefundsQuery, 'query'), adminController.listRefunds);

// PATCH /admin/users/:id/suspension
router.patch('/users/:id/suspension', authenticate, requireRole(['admin']), validateRequest(suspendUserSchema, 'body'), adminController.suspendUser);

// POST /admin/trips/:tripId/force-cancel
router.post('/trips/:tripId/force-cancel', authenticate, requireRole(['admin']), validateRequest(forceCancelTripSchema, 'body'), adminController.forceCancelTrip);

// POST /admin/bookings/:bookingId/correct-state
router.post('/bookings/:bookingId/correct-state', authenticate, requireRole(['admin']), validateRequest(correctBookingStateSchema, 'body'), adminController.correctBookingState);

// PATCH /admin/drivers/:driverId/publish-ban
router.patch('/drivers/:driverId/publish-ban', authenticate, requireRole(['admin']), validateRequest(publishBanSchema, 'body'), adminController.publishBan);

// Moderation notes
router.post('/moderation/notes', authenticate, requireRole(['admin']), validateRequest(moderationNoteSchema, 'body'), adminController.createModerationNote);
router.post('/moderation/evidence/upload-url', authenticate, requireRole(['admin']), validateRequest(evidenceUploadRequestSchema, 'body'), adminController.createEvidenceUploadUrl);
router.get('/moderation/notes', authenticate, requireRole(['admin']), validateRequest(listModerationNotesQuery, 'query'), adminController.listModerationNotes);

// Audit listing and export
router.get('/audit', authenticate, requireRole(['admin']), validateRequest(listAuditQuery, 'query'), adminController.listAudit);
// New route: /admin/audit/logs (same as /admin/audit but clearer path)
router.get('/audit/logs', authenticate, requireRole(['admin']), validateRequest(listAuditQuery, 'query'), adminController.listAudit);
router.get('/audit/integrity', authenticate, requireRole(['admin']), validateRequest(require('../validation/adminSchemas').integrityQuery, 'query'), adminController.verifyIntegrity);
router.get('/audit/export', authenticate, requireRole(['admin']), validateRequest(exportAuditQuery, 'query'), adminController.exportAudit);

// Reports management
router.get('/reports', authenticate, requireRole(['admin']), validateRequest(listReportsQuery, 'query'), adminController.listReports);
router.patch('/reports/:reportId/status', authenticate, requireRole(['admin']), validateRequest(reportIdParamSchema, 'params'), validateRequest(updateReportStatusSchema, 'body'), adminController.updateReportStatus);
router.post('/reports/:reportId/send-message', authenticate, requireRole(['admin']), validateRequest(reportIdParamSchema, 'params'), validateRequest(sendMessageToUserSchema, 'body'), adminController.sendMessageToReportedUser);

module.exports = router;
