const API_BASE = import.meta.env.VITE_API_BASE || '';

async function handleJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function addDays(dateStr, delta) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function daysBetween(dateA, dateB) {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(amount));
}

export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${API_BASE}${url}`;
}

export function buildWhatsAppUrl(phone, message) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  if (!digits) return `https://wa.me/?text=${text}`;
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${text}`;
}

// Store Auth & Profile
export async function registerStore(payload) {
  const res = await fetch(`${API_BASE}/api/stores/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson(res);
}

export async function loginStore(payload) {
  const res = await fetch(`${API_BASE}/api/stores/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson(res);
}

export async function fetchStoreByHash(storeHash) {
  const res = await fetch(`${API_BASE}/api/stores/by-hash/${encodeURIComponent(storeHash)}`);
  return handleJson(res);
}

export async function updateStoreProfile(storeId, payload) {
  const res = await fetch(`${API_BASE}/api/stores/${storeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson(res);
}

// Products
export async function fetchProducts(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/api/products?${qs.toString()}`);
  return handleJson(res);
}

export async function createProduct(formData) {
  const res = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    body: formData
  });
  return handleJson(res);
}

export async function updateProduct(id, payload) {
  const isFormData = payload instanceof FormData;
  const res = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'PUT',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? payload : JSON.stringify(payload)
  });
  return handleJson(res);
}

export async function deleteProduct(id) {
  const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' });
  return handleJson(res);
}

// Availability & Bookings
export async function checkAvailability(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/api/availability?${qs.toString()}`);
  return handleJson(res);
}

export async function fetchBookings(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const res = await fetch(`${API_BASE}/api/bookings?${qs.toString()}`);
  return handleJson(res);
}

export async function createBooking(payload) {
  const res = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson(res);
}

export async function updateBooking(id, payload) {
  const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson(res);
}

export async function deleteBooking(id) {
  const res = await fetch(`${API_BASE}/api/bookings/${id}`, { method: 'DELETE' });
  return handleJson(res);
}
