require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Script para ver los datos de la base de datos
 * Muestra un resumen de todas las colecciones y sus documentos
 */

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ Error: MONGODB_URI no está definido en las variables de entorno');
  process.exit(1);
}

async function viewDatabase() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log(`✓ Conectado a: ${mongoose.connection.name}`);
    console.log(`✓ Host: ${mongoose.connection.host}\n`);

    const db = mongoose.connection.db;
    
    // Obtener todas las colecciones
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (collectionNames.length === 0) {
      console.log('ℹ️  No hay colecciones en la base de datos');
      await mongoose.connection.close();
      return;
    }

    console.log(`📋 Encontradas ${collectionNames.length} colecciones:\n`);

    // Para cada colección, mostrar el conteo y algunos documentos de ejemplo
    for (const collectionName of collectionNames) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      console.log(`📦 ${collectionName}:`);
      console.log(`   Total documentos: ${count}`);
      
      if (count > 0) {
        // Mostrar hasta 3 documentos de ejemplo
        const sampleDocs = await collection.find({}).limit(3).toArray();
        console.log(`   Ejemplos (primeros 3):`);
        sampleDocs.forEach((doc, index) => {
          // Mostrar solo campos importantes, limitar tamaño
          const simplified = {};
          Object.keys(doc).slice(0, 5).forEach(key => {
            if (key !== '_id' || index === 0) {
              const value = doc[key];
              if (typeof value === 'object' && value !== null) {
                simplified[key] = typeof value;
              } else {
                simplified[key] = value;
              }
            }
          });
          console.log(`     ${index + 1}.`, JSON.stringify(simplified, null, 2).substring(0, 200) + '...');
        });
      }
      console.log('');
    }

    // Opción para ver una colección específica en detalle
    if (process.argv[2]) {
      const collectionName = process.argv[2];
      if (collectionNames.includes(collectionName)) {
        console.log(`\n📄 Detalles de la colección "${collectionName}":\n`);
        const collection = db.collection(collectionName);
        const allDocs = await collection.find({}).toArray();
        console.log(JSON.stringify(allDocs, null, 2));
      } else {
        console.log(`\n❌ La colección "${collectionName}" no existe`);
        console.log(`Colecciones disponibles: ${collectionNames.join(', ')}`);
      }
    }

    await mongoose.connection.close();
    console.log('\n✓ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

viewDatabase();


