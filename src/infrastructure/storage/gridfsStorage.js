// Almacenamiento GridFS: servicio para guardar y recuperar archivos desde MongoDB GridFS
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');

// Obtener bucket de GridFS para un nombre específico
// Asegura que la conexión esté lista antes de usar GridFS (importante en serverless)
async function getBucket(bucketName = 'uploads') {
  // Estados de conexión de Mongoose:
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  
  console.log(`[GridFS] Getting bucket "${bucketName}", connection state: ${mongoose.connection.readyState}`);
  
  // Si está conectado, usar directamente
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.db;
    if (!db) {
      console.error('[GridFS] MongoDB connection ready but db is null');
      throw new Error('MongoDB database not available');
    }
    console.log(`[GridFS] Using existing connection, database: ${db.databaseName}`);
    return new GridFSBucket(db, { bucketName });
  }
  
  // Si está conectando, esperar a que termine
  if (mongoose.connection.readyState === 2) {
    console.log('[GridFS] Connection in progress, waiting...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[GridFS] Connection timeout after 10 seconds');
        reject(new Error('MongoDB connection timeout'));
      }, 10000);
      
      mongoose.connection.once('connected', () => {
        console.log('[GridFS] Connection established');
        clearTimeout(timeout);
        resolve();
      });
      
      mongoose.connection.once('error', (err) => {
        console.error('[GridFS] Connection error:', err);
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    const db = mongoose.connection.db;
    if (!db) {
      console.error('[GridFS] Connection ready but db is null');
      throw new Error('MongoDB database not available after connection');
    }
    console.log(`[GridFS] Using newly connected database: ${db.databaseName}`);
    return new GridFSBucket(db, { bucketName });
  }
  
  // Si está desconectado o desconectándose, lanzar error
  throw new Error(`MongoDB connection not ready. State: ${mongoose.connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`);
}

/**
 * Guardar archivo en GridFS
 * @param {Buffer|ReadableStream} fileData - Datos del archivo (Buffer o Stream)
 * @param {Object} metadata - Metadatos del archivo
 * @param {string} metadata.filename - Nombre del archivo
 * @param {string} metadata.contentType - Tipo MIME
 * @param {string} metadata.category - Categoría (profiles, vehicles, verifications)
 * @param {string} metadata.userId - ID del usuario propietario (opcional)
 * @returns {Promise<string>} - ID del archivo en GridFS
 */
async function saveFile(fileData, metadata) {
  const bucket = await getBucket();
  const { filename, contentType, category, userId } = metadata;
  
  // Crear stream de escritura
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: contentType || 'application/octet-stream',
    metadata: {
      category: category || 'general',
      userId: userId || null,
      uploadedAt: new Date()
    }
  });
  
  // Convertir Buffer a Stream si es necesario
  let inputStream;
  if (Buffer.isBuffer(fileData)) {
    inputStream = Readable.from(fileData);
  } else {
    inputStream = fileData;
  }
  
  // Pipe del stream de entrada al stream de GridFS
  return new Promise((resolve, reject) => {
    inputStream
      .pipe(uploadStream)
      .on('error', (error) => {
        console.error('[GridFS] Error uploading file:', error);
        reject(error);
      })
      .on('finish', () => {
        const fileId = uploadStream.id.toString();
        console.log(`[GridFS] File saved: ${filename} (ID: ${fileId})`);
        resolve(fileId);
      });
  });
}

/**
 * Leer archivo de GridFS
 * @param {string} fileId - ID del archivo en GridFS
 * @returns {Promise<{stream: ReadableStream, metadata: Object}>}
 */
async function getFile(fileId) {
  const bucket = await getBucket();
  const _id = new mongoose.Types.ObjectId(fileId);
  
  // Verificar que el archivo existe
  const files = await bucket.find({ _id }).toArray();
  if (files.length === 0) {
    throw new Error('File not found');
  }
  
  const fileInfo = files[0];
  const downloadStream = bucket.openDownloadStream(_id);
  
  return {
    stream: downloadStream,
    metadata: {
      filename: fileInfo.filename,
      contentType: fileInfo.contentType,
      length: fileInfo.length,
      uploadDate: fileInfo.uploadDate,
      metadata: fileInfo.metadata || {}
    }
  };
}

/**
 * Eliminar archivo de GridFS
 * @param {string} fileId - ID del archivo en GridFS
 * @returns {Promise<void>}
 */
async function deleteFile(fileId) {
  const bucket = await getBucket();
  const _id = new mongoose.Types.ObjectId(fileId);
  
  return new Promise((resolve, reject) => {
    bucket.delete(_id, (error) => {
      if (error) {
        console.error('[GridFS] Error deleting file:', error);
        reject(error);
      } else {
        console.log(`[GridFS] File deleted: ${fileId}`);
        resolve();
      }
    });
  });
}

/**
 * Verificar si un archivo existe en GridFS
 * @param {string} fileId - ID del archivo en GridFS
 * @returns {Promise<boolean>}
 */
async function fileExists(fileId) {
  try {
    const bucket = await getBucket();
    const _id = new mongoose.Types.ObjectId(fileId);
    const files = await bucket.find({ _id }).toArray();
    return files.length > 0;
  } catch (error) {
    return false;
  }
}

module.exports = {
  saveFile,
  getFile,
  deleteFile,
  fileExists,
  getBucket
};

