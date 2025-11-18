// Rutas de administración: endpoints para gestión administrativa del sistema
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const authenticate = require('../middlewares/authenticate');
const { requireRole } = require('../middlewares/authenticate');
const adminController = require('../controllers/adminController');
const ReviewController = require('../controllers/reviewController');
const reviewController = new ReviewController();
const validateRequest = require('../middlewares/validateRequest');
const { listTripsQuery, listBookingsQuery, listRefundsQuery, suspendUserSchema, forceCancelTripSchema, publishBanSchema } = require('../validation/adminSchemas');
const { correctBookingStateSchema } = require('../validation/adminSchemas');
const { moderationNoteSchema, evidenceUploadRequestSchema, listModerationNotesQuery, listAuditQuery, exportAuditQuery, listReportsQuery, listReviewReportsQuery, updateReportStatusSchema, sendMessageToUserSchema } = require('../validation/adminSchemas');
const { reviewIdParamSchema, adminVisibilityBodySchema } = require('../validation/reviewSchemas');

// Esquema de validación para reportId en parámetros de ruta
const reportIdParamSchema = Joi.object({
  reportId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({
      'string.pattern.base': 'reportId must be a valid MongoDB ObjectId',
      'any.required': 'reportId is required'
    })
}).options({ abortEarly: false });

// GET /admin/users: listar usuarios del sistema
router.get('/users', authenticate, requireRole(['admin']), adminController.listUsers);

// GET /admin/trips: listar viajes del sistema
router.get('/trips', authenticate, requireRole(['admin']), validateRequest(listTripsQuery, 'query'), adminController.listTrips);

// GET /admin/bookings: listar reservas del sistema
router.get('/bookings', authenticate, requireRole(['admin']), validateRequest(listBookingsQuery, 'query'), adminController.listBookings);

// GET /admin/refunds: listar reembolsos del sistema
router.get('/refunds', authenticate, requireRole(['admin']), validateRequest(listRefundsQuery, 'query'), adminController.listRefunds);

// PATCH /admin/users/:id/suspension: suspender o reactivar usuario
router.patch('/users/:id/suspension', authenticate, requireRole(['admin']), validateRequest(suspendUserSchema, 'body'), adminController.suspendUser);

// POST /admin/trips/:tripId/force-cancel: cancelar viaje forzadamente
router.post('/trips/:tripId/force-cancel', authenticate, requireRole(['admin']), validateRequest(forceCancelTripSchema, 'body'), adminController.forceCancelTrip);

// POST /admin/bookings/:bookingId/correct-state: corregir estado de reserva
router.post('/bookings/:bookingId/correct-state', authenticate, requireRole(['admin']), validateRequest(correctBookingStateSchema, 'body'), adminController.correctBookingState);

// PATCH /admin/drivers/:driverId/publish-ban: prohibir o permitir publicación de viajes a conductor
router.patch('/drivers/:driverId/publish-ban', authenticate, requireRole(['admin']), validateRequest(publishBanSchema, 'body'), adminController.publishBan);

// Notas de moderación: crear, listar y gestionar evidencia
router.post('/moderation/notes', authenticate, requireRole(['admin']), validateRequest(moderationNoteSchema, 'body'), adminController.createModerationNote);
router.post('/moderation/evidence/upload-url', authenticate, requireRole(['admin']), validateRequest(evidenceUploadRequestSchema, 'body'), adminController.createEvidenceUploadUrl);
router.get('/moderation/notes', authenticate, requireRole(['admin']), validateRequest(listModerationNotesQuery, 'query'), adminController.listModerationNotes);

// Auditoría: listar logs, verificar integridad y exportar
router.get('/audit', authenticate, requireRole(['admin']), validateRequest(listAuditQuery, 'query'), adminController.listAudit);
router.get('/audit/logs', authenticate, requireRole(['admin']), validateRequest(listAuditQuery, 'query'), adminController.listAudit);
router.get('/audit/integrity', authenticate, requireRole(['admin']), validateRequest(require('../validation/adminSchemas').integrityQuery, 'query'), adminController.verifyIntegrity);
router.get('/audit/export', authenticate, requireRole(['admin']), validateRequest(exportAuditQuery, 'query'), adminController.exportAudit);

// Gestión de reportes: listar, actualizar estado y enviar mensajes a usuarios reportados
router.get('/reports', authenticate, requireRole(['admin']), validateRequest(listReportsQuery, 'query'), adminController.listReports);
router.patch('/reports/:reportId/status', authenticate, requireRole(['admin']), validateRequest(reportIdParamSchema, 'params'), validateRequest(updateReportStatusSchema, 'body'), adminController.updateReportStatus);
router.post('/reports/:reportId/send-message', authenticate, requireRole(['admin']), validateRequest(reportIdParamSchema, 'params'), validateRequest(sendMessageToUserSchema, 'body'), adminController.sendMessageToReportedUser);

// Gestión de reportes de reseñas: listar reportes de reseñas
router.get('/review-reports', authenticate, requireRole(['admin']), validateRequest(listReviewReportsQuery, 'query'), adminController.listReviewReports);

// Moderación de reseñas: ocultar/mostrar reseñas
router.patch(
  '/reviews/:reviewId/visibility',
  authenticate,
  requireRole(['admin']),
  validateRequest(reviewIdParamSchema, 'params'),
  validateRequest(adminVisibilityBodySchema, 'body'),
  reviewController.adminSetVisibility.bind(reviewController)
);

module.exports = router;
