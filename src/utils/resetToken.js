// Utilidad para tokens de restablecimiento de contraseña
// Principios de seguridad:
// - Bytes aleatorios criptográficamente seguros (32 bytes)
// - Codificación base64 URL-safe para tokens
// - Hash SHA-256 para almacenamiento (nunca almacenar tokens en texto plano)
// - Comparación constante en tiempo para verificación de tokens
const crypto = require('crypto');

class ResetTokenUtil {
  // Generar token seguro criptográficamente (43 caracteres base64 URL-safe)
  static generateToken() {
    const tokenBytes = crypto.randomBytes(32);
    
    // Convertir a base64 URL-safe (sin +, /, o =)
    const token = tokenBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return token;
  }

  // Hashear token para almacenamiento seguro (SHA-256 unidireccional)
  static hashToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: must be a non-empty string');
    }

    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  // Verificar token comparándolo con su hash almacenado (comparación timing-safe)
  static verifyToken(plainToken, storedHash) {
    if (!plainToken || !storedHash) {
      return false;
    }

    try {
      const providedHash = this.hashToken(plainToken);
      
      // Comparación constante en tiempo para prevenir ataques de timing
      return crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch (error) {
      // Ataques de timing: siempre tomar el mismo tiempo incluso en error
      return false;
    }
  }

  // Generar timestamp de expiración del token
  static getExpiryTime(minutes = 15) {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  // Verificar si un token ha expirado
  static isExpired(expiryDate) {
    if (!expiryDate) {
      return true; // Sin fecha de expiración significa inválido/expirado
    }

    return new Date() > new Date(expiryDate);
  }

  // Verificar si un token ha sido consumido
  static isConsumed(consumedAt) {
    return consumedAt !== null && consumedAt !== undefined;
  }

  // Generar y hashear token de restablecimiento (método principal)
  static generateResetToken(expiryMinutes = 15) {
    const buf = crypto.randomBytes(32);
    
    // Convertir a base64 URL-safe
    const tokenPlain = buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Hashear para almacenamiento
    const tokenHash = this.hashToken(tokenPlain);
    
    // Calcular expiración
    const expiresAt = this.getExpiryTime(expiryMinutes);

    return {
      tokenPlain,   // Enviar esto al usuario (por email)
      tokenHash,    // Almacenar esto en la base de datos
      expiresAt     // Almacenar esto en la base de datos
    };
  }

  // DEPRECADO: usar generateResetToken() en su lugar
  static createResetToken(expiryMinutes = 15) {
    const result = this.generateResetToken(expiryMinutes);
    return {
      token: result.tokenPlain,
      tokenHash: result.tokenHash,
      expiresAt: result.expiresAt
    };
  }
}

module.exports = ResetTokenUtil;
