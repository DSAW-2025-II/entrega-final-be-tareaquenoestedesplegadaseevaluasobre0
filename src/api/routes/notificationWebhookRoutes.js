// Rutas de webhooks de notificaciones: maneja eventos de proveedores de email
const express = require('express');
const router = express.Router();

const rawBodyMiddleware = require('../middlewares/rawBody');
const NotificationWebhookController = require('../controllers/notificationWebhookController');

const controller = new NotificationWebhookController();

// POST /notifications/webhooks/email: endpoint público con validación de firma
router.post('/email', rawBodyMiddleware, controller.handleEmailWebhook.bind(controller));

module.exports = router;
