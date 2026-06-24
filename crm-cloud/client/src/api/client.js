import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error || fallback;
}

/**
 * Downloads a file from a protected API route (one that requires the
 * Authorization header). A plain <a href="/api/..."> can't carry that
 * header, so the server would just reject it with 401 — this fetches the
 * bytes through the authenticated axios client instead, then hands the
 * browser a local blob to save.
 */
export async function downloadAuthedFile(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}

/**
 * Same idea, but opens the file in a new tab (e.g. to view/print a PDF)
 * instead of forcing a download.
 */
export async function openAuthedFile(url) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(res.data);
  window.open(blobUrl, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
}
