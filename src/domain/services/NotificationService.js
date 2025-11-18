// Servicio de notificaciones: crea notificaciones en la aplicación automáticamente
// Maneja la creación de notificaciones con manejo de errores adecuado (los fallos no interrumpen el flujo principal)
const InAppNotification = require('../../infrastructure/database/models/InAppNotificationModel');

class NotificationService {
  // Crear notificación en la aplicación: userId, type, title, body (opcional), data (opcional), correlationId (opcional)
  static async createNotification(userId, type, title, body = '', data = {}, correlationId = null) {
    try {
      if (!userId || !type || !title) {
        console.warn('[NotificationService] Missing required fields for notification', { userId, type, title });
        return null;
      }

      const notification = await InAppNotification.create({
        userId,
        type,
        title,
        body,
        data,
        correlationId,
        isRead: false
      });

      return notification;
    } catch (error) {
      // No lanzar error - los fallos de notificación no deben interrumpir la lógica de negocio principal
      console.error(`[NotificationService] Failed to create notification | userId: ${userId} | type: ${type}`, error.message);
      return null;
    }
  }

  // Crear múltiples notificaciones (ej: cuando se cancela un viaje para todos los pasajeros)
  // Retorna el número de notificaciones creadas exitosamente
  static async createNotifications(userIds, type, title, body = '', data = {}, correlationId = null) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return 0;
    }

    let successCount = 0;
    const notifications = userIds.map(userId => ({
      userId,
      type,
      title,
      body,
      data,
      correlationId,
      isRead: false
    }));

    try {
      const result = await InAppNotification.insertMany(notifications, { ordered: false });
      successCount = result.length;
    } catch (error) {
      // insertMany puede tener éxito parcial - contar inserciones exitosas
      if (error.writeErrors) {
        successCount = userIds.length - error.writeErrors.length;
        console.warn(`[NotificationService] Partial success creating notifications | succeeded: ${successCount} | failed: ${error.writeErrors.length}`);
      } else {
        console.error(`[NotificationService] Failed to create notifications | type: ${type}`, error.message);
      }
    }

    return successCount;
  }
}

module.exports = NotificationService;

