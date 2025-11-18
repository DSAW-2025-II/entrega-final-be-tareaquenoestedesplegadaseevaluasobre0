/**
 * Punto de entrada del servidor: inicializa la aplicación Express, conecta a la base de datos,
 * configura trabajos cron para tareas periódicas y maneja el cierre graceful del servidor.
 */
require('dotenv').config();
const app = require('./app');
const cron = require('node-cron');
const connectDB = require('./infrastructure/database/connection');
const TripReminderService = require('./domain/services/TripReminderService');

const PORT = process.env.PORT || 3000;

/**
 * Inicia el servidor: conecta a la base de datos, inicializa servicios de ciclo de vida,
 * configura trabajos cron y arranca el servidor HTTP.
 */
async function startServer() {
  try {
    // Conectar a la base de datos MongoDB
    await connectDB();
    
    // Inicializar servicio de recordatorios de viaje
    const tripReminderService = new TripReminderService();
    
    // Inicializar servicio de ciclo de vida de pagos
    const PaymentLifecycleService = require('./domain/services/PaymentLifecycleService');
    const paymentLifecycleService = new PaymentLifecycleService();
    
    // Trabajo cron: verificar y enviar recordatorios de viaje cada minuto
    // Se ejecuta en el segundo 0 de cada minuto: '0 * * * * *'
    cron.schedule('0 * * * * *', async () => {
      await tripReminderService.checkAndSendReminders();
    });
    
    // Trabajo cron: cancelar reservas no pagadas de pasajeros (no viajes completos) para viajes completados
    // IMPORTANTE: Cancela reservas individuales, no viajes completos
    // Se ejecuta cada minuto en el segundo 30: '30 * * * * *'
    cron.schedule('30 * * * * *', async () => {
      try {
        await paymentLifecycleService.cancelUnpaidBookingsBeforeTrip();
      } catch (error) {
        console.error('[Server] Error in payment lifecycle job:', error);
      }
    });
    
    console.log('[Server] Trip reminder scheduler started (runs every minute)');
    console.log('[Server] Payment lifecycle scheduler started (runs every minute)');
    
    // Iniciar servidor HTTP en el puerto configurado
    const server = app.listen(PORT, () => {
      console.log(`[Server] Server running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(`[Server] User registration: http://localhost:${PORT}/api/users`);
      console.log(`[Server] API Docs: http://localhost:${PORT}/api-docs`);
    });

    // Manejo de cierre graceful: SIGTERM (terminación normal del proceso)
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

    // Manejo de cierre graceful: SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();

