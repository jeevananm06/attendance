import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
};

export const laboursAPI = {
  getAll: (includeInactive = false) => api.get(`/labours/?include_inactive=${includeInactive}`),
  getById: (id) => api.get(`/labours/${id}`),
  create: (data) => api.post('/labours/', data),
  update: (id, data) => api.put(`/labours/${id}`, data),
  delete: (id) => api.delete(`/labours/${id}`),
};

export const attendanceAPI = {
  getByDate: (date) => api.get(`/attendance/date/${date}`),
  getByLabour: (labourId, startDate, endDate) => {
    let url = `/attendance/labour/${labourId}`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  markSingle: (data) => api.post('/attendance/', data),
  markBulk: (data) => api.post('/attendance/bulk', data),
  getToday: () => api.get('/attendance/today'),
};

export const salaryAPI = {
  getRecords: (labourId, isPaid) => {
    let url = '/salary/records';
    const params = [];
    if (labourId) params.push(`labour_id=${labourId}`);
    if (isPaid !== undefined) params.push(`is_paid=${isPaid}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  getPending: (labourId) => api.get(`/salary/pending/${labourId}`),
  getAllPending: () => api.get('/salary/pending'),
  calculate: (labourId, weekEnd) => {
    let url = `/salary/calculate/${labourId}`;
    if (weekEnd) url += `?week_end=${weekEnd}`;
    return api.post(url);
  },
  calculateAll: (weekEnd) => {
    let url = '/salary/calculate-all';
    if (weekEnd) url += `?week_end=${weekEnd}`;
    return api.post(url);
  },
  pay: (labourId, weekEnd) => api.post('/salary/pay', { labour_id: labourId, week_end: weekEnd }),
  getSummary: () => api.get('/salary/summary'),
};

export const statsAPI = {
  getLabourStats: (labourId, startDate, endDate) => {
    let url = `/stats/labour/${labourId}`;
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length) url += `?${params.join('&')}`;
    return api.get(url);
  },
  getOverview: () => api.get('/stats/overview'),
  getWeekly: (weeks = 4) => api.get(`/stats/weekly?weeks=${weeks}`),
  getAllLabourStats: () => api.get('/stats/all-labours'),
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
};

export default api;
