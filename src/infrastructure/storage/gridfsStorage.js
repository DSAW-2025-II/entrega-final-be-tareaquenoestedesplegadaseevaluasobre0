// Almacenamiento GridFS: servicio para guardar y recuperar archivos desde MongoDB GridFS
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');

// Obtener bucket de GridFS para un nombre específico
function getBucket(bucketName = 'uploads') {
  const db = mongoose.connection.db;
  return new GridFSBucket(db, { bucketName });
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
  const bucket = getBucket();
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
  const bucket = getBucket();
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
  const bucket = getBucket();
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
    const bucket = getBucket();
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

