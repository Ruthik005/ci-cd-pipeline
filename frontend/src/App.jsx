import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { dashboardAPI, projectsAPI, tasksAPI } from './api'

// Get deployment version from environment
const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'stable'
const DEPLOYMENT_STRATEGY = import.meta.env.VITE_DEPLOYMENT_STRATEGY || 'standard'

// Version-specific styles
const versionStyles = {
  blue: { color: '#38bdf8', label: '● BLUE VERSION', icon: '🔵' },
  green: { color: '#4ade80', label: '● GREEN VERSION', icon: '🟢' },
  canary: { color: '#fbbf24', label: '🐤 CANARY', icon: '🟡' },
  stable: { color: '#c084fc', label: '● STABLE', icon: '🟣' }
}
const currentVersion = versionStyles[APP_VERSION] || versionStyles.stable

// Color palette for projects
const projectColors = ['#f97316', '#14b8a6', '#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#eab308', '#ef4444']

function App() {
  const [tasks, setTasks] = useState({ todo: [], inProgress: [], review: [], done: [] })
  const [projects, setProjects] = useState([])
  const [activities, setActivities] = useState([])
  const [stats, setStats] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isConnected, setIsConnected] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [notification, setNotification] = useState(null)

  // Show notification
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [projectsData, tasksData, statsData, activitiesData] = await Promise.all([
        projectsAPI.getAll(),
        tasksAPI.getAll(),
        dashboardAPI.getStats(),
        dashboardAPI.getActivities()
      ])

      setProjects(projectsData)
      setStats(statsData)
      setActivities(activitiesData)

      // Group tasks by status
      const grouped = { todo: [], inProgress: [], review: [], done: [] }
      tasksData.forEach(task => {
        if (grouped[task.status]) {
          grouped[task.status].push(task)
        }
      })
      setTasks(grouped)
      setIsConnected(true)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Task status update
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await tasksAPI.updateStatus(taskId, newStatus)
      await fetchData()
      showNotification('Task moved successfully!')
    } catch (error) {
      showNotification('Failed to move task', 'error')
    }
  }

  // Delete task
  const deleteTask = async (taskId) => {
    try {
      await tasksAPI.delete(taskId)
      await fetchData()
      showNotification('Task deleted!')
    } catch (error) {
      showNotification('Failed to delete task', 'error')
    }
  }

  // Delete project
  const deleteProject = async (projectId) => {
    try {
      await projectsAPI.delete(projectId)
      await fetchData()
      showNotification('Project deleted!')
    } catch (error) {
      showNotification('Failed to delete project', 'error')
    }
  }

  const formatTime = (date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} min ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  return (
    <div className="app">
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}

      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-content">
          <a href="#" className="logo">
            <div className="logo-icon">📋</div>
            <span>TaskFlow Pro</span>
          </a>

          <div className="nav-links">
            {['dashboard', 'board', 'projects', 'settings'].map(page => (
              <button
                key={page}
                className={`nav-link ${currentPage === page ? 'active' : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page.charAt(0).toUpperCase() + page.slice(1)}
              </button>
            ))}
          </div>

          <div className={`version-badge ${APP_VERSION}`}>
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
            {currentVersion.label}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container" style={{ padding: '2rem 2rem 4rem' }}>
        {loading && currentPage !== 'settings' ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading TaskFlow Pro...</p>
          </div>
        ) : (
          <>
            {currentPage === 'dashboard' && (
              <Dashboard
                stats={stats}
                projects={projects}
                activities={activities}
                formatTime={formatTime}
                formatRelativeTime={formatRelativeTime}
                isConnected={isConnected}
                onCreateProject={() => setShowCreateProject(true)}
              />
            )}
            {currentPage === 'board' && (
              <KanbanBoard
                tasks={tasks}
                projects={projects}
                updateTaskStatus={updateTaskStatus}
                deleteTask={deleteTask}
                onAddTask={() => setShowCreateTask(true)}
              />
            )}
            {currentPage === 'projects' && (
              <ProjectsPage
                projects={projects}
                onCreateProject={() => setShowCreateProject(true)}
                onDeleteProject={deleteProject}
                onViewProject={(p) => { setSelectedProject(p); setCurrentPage('board') }}
              />
            )}
            {currentPage === 'settings' && <SettingsPage showNotification={showNotification} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          TaskFlow Pro v1.0.0 • Strategy: <strong>{DEPLOYMENT_STRATEGY}</strong> •
          Version: <strong style={{ color: currentVersion.color }}>{APP_VERSION.toUpperCase()}</strong> •
          {formatTime(currentTime)}
        </div>
      </footer>

      {/* Create Project Modal */}
      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onSuccess={() => { fetchData(); setShowCreateProject(false) }}
          showNotification={showNotification}
        />
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          projects={projects}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => { fetchData(); setShowCreateTask(false) }}
          showNotification={showNotification}
        />
      )}
    </div>
  )
}

// ============================================================
// CREATE PROJECT MODAL
// ============================================================
function CreateProjectModal({ onClose, onSuccess, showNotification }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#f97316')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef(null)

  useEffect(() => {
    modalRef.current?.focus()
    const handleEsc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      await projectsAPI.create({ name, description, color })
      showNotification(`Project "${name}" created successfully!`)
      onSuccess()
    } catch (error) {
      showNotification('Failed to create project', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ Create New Project</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter project name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              placeholder="What is this project about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project Color</label>
            <div className="color-picker">
              {projectColors.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? <span className="btn-spinner"></span> : '🚀'} Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// CREATE TASK MODAL
// ============================================================
function CreateTaskModal({ projects, onClose, onSuccess, showNotification }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?._id || '')
  const [priority, setPriority] = useState('medium')
  const [tag, setTag] = useState('feature')
  const [assignee, setAssignee] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const modalRef = useRef(null)

  useEffect(() => {
    modalRef.current?.focus()
    const handleEsc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    setIsSubmitting(true)
    try {
      await tasksAPI.create({
        projectId,
        title,
        description,
        priority,
        tag,
        assignee: assignee || null
      })
      showNotification(`Task "${title}" created successfully!`)
      onSuccess()
    } catch (error) {
      showNotification('Failed to create task', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>➕ Add New Task</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group flex-2">
              <label className="form-label">Task Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Project *</label>
              <select
                className="form-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                {projects.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input form-textarea"
              placeholder="Add more details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <div className="button-group">
                {[
                  { value: 'low', label: '⚪ Low' },
                  { value: 'medium', label: '🟡 Medium' },
                  { value: 'high', label: '🟠 High' },
                  { value: 'urgent', label: '🔴 Urgent' }
                ].map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn-option ${priority === p.value ? 'selected' : ''}`}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tag</label>
              <div className="button-group">
                {[
                  { value: 'feature', label: '✨ Feature' },
                  { value: 'bug', label: '🐛 Bug' },
                  { value: 'enhancement', label: '📈 Enhancement' },
                  { value: 'documentation', label: '📄 Docs' }
                ].map(t => (
                  <button
                    key={t.value}
                    type="button"
                    className={`btn-option ${tag === t.value ? 'selected' : ''}`}
                    onClick={() => setTag(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assignee</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter assignee name..."
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !title.trim() || !projectId}>
              {isSubmitting ? <span className="btn-spinner"></span> : '✓'} Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD COMPONENT
// ============================================================
function Dashboard({ stats, projects, activities, formatRelativeTime, isConnected, onCreateProject }) {
  if (!stats) return null

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
          <button className="btn btn-primary" onClick={onCreateProject}>
            ✨ Create New Project
          </button>
          <button className="btn btn-secondary" onClick={() => window.open('https://github.com', '_blank')}>
            📖 View Documentation
          </button>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.tasksByStatus?.done || 0}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.tasksByStatus?.inProgress || 0}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completionRate}%</div>
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
              <div key={project._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{project.name}</span>
                  <span style={{ fontSize: '0.8rem', color: project.color, fontWeight: 600 }}>{project.progress || 0}%</span>
                </div>
                <div style={{
                  height: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${project.progress || 0}%`,
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
            {activities.slice(0, 4).map((activity, idx) => (
              <ActivityItem
                key={activity._id || idx}
                icon={activity.icon}
                text={activity.description}
                time={formatRelativeTime(activity.createdAt)}
                color={activity.color}
              />
            ))}
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
// KANBAN BOARD COMPONENT (with Drag & Drop + Search)
// ============================================================
function KanbanBoard({ tasks, projects, updateTaskStatus, deleteTask, onAddTask }) {
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTask, setExpandedTask] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002'

  const columns = [
    { id: 'todo', title: 'To Do', icon: '📋', color: '#f97316' },
    { id: 'inProgress', title: 'In Progress', icon: '🔄', color: '#fbbf24' },
    { id: 'review', title: 'In Review', icon: '👀', color: '#a855f7' },
    { id: 'done', title: 'Done', icon: '✅', color: '#4ade80' }
  ]

  const getNextStatus = (current) => {
    const order = ['todo', 'inProgress', 'review', 'done']
    const idx = order.indexOf(current)
    return idx < order.length - 1 ? order[idx + 1] : null
  }

  const getPrevStatus = (current) => {
    const order = ['todo', 'inProgress', 'review', 'done']
    const idx = order.indexOf(current)
    return idx > 0 ? order[idx - 1] : null
  }

  const getProjectName = (projectId) => {
    const project = projects.find(p => p._id === projectId)
    return project?.name || 'Unknown'
  }

  // Drag handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task._id)
    e.currentTarget.style.opacity = '0.4'
  }

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDraggedTask(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e, columnId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e, columnId) => {
    e.preventDefault()
    setDragOverColumn(null)
    if (draggedTask && draggedTask.status !== columnId) {
      updateTaskStatus(draggedTask._id, columnId)
    }
    setDraggedTask(null)
  }

  // Filter tasks by search
  const filterTasks = (taskList) => {
    if (!searchQuery.trim()) return taskList
    const q = searchQuery.toLowerCase()
    return taskList.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.assignee && t.assignee.toLowerCase().includes(q)) ||
      (t.tag && t.tag.toLowerCase().includes(q))
    )
  }

  // Load comments when task is expanded
  const loadComments = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/comments`)
      if (res.ok) setComments(await res.json())
    } catch { setComments([]) }
  }

  const handleExpandTask = (task) => {
    setExpandedTask(task)
    loadComments(task._id)
  }

  const submitComment = async () => {
    if (!newComment.trim() || !expandedTask) return
    try {
      await fetch(`${API_BASE}/api/tasks/${expandedTask._id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment, author: 'User' })
      })
      setNewComment('')
      loadComments(expandedTask._id)
    } catch { /* ignore */ }
  }

  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
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
          <p style={{ color: 'var(--night-500)' }}>Drag tasks between columns or use arrow buttons</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--night-500)',
              fontSize: '0.9rem',
              pointerEvents: 'none'
            }}>🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '0.6rem 1rem 0.6rem 2.2rem',
                color: 'var(--night-100)',
                fontSize: '0.875rem',
                width: '220px',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-500)'
                e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={onAddTask}>
            ➕ Add Task
          </button>
        </div>
      </div>

      <div className="kanban-board">
        {columns.map(column => {
          const columnTasks = filterTasks(tasks[column.id] || [])
          const isOver = dragOverColumn === column.id

          return (
            <div
              key={column.id}
              className="kanban-column"
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              style={{
                transition: 'all 0.2s ease',
                outline: isOver ? `2px dashed ${column.color}` : 'none',
                outlineOffset: '-2px',
                background: isOver ? `${column.color}08` : undefined,
                borderRadius: isOver ? '16px' : undefined,
              }}
            >
              <div className="kanban-column-header">
                <span className="kanban-column-title" style={{ color: column.color }}>
                  {column.icon} {column.title}
                </span>
                <span className="kanban-column-count">
                  {columnTasks.length}
                </span>
              </div>

              <div className="task-list">
                {columnTasks.map(task => (
                  <div
                    key={task._id}
                    className="task-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="task-card-header">
                      <div
                        className="task-title"
                        onClick={() => handleExpandTask(task)}
                        style={{ cursor: 'pointer' }}
                        title="Click to expand"
                      >
                        {task.title}
                      </div>
                      <button
                        className="task-delete"
                        onClick={() => deleteTask(task._id)}
                        title="Delete task"
                      >
                        ×
                      </button>
                    </div>
                    <p style={{
                      fontSize: '0.8rem',
                      color: 'var(--night-500)',
                      marginBottom: '0.75rem',
                      lineHeight: 1.5
                    }}>
                      {task.description || 'No description'}
                    </p>
                    <div className="task-project">
                      📁 {getProjectName(task.projectId)}
                    </div>
                    <div className="task-meta">
                      <span className={`task-tag ${task.tag}`}>{task.tag}</span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: task.priority === 'urgent' ? '#fb7185' :
                          task.priority === 'high' ? '#fbbf24' :
                            'var(--night-500)'
                      }}>
                        {task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : task.priority === 'medium' ? '🟡' : '⚪'} {task.priority}
                      </span>
                      {task.assignee && (
                        <span className="task-assignee">
                          👤 {task.assignee}
                        </span>
                      )}
                    </div>
                    <div className="task-actions">
                      <button
                        className="task-move-btn"
                        onClick={() => updateTaskStatus(task._id, getPrevStatus(task.status))}
                        disabled={!getPrevStatus(task.status)}
                        title="Move left"
                      >
                        ←
                      </button>
                      <span style={{ fontSize: '0.65rem', color: 'var(--night-600)', userSelect: 'none' }}>
                        drag to move
                      </span>
                      <button
                        className="task-move-btn"
                        onClick={() => updateTaskStatus(task._id, getNextStatus(task.status))}
                        disabled={!getNextStatus(task.status)}
                        title="Move right"
                      >
                        →
                      </button>
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div style={{
                    padding: '2rem 1rem',
                    textAlign: 'center',
                    color: 'var(--night-600)',
                    fontSize: '0.85rem',
                    border: isOver ? `2px dashed ${column.color}40` : '2px dashed rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                  }}>
                    {isOver ? '📥 Drop here!' : searchQuery ? 'No matching tasks' : 'No tasks yet'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Task Detail / Comments Modal */}
      {expandedTask && (
        <div className="modal-overlay" onClick={() => setExpandedTask(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>📝 {expandedTask.title}</h2>
              <button className="modal-close" onClick={() => setExpandedTask(null)}>×</button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--night-400)', marginBottom: '1rem', lineHeight: 1.6 }}>
                {expandedTask.description || 'No description provided.'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className={`task-tag ${expandedTask.tag}`}>{expandedTask.tag}</span>
                <span style={{
                  background: 'rgba(255,255,255,0.06)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: 'var(--night-300)'
                }}>
                  {expandedTask.priority}
                </span>
                {expandedTask.assignee && (
                  <span style={{
                    background: 'rgba(255,255,255,0.06)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--night-300)'
                  }}>
                    👤 {expandedTask.assignee}
                  </span>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--night-200)' }}>
                💬 Comments ({comments.length})
              </h3>

              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
                {comments.length === 0 ? (
                  <p style={{ color: 'var(--night-600)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  comments.map(c => (
                    <div key={c._id} style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--accent-400)' }}>
                          {c.author}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--night-600)' }}>
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--night-300)', margin: 0, lineHeight: 1.5 }}>
                        {c.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  className="form-input"
                  style={{ flex: 1, margin: 0 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={submitComment}
                  disabled={!newComment.trim()}
                  style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================
// PROJECTS PAGE
// ============================================================
function ProjectsPage({ projects, onCreateProject, onDeleteProject, onViewProject }) {
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
          <div key={project._id} className="card project-card">
            <div className="project-card-header">
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
              <button
                className="project-delete"
                onClick={() => onDeleteProject(project._id)}
                title="Delete project"
              >
                🗑️
              </button>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.8rem'
              }}>
                <span style={{ color: 'var(--night-500)' }}>Progress</span>
                <span style={{ fontWeight: 600, color: project.color }}>{project.progress || 0}%</span>
              </div>
              <div style={{
                height: '8px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${project.progress || 0}%`,
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
              <span>👥 {project.memberCount || 1} members</span>
              <span>📋 {project.taskCount || 0} tasks</span>
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={() => onViewProject(project)}
            >
              View Board →
            </button>
          </div>
        ))}

        {/* Add New Project Card */}
        <div className="card add-project-card" onClick={onCreateProject}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '0.75rem',
            opacity: 0.5,
            transition: 'all 0.3s ease'
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
function SettingsPage({ showNotification }) {
  const [name, setName] = useState(() => localStorage.getItem('tf_name') || 'Demo User')
  const [email, setEmail] = useState(() => localStorage.getItem('tf_email') || 'demo@taskflow.pro')
  const [role, setRole] = useState(() => localStorage.getItem('tf_role') || 'Project Manager')
  const [theme, setTheme] = useState(() => localStorage.getItem('tf_theme') || 'sunset')
  const [notifications, setNotifications] = useState(() => localStorage.getItem('tf_notifications') !== 'false')
  const [timezone, setTimezone] = useState(() => localStorage.getItem('tf_timezone') || 'UTC+5:30')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    // Simulate API call delay
    await new Promise(r => setTimeout(r, 500))

    // Save to localStorage
    localStorage.setItem('tf_name', name)
    localStorage.setItem('tf_email', email)
    localStorage.setItem('tf_role', role)
    localStorage.setItem('tf_theme', theme)
    localStorage.setItem('tf_notifications', notifications)
    localStorage.setItem('tf_timezone', timezone)

    setIsSaving(false)
    showNotification('Settings saved successfully!')
  }

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
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option>Project Manager</option>
              <option>Developer</option>
              <option>Designer</option>
              <option>DevOps Engineer</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: '0.5rem' }}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <span className="btn-spinner"></span> : '💾'} Save Changes
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
              <select
                className="form-input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
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
