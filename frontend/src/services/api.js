import axios from 'axios';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

export const api = axios.create({
  baseURL: API
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('p2_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* Cache ringan untuk data pengeluaran agar halaman Pengeluaran dan
   kebutuhan notifikasi tidak melakukan request /expenses berulang. */
const expenseCache = {
  data: null,
  timestamp: 0,
  promise: null
};

const EXPENSE_CACHE_TTL = 60_000;

export const getExpensesCached = async ({ force = false } = {}) => {
  const now = Date.now();

  if (
    !force &&
    expenseCache.data &&
    now - expenseCache.timestamp < EXPENSE_CACHE_TTL
  ) {
    return expenseCache.data;
  }

  if (!force && expenseCache.promise) {
    return expenseCache.promise;
  }

  expenseCache.promise = api
    .get('/expenses')
    .then((response) => {
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      expenseCache.data = data;
      expenseCache.timestamp = Date.now();
      return data;
    })
    .finally(() => {
      expenseCache.promise = null;
    });

  return expenseCache.promise;
};

export default api;
