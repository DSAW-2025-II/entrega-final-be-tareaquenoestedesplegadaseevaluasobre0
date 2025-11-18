// Rutas para servir archivos desde GridFS
const express = require('express');
const router = express.Router();
const gridfsStorage = require('../../infrastructure/storage/gridfsStorage');
const mongoose = require('mongoose');

/**
 * GET /api/files/:fileId
 * Servir archivo desde GridFS
 * Endpoint público para servir imágenes y documentos almacenados en MongoDB GridFS
 */
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Validar formato de ObjectId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        code: 'invalid_id',
        message: 'Invalid file ID format',
        correlationId: req.correlationId
      });
    }
    
    // Obtener archivo de GridFS
    const { stream, metadata } = await gridfsStorage.getFile(fileId);
    
    // Configurar headers CORS (usar misma lógica que app.js)
    const origin = req.headers.origin;
    const allowedOrigins = process.env.CORS_ORIGINS 
      ? (process.env.CORS_ORIGINS === '*' ? '*' : process.env.CORS_ORIGINS.split(',').map(o => o.trim()))
      : ['http://localhost:5173'];
    const isAllowedOrigin = allowedOrigins === '*' || 
      (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin));
    
    if (isAllowedOrigin || allowedOrigins === '*') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Configurar headers de respuesta
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', metadata.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 año
    res.setHeader('Last-Modified', metadata.uploadDate.toUTCString());
    
    // Stream del archivo al cliente
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('[fileRoutes] Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          code: 'server_error',
          message: 'Error reading file',
          correlationId: req.correlationId
        });
      }
    });
    
  } catch (error) {
    console.error('[fileRoutes] Error serving file:', error);
    
    if (error.message === 'File not found') {
      return res.status(404).json({
        code: 'not_found',
        message: 'File not found',
        correlationId: req.correlationId
      });
    }
    
    res.status(500).json({
      code: 'server_error',
      message: 'Error serving file',
      correlationId: req.correlationId
    });
  }
});

module.exports = router;

