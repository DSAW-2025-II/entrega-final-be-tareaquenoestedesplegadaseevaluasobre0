// Rutas de notificaciones: listado y marcado de notificaciones como leídas
const express = require('express');
const router = express.Router();

const NotificationController = require('../controllers/notificationController');
const authenticate = require('../middlewares/authenticate');

const controller = new NotificationController();

// GET /notifications: listar notificaciones del usuario (query: status=unread|all, page, pageSize)
router.get('/', authenticate, controller.list.bind(controller));

// PATCH /notifications/read: marcar notificaciones como leídas (body: { ids: [string] })
router.patch('/read', authenticate, controller.markRead.bind(controller));

module.exports = router;
