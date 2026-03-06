import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Simple in-memory cache with TTL ────────────────────────────────────────
const _cache = {};

function cacheGet(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { delete _cache[key]; return null; }
  return entry.promise;
}

function cacheSet(key, promise, ttlMs) {
  _cache[key] = { promise, expiresAt: Date.now() + ttlMs };
  promise.catch(() => delete _cache[key]);
  return promise;
}

export function invalidateCache(...keys) {
  if (keys.length === 0) { Object.keys(_cache).forEach((k) => delete _cache[k]); return; }
  keys.forEach((k) => delete _cache[k]);
}

function cached(key, fn, ttlMs) {
  const hit = cacheGet(key);
  if (hit) return hit;
  return cacheSet(key, fn(), ttlMs);
}
// ─────────────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies for refresh token
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already tried to refresh (skip for auth endpoints to avoid loops)
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        // If already refreshing, add to queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Try to refresh the token
        const refreshResponse = await api.post('/auth/refresh', {}, { withCredentials: true });
        const newToken = refreshResponse.data.access_token;
        
        // Update token in localStorage
        localStorage.setItem('token', newToken);
        
        // Update default authorization header
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        
        // Process queued requests
        processQueue(null, newToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        invalidateCache();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  updateUser: (username, data) => api.put(`/auth/users/${username}`, data),
  refresh: () => api.post('/auth/refresh', {}),
  logout: () => api.post('/auth/logout', {}),
};

export const laboursAPI = {
  getAll: (includeInactive = false) =>
    includeInactive
      ? api.get(`/labours/?include_inactive=true`)
      : cached('labours:all', () => api.get('/labours/?include_inactive=false'), 60_000),
  getById: (id) => cached(`labours:${id}`, () => api.get(`/labours/${id}`), 60_000),
  create: (data) => { invalidateCache('labours:all'); return api.post('/labours/', data); },
  update: (id, data) => { invalidateCache('labours:all', `labours:${id}`); return api.put(`/labours/${id}`, data); },
  delete: (id) => { invalidateCache('labours:all', `labours:${id}`); return api.delete(`/labours/${id}`); },
};

export const attendanceAPI = {
  getByDate: (date) =>
    cached(`attendance:date:${date}`, () => api.get(`/attendance/date/${date}`), 30_000),
  getByLabour: (labourId, startDate, endDate) => {
    const key = `attendance:labour:${labourId}:${startDate}:${endDate}`;
    return cached(key, () => {
      let url = `/attendance/labour/${labourId}`;
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length) url += `?${params.join('&')}`;
      return api.get(url);
    }, 60_000);
  },
  markSingle: (data) => {
    invalidateCache(`attendance:date:${data.date}`, 'attendance:today');
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith(`attendance:labour:${data.labour_id}`)));
    return api.post('/attendance/', data);
  },
  markBulk: (data) => {
    invalidateCache(`attendance:date:${data.date}`, 'attendance:today');
    (data.records || []).forEach((r) => {
      invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith(`attendance:labour:${r.labour_id}`)));
    });
    return api.post('/attendance/bulk', data);
  },
  getToday: () => cached('attendance:today', () => api.get('/attendance/today'), 30_000),
  fillMonth: (labourId, year, month, status = 'present', overwrite = false) => {
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith(`attendance:labour:${labourId}`)));
    return api.post(
      `/attendance/fill-month?labour_id=${labourId}&year=${year}&month=${month}&status=${status}&overwrite=${overwrite}`
    );
  },
};

export const salaryAPI = {
  getRecords: (labourId, isPaid) => {
    const key = `salary:records:${labourId}:${isPaid}`;
    return cached(key, () => {
      let url = '/salary/records';
      const params = [];
      if (labourId) params.push(`labour_id=${labourId}`);
      if (isPaid !== undefined) params.push(`is_paid=${isPaid}`);
      if (params.length) url += `?${params.join('&')}`;
      return api.get(url);
    }, 30_000);
  },
  getPending: (labourId) =>
    cached(`salary:pending:${labourId}`, () => api.get(`/salary/pending/${labourId}`), 30_000),
  getAllPending: () =>
    cached('salary:pending:all', () => api.get('/salary/pending'), 30_000),
  calculate: (labourId, weekEnd) => {
    invalidateCache('salary:pending:all', `salary:pending:${labourId}`, 'salary:summary');
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith('salary:records:')));
    let url = `/salary/calculate/${labourId}`;
    if (weekEnd) url += `?week_end=${weekEnd}`;
    return api.post(url);
  },
  calculateAll: (weekEnd) => {
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith('salary:')));
    let url = '/salary/calculate-all';
    if (weekEnd) url += `?week_end=${weekEnd}`;
    return api.post(url);
  },
  pay: (labourId, weekEnd, amountPaid = null, paymentComment = null, advanceDeduction = null, advanceDeductionAmount = null) => {
    invalidateCache('salary:pending:all', `salary:pending:${labourId}`, 'salary:summary');
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith('salary:records:')));
    invalidateCache(...Object.keys(_cache).filter((k) => k.startsWith('advances:')));
    const body = { labour_id: labourId, week_end: weekEnd };
    if (amountPaid !== null) body.amount_paid = amountPaid;
    if (paymentComment !== null) body.payment_comment = paymentComment;
    if (advanceDeduction !== null) body.advance_deduction = advanceDeduction;
    if (advanceDeductionAmount !== null) body.advance_deduction_amount = advanceDeductionAmount;
    return api.post('/salary/pay', body);
  },
  getSummary: () =>
    cached('salary:summary', () => api.get('/salary/summary'), 60_000),
  getSlip: (labourId, weekEnd) => {
    let url = `/salary/slip/${labourId}`;
    if (weekEnd) url += `?week_end=${weekEnd}`;
    return api.get(url);
  },
  getRegister: (year, month) =>
    api.get(`/salary/register?year=${year}&month=${month}`),
};

export const statsAPI = {
  getLabourStats: (labourId, startDate, endDate) => {
    const key = `stats:labour:${labourId}:${startDate}:${endDate}`;
    return cached(key, () => {
      let url = `/stats/labour/${labourId}`;
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length) url += `?${params.join('&')}`;
      return api.get(url);
    }, 60_000);
  },
  getOverview: () => cached('stats:overview', () => api.get('/stats/overview'), 60_000),
  getWeekly: (weeks = 4) => cached(`stats:weekly:${weeks}`, () => api.get(`/stats/weekly?weeks=${weeks}`), 60_000),
  getAllLabourStats: () => cached('stats:all-labours', () => api.get('/stats/all-labours'), 60_000),
  getSiteCosts: () => cached('stats:sites', () => api.get('/stats/sites'), 60_000),
  getTrends: (labourId, weeks = 12) =>
    api.get(`/stats/trends?labour_id=${labourId}&weeks=${weeks}`),
};

export const exportAPI = {
  labours: () => api.get('/export/labours', { responseType: 'blob' }),
  attendance: () => api.get('/export/attendance', { responseType: 'blob' }),
  salary: () => api.get('/export/salary', { responseType: 'blob' }),
  all: () => api.get('/export/all'),
};

// New Feature APIs

export const overtimeAPI = {
  getAll: (labourId, startDate, endDate) => {
    let url = '/overtime/';
    const params = [];
    if (labourId) params.push(`labour_id=${labourId}`);
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  create: (data) => api.post('/overtime/', data),
  getByLabour: (labourId, startDate, endDate) => {
    let url = `/overtime/labour/${labourId}`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
};

export const advancesAPI = {
  getAll: (labourId, isDeducted) => {
    let url = '/advances/';
    const params = [];
    if (labourId) params.push(`labour_id=${labourId}`);
    if (isDeducted !== undefined) params.push(`is_deducted=${isDeducted}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  create: (data) => api.post('/advances/', data),
  getPending: (labourId) => api.get(`/advances/pending/${labourId}`),
  getAllPending: () => api.get('/advances/pending'),
  markDeducted: (advanceId) => api.post(`/advances/${advanceId}/deduct`),
  repayPartial: (advanceId, repayAmount) => api.post(`/advances/${advanceId}/repay`, { repay_amount: repayAmount }),
};

export const leavesAPI = {
  getAll: (labourId, status) => {
    let url = '/leaves/';
    const params = [];
    if (labourId) params.push(`labour_id=${labourId}`);
    if (status) params.push(`status=${status}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  create: (data) => api.post('/leaves/', data),
  approve: (leaveId) => api.post(`/leaves/${leaveId}/approve`),
  reject: (leaveId) => api.post(`/leaves/${leaveId}/reject`),
  getBalance: (labourId) => api.get(`/leaves/balance/${labourId}`),
  initBalance: (labourId) => api.post(`/leaves/balance/${labourId}/init`),
  getPending: () => api.get('/leaves/pending'),
};

export const sitesAPI = {
  getAll: (includeInactive = false) => api.get(`/sites/?include_inactive=${includeInactive}`),
  create: (data) => api.post('/sites/', data),
  getById: (siteId) => api.get(`/sites/${siteId}`),
  getLabours: (siteId) => api.get(`/sites/${siteId}/labours`),
  assign: (labourId, siteId) => api.post(`/sites/assign?labour_id=${labourId}&site_id=${siteId}`),
  getLabourSite: (labourId) => api.get(`/sites/labour/${labourId}/site`),
  getSummary: () => api.get('/sites/summary'),
  getUnassignedLabours: () => api.get('/sites/unassigned-labours'),
  getGroupedLabours: () => api.get('/sites/grouped-labours'),
};

export const auditAPI = {
  getAll: (user, action, entityType, limit = 100) => {
    let url = '/audit/';
    const params = [];
    if (user) params.push(`user=${user}`);
    if (action) params.push(`action=${action}`);
    if (entityType) params.push(`entity_type=${entityType}`);
    params.push(`limit=${limit}`);
    url += `?${params.join('&')}`;
    return api.get(url);
  },
  getRecent: (limit = 50) => api.get(`/audit/recent?limit=${limit}`),
  getByUser: (username, limit = 50) => api.get(`/audit/user/${username}?limit=${limit}`),
  getByEntity: (entityType, limit = 50) => api.get(`/audit/entity/${entityType}?limit=${limit}`),
  getSummary: () => api.get('/audit/summary'),
};

export const backupAPI = {
  getAll: () => api.get('/backup/'),
  create: () => api.post('/backup/create'),
  restore: (backupId) => api.post(`/backup/restore/${backupId}`),
  download: (backupId) => api.get(`/backup/download/${backupId}`, { responseType: 'blob' }),
};

export const reportsAPI = {
  getMonthly: (year, month) => api.get(`/reports/monthly?year=${year}&month=${month}`, { responseType: 'text' }),
  getLabourReport: (labourId, startDate, endDate) => {
    let url = `/reports/labour/${labourId}`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url, { responseType: 'text' });
  },
  getSummary: () => api.get('/reports/summary', { responseType: 'text' }),
  getPayroll: (year, month) => api.get(`/reports/payroll?year=${year}&month=${month}`, { responseType: 'text' }),
};

export const documentsAPI = {
  list: (labourId) => api.get(`/documents/${labourId}`),
  upload: (labourId, file, docType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', docType);
    return api.post(`/documents/${labourId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getDownloadUrl: (labourId, docId) => `${api.defaults.baseURL}/documents/${labourId}/${docId}/download`,
  delete: (labourId, docId) => api.delete(`/documents/${labourId}/${docId}`),
};

export default api;
