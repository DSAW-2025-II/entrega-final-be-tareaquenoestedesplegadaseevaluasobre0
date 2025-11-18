// Middleware de body crudo: preserva body crudo de request para verificación de firma de webhooks
// Debe aplicarse ANTES del middleware express.json()
// Stripe (y otros proveedores) requieren el body crudo para verificar la firma del webhook
function rawBodyMiddleware(req, res, next) {
  // Solo recolectar body crudo para endpoints de webhook
  // Usar originalUrl para que el middleware funcione cuando se monta en routers (req.path puede ser relativo)
  const urlToCheck = req.originalUrl || req.url || '';
  if (urlToCheck.includes('/webhook')) {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      // Almacenar como Buffer para verificación de firma de Stripe
      req.rawBody = Buffer.concat(chunks);
      next();
    });
  } else {
    next();
  }
}

module.exports = rawBodyMiddleware;
