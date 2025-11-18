// Configuración principal del servidor Express: middlewares y rutas
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

// Middlewares personalizados
const correlationId = require('./api/middlewares/correlationId');
const requestContext = require('./api/middlewares/requestContext');
const errorHandler = require('./api/middlewares/errorHandler');
const { generalRateLimiter } = require('./api/middlewares/rateLimiter');
const { serveSwagger } = require('./api/middlewares/swagger');
const { structuredLogger } = require('./api/middlewares/structuredLogger');
const auditMiddleware = require('./api/middlewares/auditMiddleware');

// Rutas de la API
const userRoutes = require('./api/routes/userRoutes');
const authRoutes = require('./api/routes/authRoutes');
const vehicleRoutes = require('./api/routes/vehicleRoutes');
const notificationWebhookRoutes = require('./api/routes/notificationWebhookRoutes');

const app = express();

// Confiar en proxy reverso (necesario para rate limiting y obtener IPs reales)
app.set('trust proxy', 1);

// Middlewares globales

// Helmet: seguridad HTTP (headers de seguridad)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:5173"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

// CORS: permitir peticiones desde el frontend (otro puerto)
const allowedOrigins = process.env.CORS_ORIGINS 
  ? (process.env.CORS_ORIGINS === '*' ? '*' : process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()))
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins === '*' ? true : allowedOrigins,
  credentials: true, // CRÍTICO: permite cookies (necesario para JWT)
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight 24h
}));

app.use(morgan('combined')); // Logging HTTP
app.use(cookieParser()); // Parsear cookies en req.cookies
app.use(correlationId); // Generar ID único por petición
app.use(requestContext); // Agregar contexto (actor, correlación)
app.use(structuredLogger); // Logging estructurado con redacción de PII
app.use(auditMiddleware); // Auditoría de acciones importantes
app.use(generalRateLimiter); // Limitar peticiones por IP

// Webhooks: montar ANTES del parsing del body (necesitan body crudo para verificar firmas)
app.use('/notifications/webhooks', notificationWebhookRoutes);

const rawBodyMiddleware = require('./api/middlewares/rawBody');
app.use(rawBodyMiddleware); // Guarda body crudo en req.rawBody

const paymentWebhookRoutes = require('./api/routes/paymentWebhookRoutes');
app.use('/api', paymentWebhookRoutes);

// Parsing del body: después de los webhooks
app.use(express.json({ limit: '10mb' })); // Parsear JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parsear form-urlencoded

const paymentRoutes = require('./api/routes/paymentRoutes');
app.use('/api', paymentRoutes);

// Archivos estáticos: servir uploads con headers CORS
// En Vercel serverless, los archivos se guardan en /tmp (efímero), así que no servimos estáticos desde aquí
// Los archivos deberían estar en un servicio de almacenamiento en la nube (S3, Cloudinary, etc.)
const isVercel = process.env.VERCEL === '1';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';

if (!isVercel) {
  // Solo servir archivos estáticos en desarrollo/local
  app.use('/uploads', (req, res, next) => {
    const origin = req.headers.origin;
    const isAllowedOrigin = process.env.CORS_ORIGINS === '*' || 
      (Array.isArray(allowedOrigins) && origin && allowedOrigins.includes(origin));
    
    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Permitir imágenes cross-origin
    next();
  }, express.static(path.join(__dirname, '..', uploadDir)));
} else {
  // En Vercel, responder 404 para rutas de uploads (archivos deberían estar en almacenamiento en la nube)
  app.use('/uploads', (req, res) => {
    res.status(404).json({
      code: 'not_found',
      message: 'Static file serving not available in serverless environment. Files should be stored in cloud storage.',
      correlationId: req.correlationId
    });
  });
}

// Health check: endpoint para verificar que el servidor está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

// Debug: logging temporal para debugging de rutas
app.use((req, res, next) => {
  if (req.path.includes('/api/users') && req.path.includes('/public')) {
    console.log(`[app.js] DEBUG: Request received | method: ${req.method} | path: ${req.path} | originalUrl: ${req.originalUrl} | url: ${req.url}`);
  }
  next();
});

// Rutas de la API
const tripOfferRoutes = require('./api/routes/tripOfferRoutes');
const passengerRoutes = require('./api/routes/passengerRoutes');
const driverRoutes = require('./api/routes/driverRoutes');
const internalRoutes = require('./api/routes/internalRoutes');
const notificationRoutes = require('./api/routes/notificationRoutes');
const reviewRoutes = require('./api/routes/reviewRoutes');
const userReportRoutes = require('./api/routes/userReportRoutes');
const adminRoutes = require('./api/routes/adminRoutes');

// Rutas de usuarios (orden importante: más específicas primero)
app.use('/api/users', (req, res, next) => {
  console.log(`[app.js] /api/users route hit | method: ${req.method} | path: ${req.path} | originalUrl: ${req.originalUrl}`);
  next();
});
app.use('/api/users', userReportRoutes); // Reportar usuarios
app.use('/api/users', userRoutes); // Rutas generales de usuarios

app.use('/auth', authRoutes); // Autenticación
app.use('/api/drivers', vehicleRoutes); // Vehículos
app.use('/drivers', tripOfferRoutes); // Ofertas de viaje
app.use('/drivers', driverRoutes); // Acciones de conductores
app.use('/passengers', passengerRoutes); // Acciones de pasajeros
app.use('/internal', internalRoutes); // Rutas internas (tests, herramientas)
app.use('/notifications', notificationRoutes); // Notificaciones
app.use('/trips', reviewRoutes); // Reseñas
app.use('/admin', adminRoutes); // Administración

// Documentación Swagger
serveSwagger(app);

// Manejo de errores (debe ser el último middleware)
app.use((req, res) => {
  res.status(404).json({
    code: 'not_found',
    message: 'Endpoint not found',
    correlationId: req.correlationId
  });
});

app.use(errorHandler); // Handler global de errores

module.exports = app;

