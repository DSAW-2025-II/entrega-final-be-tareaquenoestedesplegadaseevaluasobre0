/**
 * Configuración de preferencias de notificación: metadatos y guardas de seguridad.
 * Exporta un mapa de tipos de notificación críticos y qué canales están bloqueados
 * (no editables) por seguridad. Los clientes pueden llamar al endpoint de metadatos para descubrir
 * qué pares evento/canal no se pueden deshabilitar.
 */

const locked = {
  // Prevenir que usuarios deshabiliten email para fallos de pago — alerta crítica
  'payment.failed': { email: true },
  // Prevenir deshabilitar email para pago exitoso? mantener flexible — solo ejemplo
  // Agregar más entradas conforme evolucionen los requisitos del producto
};

/**
 * Verifica si un tipo de notificación y canal están bloqueados (no editables).
 */
function isLocked(type, channel) {
  if (!locked[type]) return false;
  return !!locked[type][channel];
}

module.exports = { locked, isLocked };
