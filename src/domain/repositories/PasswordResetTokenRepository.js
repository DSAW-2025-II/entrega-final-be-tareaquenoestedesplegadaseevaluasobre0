/**
 * Interfaz de repositorio de token de restablecimiento de contraseña: abstracción a nivel de dominio para operaciones de tokens.
 * Esta interfaz define el contrato que las implementaciones de infraestructura deben seguir.
 * 
 * Separación de responsabilidades:
 * - Capa de dominio define QUÉ operaciones se necesitan
 * - Capa de infraestructura define CÓMO se implementan
 */

class PasswordResetTokenRepository {
  /**
   * Crea un nuevo token de restablecimiento de contraseña.
   * 
   * @param {Object} tokenData - Datos del token
   * @param {string} tokenData.userId - ID del usuario
   * @param {string} tokenData.tokenHash - Hash SHA-256
   * @param {Date} tokenData.expiresAt - Timestamp de expiración
   * @param {string} [tokenData.createdIp] - Dirección IP
   * @param {string} [tokenData.createdUa] - User-Agent
   * @returns {Promise<Object>} - Token creado
   */
  async create(tokenData) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca token por hash.
   * 
   * @param {string} tokenHash - Hash SHA-256
   * @returns {Promise<Object|null>} - Token o null
   */
  async findByHash(tokenHash) {
    throw new Error('Method not implemented');
  }

  /**
   * Busca token válido (no expirado, no consumido).
   * 
   * @param {string} tokenHash - Hash SHA-256
   * @returns {Promise<Object|null>} - Token válido o null
   */
  async findValidToken(tokenHash) {
    throw new Error('Method not implemented');
  }

  /**
   * Marca token como consumido (idempotente).
   * 
   * @param {string} tokenHash - Hash del token
   * @returns {Promise<Object|null>} - Token actualizado o null
   */
  async consumeToken(tokenHash) {
    throw new Error('Method not implemented');
  }

  /**
   * Invalida todos los tokens activos de un usuario.
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>} - Conteo de tokens invalidados
   */
  async invalidateActiveTokens(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Cuenta tokens activos para un usuario.
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<number>} - Conteo de tokens
   */
  async countActiveForUser(userId) {
    throw new Error('Method not implemented');
  }

  /**
   * Limpia tokens expirados.
   * 
   * @returns {Promise<number>} - Conteo eliminado
   */
  async cleanupExpired() {
    throw new Error('Method not implemented');
  }

  /**
   * Obtiene todos los tokens de un usuario (auditoría/debug).
   * 
   * @param {string} userId - ID del usuario
   * @returns {Promise<Array>} - Documentos de tokens
   */
  async findByUserId(userId) {
    throw new Error('Method not implemented');
  }
}

module.exports = PasswordResetTokenRepository;
