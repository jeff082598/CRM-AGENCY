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
