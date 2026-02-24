const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const promClient = require('prom-client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secret-key-2024';
const JWT_EXPIRES_IN = '7d';

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
// MONGODB CONNECTION & SCHEMAS
// ============================================

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:taskflow123@localhost:27017/taskflow?authSource=admin';
console.log('🔗 Attempting to connect to MongoDB with credentials...');

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String },
  role: { type: String, default: 'member' },
  avatar: { type: String },
  timezone: { type: String, default: 'UTC+5:30' },
  notifications: { type: Boolean, default: true },
  theme: { type: String, default: 'sunset' }
}, { timestamps: true });

// Project Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  color: { type: String, default: '#f97316' },
  status: { type: String, default: 'active' }
}, { timestamps: true });

// Task Schema
const taskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['todo', 'inProgress', 'review', 'done'], default: 'todo' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  tag: { type: String, enum: ['feature', 'bug', 'enhancement', 'documentation'], default: 'feature' },
  assignee: { type: String },
  dueDate: { type: Date }
}, { timestamps: true });

// Activity Schema for tracking recent actions
const activitySchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'task_created', 'task_moved', 'project_created', etc.
  description: { type: String, required: true },
  icon: { type: String, default: '📝' },
  color: { type: String, default: '#f97316' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }
}, { timestamps: true });

// Comment Schema for task discussions
const commentSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  author: { type: String, required: true },
  content: { type: String, required: true },
  avatar: { type: String },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Task = mongoose.model('Task', taskSchema);
const Activity = mongoose.model('Activity', activitySchema);
const Comment = mongoose.model('Comment', commentSchema);

// MongoDB Connection with retry logic
let isDbConnected = false;

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    isDbConnected = true;
    console.log('✅ Connected to MongoDB');

    // Seed initial data if empty
    await seedDatabase();
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⏳ Will retry in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

async function seedDatabase() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('📦 Seeding initial data...');

      // Create demo user
      const user = await User.create({
        email: 'demo@taskflow.pro',
        name: 'Demo User',
        role: 'admin'
      });

      // Create sample projects
      const projects = await Project.create([
        { name: 'TaskFlow Pro', description: 'Project management platform demonstrating deployment strategies', ownerId: user._id, members: [user._id], color: '#f97316' },
        { name: 'CI/CD Pipeline', description: 'Automated deployment and testing infrastructure', ownerId: user._id, members: [user._id], color: '#14b8a6' },
        { name: 'Analytics Dashboard', description: 'Real-time metrics and insights platform', ownerId: user._id, members: [user._id], color: '#a855f7' }
      ]);

      // Create sample tasks
      await Task.create([
        { projectId: projects[0]._id, title: 'Design system documentation', description: 'Create comprehensive design system docs', status: 'todo', priority: 'high', tag: 'feature', assignee: 'Sarah' },
        { projectId: projects[0]._id, title: 'Fix authentication token refresh', description: 'Token expires too quickly', status: 'todo', priority: 'urgent', tag: 'bug', assignee: 'Mike' },
        { projectId: projects[0]._id, title: 'Add export to PDF feature', description: 'Allow users to export reports', status: 'todo', priority: 'medium', tag: 'enhancement' },
        { projectId: projects[0]._id, title: 'Implement WebSocket connections', description: 'Real-time updates for collaboration', status: 'inProgress', priority: 'high', tag: 'feature', assignee: 'Alex' },
        { projectId: projects[0]._id, title: 'Database query optimization', description: 'Improve dashboard load times', status: 'inProgress', priority: 'high', tag: 'enhancement', assignee: 'Jordan' },
        { projectId: projects[0]._id, title: 'User permissions refactor', description: 'Role-based access control', status: 'review', priority: 'medium', tag: 'feature', assignee: 'Sarah' },
        { projectId: projects[1]._id, title: 'Set up CI/CD pipeline', description: 'Jenkins + Kubernetes deployment', status: 'done', priority: 'high', tag: 'enhancement', assignee: 'DevOps' },
        { projectId: projects[1]._id, title: 'Implement Blue-Green deployment', description: 'Zero-downtime releases', status: 'done', priority: 'high', tag: 'feature', assignee: 'DevOps' },
        { projectId: projects[2]._id, title: 'Add Prometheus metrics', description: 'Observability setup complete', status: 'done', priority: 'medium', tag: 'enhancement', assignee: 'Alex' }
      ]);

      // Create recent activity
      await Activity.create([
        { type: 'build_complete', description: 'Pipeline build #47 completed', icon: '✅', color: '#4ade80' },
        { type: 'deployment', description: 'Deployed to staging environment', icon: '🔄', color: '#14b8a6' },
        { type: 'task_update', description: "Task 'Database optimization' updated", icon: '📝', color: '#f97316' },
        { type: 'member_joined', description: 'Sarah joined the project', icon: '👤', color: '#a855f7' }
      ]);

      console.log('✅ Database seeded successfully!');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Start DB connection
connectDB();

// ============================================
// HEALTH & READINESS ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: APP_VERSION,
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  if (!isDbConnected) {
    return res.status(503).json({ status: 'not ready', reason: 'database not connected' });
  }
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

app.get('/api/status', async (req, res) => {
  try {
    const [users, projects, tasks] = await Promise.all([
      User.countDocuments(),
      Project.countDocuments(),
      Task.countDocuments()
    ]);

    res.json({
      app: 'TaskFlow Pro API',
      version: '1.0.0',
      deploymentVersion: APP_VERSION,
      deploymentStrategy: DEPLOYMENT_STRATEGY,
      database: isDbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      stats: { users, projects, tasks }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
// AUTH ENDPOINTS
// ============================================

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Allow unauthenticated access but set req.user to null
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    req.user = null;
    next();
  }
};

// Apply auth middleware globally
app.use(authenticateToken);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password with bcrypt
    const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined;

    const user = await User.create({ email, name, password: hashedPassword, role: 'member' });
    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json({ user: userObj, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password with bcrypt (skip for demo users without passwords)
    if (user.password && password) {
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ user: userObj, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER ENDPOINTS
// ============================================

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PROJECT ENDPOINTS
// ============================================

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });

    // Add task counts and progress for each project
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
      const tasks = await Task.find({ projectId: project._id });
      const doneTasks = tasks.filter(t => t.status === 'done').length;
      const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

      return {
        ...project.toObject(),
        taskCount: tasks.length,
        progress,
        memberCount: project.members?.length || 1
      };
    }));

    res.json(projectsWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await Project.create({
      name,
      description: description || '',
      color: color || '#f97316'
    });

    // Log activity
    await Activity.create({
      type: 'project_created',
      description: `Project "${name}" was created`,
      icon: '📁',
      color: color || '#f97316',
      projectId: project._id
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Delete associated tasks
    await Task.deleteMany({ projectId: req.params.id });

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TASK ENDPOINTS
// ============================================

app.get('/api/tasks', async (req, res) => {
  try {
    const { projectId, status, priority } = req.query;
    const filter = {};

    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { projectId, title, description, status, priority, tag, assignee } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'Project ID and title are required' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const task = await Task.create({
      projectId,
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      tag: tag || 'feature',
      assignee: assignee || null
    });

    // Log activity
    await Activity.create({
      type: 'task_created',
      description: `Task "${title}" was created`,
      icon: '✨',
      color: '#4ade80',
      projectId,
      taskId: task._id
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/tasks/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo', 'inProgress', 'review', 'done'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Valid status required: ' + validStatuses.join(', ') });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Log activity
    const statusLabels = { todo: 'To Do', inProgress: 'In Progress', review: 'Review', done: 'Done' };
    await Activity.create({
      type: 'task_moved',
      description: `Task "${task.title}" moved to ${statusLabels[status]}`,
      icon: '🔄',
      color: status === 'done' ? '#4ade80' : '#fbbf24',
      taskId: task._id
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DASHBOARD STATS ENDPOINT
// ============================================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [totalTasks, totalProjects, totalUsers, todoCount, inProgressCount, reviewCount, doneCount] = await Promise.all([
      Task.countDocuments(),
      Project.countDocuments(),
      User.countDocuments(),
      Task.countDocuments({ status: 'todo' }),
      Task.countDocuments({ status: 'inProgress' }),
      Task.countDocuments({ status: 'review' }),
      Task.countDocuments({ status: 'done' })
    ]);

    const tasksByStatus = { todo: todoCount, inProgress: inProgressCount, review: reviewCount, done: doneCount };

    const [urgentCount, highCount, mediumCount, lowCount] = await Promise.all([
      Task.countDocuments({ priority: 'urgent' }),
      Task.countDocuments({ priority: 'high' }),
      Task.countDocuments({ priority: 'medium' }),
      Task.countDocuments({ priority: 'low' })
    ]);

    const tasksByPriority = { urgent: urgentCount, high: highCount, medium: mediumCount, low: lowCount };

    res.json({
      totalTasks,
      totalProjects,
      totalUsers,
      tasksByStatus,
      tasksByPriority,
      completionRate: totalTasks > 0 ? ((doneCount / totalTasks) * 100).toFixed(1) : 0,
      deploymentVersion: APP_VERSION,
      deploymentStrategy: DEPLOYMENT_STRATEGY
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RECENT ACTIVITY ENDPOINT
// ============================================

app.get('/api/activities', async (req, res) => {
  try {
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TASK COMMENTS ENDPOINTS
// ============================================

app.get('/api/tasks/:taskId/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ taskId: req.params.taskId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:taskId/comments', async (req, res) => {
  try {
    const { author, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment content is required' });

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const comment = await Comment.create({
      taskId: req.params.taskId,
      author: author || (req.user ? req.user.email : 'Anonymous'),
      content,
    });

    await Activity.create({
      type: 'comment_added',
      description: `Comment added on "${task.title}"`,
      icon: '💬',
      color: '#3b82f6',
      taskId: task._id,
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SEARCH ENDPOINT
// ============================================

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ tasks: [], projects: [] });

    const regex = new RegExp(q, 'i');

    const [tasks, projects] = await Promise.all([
      Task.find({
        $or: [{ title: regex }, { description: regex }, { assignee: regex }, { tag: regex }]
      }).limit(20),
      Project.find({
        $or: [{ name: regex }, { description: regex }]
      }).limit(10),
    ]);

    res.json({ tasks, projects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
        .db-status { 
          padding: 8px 16px; 
          border-radius: 20px; 
          display: inline-block;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        .db-connected { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }
        .db-disconnected { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; }
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
        
        <div class="db-status ${isDbConnected ? 'db-connected' : 'db-disconnected'}">
          ${isDbConnected ? '✅ MongoDB Connected' : '⚠️ MongoDB Disconnected'}
        </div>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-value" id="users">-</div>
            <div class="stat-label">Users</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="projects">-</div>
            <div class="stat-label">Projects</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="tasks">-</div>
            <div class="stat-label">Tasks</div>
          </div>
        </div>
        
        <div class="endpoints">
          <h3>📡 API Endpoints</h3>
          <div class="endpoint"><span>GET</span> /api/status</div>
          <div class="endpoint"><span>POST</span> /api/auth/register (bcrypt + JWT)</div>
          <div class="endpoint"><span>POST</span> /api/auth/login (bcrypt + JWT)</div>
          <div class="endpoint"><span>GET/POST</span> /api/projects</div>
          <div class="endpoint"><span>GET/POST</span> /api/tasks</div>
          <div class="endpoint"><span>PATCH</span> /api/tasks/:id/status</div>
          <div class="endpoint"><span>GET/POST</span> /api/tasks/:id/comments</div>
          <div class="endpoint"><span>GET</span> /api/search?q=query</div>
          <div class="endpoint"><span>GET</span> /api/dashboard/stats</div>
          <div class="endpoint"><span>GET</span> /api/activities</div>
          <div class="endpoint"><span>GET</span> /metrics (Prometheus)</div>
        </div>
        
        <p style="margin-top: 2rem; color: #64748b; font-size: 0.875rem;">
          Uptime: ${Math.floor(process.uptime())}s | Version: 1.0.0
        </p>
      </div>
      <script>
        fetch('/api/status')
          .then(r => r.json())
          .then(data => {
            document.getElementById('users').textContent = data.stats.users;
            document.getElementById('projects').textContent = data.stats.projects;
            document.getElementById('tasks').textContent = data.stats.tasks;
          })
          .catch(() => {});
      </script>
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