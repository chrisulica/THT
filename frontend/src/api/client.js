/**
 * api/client.js
 * Centralized HTTP client for all backend calls.
 * Automatically attaches the JWT from localStorage.
 */

const BASE_URL = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('tht_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body) => request('/users/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => request('/users/login',    { method: 'POST', body: JSON.stringify(body) }),
  me:       ()     => request('/users/me'),
};

// ── Treasure Hunt ─────────────────────────────────────────────────────────────
export const huntApi = {
  generateRoute: (body) =>
    request('/treasure_hunt/generate', { method: 'POST', body: JSON.stringify(body) }),
};

// ── AI Integrations ───────────────────────────────────────────────────────────
export const aiApi = {
  generateBingo: (body) =>
    request('/ai_integrations/generate-bingo', { method: 'POST', body: JSON.stringify(body) }),
  getEvents: (month) =>
    request(`/ai_integrations/events${month ? `?month=${month}` : ''}`),
  getCompletionMessage: (body) =>
    request('/ai_integrations/completion-message', { method: 'POST', body: JSON.stringify(body) }),
};
