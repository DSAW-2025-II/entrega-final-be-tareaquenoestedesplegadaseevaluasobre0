// Middleware de validación de allow-list para PATCH /users/me
// Fuente única de verdad para campos permitidos/inmutables/desconocidos
// ALLOW-LIST: firstName, lastName, phone, profilePhoto (manejado por upload adapter)
// IMMUTABLE: corporateEmail, universityId, role, id, password
// UNKNOWN: cualquier otro campo no listado arriba

// Fuente única de verdad - Allow-list de campos
const ALLOWED_FIELDS = ['firstName', 'lastName', 'phone'];

// Fuente única de verdad - Campos inmutables
const IMMUTABLE_FIELDS = ['corporateEmail', 'universityId', 'role', 'id', 'password'];

// Validar allow-list en PATCH /users/me
// Valida que no se modifiquen campos inmutables (403) y no se envíen campos desconocidos (400)
const validateAllowList = (req, res, next) => {
  try {
    // Obtener todas las keys del body (sin considerar req.file)
    const bodyKeys = Object.keys(req.body);

    // Si no hay keys en body, puede ser que solo se esté subiendo una foto (req.file)
    // Esto es válido, dejar pasar al controller que verificará req.file
    if (bodyKeys.length === 0) {
      return next();
    }

    // 1. Check for IMMUTABLE fields (403)
    const immutableAttempts = bodyKeys.filter(key => IMMUTABLE_FIELDS.includes(key));
    
    if (immutableAttempts.length > 0) {
      // Cleanup de archivo subido si existe
      if (req.file && req.file.path) {
        const fs = require('fs').promises;
        fs.unlink(req.file.path).catch(err => 
          console.error('Error cleaning up file after immutable field error:', err)
        );
      }

      return res.status(403).json({
        code: 'immutable_field',
        message: 'One or more fields cannot be updated',
        details: immutableAttempts.map(field => ({
          field,
          issue: 'immutable'
        })),
        correlationId: req.correlationId
      });
    }

    // 2. Check for UNKNOWN fields (400)
    const unknownFields = bodyKeys.filter(key => !ALLOWED_FIELDS.includes(key));
    
    if (unknownFields.length > 0) {
      // Cleanup de archivo subido si existe
      if (req.file && req.file.path) {
        const fs = require('fs').promises;
        fs.unlink(req.file.path).catch(err => 
          console.error('Error cleaning up file after unknown field error:', err)
        );
      }

      return res.status(400).json({
        code: 'invalid_schema',
        message: 'Unknown fields provided',
        details: unknownFields.map(field => ({
          field,
          issue: 'unknown field'
        })),
        correlationId: req.correlationId
      });
    }

    // 3. All keys are in allow-list, proceed
    next();

  } catch (error) {
    // Cleanup de archivo en caso de error inesperado
    if (req.file && req.file.path) {
      const fs = require('fs').promises;
      fs.unlink(req.file.path).catch(() => {});
    }
    next(error);
  }
};

module.exports = {
  validateAllowList,
  ALLOWED_FIELDS,
  IMMUTABLE_FIELDS
};

