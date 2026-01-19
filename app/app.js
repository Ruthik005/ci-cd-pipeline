const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// PROMETHEUS METRICS SETUP
// ============================================

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

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

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds.observe(
      { method: req.method, route, status_code: res.statusCode.toString() },
      duration
    );
    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode.toString() });
  });
  next();
});

// ============================================
// DEPLOYMENT INFORMATION
// ============================================

const APP_VERSION = process.env.APP_VERSION || 'standard';
const DEPLOYMENT_STRATEGY = process.env.DEPLOYMENT_STRATEGY || 'standard';

// ============================================
// IN-MEMORY DATABASE (MongoDB would replace this)
// ============================================

let users = [
  { id: '1', email: 'admin@taskflow.com', name: 'Admin User', role: 'admin', createdAt: new Date().toISOString() }
];

let projects = [
  { id: '1', name: 'TaskFlow Pro Development', description: 'Building the next-gen project management platform', ownerId: '1', members: ['1'], createdAt: new Date().toISOString() },
  { id: '2', name: 'CI/CD Pipeline Setup', description: 'Setting up continuous integration and deployment', ownerId: '1', members: ['1'], createdAt: new Date().toISOString() }
];

let tasks = [
  { id: '1', projectId: '1', title: 'Design new landing page', description: 'Create a modern, responsive landing page', status: 'todo', priority: 'high', tag: 'feature', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '2', projectId: '1', title: 'Fix login validation bug', description: 'Email validation not working correctly', status: 'todo', priority: 'urgent', tag: 'bug', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '3', projectId: '1', title: 'Add dark mode support', description: 'Implement theme switching functionality', status: 'todo', priority: 'medium', tag: 'enhancement', assigneeId: null, createdAt: new Date().toISOString() },
  { id: '4', projectId: '1', title: 'Implement user authentication', description: 'JWT-based auth system', status: 'inProgress', priority: 'high', tag: 'feature', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '5', projectId: '2', title: 'Set up CI/CD pipeline', description: 'Configure Jenkins and Kubernetes', status: 'inProgress', priority: 'high', tag: 'enhancement', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '6', projectId: '1', title: 'API rate limiting', description: 'Implement rate limiting middleware', status: 'review', priority: 'medium', tag: 'feature', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '7', projectId: '1', title: 'Database schema design', description: 'Design MongoDB schemas', status: 'done', priority: 'high', tag: 'feature', assigneeId: '1', createdAt: new Date().toISOString() },
  { id: '8', projectId: '2', title: 'Project setup', description: 'Initial repository and project structure', status: 'done', priority: 'low', tag: 'enhancement', assigneeId: '1', createdAt: new Date().toISOString() }
];

let idCounter = 100;
const generateId = () => String(++idCounter);

// ============================================
// HEALTH & READINESS ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// ============================================
// VERSION / STATUS ENDPOINT
// ============================================

app.get('/api/status', (req, res) => {
  res.json({
    app: 'TaskFlow Pro API',
    version: '1.0.0',
    deploymentVersion: APP_VERSION,
    deploymentStrategy: DEPLOYMENT_STRATEGY,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats: {
      users: users.length,
      projects: projects.length,
      tasks: tasks.length
    }
  });
});

app.get('/api/version', (req, res) => {
  const versionInfo = {
    blue: { color: '#3b82f6', label: 'BLUE - Production', description: 'Stable production environment' },
    green: { color: '#10b981', label: 'GREEN - Staging', description: 'Pre-production testing environment' },
    canary: { color: '#f59e0b', label: 'CANARY', description: 'Experimental release (10% traffic)' },
    stable: { color: '#8b5cf6', label: 'STABLE', description: 'Standard deployment' }
  };

  res.json({
    current: APP_VERSION,
    strategy: DEPLOYMENT_STRATEGY,
    info: versionInfo[APP_VERSION] || versionInfo.stable,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// AUTH ENDPOINTS (Simplified - no real auth)
// ============================================

app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }

  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const newUser = {
    id: generateId(),
    email,
    name,
    role: 'member',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  res.status(201).json({ user: newUser, token: 'mock-jwt-token-' + newUser.id });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ user, token: 'mock-jwt-token-' + user.id });
});

// ============================================
// USER ENDPOINTS
// ============================================

app.get('/api/users', (req, res) => {
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ============================================
// PROJECT ENDPOINTS
// ============================================

app.get('/api/projects', (req, res) => {
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const project = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const { name, description, ownerId } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const newProject = {
    id: generateId(),
    name,
    description: description || '',
    ownerId: ownerId || '1',
    members: [ownerId || '1'],
    createdAt: new Date().toISOString()
  };

  projects.push(newProject);
  res.status(201).json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const index = projects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  projects[index] = { ...projects[index], ...req.body, id: req.params.id };
  res.json(projects[index]);
});

app.delete('/api/projects/:id', (req, res) => {
  const index = projects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });

  projects.splice(index, 1);
  // Also delete associated tasks
  tasks = tasks.filter(t => t.projectId !== req.params.id);
  res.status(204).send();
});

// ============================================
// TASK ENDPOINTS
// ============================================

app.get('/api/tasks', (req, res) => {
  const { projectId, status, priority, assigneeId } = req.query;
  let filtered = tasks;

  if (projectId) filtered = filtered.filter(t => t.projectId === projectId);
  if (status) filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  if (assigneeId) filtered = filtered.filter(t => t.assigneeId === assigneeId);

  res.json(filtered);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const { projectId, title, description, status, priority, tag, assigneeId } = req.body;

  if (!projectId || !title) {
    return res.status(400).json({ error: 'Project ID and title are required' });
  }

  const project = projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const newTask = {
    id: generateId(),
    projectId,
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    tag: tag || 'feature',
    assigneeId: assigneeId || null,
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Task not found' });

  tasks[index] = {
    ...tasks[index],
    ...req.body,
    id: req.params.id,
    updatedAt: new Date().toISOString()
  };
  res.json(tasks[index]);
});

app.patch('/api/tasks/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['todo', 'inProgress', 'review', 'done'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Valid status required: ' + validStatuses.join(', ') });
  }

  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Task not found' });

  tasks[index].status = status;
  tasks[index].updatedAt = new Date().toISOString();
  res.json(tasks[index]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Task not found' });

  tasks.splice(index, 1);
  res.status(204).send();
});

// ============================================
// DASHBOARD STATS ENDPOINT
// ============================================

app.get('/api/dashboard/stats', (req, res) => {
  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'inProgress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  const tasksByPriority = {
    urgent: tasks.filter(t => t.priority === 'urgent').length,
    high: tasks.filter(t => t.priority === 'high').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    low: tasks.filter(t => t.priority === 'low').length
  };

  res.json({
    totalTasks: tasks.length,
    totalProjects: projects.length,
    totalUsers: users.length,
    tasksByStatus,
    tasksByPriority,
    completionRate: tasks.length > 0 ? (tasksByStatus.done / tasks.length * 100).toFixed(1) : 0,
    deploymentVersion: APP_VERSION,
    deploymentStrategy: DEPLOYMENT_STRATEGY
  });
});

// ============================================
// HOME PAGE (HTML for direct access)
// ============================================

app.get('/', (req, res) => {
  const versionColor = APP_VERSION === 'blue' ? '#3b82f6' :
    APP_VERSION === 'green' ? '#10b981' :
      APP_VERSION === 'canary' ? '#f59e0b' : '#8b5cf6';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TaskFlow Pro API - ${APP_VERSION.toUpperCase()}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          padding: 3rem;
          background: rgba(255,255,255,0.05);
          border-radius: 24px;
          border: 2px solid ${versionColor};
          box-shadow: 0 0 60px ${versionColor}40;
          max-width: 600px;
        }
        .version-badge {
          background: ${versionColor};
          padding: 12px 32px;
          border-radius: 50px;
          font-size: 20px;
          font-weight: 700;
          display: inline-block;
          margin-bottom: 24px;
          text-transform: uppercase;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 20px ${versionColor}; }
          50% { box-shadow: 0 0 40px ${versionColor}; }
        }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; }
        .subtitle { color: #94a3b8; margin-bottom: 2rem; font-size: 1.1rem; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 2rem; }
        .stat { background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 12px; }
        .stat-value { font-size: 2rem; font-weight: 700; color: ${versionColor}; }
        .stat-label { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; }
        .endpoints { margin-top: 2rem; text-align: left; background: rgba(0,0,0,0.3); padding: 1.5rem; border-radius: 12px; }
        .endpoints h3 { margin-bottom: 1rem; color: ${versionColor}; }
        .endpoint { font-family: monospace; color: #94a3b8; margin: 0.5rem 0; font-size: 0.9rem; }
        .endpoint span { color: #22c55e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="version-badge">🚀 ${APP_VERSION} VERSION</div>
        <h1>TaskFlow Pro API</h1>
        <p class="subtitle">Project Management Backend Service<br/>Strategy: <strong>${DEPLOYMENT_STRATEGY}</strong></p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value">${users.length}</div>
            <div class="stat-label">Users</div>
          </div>
          <div class="stat">
            <div class="stat-value">${projects.length}</div>
            <div class="stat-label">Projects</div>
          </div>
          <div class="stat">
            <div class="stat-value">${tasks.length}</div>
            <div class="stat-label">Tasks</div>
          </div>
        </div>
        
        <div class="endpoints">
          <h3>📡 API Endpoints</h3>
          <div class="endpoint"><span>GET</span> /api/status</div>
          <div class="endpoint"><span>GET</span> /api/projects</div>
          <div class="endpoint"><span>GET</span> /api/tasks</div>
          <div class="endpoint"><span>GET</span> /api/dashboard/stats</div>
          <div class="endpoint"><span>GET</span> /health</div>
          <div class="endpoint"><span>GET</span> /metrics</div>
        </div>
        
        <p style="margin-top: 2rem; color: #64748b; font-size: 0.875rem;">
          Uptime: ${Math.floor(process.uptime())}s | Version: 1.0.0
        </p>
      </div>
    </body>
    </html>
  `);
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 TaskFlow Pro API listening on http://localhost:${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
  console.log(`🏷️  Version: ${APP_VERSION} | Strategy: ${DEPLOYMENT_STRATEGY}`);
});