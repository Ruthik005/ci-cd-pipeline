const express = require('express');
const promClient = require('prom-client');

const app = express();

// ============================================
// PROMETHEUS METRICS SETUP
// ============================================

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for HTTP requests
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});
register.registerMetric(httpRequestDurationMicroseconds);

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

const httpErrorsTotal = new promClient.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (5xx)',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpErrorsTotal);

// Middleware to track request metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const statusCode = res.statusCode.toString();

    httpRequestDurationMicroseconds.observe(
      { method: req.method, route, status_code: statusCode },
      duration
    );

    httpRequestsTotal.inc({ method: req.method, route, status_code: statusCode });

    // Track 5xx errors
    if (res.statusCode >= 500) {
      httpErrorsTotal.inc({ method: req.method, route, status_code: statusCode });
    }
  });

  next();
});

// ============================================
// HEALTH & READINESS ENDPOINTS (for K8s probes)
// ============================================

// Liveness probe - is the app alive?
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Readiness probe - is the app ready to receive traffic?
app.get('/ready', (req, res) => {
  // Add any readiness checks here (DB connection, etc.)
  res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
});

// ============================================
// PROMETHEUS METRICS ENDPOINT
// ============================================

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// ============================================
// APPLICATION ROUTES
// ============================================

// Get deployment info from environment
const APP_VERSION = process.env.APP_VERSION || 'standard';
const DEPLOYMENT_STRATEGY = process.env.DEPLOYMENT_STRATEGY || 'standard';

app.get('/', (req, res) => {
  const versionColor = APP_VERSION === 'blue' ? '#3b82f6' :
    APP_VERSION === 'green' ? '#10b981' :
      APP_VERSION === 'canary' ? '#f59e0b' : '#6366f1';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CI/CD App - ${APP_VERSION.toUpperCase()}</title>
      <style>
        body {
          font-family: 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          border: 2px solid ${versionColor};
          box-shadow: 0 0 30px ${versionColor}40;
        }
        .version-badge {
          background: ${versionColor};
          padding: 10px 30px;
          border-radius: 30px;
          font-size: 24px;
          font-weight: bold;
          display: inline-block;
          margin-bottom: 20px;
          text-transform: uppercase;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 10px ${versionColor}; }
          50% { box-shadow: 0 0 30px ${versionColor}; }
        }
        h1 { font-size: 32px; margin: 20px 0; }
        .strategy { color: #94a3b8; font-size: 18px; }
        .features { margin-top: 30px; color: #cbd5e1; }
        .feature { 
          display: inline-block; 
          background: rgba(255,255,255,0.1); 
          padding: 8px 16px; 
          margin: 5px;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="version-badge">🚀 ${APP_VERSION} VERSION</div>
        <h1>CI/CD Application</h1>
        <p class="strategy">Deployment Strategy: <strong>${DEPLOYMENT_STRATEGY}</strong></p>
        <div class="features">
          <span class="feature">✅ DevSecOps</span>
          <span class="feature">📊 Observability</span>
          <span class="feature">🔥 Chaos Engineering</span>
          <span class="feature">🔵🟢 Blue-Green</span>
          <span class="feature">🐤 Canary</span>
        </div>
        <p style="margin-top: 30px; color: #64748b;">
          Version: 2.0.0 | Uptime: ${Math.floor(process.uptime())}s
        </p>
      </div>
    </body>
    </html>
  `);
});

// Example API endpoint - Shows deployment version
app.get('/api/status', (req, res) => {
  res.json({
    app: 'ci-cd-app',
    version: '2.0.0',
    deploymentVersion: APP_VERSION,
    deploymentStrategy: DEPLOYMENT_STRATEGY,
    features: ['DevSecOps', 'Observability', 'Chaos Engineering', 'Blue-Green Deployment', 'Canary Deployment'],
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ERROR HANDLING (for testing 5xx metrics)
// ============================================

app.get('/api/error-test', (req, res) => {
  res.status(500).json({ error: 'Intentional error for testing' });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
  console.log(`✅ Readiness check at http://localhost:${PORT}/ready`);
});