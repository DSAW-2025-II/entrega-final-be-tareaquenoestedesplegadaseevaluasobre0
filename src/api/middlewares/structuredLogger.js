// Middleware de logger estructurado: proporciona logging estructurado con redacción de PII, seguimiento de latencia y correlation IDs
// Campos que contienen PII y deben ser redactados en logs
const PII_FIELDS = [
  'password',
  'corporateEmail',
  'email',
  'phone',
  'firstName',
  'lastName',
  'universityId',
  'profilePhoto',
  'vehiclePhoto',
  'soatPhoto'
];

// Redactar PII de un objeto
function redactPII(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPII(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Obtener identificador seguro de usuario para logging (sin PII)
 * @param {Object} req - Express request
 * @returns {string} - Safe user identifier
 */
function getSafeUserId(req) {
  return req.user?.id || req.body?.driverId || req.query?.driverId || 'anonymous';
}

/**
 * Structured logger middleware
 * Logs request/response with timing, status, and correlation ID
 */
const structuredLogger = (req, res, next) => {
  const startTime = Date.now();
  const { method, originalUrl, ip } = req;

  // Log incoming request
  const requestLog = {
    type: 'request',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId,
    method,
    path: originalUrl,
    ip,
    userId: getSafeUserId(req),
    userAgent: req.get('user-agent') || 'unknown',
    // Only log query params (no body to avoid PII in logs)
    query: redactPII(req.query)
  };

  console.log(JSON.stringify(requestLog));

  // Attach a minimal structured logger to the request so controllers can use
  // `req.log.info/error` without depending on external logging middleware.
  // The logger will redact PII and include the correlationId automatically.
  req.log = {
    info: (meta, message) => {
      try {
        const payload = Object.assign({}, redactPII(meta || {}), { correlationId: req.correlationId, message });
        console.log(JSON.stringify(payload));
      } catch (err) {
        console.log(message, meta);
      }
    },
    error: (meta, message) => {
      try {
        const payload = Object.assign({}, redactPII(meta || {}), { correlationId: req.correlationId, message });
        console.error(JSON.stringify(payload));
      } catch (err) {
        console.error(message, meta);
      }
    },
    debug: (meta, message) => {
      try {
        const payload = Object.assign({}, redactPII(meta || {}), { correlationId: req.correlationId, message });
        console.log(JSON.stringify(payload));
      } catch (err) {
        console.log(message, meta);
      }
    }
  };

  // Intercept response to log completion
  const originalSend = res.send;
  const originalJson = res.json;

  const logResponse = () => {
    const latency = Date.now() - startTime;
    const responseLog = {
      type: 'response',
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId,
      method,
      path: originalUrl,
      status: res.statusCode,
      latency: `${latency}ms`,
      userId: getSafeUserId(req)
    };

    // Add error details if response is an error
    if (res.statusCode >= 400 && res.locals.errorCode) {
      responseLog.error = {
        code: res.locals.errorCode,
        message: res.locals.errorMessage
      };
    }

    console.log(JSON.stringify(responseLog));
  };

  res.send = function(data) {
    logResponse();
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    // Capture error details if present
    if (res.statusCode >= 400 && data && typeof data === 'object') {
      res.locals.errorCode = data.code;
      res.locals.errorMessage = data.message;
    }
    logResponse();
    return originalJson.call(this, data);
  };

  next();
};

module.exports = {
  structuredLogger,
  redactPII
};

