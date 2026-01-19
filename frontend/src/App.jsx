import { useEffect, useState } from 'react'
import './App.css'

// Get deployment version from environment or default
const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'stable'
const DEPLOYMENT_STRATEGY = import.meta.env.VITE_DEPLOYMENT_STRATEGY || 'standard'

// Version-specific colors for badges
const versionStyles = {
  blue: { color: '#38bdf8', label: '● BLUE VERSION', icon: '🔵' },
  green: { color: '#4ade80', label: '● GREEN VERSION', icon: '🟢' },
  canary: { color: '#fbbf24', label: '🐤 CANARY', icon: '🟡' },
  stable: { color: '#c084fc', label: '● STABLE', icon: '🟣' }
}
const currentVersion = versionStyles[APP_VERSION] || versionStyles.stable

// Initial task data - properly categorized
const initialTasks = {
  todo: [
    { id: 1, title: 'Design system documentation', description: 'Create comprehensive design system docs', tag: 'feature', priority: 'high', assignee: 'Sarah' },
    { id: 2, title: 'Fix authentication token refresh', description: 'Token expires too quickly', tag: 'bug', priority: 'urgent', assignee: 'Mike' },
    { id: 3, title: 'Add export to PDF feature', description: 'Allow users to export reports', tag: 'enhancement', priority: 'medium', assignee: null },
  ],
  inProgress: [
    { id: 4, title: 'Implement WebSocket connections', description: 'Real-time updates for collaboration', tag: 'feature', priority: 'high', assignee: 'Alex' },
    { id: 5, title: 'Database query optimization', description: 'Improve dashboard load times', tag: 'enhancement', priority: 'high', assignee: 'Jordan' },
  ],
  review: [
    { id: 6, title: 'User permissions refactor', description: 'Role-based access control', tag: 'feature', priority: 'medium', assignee: 'Sarah' },
  ],
  done: [
    { id: 7, title: 'Set up CI/CD pipeline', description: 'Jenkins + Kubernetes deployment', tag: 'enhancement', priority: 'high', assignee: 'DevOps' },
    { id: 8, title: 'Implement Blue-Green deployment', description: 'Zero-downtime releases', tag: 'feature', priority: 'high', assignee: 'DevOps' },
    { id: 9, title: 'Add Prometheus metrics', description: 'Observability setup complete', tag: 'enhancement', priority: 'medium', assignee: 'Alex' },
  ]
}

// Sample projects
const initialProjects = [
  { id: 1, name: 'TaskFlow Pro', description: 'Project management platform', progress: 68, color: '#f97316' },
  { id: 2, name: 'CI/CD Pipeline', description: 'Deployment automation', progress: 92, color: '#14b8a6' },
  { id: 3, name: 'Analytics Dashboard', description: 'Real-time metrics & insights', progress: 45, color: '#a855f7' },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [projects] = useState(initialProjects)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isConnected, setIsConnected] = useState(true)

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Simulate connection status
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(Math.random() > 0.05) // 95% uptime simulation
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Task status update function
  const updateTaskStatus = (taskId, newStatus) => {
    const allTasks = Object.entries(tasks).flatMap(([status, list]) =>
      list.map(task => ({ ...task, currentStatus: status }))
    )
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    const oldStatus = task.currentStatus
    setTasks(prev => ({
      ...prev,
      [oldStatus]: prev[oldStatus].filter(t => t.id !== taskId),
      [newStatus]: [...prev[newStatus], { ...task, currentStatus: undefined }]
    }))
  }

  const formatTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-content">
          <a href="#" className="logo">
            <div className="logo-icon">📋</div>
            <span>TaskFlow Pro</span>
          </a>

          <div className="nav-links">
            <button
              className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-link ${currentPage === 'board' ? 'active' : ''}`}
              onClick={() => setCurrentPage('board')}
            >
              Board
            </button>
            <button
              className={`nav-link ${currentPage === 'projects' ? 'active' : ''}`}
              onClick={() => setCurrentPage('projects')}
            >
              Projects
            </button>
            <button
              className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentPage('settings')}
            >
              Settings
            </button>
          </div>

          <div className={`version-badge ${APP_VERSION}`}>
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
            {currentVersion.label}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 2rem 4rem' }}>
        {currentPage === 'dashboard' && (
          <Dashboard
            tasks={tasks}
            projects={projects}
            currentTime={currentTime}
            formatTime={formatTime}
            isConnected={isConnected}
          />
        )}
        {currentPage === 'board' && (
          <KanbanBoard
            tasks={tasks}
            updateTaskStatus={updateTaskStatus}
          />
        )}
        {currentPage === 'projects' && <ProjectsPage projects={projects} />}
        {currentPage === 'settings' && <SettingsPage />}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          TaskFlow Pro v1.0.0 • Strategy: <strong>{DEPLOYMENT_STRATEGY}</strong> •
          Version: <strong style={{ color: currentVersion.color }}>{APP_VERSION.toUpperCase()}</strong> •
          {formatTime(currentTime)}
        </div>
      </footer>
    </div>
  )
}

// ============================================================
// DASHBOARD COMPONENT
// ============================================================
function Dashboard({ tasks, projects, formatTime, isConnected }) {
  const totalTasks = Object.values(tasks).flat().length
  const completedTasks = tasks.done.length
  const inProgressTasks = tasks.inProgress.length
  const todoTasks = tasks.todo.length
  const completionRate = Math.round((completedTasks / totalTasks) * 100)

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        <h1>Welcome to TaskFlow Pro</h1>
        <p>
          Streamline your workflow with powerful Kanban boards, real-time collaboration,
          and intelligent project management.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary">
            ✨ Create New Project
          </button>
          <button className="btn btn-secondary">
            📖 View Documentation
          </button>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedTasks}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{inProgressTasks}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
      </section>

      {/* Info Cards Row */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Deployment Info */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Deployment Status</h3>
            <div className="card-icon">🚀</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <InfoRow label="Environment" value={APP_VERSION.toUpperCase()} valueColor={versionStyles[APP_VERSION]?.color} />
            <InfoRow label="Strategy" value={DEPLOYMENT_STRATEGY} />
            <InfoRow label="Status" value={isConnected ? 'Connected' : 'Reconnecting...'} valueColor={isConnected ? '#4ade80' : '#fbbf24'} />
            <InfoRow label="Health Check" value="Passing ✓" valueColor="#4ade80" />
          </div>
        </div>

        {/* Active Projects */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active Projects</h3>
            <div className="card-icon">📁</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {projects.slice(0, 3).map(project => (
              <div key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{project.name}</span>
                  <span style={{ fontSize: '0.8rem', color: project.color, fontWeight: 600 }}>{project.progress}%</span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${project.progress}%`,
                    height: '100%',
                    background: project.color,
                    borderRadius: '10px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <div className="card-icon">📊</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.9rem' }}>
            <ActivityItem
              icon="✅"
              text="Pipeline build #47 completed"
              time="2 minutes ago"
              color="#4ade80"
            />
            <ActivityItem
              icon="🔄"
              text="Deployed to staging environment"
              time="15 minutes ago"
              color="#14b8a6"
            />
            <ActivityItem
              icon="📝"
              text="Task 'Database optimization' updated"
              time="1 hour ago"
              color="#f97316"
            />
            <ActivityItem
              icon="👤"
              text="Sarah joined the project"
              time="3 hours ago"
              color="#a855f7"
            />
          </div>
        </div>
      </section>
    </>
  )
}

// Helper components
function InfoRow({ label, value, valueColor }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.625rem 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)'
    }}>
      <span style={{ color: 'var(--night-500)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor || 'var(--night-200)' }}>{value}</span>
    </div>
  )
}

function ActivityItem({ icon, text, time, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '0.5rem 0'
    }}>
      <span style={{
        fontSize: '1.1rem',
        background: `${color}15`,
        padding: '0.375rem',
        borderRadius: '8px'
      }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: 'var(--night-200)' }}>{text}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--night-500)' }}>{time}</div>
      </div>
    </div>
  )
}

// ============================================================
// KANBAN BOARD COMPONENT
// ============================================================
function KanbanBoard({ tasks, updateTaskStatus }) {
  const columns = [
    { id: 'todo', title: 'To Do', icon: '📋', color: '#f97316' },
    { id: 'inProgress', title: 'In Progress', icon: '🔄', color: '#fbbf24' },
    { id: 'review', title: 'In Review', icon: '👀', color: '#a855f7' },
    { id: 'done', title: 'Done', icon: '✅', color: '#4ade80' }
  ]

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.25rem'
          }}>
            Project Board
          </h2>
          <p style={{ color: 'var(--night-500)' }}>Drag and drop tasks between columns</p>
        </div>
        <button className="btn btn-primary">
          ➕ Add Task
        </button>
      </div>

      <div className="kanban-board">
        {columns.map(column => (
          <div key={column.id} className="kanban-column">
            <div className="kanban-column-header">
              <span className="kanban-column-title" style={{ color: column.color }}>
                {column.icon} {column.title}
              </span>
              <span className="kanban-column-count">
                {tasks[column.id]?.length || 0}
              </span>
            </div>

            <div>
              {tasks[column.id]?.map(task => (
                <div key={task.id} className="task-card">
                  <div className="task-title">{task.title}</div>
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--night-500)',
                    marginBottom: '0.75rem',
                    lineHeight: 1.5
                  }}>
                    {task.description}
                  </p>
                  <div className="task-meta">
                    <span className={`task-tag ${task.tag}`}>{task.tag}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      color: task.priority === 'urgent' ? '#fb7185' :
                        task.priority === 'high' ? '#fbbf24' :
                          'var(--night-500)'
                    }}>
                      {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟡' : '⚪'} {task.priority}
                    </span>
                    {task.assignee && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '20px',
                        fontSize: '0.7rem'
                      }}>
                        👤 {task.assignee}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ============================================================
// PROJECTS PAGE
// ============================================================
function ProjectsPage({ projects }) {
  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.5rem'
        }}>
          All Projects
        </h2>
        <p style={{ color: 'var(--night-500)' }}>Manage and track all your active projects</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        {projects.map(project => (
          <div key={project.id} className="card" style={{ cursor: 'pointer' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${project.color}30, ${project.color}10)`,
                border: `1px solid ${project.color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}>
                📁
              </div>
              <div>
                <h4 style={{ fontWeight: 600, marginBottom: '0.125rem' }}>{project.name}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--night-500)' }}>{project.description}</p>
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.8rem'
              }}>
                <span style={{ color: 'var(--night-500)' }}>Progress</span>
                <span style={{ fontWeight: 600, color: project.color }}>{project.progress}%</span>
              </div>
              <div style={{
                height: '8px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${project.progress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${project.color}, ${project.color}cc)`,
                  borderRadius: '10px'
                }} />
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: '0.8rem',
              color: 'var(--night-500)'
            }}>
              <span>👥 5 members</span>
              <span>📋 12 tasks</span>
            </div>
          </div>
        ))}

        {/* Add New Project Card */}
        <div className="card" style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          border: '2px dashed rgba(255,255,255,0.1)',
          background: 'transparent'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '0.75rem',
            opacity: 0.5
          }}>➕</div>
          <span style={{ color: 'var(--night-500)' }}>Create New Project</span>
        </div>
      </div>
    </>
  )
}

// ============================================================
// SETTINGS PAGE
// ============================================================
function SettingsPage() {
  const [theme, setTheme] = useState('sunset')
  const [notifications, setNotifications] = useState(true)

  return (
    <>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.5rem'
        }}>
          Settings
        </h2>
        <p style={{ color: 'var(--night-500)' }}>Customize your TaskFlow Pro experience</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Profile Settings */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Profile</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input type="text" className="form-input" defaultValue="Alex Johnson" />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" defaultValue="alex@taskflow.pro" />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input">
              <option>Project Manager</option>
              <option>Developer</option>
              <option>Designer</option>
              <option>DevOps Engineer</option>
            </select>
          </div>

          <button className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Save Changes
          </button>
        </div>

        {/* Preferences */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Preferences</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Theme Selection */}
            <div>
              <label className="form-label">Theme</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {['sunset', 'ocean', 'forest'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '12px',
                      border: theme === t ? '2px solid var(--coral-500)' : '1px solid rgba(255,255,255,0.1)',
                      background: theme === t ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                      color: theme === t ? 'var(--coral-400)' : 'var(--night-400)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      fontWeight: 500,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {t === 'sunset' ? '🌅' : t === 'ocean' ? '🌊' : '🌲'} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications Toggle */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>Push Notifications</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--night-500)' }}>
                  Receive alerts for task updates
                </div>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                style={{
                  width: '52px',
                  height: '28px',
                  borderRadius: '20px',
                  border: 'none',
                  background: notifications ? 'var(--coral-500)' : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s ease'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: notifications ? '26px' : '3px',
                  width: '22px',
                  height: '22px',
                  background: 'white',
                  borderRadius: '50%',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            {/* Timezone */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Timezone</label>
              <select className="form-input">
                <option>UTC+5:30 - India Standard Time</option>
                <option>UTC+0 - Greenwich Mean Time</option>
                <option>UTC-5 - Eastern Standard Time</option>
                <option>UTC-8 - Pacific Standard Time</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
