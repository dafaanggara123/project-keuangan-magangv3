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

/* Cache per-query untuk data pengeluaran agar request dengan filter periode yang sama
   tidak melakukan panggilan berulang jika masih dalam kurun waktu TTL */
const expenseCacheMap = new Map();
const EXPENSE_CACHE_TTL = 30_000;

export const getExpensesCached = async ({ force = false, params = {} } = {}) => {
  const now = Date.now();
  const cacheKey = JSON.stringify(params || {});
  const entry = expenseCacheMap.get(cacheKey);

  if (!force && entry && entry.data && now - entry.timestamp < EXPENSE_CACHE_TTL) {
    return entry.data;
  }

  if (!force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = api
    .get('/expenses', { params })
    .then((response) => {
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      expenseCacheMap.set(cacheKey, {
        data,
        timestamp: Date.now(),
        promise: null
      });
      return data;
    })
    .catch((err) => {
      expenseCacheMap.delete(cacheKey);
      throw err;
    });

  expenseCacheMap.set(cacheKey, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise
  });

  return promise;
};

export default api;
