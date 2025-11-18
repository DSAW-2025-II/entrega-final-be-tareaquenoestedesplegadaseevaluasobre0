/**
 * Script para limpiar solo los viajes (TripOffers) de la base de datos
 * 
 * Uso: node scripts/clear-trips.js
 * 
 * ADVERTENCIA: Este script elimina TODOS los viajes de la base de datos.
 * No afecta usuarios, reservas, vehículos u otras colecciones.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TripOfferModel = require('../src/infrastructure/database/models/TripOfferModel');

async function clearTrips() {
  try {
    // Conectar a MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/wheels-unisabana';
    console.log('Conectando a MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✓ Conectado a MongoDB');

    // Contar viajes antes de eliminar
    const countBefore = await TripOfferModel.countDocuments();
    console.log(`\n📊 Viajes encontrados: ${countBefore}`);

    if (countBefore === 0) {
      console.log('No hay viajes para eliminar.');
      await mongoose.disconnect();
      return;
    }

    // Confirmar eliminación
    console.log(`\n⚠️  ADVERTENCIA: Se eliminarán ${countBefore} viaje(s) de la base de datos.`);
    console.log('Presiona Ctrl+C para cancelar, o espera 5 segundos para continuar...\n');
    
    // Esperar 5 segundos para dar tiempo de cancelar
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Eliminar todos los viajes
    console.log('Eliminando viajes...');
    const result = await TripOfferModel.deleteMany({});
    
    console.log(`\n✓ Eliminación completada:`);
    console.log(`  - Viajes eliminados: ${result.deletedCount}`);
    
    // Verificar que se eliminaron todos
    const countAfter = await TripOfferModel.countDocuments();
    console.log(`  - Viajes restantes: ${countAfter}`);

    if (countAfter === 0) {
      console.log('\n✅ Todos los viajes han sido eliminados exitosamente.');
    } else {
      console.log(`\n⚠️  Advertencia: Aún quedan ${countAfter} viaje(s) en la base de datos.`);
    }

  } catch (error) {
    console.error('\n❌ Error al limpiar viajes:', error);
    process.exit(1);
  } finally {
    // Desconectar de MongoDB
    await mongoose.disconnect();
    console.log('\n✓ Desconectado de MongoDB');
  }
}

// Ejecutar el script
clearTrips();

