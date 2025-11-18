// Middleware de carga de archivos: configuración de Multer para perfiles y vehículos
// Usa almacenamiento en memoria para luego guardar en MongoDB GridFS
const multer = require('multer');
const path = require('path');

// Configuración de storage en memoria: guarda archivos en memoria como Buffer
// Los archivos se guardarán en MongoDB GridFS después de la validación
const memoryStorage = multer.memoryStorage();

// Filtro de archivos: valida que solo se permitan JPEG, PNG y WebP para perfiles y vehículos
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

// Configuración de Multer para perfiles: middleware para carga de foto de perfil única
// Usa memoria para luego guardar en GridFS
const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_PROFILE_PHOTO_MB || '5') * 1024 * 1024 // 5MB por defecto
  }
});

// Configuración de Multer para vehículos: middleware para carga de múltiples archivos (foto de vehículo y SOAT)
// Usa memoria para luego guardar en GridFS
const vehicleUpload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VEHICLE_PHOTO_MB || process.env.MAX_SOAT_PHOTO_MB || '5') * 1024 * 1024 // 5MB por defecto
  }
});

// Filtro de archivos para verificación: permite JPEG, PNG, WebP y PDF
const verificationFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error('Unsupported file type. Only JPEG, PNG, WebP or PDF are allowed.'), false);
};

// Configuración de Multer para verificación: middleware para carga de documentos de verificación
// Usa memoria para luego guardar en GridFS
const verificationUpload = multer({
  storage: memoryStorage,
  fileFilter: verificationFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VERIFICATION_MB || '10') * 1024 * 1024 // 10MB default
  }
});

// Middleware para manejar errores de Multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        code: 'payload_too_large',
        message: 'File exceeds limit',
        correlationId: req.correlationId
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        code: 'invalid_file_type',
        message: 'Unexpected file field',
        correlationId: req.correlationId
      });
    }
  }
  
  if (err && err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({
      code: 'invalid_file_type',
      message: 'Unsupported MIME type',
      correlationId: req.correlationId
    });
  }
  
  next(err);
};

// Middleware de limpieza automática: ya no es necesario limpiar archivos del sistema de archivos
// porque ahora usamos memoria. Los archivos se guardan directamente en GridFS o se descartan.
// Este middleware se mantiene por compatibilidad pero no hace nada.
const cleanupOnError = async (req, res, next) => {
  // Con almacenamiento en memoria, no hay archivos temporales que limpiar
  // Los Buffers se liberan automáticamente por el garbage collector
  next();
};

module.exports = {
  upload, // Middleware para carga de foto de perfil
  vehicleUpload, // Middleware para carga de fotos de vehículo
  handleUploadError, // Middleware para manejar errores de Multer
  cleanupOnError // Middleware para limpiar archivos en caso de error
};
// Exportar middleware de verificación para documentos de conductores
module.exports.verificationUpload = verificationUpload;

