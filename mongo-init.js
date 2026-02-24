// MongoDB Initialization Script for TaskFlow Pro
// This creates the initial database structure and sample data

// Switch to taskflow database
db = db.getSiblingDB('taskflow');

// Create collections
db.createCollection('users');
db.createCollection('projects');
db.createCollection('tasks');

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.projects.createIndex({ userId: 1 });
db.tasks.createIndex({ projectId: 1 });
db.tasks.createIndex({ status: 1 });

// Insert sample user
db.users.insertOne({
    _id: ObjectId(),
    name: 'Demo User',
    email: 'demo@taskflow.pro',
    password: '$2b$10$hashedpassword', // In real app, this would be bcrypt hashed
    role: 'admin',
    createdAt: new Date()
});

// Insert sample projects
const demoUserId = db.users.findOne({ email: 'demo@taskflow.pro' })._id;

db.projects.insertMany([
    {
        _id: ObjectId(),
        name: 'TaskFlow Pro',
        description: 'Project management platform demonstrating Blue-Green deployment',
        userId: demoUserId,
        status: 'active',
        progress: 68,
        color: '#f97316',
        createdAt: new Date()
    },
    {
        _id: ObjectId(),
        name: 'CI/CD Pipeline',
        description: 'Automated deployment and testing infrastructure',
        userId: demoUserId,
        status: 'active',
        progress: 92,
        color: '#14b8a6',
        createdAt: new Date()
    },
    {
        _id: ObjectId(),
        name: 'Analytics Dashboard',
        description: 'Real-time metrics and insights platform',
        userId: demoUserId,
        status: 'active',
        progress: 45,
        color: '#a855f7',
        createdAt: new Date()
    }
]);

// Get project IDs for tasks
const taskflowProject = db.projects.findOne({ name: 'TaskFlow Pro' });
const cicdProject = db.projects.findOne({ name: 'CI/CD Pipeline' });

// Insert sample tasks
db.tasks.insertMany([
    {
        projectId: taskflowProject._id,
        title: 'Design system documentation',
        description: 'Create comprehensive design system docs',
        status: 'todo',
        priority: 'high',
        tag: 'feature',
        assignee: 'Sarah',
        createdAt: new Date()
    },
    {
        projectId: taskflowProject._id,
        title: 'Fix authentication token refresh',
        description: 'Token expires too quickly',
        status: 'todo',
        priority: 'urgent',
        tag: 'bug',
        assignee: 'Mike',
        createdAt: new Date()
    },
    {
        projectId: taskflowProject._id,
        title: 'Implement WebSocket connections',
        description: 'Real-time updates for collaboration',
        status: 'in-progress',
        priority: 'high',
        tag: 'feature',
        assignee: 'Alex',
        createdAt: new Date()
    },
    {
        projectId: cicdProject._id,
        title: 'Set up CI/CD pipeline',
        description: 'Jenkins + Kubernetes deployment',
        status: 'done',
        priority: 'high',
        tag: 'enhancement',
        assignee: 'DevOps',
        createdAt: new Date()
    },
    {
        projectId: cicdProject._id,
        title: 'Implement Blue-Green deployment',
        description: 'Zero-downtime releases',
        status: 'done',
        priority: 'high',
        tag: 'feature',
        assignee: 'DevOps',
        createdAt: new Date()
    }
]);

print('✅ TaskFlow Pro database initialized successfully!');
print('📊 Created: 1 user, 3 projects, 5 tasks');
