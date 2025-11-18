// Conexión a MongoDB: configuración y gestión de conexión a base de datos
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
    };

  // Preferir URI de test en memoria cuando es proporcionada por helper de test
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGODB_URI || process.env.MONGODB_URI_TEST;
  // Conectar a MongoDB
  const conn = await mongoose.connect(mongoUri, options);
    
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    console.log(`[MongoDB] Database: ${conn.connection.name}`);

    try {
      // Crear índices únicos para usuarios
      await conn.connection.db.collection('users').createIndexes([
        { key: { corporateEmail: 1 }, unique: true, name: 'corporateEmail_unique' },
        { key: { universityId: 1 }, unique: true, name: 'universityId_unique' },
        { key: { phone: 1 }, unique: true, name: 'phone_unique' }
      ]);
      
      // Crear índices para vehículos
      await conn.connection.db.collection('vehicles').createIndexes([
        { key: { plate: 1 }, unique: true, name: 'plate_unique' },
        { key: { driverId: 1 }, unique: false, name: 'driverId_index' }
      ]);
      
      console.log('[MongoDB] Indexes verified and created');
    } catch (indexError) {
      // Si los índices ya existen, está bien
      if (indexError.code === 85 || indexError.codeName === 'IndexOptionsConflict') {
        console.log('[MongoDB] Indexes already exist');
      } else {
        console.warn('[MongoDB] Index creation warning:', indexError.message);
      }
    }
    
  } catch (error) {
    console.error('[MongoDB] Connection error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1); // Salir si no se puede conectar a la DB
  }
};

// Event handlers para monitoreo de conexión: eventos de conexión, error y desconexión
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('[MongoDB] Mongoose disconnected from DB');
});

// Manejo de cierre graceful: cerrar conexión al terminar aplicación
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('[MongoDB] Mongoose connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('[MongoDB] Error closing mongoose connection:', err);
    process.exit(1);
  }
});

module.exports = connectDB;

