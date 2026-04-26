import axios from 'axios';

/**
 * Same-origin `/api` uses the CRA dev proxy (package.json "proxy") in development.
 * For production builds or split hosts, set REACT_APP_API_URL to the API root, e.g.
 * http://localhost:5000/api — host only is accepted and /api is appended.
 */
function resolveApiBase() {
  const raw = (process.env.REACT_APP_API_URL || '').trim();
  if (!raw) return '/api';
  const u = raw.replace(/\/+$/, '');
  if (u.endsWith('/api')) return u;
  return `${u}/api`;
}

const BASE = resolveApiBase();

// Create axios instance FIRST
const apiClient = axios.create({
  baseURL: BASE,
});

// Add auth token to every request globally on BOTH instances
const addTokenInterceptor = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

// Apply interceptor to both axios and apiClient
addTokenInterceptor(axios);
addTokenInterceptor(apiClient);

// Handle 401 globally on both instances
const add401Handler = (instance) => {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

add401Handler(axios);
add401Handler(apiClient);

// Auth API
export const authAPI = {
  login: (email, password) => axios.post(`${BASE}/auth/login`, { email, password }),
  register: (data) => apiClient.post('/auth/register', data),
  getMe: () => apiClient.get('/auth/me'),
  behaveAs: (targetUserId) => apiClient.post('/auth/behave-as', { targetUserId }),
};

// Users API
export const usersAPI = {
  getAll: () => apiClient.get('/users'),
  getClients: () => apiClient.get('/users/clients'),
  getById: (id) => apiClient.get(`/users/${id}`),
  create: (data) => apiClient.post('/users', data),
  update: (id, data) => apiClient.put(`/users/${id}`, data),
  delete: (id) => apiClient.delete(`/users/${id}`),
};

// Comments API
export const commentsAPI = {
  getByTask: (taskId) => apiClient.get(`/comments?taskId=${taskId}`),
  add: (taskId, text) => apiClient.post('/comments', { taskId, text }),
  delete: (id) => apiClient.delete(`/comments/${id}`),
};

export const projectsAPI = {
  getAll: () => apiClient.get('/projects'),
  getMy: () => apiClient.get('/projects/my'),
  getById: (id) => apiClient.get(`/projects/${id}`),
  create: (data) => apiClient.post('/projects', data),
  createFull: (data) => apiClient.post('/projects/full', data),
  update: (id, data) => apiClient.put(`/projects/${id}`, data),
  delete: (id) => apiClient.delete(`/projects/${id}`),
  clone: (id, data) => apiClient.post(`/projects/${id}/clone`, data),
};

/** Catalog + CRUD + instantiate (modules, workstreams, starter tasks) — Rocketlane-style */
export const projectTemplatesAPI = {
  getCatalog: () => apiClient.get('/project-templates'),
  getById: (templateId) => apiClient.get(`/project-templates/${templateId}`),
  create: (body) => apiClient.post('/project-templates', body),
  update: (templateId, body) => apiClient.put(`/project-templates/${templateId}`, body),
  remove: (templateId) => apiClient.delete(`/project-templates/${templateId}`),
  instantiate: (templateId, body) => apiClient.post(`/project-templates/${templateId}/instantiate`, body),
};

export const intakeAPI = {
  getPendingDeals: () => apiClient.get('/intake/pending-deals'),
  rejectPendingDeal: (dealId, reason = '') => apiClient.post(`/intake/pending-deals/${dealId}/reject`, { reason }),
  markIntaken: (dealId, projectId) => apiClient.post(`/intake/pending-deals/${dealId}/intaken`, { projectId }),
  hubspotDealWebhook: (payload) => apiClient.post('/intake/hubspot-deal-webhook', payload),
  hubspotWebhook: (payload) => apiClient.post('/intake/hubspot-webhook', payload),
};

export const matrixAPI = {
  getByProject: (projectId) => apiClient.get(`/matrix/${projectId}`),
};

export const modulesAPI = {
  getByProject: (projectId) => apiClient.get(`/modules?projectId=${projectId}`),
  create: (data) => apiClient.post('/modules', data),
  update: (id, data) => apiClient.put(`/modules/${id}`, data),
  delete: (id) => apiClient.delete(`/modules/${id}`),
  getDependencyStatus: (id) => apiClient.get(`/modules/${id}/dependency-status`),
  setDependencies: (id, dependsOnModuleIds) =>
    apiClient.post(`/modules/${id}/dependencies`, { dependsOnModuleIds }),
};

export const workstreamsAPI = {
  getByModule: (moduleId) => apiClient.get(`/workstreams?moduleId=${moduleId}`),
  create: (data) => apiClient.post('/workstreams', data),
  update: (id, data) => apiClient.put(`/workstreams/${id}`, data),
  delete: (id) => apiClient.delete(`/workstreams/${id}`),
  requestSignOff: (id, notes = '') => apiClient.patch(`/workstreams/${id}/request-signoff`, { notes }),
  completeSignOff: (id, notes = '') => apiClient.patch(`/workstreams/${id}/complete-signoff`, { notes }),
};

export const tasksAPI = {
  getByWorkstream: (workstreamId) => apiClient.get(`/tasks?workstreamId=${workstreamId}`),
  getMyTasks: () => apiClient.get('/tasks/my'), // BUG 4 FIX: scoped endpoint for member dashboard
  create: (data) => apiClient.post('/tasks', data),
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  logHours: (id, hours) => apiClient.patch(`/tasks/${id}/log-hours`, { hours }),
  bulkPatch: (payload) => apiClient.patch('/tasks/bulk', payload),
  delete: (id) => apiClient.delete(`/tasks/${id}`),
};

export const auditAPI = {
  getByProject: (projectId) =>
    projectId ? apiClient.get(`/audit?projectId=${projectId}`) : apiClient.get('/audit'),
  exportCsv: (projectId) =>
    projectId
      ? apiClient.get(`/audit/export?projectId=${projectId}`, { responseType: 'blob' })
      : apiClient.get('/audit/export', { responseType: 'blob' }),
};

export const dashboardAPI = {
  commandCentre: (projectId) => apiClient.get(`/dashboard/command-centre/${projectId}`),
  byRole: (role) => apiClient.get(`/dashboard/${role}`),
};

export const aiAPI = {
  getProjectRisk: (projectId) => apiClient.get(`/ai/project-risk/${projectId}`),
  getWeeklySummary: (projectId) => apiClient.get(`/ai/weekly-summary/${projectId}`),
  getTaskFlags: (moduleId) => apiClient.get(`/ai/task-flags/${moduleId}`),
  askQuestion: (projectId, question) => apiClient.post(`/ai/chat/${projectId}`, { question }),
  getPmScore: (projectId) => apiClient.get(`/ai/pm-score/${projectId}`),
  getMarginForecast: (projectId) => apiClient.get(`/ai/margin-forecast/${projectId}`),
  getResourceOverload: (projectId) => apiClient.get(`/ai/resource-overload/${projectId}`),
  postClientSentiment: (projectId, emailContent) =>
    apiClient.post(`/ai/client-sentiment/${projectId}`, { emailContent }),
  getEscalationRisk: (projectId) => apiClient.get(`/ai/escalation-risk/${projectId}`),
  postScopeCheck: (projectId, emailContent) =>
    apiClient.post(`/ai/scope-check/${projectId}`, { emailContent }),
  getNarrative: (projectId, audience) =>
    audience != null && audience !== ''
      ? apiClient.get(`/ai/narrative/${projectId}`, { params: { audience } })
      : apiClient.get(`/ai/narrative/${projectId}`),
  approveNarrative: (projectId) => apiClient.patch(`/ai/narrative-approve/${projectId}`),
  postRaidExtract: (projectId, notes) => apiClient.post(`/ai/raid-extract/${projectId}`, { notes }),
  listRaidItems: (projectId) => apiClient.get(`/ai/raid-items/${projectId}`),
  createRaidItem: (projectId, body) => apiClient.post(`/ai/raid-items/${projectId}`, body),
  patchRaidItem: (raidItemId, body) => apiClient.patch(`/ai/raid-item/${raidItemId}`, body),
  listSentimentHistory: (projectId) => apiClient.get(`/ai/sentiment-history/${projectId}`),
  getClientSentimentView: (projectId) => apiClient.get(`/ai/client-sentiment-view/${projectId}`),
  postCrImpact: (body) => apiClient.post('/ai/cr-impact', body),
};

export const financialAPI = {
  getProject: (projectId) => apiClient.get(`/financial/project/${projectId}`),
  getPortfolio: () => apiClient.get('/financial/portfolio'),
};

export const alertsAPI = {
  list: (params) => apiClient.get('/alerts', { params }),
  markRead: (id) => apiClient.patch(`/alerts/${id}/read`),
  acceptInvite: (id) => apiClient.patch(`/alerts/${id}/accept`),
};

export const darwinboxAPI = {
  sync: (projectId) => apiClient.post(`/darwinbox/sync/${projectId}`),
  getNonSubmitters: (projectId) => apiClient.get(`/darwinbox/non-submitters/${projectId}`),
  getHealth: () => apiClient.get('/darwinbox/health'),
};

export const crAPI = {
  create: (body) => apiClient.post('/cr', body),
  list: (projectId) => apiClient.get('/cr', { params: { projectId } }),
  getById: (id) => apiClient.get(`/cr/${id}`),
  submit: (id) => apiClient.post(`/cr/${id}/submit`),
  approve: (id) => apiClient.post(`/cr/${id}/approve`),
  reject: (id, reason) => apiClient.post(`/cr/${id}/reject`, { reason }),
  notifyClient: (id) => apiClient.post(`/cr/${id}/notify-client`),
};

export const reviewsAPI = {
  list: (projectId) => apiClient.get('/reviews', { params: { projectId } }),
  complete: (id, body) => apiClient.patch(`/reviews/${id}/complete`, body),
};

export const governanceAPI = {
  compliance: (projectId) => apiClient.get(`/governance/compliance/${projectId}`),
  dashboard: (params) => apiClient.get('/governance/dashboard', { params }),
};

export const reportsAPI = {
  run: (body) => apiClient.post('/reports/run', body),
  save: (body) => apiClient.post('/reports/save', body),
  list: () => apiClient.get('/reports'),
  runSaved: (id) => apiClient.post(`/reports/${id}/run`),
  exportSaved: (id) => apiClient.post(`/reports/${id}/export`, {}, { responseType: 'blob' }),
  schedule: (id, body) => apiClient.post(`/reports/${id}/schedule`, body),
  scheduled: () => apiClient.get('/reports/scheduled'),
  pmLeaderboard: () => apiClient.get('/reports/pm-leaderboard'),
};

export const portfolioAPI = {
  drilldown: () => apiClient.get('/portfolio/drilldown'),
};

/** Cross-project execution views (Rocketlane-style “All tasks”, resource snapshot) */
export const executionAPI = {
  allTasks: (params = {}) => apiClient.get('/execution/all-tasks', { params }),
  resourceSnapshot: () => apiClient.get('/execution/resource-snapshot'),
};

export const resourcesAPI = {
  people: (params = {}) => apiClient.get('/resources/people', { params }),
  allocate: (body) => apiClient.post('/resources/allocate', body),
  deleteAllocation: (id) => apiClient.delete(`/resources/allocate/${id}`),
  availability: (params = {}) => apiClient.get('/resources/availability', { params }),
  utilisationSummary: () => apiClient.get('/resources/utilisation-summary'),
};

export const costRatesAPI = {
  list: (includeExpired = false) =>
    apiClient.get('/cost-rates', {
      params: includeExpired ? { includeExpired: 'true' } : {},
    }),
  create: (data) => apiClient.post('/cost-rates', data),
  supersede: (id, data) => apiClient.post(`/cost-rates/${id}/supersede`, data),
};
