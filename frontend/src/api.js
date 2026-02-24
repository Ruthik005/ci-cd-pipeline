// TaskFlow Pro API Service
// Connects frontend to the backend API

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// Helper for fetch with error handling
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// ============================================
// PROJECTS API
// ============================================

export const projectsAPI = {
    getAll: () => fetchAPI('/api/projects'),

    getById: (id) => fetchAPI(`/api/projects/${id}`),

    create: (data) => fetchAPI('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => fetchAPI(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    delete: (id) => fetchAPI(`/api/projects/${id}`, {
        method: 'DELETE',
    }),
};

// ============================================
// TASKS API
// ============================================

export const tasksAPI = {
    getAll: (filters = {}) => {
        const params = new URLSearchParams();
        if (filters.projectId) params.append('projectId', filters.projectId);
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);

        const query = params.toString();
        return fetchAPI(`/api/tasks${query ? `?${query}` : ''}`);
    },

    getById: (id) => fetchAPI(`/api/tasks/${id}`),

    create: (data) => fetchAPI('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id, data) => fetchAPI(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    updateStatus: (id, status) => fetchAPI(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    }),

    delete: (id) => fetchAPI(`/api/tasks/${id}`, {
        method: 'DELETE',
    }),
};

// ============================================
// DASHBOARD API
// ============================================

export const dashboardAPI = {
    getStats: () => fetchAPI('/api/dashboard/stats'),
    getActivities: () => fetchAPI('/api/activities'),
    getStatus: () => fetchAPI('/api/status'),
};

// ============================================
// USERS API
// ============================================

export const usersAPI = {
    getAll: () => fetchAPI('/api/users'),
    getById: (id) => fetchAPI(`/api/users/${id}`),
    update: (id, data) => fetchAPI(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
};

export default {
    projects: projectsAPI,
    tasks: tasksAPI,
    dashboard: dashboardAPI,
    users: usersAPI,
};
