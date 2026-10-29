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

/* Cache kategori pengeluaran agar modal tambah/edit dapat terbuka instan tanpa jeda network */
let expenseCategoriesCache = null;
let expenseCategoriesPromise = null;
const EXPENSE_CATEGORIES_CACHE_TTL = 300_000; // 5 menit

export const getExpenseCategoriesCached = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && expenseCategoriesCache && now - expenseCategoriesCache.timestamp < EXPENSE_CATEGORIES_CACHE_TTL) {
    return expenseCategoriesCache.data;
  }

  if (!force && expenseCategoriesPromise) {
    return expenseCategoriesPromise;
  }

  expenseCategoriesPromise = api
    .get('/expense-categories')
    .then((response) => {
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      expenseCategoriesCache = {
        data,
        timestamp: Date.now()
      };
      expenseCategoriesPromise = null;
      return data;
    })
    .catch((err) => {
      expenseCategoriesPromise = null;
      throw err;
    });

  return expenseCategoriesPromise;
};

export const clearExpenseCategoriesCache = () => {
  expenseCategoriesCache = null;
  expenseCategoriesPromise = null;
};

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

/* Cache detail transaksi (/sales/:id) untuk pembukaan ulang modal cepat & deduping inflight request */
const saleDetailCacheMap = new Map();
const SALE_DETAIL_CACHE_TTL = 60_000;

export const getSaleDetailCached = async (orderId, { force = false } = {}) => {
  if (!orderId) throw new Error('ID transaksi tidak valid.');
  const now = Date.now();
  const entry = saleDetailCacheMap.get(orderId);

  if (!force && entry && entry.data && now - entry.timestamp < SALE_DETAIL_CACHE_TTL) {
    return entry.data;
  }

  if (!force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = api
    .get(`/sales/${orderId}`)
    .then((response) => {
      const data = response.data;
      saleDetailCacheMap.set(orderId, {
        data,
        timestamp: Date.now(),
        promise: null
      });
      return data;
    })
    .catch((err) => {
      saleDetailCacheMap.delete(orderId);
      throw err;
    });

  saleDetailCacheMap.set(orderId, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise
  });

  return promise;
};

export const clearSaleDetailCache = (orderId) => {
  if (orderId) {
    saleDetailCacheMap.delete(orderId);
  } else {
    saleDetailCacheMap.clear();
  }
};

/* Cache per-query untuk data performa toko (/analytics) & rekomendasi (/recommendations)
   Menghindari duplicate fetch saat navigasi ulang dan mencegah blocking render */
const analyticsCacheMap = new Map();
const ANALYTICS_CACHE_TTL = 30_000; // 30 detik

export const getAnalyticsCached = async ({ force = false, params = {}, signal = null } = {}) => {
  const now = Date.now();
  const cacheKey = JSON.stringify(params || {});
  const entry = analyticsCacheMap.get(cacheKey);

  if (!force && entry && entry.data && now - entry.timestamp < ANALYTICS_CACHE_TTL) {
    return entry.data;
  }

  if (!force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = api
    .get('/analytics', { params, signal })
    .then((response) => {
      const data = response.data;
      analyticsCacheMap.set(cacheKey, {
        data,
        timestamp: Date.now(),
        promise: null
      });
      return data;
    })
    .catch((err) => {
      analyticsCacheMap.delete(cacheKey);
      throw err;
    });

  analyticsCacheMap.set(cacheKey, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise
  });

  return promise;
};

const recommendationsCacheMap = new Map();
const RECOMMENDATIONS_CACHE_TTL = 30_000; // 30 detik

export const getRecommendationsCached = async ({ force = false, params = {}, signal = null } = {}) => {
  const now = Date.now();
  const cacheKey = JSON.stringify(params || {});
  const entry = recommendationsCacheMap.get(cacheKey);

  if (!force && entry && entry.data && now - entry.timestamp < RECOMMENDATIONS_CACHE_TTL) {
    return entry.data;
  }

  if (!force && entry && entry.promise) {
    return entry.promise;
  }

  const promise = api
    .get('/recommendations', { params, signal })
    .then((response) => {
      const data = response.data;
      recommendationsCacheMap.set(cacheKey, {
        data,
        timestamp: Date.now(),
        promise: null
      });
      return data;
    })
    .catch((err) => {
      recommendationsCacheMap.delete(cacheKey);
      throw err;
    });

  recommendationsCacheMap.set(cacheKey, {
    data: entry?.data || null,
    timestamp: entry?.timestamp || 0,
    promise
  });

  return promise;
};

export const clearAnalyticsCache = () => {
  analyticsCacheMap.clear();
  recommendationsCacheMap.clear();
};

export default api;
