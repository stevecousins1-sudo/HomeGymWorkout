const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'hgw_token';
const USER_KEY = 'hgw_user';

function parseJwtExp(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).exp;
  } catch {
    return 0;
  }
}

export const authStore = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get model() {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  get isValid() {
    const t = this.token;
    return !!t && parseJwtExp(t) * 1000 > Date.now();
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._notify(user);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._notify(null);
  },
  _listeners: [],
  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  },
  _notify(model) { this._listeners.forEach(fn => fn(null, model)); },
};

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.response = { message: data.error, data: {} };
    throw err;
  }
  return data;
}

export const auth = {
  async register(email, password) {
    const data = await request('/api/auth/register', { method: 'POST', body: { email, password } });
    authStore.save(data.token, data.user);
    return data;
  },
  async login(email, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: { email, password } });
    authStore.save(data.token, data.user);
    return data;
  },
  async refresh() {
    const data = await request('/api/auth/refresh', { method: 'POST' });
    authStore.save(data.token, data.user);
    return data;
  },
};

export const historyApi = {
  list: () => request('/api/history'),
  create: (body) => request('/api/history', { method: 'POST', body }),
  remove: (id) => request(`/api/history/${id}`, { method: 'DELETE' }),
};

export const settingsApi = {
  get: () => request('/api/settings'),
  create: (body) => request('/api/settings', { method: 'POST', body }),
  patch: (body) => request('/api/settings', { method: 'PATCH', body }),
};
