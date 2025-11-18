// Esquemas de validación de autenticación (Joi): validan peticiones relacionadas con autenticación
const Joi = require('joi');

// Esquema de login: corporateEmail (email válido requerido), password (mínimo 8 caracteres requerido)
// Nota: validamos formato aquí pero no revelamos si el email existe en la respuesta de error (previene enumeración de usuarios)
const loginSchema = Joi.object({
  corporateEmail: Joi.string()
    .email()
    .required()
    .trim()
    .lowercase()
    .messages({
      'string.email': 'corporateEmail must be a valid email address',
      'any.required': 'corporateEmail is required',
      'string.empty': 'corporateEmail cannot be empty'
    }),
  
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'password must be at least 8 characters long',
      'any.required': 'password is required',
      'string.empty': 'password cannot be empty'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema de solicitud de restablecimiento de contraseña: corporateEmail (email válido requerido)
// Seguridad: siempre retorna éxito genérico, nunca revela si el email existe
const passwordResetRequestSchema = Joi.object({
  corporateEmail: Joi.string()
    .email()
    .required()
    .trim()
    .lowercase()
    .messages({
      'string.email': 'corporateEmail must be a valid email address',
      'any.required': 'corporateEmail is required',
      'string.empty': 'corporateEmail cannot be empty'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema de restablecimiento de contraseña (canje de token): token (string base64url requerido), newPassword (contraseña fuerte requerida)
// Requisitos de contraseña: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial
const passwordResetSchema = Joi.object({
  token: Joi.string()
    .required()
    .trim()
    .pattern(/^[A-Za-z0-9_-]+$/)  // Base64url characters only
    .min(43)  // 32 bytes base64url encoded = 43+ chars
    .messages({
      'string.pattern.base': 'token must be a valid reset token',
      'string.min': 'token appears to be invalid',
      'any.required': 'token is required',
      'string.empty': 'token cannot be empty'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.min': 'newPassword must be at least 8 characters long',
      'string.max': 'newPassword must not exceed 128 characters',
      'string.pattern.base': 'newPassword must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'newPassword is required',
      'string.empty': 'newPassword cannot be empty'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

// Esquema de cambio de contraseña (en sesión): currentPassword (contraseña actual requerida), newPassword (contraseña fuerte requerida)
// Requisitos de contraseña: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial
// Nota: requiere autenticación (cookie JWT)
const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .min(1)  // Just verify it's not empty, actual verification happens in service
    .messages({
      'any.required': 'currentPassword is required',
      'string.empty': 'currentPassword cannot be empty',
      'string.min': 'currentPassword cannot be empty'
    }),
  
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.min': 'newPassword must be at least 8 characters long',
      'string.max': 'newPassword must not exceed 128 characters',
      'string.pattern.base': 'newPassword must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
      'any.required': 'newPassword is required',
      'string.empty': 'newPassword cannot be empty'
    })
}).options({
  abortEarly: false,
  stripUnknown: true
});

module.exports = {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  passwordChangeSchema
};

