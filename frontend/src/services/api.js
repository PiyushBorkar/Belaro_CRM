import { queryClient } from '../lib/queryClient';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

// Demo mode (the default): requests are answered in the browser by src/mock, no server needed.
// Set VITE_USE_MOCK=false (.env) to call the real API at VITE_API_BASE_URL instead.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// The demo factory / ERP sync: one step for every ordered project every 20 seconds
// (the real API's scheduler does this every 15 minutes)
const mock = USE_MOCK ? import('../mock/server') : null;
if (mock) {
  setInterval(() => mock.then((m) => m.runSync() && queryClient.invalidateQueries()), 20_000);
}

// ─── Token helpers (save/read/delete the login token) ────────────────────────
export function getToken()  { return sessionStorage.getItem('ff_auth_token'); }
export function setToken(t) { sessionStorage.setItem('ff_auth_token', t); }
export function clearAuth() {
  sessionStorage.removeItem('ff_auth_token');
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request(method, path, body, signal) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = mock
    ? await (await mock).handleRequest(method, path, body, token)
    : await fetch(BASE + path, {
      method,
      headers,
      signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  if (res.status === 401) {
    if (path === '/login') {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Invalid email or password.');
    }
    clearAuth();
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Error ${res.status}`);
    err.status = res.status;
    err.errors = data.errors ?? {};   // validation errors: { field: [messages] }
    throw err;
  }
  return data;
}

// Builds "?a=1&b=2" from an object, skipping empty values
function query(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
  return qs ? `?${qs}` : '';
}

// ─── All API endpoints ────────────────────────────────────────────────────────
export const api = {
  login:          (email, password) => request('POST', '/login', { email, password }),
  logout:         ()                => request('POST', '/logout'),
  me:             ()                => request('GET', '/me'),
  changePassword: (data)            => request('POST', '/change-password', data),

  // Users
  getUsers:       ()         => request('GET', '/users'),
  createUser:     (data)     => request('POST', '/users', data),
  updateUser:     (id, data) => request('PATCH', `/users/${id}`, data),
  deactivateUser: (id)       => request('DELETE', `/users/${id}`),

  // Projects. filters: view, q, designer_id, product, status, stage, production_status, date_field, from, to
  getProjects:        (filters, signal) => request('GET', `/projects${query(filters)}`, undefined, signal),
  getProjectById:     (id)         => request('GET', `/projects/${id}`),
  getProjectTracking: (id)         => request('GET', `/projects/${id}/tracking`),
  createProject:      (data)       => request('POST', '/projects', data),
  assignProject:      (id, data)   => request('PATCH', `/projects/${id}/assign`, data),
  updateDesignerFields:   (id, data) => request('PATCH', `/projects/${id}/designer`, data),
  updateProductionFields: (id, data) => request('PATCH', `/projects/${id}/production`, data),
  // data: { entries: [{ sale_id, installed_on: 'YYYY-MM-DD' | null }] }
  updateInstallations:    (id, data) => request('PUT', `/projects/${id}/installations`, data),
  deleteProject:      (id)         => request('DELETE', `/projects/${id}`),
  restoreProject:     (id)         => request('POST', `/projects/${id}/restore`),
  markProjectLost:    (id, reason) => request('POST', `/projects/${id}/lost`, { reason }),
  reopenProject:      (id)         => request('POST', `/projects/${id}/reopen`),
  closeProject:       (id, closedOn) => request('POST', `/projects/${id}/close`, { closed_on: closedOn }),
  reopenClosedProject: (id)        => request('DELETE', `/projects/${id}/close`),
  lookupErpOrder:     (number)     => request('GET', `/erp/orders/${encodeURIComponent(number)}`),

  getDashboardStats: (range) => request('GET', `/dashboard/stats${query(range)}`),
  getActivity:       (filters) => request('GET', `/activity${query(filters)}`),

  // Notifications
  getNotifications:     ()   => request('GET', '/notifications'),
  markNotificationRead: (id) => request('POST', `/notifications/${id}/read`),
  markAllNotificationsRead: () => request('POST', '/notifications/read-all'),

  // Settings and products
  getSettings:    ()     => request('GET', '/settings'),
  updateSettings: (data) => request('PATCH', '/settings', data),
  testErp:        (number) => request('POST', '/settings/erp-test', { number }),
  getAllProducts: ()     => request('GET', '/products/manage'),
  createProduct:  (data) => request('POST', '/products', data),
  updateProduct:  (id, data) => request('PATCH', `/products/${id}`, data),

  // Dropdown lists
  getDesigners:   () => request('GET', '/designers'),
  getProducts:    () => request('GET', '/products'),
  getSupervisors: () => request('GET', '/supervisors'),
};
