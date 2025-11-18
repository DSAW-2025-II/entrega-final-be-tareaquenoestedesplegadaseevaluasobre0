// Handler serverless para Vercel: exporta la app Express como función serverless
// Este archivo es el punto de entrada para las funciones serverless de Vercel
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../src/app');

// Variable global para mantener la conexión a la base de datos entre invocaciones
let dbConnectionPromise = null;

// Función para conectar a la base de datos (reutiliza conexión si ya existe)
async function ensureDBConnection() {
  // Si ya hay una conexión activa, reutilizarla
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Si hay una promesa de conexión en progreso, esperarla
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  // Crear nueva conexión
  dbConnectionPromise = (async () => {
    try {
      const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGODB_URI || process.env.MONGODB_URI_TEST;
      
      if (!mongoUri) {
        throw new Error('MongoDB URI not configured. Set MONGODB_URI environment variable.');
      }

      const options = {};
      await mongoose.connect(mongoUri, options);
      
      console.log(`[Serverless] MongoDB connected: ${mongoose.connection.host}`);
      console.log(`[Serverless] Database: ${mongoose.connection.name}`);
      
      return true;
    } catch (error) {
      console.error('[Serverless] MongoDB connection error:', error);
      dbConnectionPromise = null; // Reset para permitir reintentos
      throw error;
    }
  })();

  return dbConnectionPromise;
}

// Handler serverless: se ejecuta en cada request
// Vercel espera que retornemos una Promise que se resuelve cuando Express termina
module.exports = async (req, res) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Conectar a la base de datos si no está conectado
      await ensureDBConnection();
      
      // Interceptar el evento 'finish' de la respuesta para resolver la Promise
      res.on('finish', () => {
        resolve();
      });
      
      // Manejar errores de Express
      res.on('error', (error) => {
        console.error('[Serverless] Response error:', error);
        reject(error);
      });
      
      // Pasar el request a Express
      app(req, res);
    } catch (error) {
      console.error('[Serverless] Handler error:', error);
      
      // Si no hay respuesta enviada aún, enviar error
      if (!res.headersSent) {
        res.status(500).json({
          code: 'server_error',
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
      }
      
      resolve(); // Resolver incluso si hay error para evitar timeout
    }
  });
};

