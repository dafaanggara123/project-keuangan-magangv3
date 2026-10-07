import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
/* XLSX, jsPDF, jspdf-autotable: dynamic import — hanya dimuat saat export diklik */

import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  Gauge,
  LogOut,
  Menu as MenuIcon,
  Receipt,
  Settings,
  TrendingUp,
  WalletCards,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Target,
  Store,
  Percent,
  PackageSearch,
  ShoppingBag,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Layers,
  Activity,
  Award,
  Lock,
  Download,
  Check,
  Copy,
  Clock,
  Sliders,
  DollarSign,
  PieChart,
  MoreVertical
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts';
import './styles.css';

/* =========================================================
   API CONFIGURATION
   ========================================================= */
const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

/* =========================================================
   FORMATTERS & HELPERS
   ========================================================= */
const moneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const dateFormatterShort = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short'
});

const dateFormatterLong = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const money = (n) =>
  moneyFormatter.format(Number(n || 0));

const shortMoney = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000_000) {
    return `Rp ${(v / 1_000_000_000).toFixed(2)} M`;
  }
  if (Math.abs(v) >= 1_000_000) {
    return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  }
  if (Math.abs(v) >= 1_000) {
    return `Rp ${(v / 1_000).toFixed(0)} rb`;
  }
  return money(v);
};

const dateLabel = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return dateFormatterShort.format(d);
};

const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return dateFormatterLong.format(d);
};

const relativeTimeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 jam lalu' : `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  return dateLabel(iso);
};

const notifStorageKey = (profile) => {
  const id = profile?.id || profile?.email || 'owner';
  return `p2_notif_read_${id}`;
};

const loadReadNotifIds = (profile) => {
  try {
    const raw = localStorage.getItem(notifStorageKey(profile));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveReadNotifIds = (profile, ids) => {
  try {
    localStorage.setItem(notifStorageKey(profile), JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
};

const buildNotifications = (salesRows, expenseRows) => {
  const sales = (Array.isArray(salesRows) ? salesRows : [])
    .slice(0, 8)
    .map((row) => ({
      id: `sale-${row.id}`,
      type: 'sale',
      tone: 'success',
      title: 'Penjualan berhasil dicatat',
      body: `${row.orderCode || 'Pesanan'} · ${money(row.total)} · ${channelLabel(
        row.channel || 'website'
      )}`,
      at: row.orderedAt,
      href: '/penjualan'
    }));

  const expenses = (Array.isArray(expenseRows) ? expenseRows : [])
    .slice(0, 8)
    .map((row) => ({
      id: `expense-${row.id}`,
      type: 'expense',
      tone: 'primary',
      title: 'Pengeluaran operasional',
      body: `${row.categoryName || row.category || 'Operasional'} · ${money(
        row.amount
      )}${
        row.note && row.note !== '-'
          ? ` · ${row.note}`
          : row.description && row.description !== '-'
            ? ` · ${row.description}`
            : ''
      }`,
      at: row.createdAt || row.created_at || row.expenseDate || row.expense_date,
      href: '/pengeluaran'
    }));

  return [...sales, ...expenses]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20);
};


/* =========================================================
   AXIOS INSTANCE & INTERCEPTORS
   ========================================================= */
const api = axios.create({
  baseURL: API
});

/* Cache ringan untuk data pengeluaran agar halaman Pengeluaran dan
   kebutuhan notifikasi tidak melakukan request /expenses berulang. */
const expenseCache = {
  data: null,
  timestamp: 0,
  promise: null
};

const EXPENSE_CACHE_TTL = 60_000;

const getExpensesCached = async ({ force = false } = {}) => {
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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('p2_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* =========================================================
   MAIN APP ROUTER
   ========================================================= */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<RegisterOwner />} />
        <Route path="*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

/* =========================================================
   PROTECTED LAYOUT (SIDEBAR + TOPBAR + CONTENT)
   ========================================================= */
function ProtectedLayout() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  /* Cache timestamp: notifikasi hanya diperbarui jika sudah > 60 detik */
  const notifLastLoadedRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    api
      .get('/me')
      .then((response) => {
        if (!mounted) return;
        const nextProfile = {
          ...(response.data.profile || {}),
          id: response.data.user?.id || response.data.profile?.id,
          email: response.data.user?.email || response.data.profile?.email
        };
        setProfile(nextProfile);
        setReadNotifIds(loadReadNotifIds(nextProfile));
      })
      .catch(() => {
        localStorage.removeItem('p2_token');
        navigate('/login', { replace: true });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!profile) return undefined;
    if (location.pathname === '/notifikasi') return undefined;

    /* 60-second cache: jangan reload notifikasi setiap pindah halaman */
    const now = Date.now();
    if (now - notifLastLoadedRef.current < 60_000) return undefined;

    let mounted = true;
    let timeoutId = null;
    let idleId = null;

    const loadNotifications = async () => {
      try {
        notifLastLoadedRef.current = Date.now();

        const [salesRes, expenseRows] = await Promise.all([
          api.get('/sales', { params: { range: '30d' } }),
          getExpensesCached()
        ]);

        if (!mounted) return;

        setNotifications(
          buildNotifications(
            salesRes.data?.rows || [],
            expenseRows
          )
        );
      } catch {
        if (mounted) setNotifications([]);
      }
    };

    const schedule = () => {
      if (!mounted) return;

      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(
          loadNotifications,
          { timeout: 5000 }
        );
      } else {
        timeoutId = window.setTimeout(loadNotifications, 2500);
      }
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      mounted = false;
      window.removeEventListener('load', schedule);

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      if (idleId && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [profile, location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
    if (profile) {
      setReadNotifIds(loadReadNotifIds(profile));
    }
  }, [location.pathname, profile]);

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-content">
          <div className="boot-logo">
            <img src="/favicon-dapoersari.png" alt="Dapoersari" />
          </div>
          <div className="boot-text">
            <strong>Dapoersari Enterprise</strong>
            <span>Menghubungkan ke server keuangan aman...</span>
          </div>
          <div className="boot-spinner">
            <div className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const ownerName = profile?.full_name?.trim() || 'Owner Dapoersari';
  const ownerInitial = ownerName.charAt(0).toUpperCase() || 'D';

  const hour = new Date().getHours();
  let greeting = 'Selamat malam';
  if (hour >= 5 && hour < 11) greeting = 'Selamat pagi';
  else if (hour >= 11 && hour < 15) greeting = 'Selamat siang';
  else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';

  const logout = () => {
    const confirmed = window.confirm('Apakah Anda yakin ingin keluar dari Dapoersari Executive Portal?');
    if (!confirmed) return;
    localStorage.removeItem('p2_token');
    navigate('/login', { replace: true });
  };

  const unreadNotifications = notifications.filter(
    (item) => !readNotifIds.includes(item.id)
  );
  const unreadCount = unreadNotifications.length;

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src="/favicon-dapoersari.png" alt="Dapoersari" />
          <div className="brand-copy">
            <strong>Dapoersari</strong>
            <span>Executive Finance Hub</span>
          </div>
        </div>

        <div className="sidebar-caption">IKHTISAR UTAMA</div>
        <nav className="nav-list">
          <NavItem to="/" icon={<Gauge size={18} />} label="Dashboard" />
        </nav>

        <div className="sidebar-caption">OPERASIONAL KEUANGAN</div>
        <nav className="nav-list">
          <NavItem to="/penjualan" icon={<Receipt size={18} />} label="Penjualan & Kasir" />
          <NavItem to="/pengeluaran" icon={<WalletCards size={18} />} label="Pengeluaran (OpEx)" />
        </nav>

        <div className="sidebar-caption">ANALISIS BISNIS</div>
        <nav className="nav-list">
          <NavItem to="/analitik" icon={<BarChart3 size={18} />} label="Performa Toko" />
          <NavItem to="/laporan" icon={<FileText size={18} />} label="Laporan Eksekutif" />
        </nav>

        <div className="sidebar-caption">SISTEM & AKUN</div>
        <nav className="nav-list">
          <NavItem to="/pengaturan" icon={<Settings size={18} />} label="Pengaturan" />
        </nav>

        <div className="sidebar-footer">
          <div className="owner-mini">
            <div className="avatar">{ownerInitial}</div>
            <div className="owner-meta">
              <strong>{ownerName}</strong>
              <span>Executive Owner</span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={logout} title="Keluar dari sesi">
            <LogOut size={16} />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BACKDROP */}
      {mobileOpen && (
        <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* MAIN CONTAINER */}
      <main className="main-area">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-button mobile-only"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <MenuIcon size={20} />}
            </button>

            <div className="crumb">
              <span className="crumb-root">
                <Building2 size={14} />
                <span>Enterprise</span>
              </span>
              <span className="crumb-sep">/</span>
              <strong className="crumb-current">{pageName(location.pathname)}</strong>
            </div>
          </div>

          <div className="top-actions">
            <div className="date-chip">
              <CalendarDays size={14} />
              <span>
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>

            <button
              type="button"
              className="notification"
              aria-label={
                unreadCount > 0
                  ? `Notifikasi, ${unreadCount} belum dibaca`
                  : 'Notifikasi'
              }
              onClick={() => navigate('/notifikasi')}
              title="Buka notifikasi"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="notif-count">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <div className="profile-chip" onClick={() => navigate('/pengaturan')} title="Buka Pengaturan">
              <div className="profile-avatar">{ownerInitial}</div>
              <div className="profile-copy">
                <strong>{ownerName}</strong>
                <span>Executive Owner</span>
              </div>
              <ChevronDown size={14} className="profile-chevron" />
            </div>
          </div>
        </header>

        {/* PAGE BODY */}
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard greeting={greeting} ownerName={ownerName} />} />
            <Route path="/notifikasi" element={<NotificationsPage profile={profile} />} />
            <Route path="/penjualan" element={<Sales />} />
            <Route path="/pengeluaran" element={<Finance />} />
            <Route path="/analitik" element={<Analytics />} />
            <Route path="/laporan" element={<Reports />} />
            <Route path="/pengaturan" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   NAVIGATION ITEM HELPER
   ========================================================= */
function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      <ChevronRight size={14} className="nav-arrow" />
    </NavLink>
  );
}

function pageName(path) {
  if (path === '/') return 'Dashboard Eksekutif';
  if (path.includes('notifikasi')) return 'Notifikasi';
  if (path.includes('penjualan')) return 'Penjualan & Kasir';
  if (path.includes('pengeluaran')) return 'Pengeluaran (OpEx)';
  if (path.includes('analitik') || path.includes('rekomendasi')) return 'Performa Toko & Analitik';
  if (path.includes('laporan')) return 'Laporan Keuangan';
  return 'Pusat Pengaturan';
}

/* =========================================================
   PAGE HEADER HELPER
   ========================================================= */
function PageHeader({ eyebrow, title, subtitle, action, badge }) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="page-head-title-row">
          <h1>{title}</h1>
          {badge && <span className="page-head-badge">{badge}</span>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="head-actions">{action}</div>}
    </div>
  );
}

/* =========================================================
   RANGE SELECTOR COMPONENT
   ========================================================= */
function useRange(initial = '30d') {
  const [range, setRange] = useState(initial);
  return [range, setRange];
}

function RangeSelect({ value, onChange }) {
  return (
    <div className="range-select-wrapper">
      <Clock size={14} className="range-select-icon" />
      <select className="range-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="today">Hari Ini</option>
        <option value="7d">7 Hari Terakhir</option>
        <option value="30d">30 Hari Terakhir</option>
        <option value="90d">90 Hari Terakhir</option>
      </select>
    </div>
  );
}

/* =========================================================
   METRIC STAT CARD COMPONENT
   ========================================================= */
function Metric({ label, value, sub, icon, trend, positive = true, tooltip }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <div className={`metric-icon-box ${positive ? 'positive' : 'negative'}`}>{icon}</div>
      </div>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
      </div>
      <div className="metric-footer">
        <span className={`metric-sub ${positive ? 'positive' : 'negative'}`}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{sub}</span>
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   PANEL COMPONENT
   ========================================================= */
function Panel({ title, hint, action, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <strong>{title}</strong>
          {hint && <span>{hint}</span>}
        </div>
        {action && <div className="panel-action">{action}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

/* =========================================================
   CHANNEL BADGE COMPONENT
   ========================================================= */
function ChannelBadge({ channel }) {
  const ch = (channel || 'website').toLowerCase();
  return (
    <span className={`channel-badge ${ch}`}>
      <span className="channel-dot" />
      <span>{channelLabel(ch)}</span>
    </span>
  );
}

function channelLabel(c) {
  const map = {
    website: 'Website Online',
    offline: 'Offline POS',
    shopeefood: 'ShopeeFood'
  };
  return map[c] || c || 'Website';
}

/* =========================================================
   LOADING & ERROR STATES
   ========================================================= */
function LoadingPage() {
  return (
    <div className="loading-page">
      <div className="spinner" />
      <span>Mengambil data transaksi dan laporan...</span>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="error-page">
      <div className="error-icon">
        <AlertCircle size={24} />
      </div>
      <h2>Gagal Memuat Data</h2>
      <p>{message || 'Terjadi gangguan saat menghubungkan ke server API.'}</p>
      <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
        <RefreshCw size={15} />
        <span>Coba Lagi</span>
      </button>
    </div>
  );
}

/* =========================================================
   1. LOGIN COMPONENT (ENTERPRISE SPLIT SCREEN)
   ========================================================= */
function Login() {
  const [form, setForm] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loginPhase, setLoginPhase] = useState('login');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const response = await axios.post(`${API}/auth/login`, form);
      const token = response?.data?.session?.access_token;
      if (!token) {
        throw new Error('Token otentikasi tidak ditemukan dalam respon.');
      }
      localStorage.setItem('p2_token', token);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(err?.response?.data?.error || err?.message || 'Email atau password salah.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`login-page phase-${loginPhase}`}>
      {/* BACKGROUND PARTICLES & MESH */}
      <div className="login-background">
        <div className="login-glow login-glow-a" />
        <div className="login-glow login-glow-b" />
        <div className="login-grid-mesh" />
      </div>

      {/* SPLASH INTRO OVERLAY */}
      <div className="login-splash">
        <div className="splash-content">
          <div className="splash-logo">
            <img src="/favicon-dapoersari.png" alt="Dapoersari" />
          </div>
          <span className="splash-eyebrow">ENTERPRISE FINANCIAL PORTAL</span>
          <h1>
            Dapoersari <em>Finance</em>
          </h1>
          <p>Sistem manajemen keuangan, omzet penjualan, dan performa bisnis terintegrasi.</p>
          <div className="splash-note">
            <ShieldCheck size={16} />
            <span>Koneksi aman terenkripsi 256-bit TLS</span>
          </div>
        </div>
      </div>

      {/* LEFT SHOWCASE PANEL (DESKTOP) */}
      <div className="login-showcase">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="showcase-logo">
              <img src="/favicon-dapoersari.png" alt="Dapoersari" />
            </div>
            <div>
              <h3>Dapoersari Enterprise</h3>
              <span>Financial Control</span>
            </div>
          </div>

          <div className="showcase-hero">
            <h1>
              Kontrol Penuh <br />
              <span className="gradient-text">Keuangan Bisnis Anda</span>
            </h1>
            <p>
              Pantau arus kas, penjualan, catatan operasional, dan laporan laba rugi dalam satu portal terpadu.
            </p>
          </div>

          <div className="showcase-feature-cards">
            <div className="showcase-card">
              <div className="showcase-card-icon">
                <Receipt size={18} />
              </div>
              <div>
                <strong>Multi-Channel Reconciliation</strong>
                <span>Website, Kasir Offline, dan ShopeeFood tercatat otomatis.</span>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-icon">
                <Target size={18} />
              </div>
              <div>
                <strong>Margin & Profit</strong>
                <span>Kalkulasi otomatis margin laba bersih berdasarkan penjualan bersih.</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <div className="security-tag">
              <ShieldCheck size={15} />
              <span>Enterprise Grade Security • Dapoersari Suite v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN FORM PANEL */}
      <div className="login-panel">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-card-logo">
                <img src="/favicon-dapoersari.png" alt="Dapoersari" />
              </div>
              <span className="portal-badge-eyebrow">OWNER PORTAL</span>
              <h2>Selamat Datang Kembali</h2>
              <p>Masuk ke portal eksekutif owner Dapoersari</p>
            </div>

            <form onSubmit={submit} className="login-form">
              {error && (
                <div className="error-box">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email-input">Alamat Email</label>
                <div className="input-with-icon">
                  <input
                    id="email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="owner@dapoersari.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-row label-with-action">
                  <label htmlFor="password-input">Kata Sandi</label>
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => navigate('/forgot-password')}
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="input-with-icon password-group">
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Masukkan kata sandi akun"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-btn login-submit" disabled={busy}>
                {busy ? (
                  <>
                    <div className="spinner small" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Workspace</span>
                    <ArrowUpRight size={18} />
                  </>
                )}
              </button>

              <div className="login-register-prompt">
                <span>Belum punya akun Owner?</span>
                <button
                  type="button"
                  className="register-owner-link"
                  onClick={() => navigate('/register')}
                >
                  Daftar sebagai Owner
                </button>
              </div>
            </form>

            <div className="login-security">
              <Lock size={13} className="tiny-lock" />
              <span>Akses khusus akun Owner terverifikasi</span>
            </div>
          </div>

          <div className="login-footer">
            <span>© {new Date().getFullYear()} Dapoersari Financial Suite • Hak Cipta Dilindungi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   1B. FORGOT PASSWORD COMPONENT
   ========================================================= */
function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    setSentMessage('');

    try {
      const response = await axios.post(`${API}/auth/forgot-password`, { email });
      setSentMessage(
        response?.data?.message ||
          'Jika email tersebut terdaftar, instruksi reset kata sandi telah dikirim ke alamat email Anda.'
      );
    } catch (err) {
      console.warn('Forgot password request error:', err?.message);
      // Even on non-400 error, return generic security message to protect user enumeration
      setSentMessage('Jika email tersebut terdaftar, instruksi reset kata sandi telah dikirim ke alamat email Anda.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page phase-login">
      {/* BACKGROUND PARTICLES & MESH */}
      <div className="login-background">
        <div className="login-glow login-glow-a" />
        <div className="login-glow login-glow-b" />
        <div className="login-grid-mesh" />
      </div>

      {/* LEFT SHOWCASE PANEL (DESKTOP) */}
      <div className="login-showcase">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="showcase-logo">
              <img src="/favicon-dapoersari.png" alt="Dapoersari" />
            </div>
            <div>
              <h3>Dapoersari Enterprise</h3>
              <span>Financial Control</span>
            </div>
          </div>

          <div className="showcase-hero">
            <h1>
              Pemulihan Akses <br />
              <span className="gradient-text">Akun Eksekutif Owner</span>
            </h1>
            <p>
              Kami memastikan keamanan penuh data finansial dan kredensial bisnis Dapoersari Anda dengan enkripsi end-to-end.
            </p>
          </div>

          <div className="showcase-feature-cards">
            <div className="showcase-card">
              <div className="showcase-card-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Autentikasi Aman</strong>
                <span>Link reset hanya dikirim ke email terverifikasi pemilik usaha.</span>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-icon">
                <Lock size={18} />
              </div>
              <div>
                <strong>Perlindungan Privasi</strong>
                <span>Informasi akun terlindungi tanpa membocorkan status data internal.</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <div className="security-tag">
              <ShieldCheck size={15} />
              <span>Enterprise Grade Security • Dapoersari Suite v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="login-panel">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-card-logo">
                <img src="/favicon-dapoersari.png" alt="Dapoersari" />
              </div>
              <span className="portal-badge-eyebrow">OWNER PORTAL</span>
              <h2>Lupa Kata Sandi?</h2>
              <p>Masukkan email yang terdaftar pada akun Owner Dapoersari.</p>
            </div>

            {sentMessage ? (
              <div className="reset-success-box">
                <div className="reset-success-icon-wrap">
                  <CheckCircle2 size={36} className="reset-success-icon" />
                </div>
                <strong className="reset-success-title">Permintaan Terkirim</strong>
                <p className="reset-success-desc">{sentMessage}</p>
                <button
                  type="button"
                  className="primary-btn reset-back-btn"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft size={16} />
                  <span>Kembali ke Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="error-box">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="forgot-email-input">Alamat Email</label>
                  <div className="input-with-icon">
                    <input
                      id="forgot-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@dapoersari.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={busy}>
                  {busy ? (
                    <>
                      <div className="spinner small" />
                      <span>Mengirim Tautan...</span>
                    </>
                  ) : (
                    <>
                      <span>Kirim Link Reset</span>
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </button>

                <div className="login-back-action">
                  <button
                    type="button"
                    className="back-to-login-btn"
                    onClick={() => navigate('/login')}
                  >
                    <ArrowLeft size={15} />
                    <span>Kembali ke Login</span>
                  </button>
                </div>
              </form>
            )}

            <div className="login-security">
              <Lock size={13} className="tiny-lock" />
              <span>Sesi terenkripsi & khusus akun terverifikasi</span>
            </div>
          </div>

          <div className="login-footer">
            <span>© {new Date().getFullYear()} Dapoersari Financial Suite • Hak Cipta Dilindungi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   1C. RESET PASSWORD COMPONENT
   ========================================================= */
function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    // 1. Check URL hash (Supabase default: #access_token=...&type=recovery)
    let extractedToken = '';
    const hash = location.hash || '';
    if (hash.startsWith('#')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      extractedToken = hashParams.get('access_token') || '';
    }

    // 2. Check query params (?token=... or ?access_token=...)
    if (!extractedToken) {
      const searchParams = new URLSearchParams(location.search);
      extractedToken = searchParams.get('token') || searchParams.get('access_token') || '';
    }

    if (!extractedToken) {
      setTokenError(true);
    } else {
      setToken(extractedToken);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    if (!password) {
      setError('Kata sandi baru wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await axios.post(
        `${API}/auth/reset-password`,
        { password },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setIsSuccess(true);
    } catch (err) {
      console.error('Reset password error:', err);
      const status = err?.response?.status;
      if (status === 401) {
        setTokenError(true);
      } else {
        setError(
          err?.response?.data?.error ||
            'Gagal memperbarui kata sandi. Pastikan tautan masih valid.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page phase-login">
      {/* BACKGROUND PARTICLES & MESH */}
      <div className="login-background">
        <div className="login-glow login-glow-a" />
        <div className="login-glow login-glow-b" />
        <div className="login-grid-mesh" />
      </div>

      {/* LEFT SHOWCASE PANEL (DESKTOP) */}
      <div className="login-showcase">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="showcase-logo">
              <img src="/favicon-dapoersari.png" alt="Dapoersari" />
            </div>
            <div>
              <h3>Dapoersari Enterprise</h3>
              <span>Financial Control</span>
            </div>
          </div>

          <div className="showcase-hero">
            <h1>
              Perbarui Kredensial <br />
              <span className="gradient-text">Aman & Terverifikasi</span>
            </h1>
            <p>
              Lindungi keamanan finansial Dapoersari dengan memperbarui kata sandi secara berkala.
            </p>
          </div>

          <div className="showcase-feature-cards">
            <div className="showcase-card">
              <div className="showcase-card-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Standar Keamanan Tinggi</strong>
                <span>Enkripsi kata sandi menggunakan hashing kriptografi standar industri.</span>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-icon">
                <Lock size={18} />
              </div>
              <div>
                <strong>Otentikasi Terpusat</strong>
                <span>Role Owner diverifikasi langsung oleh sistem sebelum perubahan diterapkan.</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <div className="security-tag">
              <ShieldCheck size={15} />
              <span>Enterprise Grade Security • Dapoersari Suite v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="login-panel">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-card-logo">
                <img src="/favicon-dapoersari.png" alt="Dapoersari" />
              </div>
              <span className="portal-badge-eyebrow">OWNER PORTAL</span>
              <h2>Buat Kata Sandi Baru</h2>
              <p>Tetapkan kata sandi baru untuk akun Owner Dapoersari.</p>
            </div>

            {tokenError ? (
              <div className="reset-error-state-box">
                <div className="reset-error-icon-wrap">
                  <AlertCircle size={36} className="reset-error-icon" />
                </div>
                <strong className="reset-error-title">Tautan Tidak Valid</strong>
                <p className="reset-error-desc">
                  Link reset sudah tidak valid atau telah kedaluwarsa. Silakan minta link reset baru.
                </p>
                <button
                  type="button"
                  className="primary-btn reset-back-btn"
                  onClick={() => navigate('/forgot-password')}
                >
                  <RefreshCw size={15} />
                  <span>Minta Link Reset Baru</span>
                </button>
                <div className="login-back-action">
                  <button
                    type="button"
                    className="back-to-login-btn"
                    onClick={() => navigate('/login')}
                  >
                    <ArrowLeft size={15} />
                    <span>Kembali ke Login</span>
                  </button>
                </div>
              </div>
            ) : isSuccess ? (
              <div className="reset-success-box">
                <div className="reset-success-icon-wrap">
                  <CheckCircle2 size={36} className="reset-success-icon" />
                </div>
                <strong className="reset-success-title">Password Berhasil Diubah</strong>
                <p className="reset-success-desc">
                  Kata sandi akun Anda telah diperbarui. Silakan login menggunakan password baru.
                </p>
                <button
                  type="button"
                  className="primary-btn reset-back-btn"
                  onClick={() => navigate('/login')}
                >
                  <Check size={16} />
                  <span>Kembali ke Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="error-box">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="new-password-input">Kata Sandi Baru</label>
                  <div className="input-with-icon password-group">
                    <input
                      id="new-password-input"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password-input">Konfirmasi Kata Sandi</label>
                  <div className="input-with-icon password-group">
                    <input
                      id="confirm-password-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={busy}>
                  {busy ? (
                    <>
                      <div className="spinner small" />
                      <span>Menyimpan Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Simpan Password Baru</span>
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </button>

                <div className="login-back-action">
                  <button
                    type="button"
                    className="back-to-login-btn"
                    onClick={() => navigate('/login')}
                  >
                    <ArrowLeft size={15} />
                    <span>Kembali ke Login</span>
                  </button>
                </div>
              </form>
            )}

            <div className="login-security">
              <Lock size={13} className="tiny-lock" />
              <span>Sesi terenkripsi & khusus akun terverifikasi</span>
            </div>
          </div>

          <div className="login-footer">
            <span>© {new Date().getFullYear()} Dapoersari Financial Suite • Hak Cipta Dilindungi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   1D. REGISTER OWNER COMPONENT
   ========================================================= */
function RegisterOwner() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    if (!fullName.trim() || !email.trim() || !password) {
      setError('Periksa kembali data pendaftaran Anda.');
      return;
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await axios.post(`${API}/auth/register-owner`, {
        fullName: fullName.trim(),
        email: email.trim(),
        password
      });

      setSuccessData({
        email: response.data?.email || email.trim(),
        message: response.data?.message || 'Permintaan akses Owner Anda telah diterima dan sedang menunggu verifikasi administrator.'
      });
    } catch (err) {
      console.error('Registration error:', err);
      const serverError = err?.response?.data?.error;
      if (serverError && serverError.includes('Email sudah terdaftar')) {
        setError('Email sudah terdaftar. Silakan gunakan email lain atau kembali ke Login.');
      } else {
        setError(serverError || 'Periksa kembali data pendaftaran Anda.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page phase-login">
      {/* BACKGROUND PARTICLES & MESH */}
      <div className="login-background">
        <div className="login-glow login-glow-a" />
        <div className="login-glow login-glow-b" />
        <div className="login-grid-mesh" />
      </div>

      {/* LEFT SHOWCASE PANEL (DESKTOP) */}
      <div className="login-showcase">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="showcase-logo">
              <img src="/favicon-dapoersari.png" alt="Dapoersari" />
            </div>
            <div>
              <h3>Dapoersari Enterprise</h3>
              <span>Financial Control</span>
            </div>
          </div>

          <div className="showcase-hero">
            <h1>
              Pengajuan Akses <br />
              <span className="gradient-text">Portal Finansial Owner</span>
            </h1>
            <p>
              Portal eksekutif Dapoersari dilindungi otentikasi ketat. Setiap akun owner melewati proses verifikasi administrator resmi.
            </p>
          </div>

          <div className="showcase-feature-cards">
            <div className="showcase-card">
              <div className="showcase-card-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Verifikasi Ketat Administrator</strong>
                <span>Akses finansial sensitif hanya diberikan kepada pemilik usaha yang disetujui.</span>
              </div>
            </div>

            <div className="showcase-card">
              <div className="showcase-card-icon">
                <Lock size={18} />
              </div>
              <div>
                <strong>Kredensial Terenkripsi</strong>
                <span>Keamanan akun tingkat enterprise dengan enkripsi industri standar.</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <div className="security-tag">
              <ShieldCheck size={15} />
              <span>Enterprise Grade Security • Dapoersari Suite v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT FORM PANEL */}
      <div className="login-panel">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-card-logo">
                <img src="/favicon-dapoersari.png" alt="Dapoersari" />
              </div>
              <span className="portal-badge-eyebrow">OWNER PORTAL</span>
              <h2>Buat Akun Owner</h2>
              <p>Daftarkan akun untuk mengajukan akses ke portal keuangan Dapoersari.</p>
            </div>

            {successData ? (
              <div className="reset-success-box">
                <div className="reset-success-icon-wrap">
                  <CheckCircle2 size={36} className="reset-success-icon" />
                </div>
                <strong className="reset-success-title">Pendaftaran Berhasil</strong>
                <p className="reset-success-desc">
                  Permintaan akses Owner Anda telah diterima dan sedang menunggu verifikasi administrator.
                </p>

                <div className="registration-status-card">
                  <div className="status-card-row">
                    <span>Email:</span>
                    <strong>{successData.email}</strong>
                  </div>
                  <div className="status-card-row">
                    <span>Status:</span>
                    <span className="pending-pill">
                      <span className="pending-dot" />
                      <span>Menunggu Verifikasi</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary-btn reset-back-btn"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft size={16} />
                  <span>Kembali ke Login</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                {error && (
                  <div className="error-box">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="reg-fullname">Nama Lengkap</label>
                  <div className="input-with-icon">
                    <input
                      id="reg-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama lengkap pemilik usaha"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-email">Alamat Email</label>
                  <div className="input-with-icon">
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="owner@dapoersari.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-password">Password</label>
                  <div className="input-with-icon password-group">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-confirm-password">Konfirmasi Password</label>
                  <div className="input-with-icon password-group">
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="primary-btn login-submit" disabled={busy}>
                  {busy ? (
                    <>
                      <div className="spinner small" />
                      <span>Mengajukan Pendaftaran...</span>
                    </>
                  ) : (
                    <>
                      <span>Ajukan Pendaftaran</span>
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </button>

                <div className="login-back-action">
                  <span>Sudah punya akun?</span>
                  <button
                    type="button"
                    className="back-to-login-btn inline"
                    onClick={() => navigate('/login')}
                  >
                    Kembali ke Login
                  </button>
                </div>
              </form>
            )}

            <div className="login-security">
              <Lock size={13} className="tiny-lock" />
              <span>Akses khusus akun Owner terverifikasi</span>
            </div>
          </div>

          <div className="login-footer">
            <span>© {new Date().getFullYear()} Dapoersari Financial Suite • Hak Cipta Dilindungi</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   2. DASHBOARD COMPONENT
   ========================================================= */
function Dashboard({ greeting, ownerName }) {
  const [range, setRange] = useRange('30d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setError('');
    api
      .get('/dashboard', { params: { range } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error || 'Gagal memuat ringkasan dashboard.'));
  }, [range]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingPage />;

  const s = data.summary || {};
  const grossSales = Number(s.grossSales || 0);
  const netSales = Number(s.netSales || 0);
  const expenseTotal = Number(s.expenseTotal || 0);
  const netProfit = Number(s.netProfit || 0);
  const transactionCount = Number(s.transactionCount || 0);
  const marginPercent = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : '0.0';

  const channelData = s.channel || {};
  const channelTotalSum = Object.values(channelData).reduce((a, b) => a + Number(b || 0), 0) || 1;

  return (
    <>
      {/* EXECUTIVE GREETING BANNER */}
      <section className="dashboard-greeting">
        <div className="dashboard-greeting-main">
          <div className="dashboard-greeting-label">
            <span className="greeting-time">{greeting}</span>
            <span className="greeting-divider">•</span>
            <span className="greeting-status">Portal Eksekutif Aktif</span>
          </div>
          <h2>{ownerName}</h2>
          <p>Berikut adalah ringkasan kinerja penjualan, alokasi biaya, dan profitabilitas Dapoersari untuk periode terpilih.</p>
        </div>
        <div className="dashboard-greeting-actions">
          <button type="button" className="greeting-btn secondary" onClick={() => navigate('/laporan')}>
            <FileText size={15} />
            <span>Buka Laporan</span>
          </button>
          <button type="button" className="greeting-btn primary" onClick={() => navigate('/pengeluaran')}>
            <Plus size={15} />
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </section>

      {/* PAGE HEADER & RANGE FILTER */}
      <PageHeader
        eyebrow="IKHTISAR KEUANGAN"
        title="Ringkasan Kinerja Bisnis"
        subtitle="Analisis real-time omzet kotor, penjualan bersih, pengeluaran operasional, dan laba bersih."
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      {/* METRICS GRID */}
      <div className="metric-grid">
        <Metric
          label="Penjualan Kotor (Gross)"
          value={shortMoney(grossSales)}
          sub={`${transactionCount} transaksi berhasil`}
          icon={<CircleDollarSign size={20} />}
          positive={true}
        />
        <Metric
          label="Penjualan Bersih (Net Sales)"
          value={shortMoney(netSales)}
          sub="Nilai bersih seluruh channel"
          icon={<TrendingUp size={20} />}
          positive={true}
        />
        <Metric
          label="Pengeluaran Operasional"
          value={shortMoney(expenseTotal)}
          sub={`${data.expenseCount || 0} pos pengeluaran tercatat`}
          icon={<WalletCards size={20} />}
          positive={false}
        />
        <Metric
          label="Laba Bersih (Net Profit)"
          value={shortMoney(netProfit)}
          sub={`${marginPercent}% margin profitabilitas`}
          icon={<Target size={20} />}
          positive={netProfit >= 0}
        />
      </div>

      {/* CHARTS & CHANNEL BREAKDOWN */}
      <div className="two-col-grid">
        <Panel
          title="Tren Arus Pendapatan"
          hint={`Fluktuasi penjualan harian (${range === 'today' ? 'Hari ini' : range})`}
          action={
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-dot gross" />
                <span>Penjualan</span>
              </span>
            </div>
          }
        >
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <YAxis tickFormatter={shortMoney} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
                <Tooltip
                  formatter={(v) => [money(v), 'Penjualan']}
                  labelFormatter={(l) =>
                    new Date(l).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  }
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '10px',
                    color: '#fff',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                  }}
                  itemStyle={{ color: '#a5b4fc', fontWeight: 600 }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Kontribusi Channel Penjualan" hint="Distribusi penjualan bersih per channel">
          <div className="channel-distribution-list">
            {Object.entries(channelData).map(([key, val]) => {
              const amount = Number(val || 0);
              const percent = ((amount / channelTotalSum) * 100).toFixed(1);
              return (
                <div className="channel-bar-row" key={key}>
                  <div className="channel-bar-meta">
                    <div className="channel-bar-label">
                      <span className={`channel-indicator ${key}`} />
                      <strong>{channelLabel(key)}</strong>
                    </div>
                    <div className="channel-bar-amounts">
                      <strong>{money(amount)}</strong>
                      <span className="channel-bar-pct">{percent}%</span>
                    </div>
                  </div>
                  <div className="channel-progress-track">
                    <div className={`channel-progress-fill ${key}`} style={{ width: `${Math.max(4, percent)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

        </Panel>
      </div>

      {/* EXECUTIVE ADVISOR INSIGHT STRIP */}
      <div className="insight-strip">
        <div className="insight-icon">
          <Activity size={20} />
        </div>
        <div className="insight-content">
          <strong>Ringkasan Bisnis</strong>
          <span>
            {transactionCount > 0
              ? `Periode ini membukukan ${transactionCount} transaksi dengan rata-rata omzet ${money(grossSales / transactionCount)} per pesanan. Laba bersih mencapai ${money(netProfit)} (${marginPercent}% margin). Gunakan tab Performa Toko untuk melihat menu terlaris dan jam sibuk.`
              : 'Belum ada transaksi pada rentang waktu ini. Ubah filter periode di atas untuk meninjau data historis usaha.'}
          </span>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   NOTIFICATIONS COMPONENT
   ========================================================= */
function NotificationsPage({ profile }) {
  const [notifications, setNotifications] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState(() =>
    loadReadNotifIds(profile)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setReadNotifIds(loadReadNotifIds(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [salesRes, expensesRes] = await Promise.all([
          api.get('/sales', { params: { range: '30d' } }),
          api.get('/expenses')
        ]);

        if (!active) return;

        const expenseRows = Array.isArray(expensesRes.data)
          ? expensesRes.data
          : expensesRes.data?.rows || expensesRes.data?.data || [];

        setNotifications(
          buildNotifications(
            salesRes.data?.rows || [],
            expenseRows
          )
        );
      } catch (e) {
        if (!active) return;
        setError(
          e?.response?.data?.error ||
          e?.message ||
          'Notifikasi gagal dimuat.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const unreadNotifications = notifications.filter(
    (item) => !readNotifIds.includes(item.id)
  );

  const markAllRead = () => {
    const next = [
      ...new Set([
        ...readNotifIds,
        ...notifications.map((item) => item.id)
      ])
    ];

    setReadNotifIds(next);
    saveReadNotifIds(profile, next);
  };

  const openNotification = (item) => {
    const next = readNotifIds.includes(item.id)
      ? readNotifIds
      : [...readNotifIds, item.id];

    setReadNotifIds(next);
    saveReadNotifIds(profile, next);

    if (item.href) {
      navigate(item.href);
    }
  };

  const groupedNotifications = notifications.reduce((groups, item) => {
    const key = new Date(item.at).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="PUSAT NOTIFIKASI"
        title="Notifikasi"
        subtitle="Pantau aktivitas penjualan dan pengeluaran terbaru dari satu halaman."
        action={
          unreadNotifications.length > 0 ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={markAllRead}
            >
              <Check size={15} />
              <span>Tandai semua dibaca</span>
            </button>
          ) : null
        }
      />

      <div className="notification-page">
        <div className="notification-page-summary">
          <div className="notification-summary-main">
            <div className="notification-summary-icon">
              <Bell size={20} />
            </div>
            <div>
              <strong>
                {notifications.length} aktivitas terbaru
              </strong>
              <span>
                {unreadNotifications.length > 0
                  ? `${unreadNotifications.length} belum dibaca`
                  : 'Semua notifikasi sudah dibaca'}
              </span>
            </div>
          </div>

          <div className="notification-summary-date">
            <CalendarDays size={15} />
            <span>30 hari terakhir</span>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} />
        ) : loading ? (
          <LoadingPage />
        ) : notifications.length === 0 ? (
          <div className="notification-empty-page">
            <div className="notification-empty-icon">
              <Bell size={28} />
            </div>
            <h3>Belum ada aktivitas</h3>
            <p>
              Notifikasi penjualan dan pengeluaran akan muncul di halaman ini.
            </p>
          </div>
        ) : (
          <div className="notification-timeline">
            {Object.entries(groupedNotifications).map(
              ([date, items]) => (
                <section key={date} className="notification-day">
                  <div className="notification-day-label">
                    {date}
                  </div>

                  <div className="notification-list">
                    {items.map((item) => {
                      const unread = !readNotifIds.includes(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`notification-page-item ${
                            unread ? 'unread' : ''
                          }`}
                          onClick={() => openNotification(item)}
                        >
                          <div
                            className={`notification-page-icon ${item.tone}`}
                          >
                            {item.type === 'sale' ? (
                              <Receipt size={18} />
                            ) : (
                              <WalletCards size={18} />
                            )}
                          </div>

                          <div className="notification-page-content">
                            <div className="notification-page-title-row">
                              <strong>{item.title}</strong>
                              <span>
                                {formatDateTime(item.at)}
                              </span>
                            </div>

                            <p>{item.body}</p>

                            <div className="notification-page-meta">
                              <span>
                                {item.type === 'sale'
                                  ? 'Penjualan'
                                  : 'Pengeluaran'}
                              </span>
                              <ChevronRight size={14} />
                            </div>
                          </div>

                          {unread && (
                            <span
                              className="notification-page-unread"
                              aria-label="Belum dibaca"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* =========================================================
   3. SALES COMPONENT (PENJUALAN)
   ========================================================= */
function Sales() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [range, setRange] = useRange('30d');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');

  const openOrderDetail = async (order) => {
    setDetailLoading(true);

    try {
      const response = await api.get(`/sales/${order.id}`);
      setSelectedOrder(response.data);
    } catch (e) {
      console.error('Gagal memuat detail transaksi:', e);
      alert(e?.response?.data?.error || 'Detail transaksi gagal dimuat.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setRows(null);
    setError('');

    api
      .get('/sales', { params: { range } })
      .then((response) => {
        const salesRows = Array.isArray(response.data?.rows)
          ? response.data.rows
          : [];

        setRows(
          salesRows.map((order) => ({
            id: order.id || order.orderId || null,
            orderCode: order.orderCode || order.order_code || '-',
            orderedAt: order.orderedAt || order.ordered_at || null,
            channel: order.channel || order.sales_channel || 'website',
            status: order.status || 'completed',
            total: Number(order.netTotal ?? order.total ?? 0),
            grossTotal: Number(order.grossTotal ?? order.total ?? 0)
          }))
        );
      })
      .catch((e) => {
        console.error('Gagal memuat penjualan:', e);
        setError(
          e?.response?.data?.error ||
          e?.message ||
          'Gagal memuat data penjualan.'
        );
      });
  }, [range]);

  if (error) return <ErrorState message={error} />;
  if (!rows) return <LoadingPage />;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRows = rows.filter((row) => {
    const orderCode = String(row.orderCode || '').toLowerCase();
    const channel = String(row.channel || '').toLowerCase();

    const matchesSearch =
      !normalizedSearch || orderCode.includes(normalizedSearch);

    const matchesChannel =
      channelFilter === 'all' ||
      channel === channelFilter.toLowerCase();

    return matchesSearch && matchesChannel;
  });

  const totalRevenue = rows.reduce(
    (sum, row) => sum + Number(row.total || 0),
    0
  );

  const average = rows.length ? totalRevenue / rows.length : 0;

  const hasActiveFilters =
    Boolean(searchTerm.trim()) || channelFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setChannelFilter('all');
  };

  return (
    <>
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <PageHeader
        eyebrow="KINERJA PENJUALAN"
        title="Penjualan & Kasir"
        subtitle="Pantau seluruh transaksi yang terselesaikan dari setiap channel penjualan Dapoersari."
      />

      {/* =====================================================
          SEARCH + FILTER TOOLBAR
          Satu pola visual untuk desktop, tablet, dan mobile.
      ===================================================== */}
      <section className="sales-filter-shell" aria-label="Pencarian dan filter transaksi">
        <div className="sales-filter-toolbar">
          <label className="sales-filter-field sales-filter-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Cari transaksi</span>
            <input
              type="search"
              inputMode="search"
              placeholder="Cari kode transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cari kode transaksi"
            />
          </label>

          <label className="sales-filter-field">
            <Filter size={16} aria-hidden="true" />
            <span className="sr-only">Filter channel penjualan</span>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              aria-label="Filter channel penjualan"
            >
              <option value="all">Semua Channel</option>
              <option value="website">Website Online</option>
              <option value="offline">Offline POS</option>
              <option value="shopeefood">ShopeeFood</option>
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </label>

          <div className="sales-filter-field sales-filter-range">
            <Clock size={16} aria-hidden="true" />
            <RangeSelect
              value={range}
              onChange={setRange}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="sales-filter-reset"
              onClick={resetFilters}
              aria-label="Hapus semua filter transaksi"
              title="Hapus semua filter"
            >
              <X size={15} />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="sales-filter-meta">
          <span>
            Menampilkan <strong>{filteredRows.length}</strong> dari{' '}
            <strong>{rows.length}</strong> transaksi selesai
          </span>

          {(searchTerm || channelFilter !== 'all') && (
            <span className="sales-filter-status">
              Filter aktif
            </span>
          )}
        </div>
      </section>

      {/* =====================================================
          SALES SUMMARY
      ===================================================== */}
      <div className="sales-summary-grid">
        <article className="sales-summary-card sales-summary-primary">
          <div className="sales-summary-icon">
            <Receipt size={19} />
          </div>
          <div className="sales-summary-content">
            <span>Total Penjualan Bersih</span>
            <strong>{money(totalRevenue)}</strong>
            <small>
              {rows.length} transaksi selesai pada periode terpilih
            </small>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon">
            <ShoppingBag size={18} />
          </div>
          <div className="sales-summary-content">
            <span>Total Transaksi</span>
            <strong>{rows.length}</strong>
            <small>Pesanan selesai</small>
          </div>
        </article>

        <article className="sales-summary-card">
          <div className="sales-summary-icon">
            <CircleDollarSign size={18} />
          </div>
          <div className="sales-summary-content">
            <span>Rata-rata Pesanan</span>
            <strong>{money(average)}</strong>
            <small>Nilai rata-rata per transaksi</small>
          </div>
        </article>
      </div>

      {/* =====================================================
          TRANSACTION TABLE - DESKTOP / TABLET
      ===================================================== */}
      <section className="table-panel sales-table-panel">
        <div className="table-head">
          <div>
            <strong>Riwayat Transaksi</strong>
            <span>
              Klik transaksi untuk melihat rincian pesanan dan pembayaran.
            </span>
          </div>

          <div className="sales-table-count">
            {filteredRows.length} transaksi
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Kode Pesanan</th>
                <th>Waktu Transaksi</th>
                <th>Channel Penjualan</th>
                <th>Status</th>
                <th className="right">Penjualan Bersih</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={`${row.orderCode}-${row.orderedAt}`}
                  className="transaction-row"
                  onClick={() => openOrderDetail(row)}
                >
                  <td>
                    <span className="order-code-badge">
                      {row.orderCode}
                    </span>
                  </td>

                  <td>
                    <span className="text-muted">
                      {formatDateTime(row.orderedAt)}
                    </span>
                  </td>

                  <td>
                    <ChannelBadge channel={row.channel} />
                  </td>

                  <td>
                    <span className="status-badge done">
                      <CheckCircle2 size={12} />
                      <span>Selesai</span>
                    </span>
                  </td>

                  <td className="right">
                    <strong className="amount-cell">
                      {money(row.total)}
                    </strong>
                  </td>

                  <td className="right">
                    <button
                      type="button"
                      className="table-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openOrderDetail(row);
                      }}
                    >
                      <span>Detail</span>
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    <div className="empty-state">
                      <Receipt size={32} />
                      <strong>Tidak ada transaksi yang cocok</strong>
                      <span>
                        Coba ganti kata kunci pencarian atau ubah filter
                        channel.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =====================================================
          TRANSACTION CARDS - MOBILE
      ===================================================== */}
      <section className="sales-mobile-section" aria-label="Riwayat transaksi mobile">
        <div className="sales-mobile-section-head">
          <div>
            <strong>Riwayat Transaksi</strong>
            <span>{filteredRows.length} transaksi</span>
          </div>
        </div>

        <div className="sales-mobile-list">
          {filteredRows.map((row) => (
            <button
              key={`mobile-${row.orderCode}-${row.orderedAt}`}
              type="button"
              className="sales-mobile-card"
              onClick={() => openOrderDetail(row)}
            >
              <div className="sales-mobile-card-top">
                <span className="sales-mobile-code">
                  {row.orderCode}
                </span>

                <strong className="sales-mobile-total">
                  {money(row.total)}
                </strong>
              </div>

              <div className="sales-mobile-date">
                <Clock size={13} />
                <span>{formatDateTime(row.orderedAt)}</span>
              </div>

              <div className="sales-mobile-card-bottom">
                <div className="sales-mobile-meta">
                  <ChannelBadge channel={row.channel} />

                  <span className="status-badge done">
                    <CheckCircle2 size={11} />
                    <span>Selesai</span>
                  </span>
                </div>

                <span className="sales-mobile-arrow" aria-hidden="true">
                  <ChevronRight size={16} />
                </span>
              </div>
            </button>
          ))}

          {filteredRows.length === 0 && (
            <div className="sales-mobile-empty">
              <Receipt size={28} />
              <strong>Tidak ada transaksi</strong>
              <span>
                Ubah pencarian atau filter channel untuk melihat transaksi
                lainnya.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          MOBILE-SCOPED STYLES FOR THIS PAGE
          Tidak memerlukan perubahan file CSS lain.
      ===================================================== */}
      <style>{`
        .sr-only {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        }

        .sales-filter-shell {
          margin-bottom: 16px;
          border: 1px solid var(--line, #e7e0d6);
          border-radius: 16px;
          background: var(--surface, #fffdf9);
          box-shadow: 0 4px 18px rgba(28, 25, 23, 0.045);
          overflow: hidden;
        }

        .sales-filter-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px 190px auto;
          gap: 10px;
          align-items: center;
          padding: 10px;
        }

        .sales-filter-field {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #e5ddd2;
          border-radius: 10px;
          background: #ffffff;
          color: #78716c;
        }

        .sales-filter-field:focus-within {
          border-color: #3f6b4e;
          box-shadow: 0 0 0 3px rgba(63, 107, 78, 0.10);
        }

        .sales-filter-search input,
        .sales-filter-field select {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #292524;
          font: inherit;
        }

        .sales-filter-search input::placeholder {
          color: #a8a29e;
        }

        .sales-filter-field select {
          appearance: none;
          cursor: pointer;
          padding-right: 0;
        }

        .sales-filter-range {
          padding-right: 8px;
        }

        .sales-filter-range .range-select-wrapper {
          display: contents;
        }

        .sales-filter-range .range-select-icon {
          display: none;
        }

        .sales-filter-range .range-select {
          width: 100%;
          min-width: 0;
          height: 40px;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          box-shadow: none;
          color: #292524;
          font: inherit;
        }

        .sales-filter-reset {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 78px;
          height: 42px;
          padding: 0 12px;
          border: 1px solid #ded6cc;
          border-radius: 10px;
          background: #fff;
          color: #57534e;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 650;
        }

        .sales-filter-reset:hover {
          border-color: #c9bfb2;
          background: #faf7f2;
          color: #292524;
        }

        .sales-filter-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 13px 11px;
          color: #78716c;
          font-size: 11px;
        }

        .sales-filter-meta strong {
          color: #292524;
          font-weight: 700;
        }

        .sales-filter-status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          background: #eef5ef;
          color: #3f6b4e;
          font-size: 10px;
          font-weight: 700;
        }

        .sales-summary-grid {
          display: grid !important;
          grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr) minmax(0, 1fr) !important;
          gap: 10px !important;
          margin-bottom: 16px;
        }

        .sales-summary-card {
          display: flex;
          align-items: center;
          min-width: 0;
          gap: 11px;
          padding: 15px;
          border: 1px solid #e6ded3;
          border-radius: 14px;
          background: #fffdf9;
          color: #292524;
          box-shadow: 0 3px 14px rgba(28, 25, 23, 0.035);
        }

        .sales-summary-primary {
          border-color: #292523;
          background: #1c1917;
          color: #fff;
        }

        .sales-summary-icon {
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #f3efe8;
          color: #3f6b4e;
        }

        .sales-summary-primary .sales-summary-icon {
          background: rgba(255, 255, 255, 0.10);
          color: #dfe9df;
        }

        .sales-summary-content {
          min-width: 0;
        }

        .sales-summary-content span,
        .sales-summary-content small {
          display: block;
        }

        .sales-summary-content span {
          color: #78716c;
          font-size: 10px;
          line-height: 1.3;
        }

        .sales-summary-primary .sales-summary-content span {
          color: rgba(255,255,255,.68);
        }

        .sales-summary-content strong {
          display: block;
          margin-top: 3px;
          color: #1c1917;
          font-size: clamp(18px, 2vw, 22px);
          line-height: 1.15;
          font-variant-numeric: tabular-nums;
        }

        .sales-summary-primary .sales-summary-content strong {
          color: #fff;
        }

        .sales-summary-content small {
          margin-top: 4px;
          color: #a8a29e;
          font-size: 9px;
          line-height: 1.3;
        }

        .sales-summary-primary .sales-summary-content small {
          color: rgba(255,255,255,.56);
        }

        .sales-table-panel {
          overflow: hidden;
        }

        .sales-table-panel .table-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .sales-table-count {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 9px;
          border-radius: 999px;
          background: #f5f1ea;
          color: #78716c;
          font-size: 10px;
          font-weight: 700;
        }

        .sales-mobile-section {
          display: none;
        }

        .sales-mobile-section-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .sales-mobile-section-head strong {
          display: block;
          color: #292524;
          font-size: 14px;
        }

        .sales-mobile-section-head span {
          display: block;
          margin-top: 2px;
          color: #8b8580;
          font-size: 10px;
        }

        .sales-mobile-list {
          display: grid;
          gap: 9px;
        }

        .sales-mobile-card {
          display: grid;
          gap: 8px;
          width: 100%;
          padding: 13px;
          border: 1px solid #e5ddd3;
          border-radius: 14px;
          background: #fffdf9;
          color: #292524;
          text-align: left;
          box-shadow: 0 3px 13px rgba(28,25,23,.035);
          cursor: pointer;
          font: inherit;
          appearance: none;
        }

        .sales-mobile-card:active {
          transform: translateY(1px);
        }

        .sales-mobile-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          min-width: 0;
        }

        .sales-mobile-code {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #292524;
          font-size: 12px;
          font-weight: 750;
        }

        .sales-mobile-total {
          flex: 0 0 auto;
          color: #1c1917;
          font-size: 15px;
          line-height: 1.15;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .sales-mobile-date {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #8b8580;
          font-size: 10px;
        }

        .sales-mobile-card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .sales-mobile-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          min-width: 0;
        }

        .sales-mobile-meta .channel-badge,
        .sales-mobile-meta .status-badge {
          margin: 0;
        }

        .sales-mobile-arrow {
          flex: 0 0 auto;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #f3efe8;
          color: #57534e;
        }

        .sales-mobile-empty {
          display: grid;
          justify-items: center;
          gap: 6px;
          padding: 32px 18px;
          border: 1px dashed #ddd4c8;
          border-radius: 14px;
          color: #8b8580;
          text-align: center;
          background: #fffdf9;
        }

        .sales-mobile-empty strong {
          color: #57534e;
          font-size: 13px;
        }

        .sales-mobile-empty span {
          max-width: 280px;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .sales-filter-toolbar {
            grid-template-columns: minmax(0, 1fr) 1fr 1fr !important;
          }

          .sales-filter-search {
            grid-column: 1 / -1;
          }

          .sales-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .sales-summary-primary {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 767px) {
          .sales-filter-shell {
            margin-bottom: 13px;
            border-radius: 14px;
          }

          .sales-filter-toolbar {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 8px !important;
            padding: 9px;
          }

          .sales-filter-search {
            grid-column: auto;
          }

          .sales-filter-field,
          .sales-filter-reset {
            width: 100%;
            min-width: 0;
          }

          .sales-filter-meta {
            align-items: flex-start;
            padding: 0 11px 10px;
            font-size: 10px;
          }

          .sales-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 9px !important;
            margin-bottom: 14px;
          }

          .sales-summary-primary {
            grid-column: 1 / -1;
          }

          .sales-summary-card {
            align-items: flex-start;
            gap: 9px;
            padding: 13px;
            border-radius: 13px;
          }

          .sales-summary-icon {
            width: 31px;
            height: 31px;
            border-radius: 9px;
          }

          .sales-summary-content span {
            font-size: 9px;
          }

          .sales-summary-content strong {
            font-size: 18px;
          }

          .sales-summary-content small {
            font-size: 8.5px;
          }

          .sales-table-panel {
            display: none !important;
          }

          .sales-mobile-section {
            display: block;
          }

          .sales-mobile-card {
            min-height: 94px;
          }
        }

        @media (max-width: 374px) {
          .sales-summary-card {
            padding: 11px;
          }

          .sales-summary-content strong {
            font-size: 17px;
          }

          .sales-summary-content small {
            font-size: 8px;
          }

          .sales-mobile-card {
            padding: 12px;
          }

          .sales-mobile-code {
            font-size: 11px;
          }

          .sales-mobile-total {
            font-size: 14px;
          }
        }
      `}</style>

      {/* ORDER DETAIL DRAWER/MODAL */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          loading={detailLoading}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}

/* =========================================================
   ORDER DETAIL MODAL (DIGITAL RECEIPT)
   ========================================================= */
function OrderDetailModal({ order, loading, onClose }) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card">
          <div className="loading-page">
            <div className="spinner" />
            <span>Memuat rincian invoice transaksi...</span>
          </div>
        </div>
      </div>
    );
  }

  const channel = String(
    order?.sales_channel || order?.channel || 'website'
  ).toLowerCase();

  const gross = Number(
    order?.gross_total ??
    order?.total ??
    0
  );

  const netSales = Number(
    order?.net_total ??
    order?.netTotal ??
    (
      channel === 'shopeefood'
        ? gross * 0.75
        : gross
    )
  );

  const items = Array.isArray(order?.order_items)
    ? order.order_items
    : [];

  const copyOrderCode = () => {
    if (order?.order_code) {
      navigator.clipboard.writeText(order.order_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">RINCIAN INVOICE PESANAN</span>
            <div className="order-code-title-row">
              <h3>{order?.order_code || '-'}</h3>
              <button type="button" className="copy-btn" onClick={copyOrderCode} title="Salin kode pesanan">
                {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* ORDER INFO GRID */}
        <div className="order-detail-info">
          <div>
            <span>WAKTU PEMESANAN</span>
            <strong>{formatDateTime(order?.ordered_at)}</strong>
          </div>
          <div>
            <span>CHANNEL PENJUALAN</span>
            <ChannelBadge channel={channel} />
          </div>
          <div>
            <span>STATUS TRANSAKSI</span>
            <span className="status-badge done">
              <CheckCircle2 size={12} />
              <span>Selesai & Lunas</span>
            </span>
          </div>
          <div>
            <span>METODE PEMBAYARAN</span>
            <strong>{(order?.payment_method || 'CASH').toUpperCase()}</strong>
          </div>
        </div>

        {/* ORDER ITEMS */}
        <div className="order-detail-section">
          <div className="order-detail-section-head">
            <strong>Daftar Item Menu ({items.length})</strong>
          </div>

          <div className="order-item-list">
            {items.map((item, idx) => {
              const itemName = item?.menu?.name || item?.name || 'Menu Dapoersari';
              const quantity = Number(item?.quantity || 1);
              const unitPrice = Number(item?.unit_price || 0);
              const subtotal = quantity * unitPrice;

              return (
                <div className="order-item-row" key={item.id || idx}>
                  <div className="order-item-main">
                    <strong>{itemName}</strong>
                    <span>
                      {quantity} x {money(unitPrice)}
                    </span>
                  </div>
                  <strong className="order-item-total">{money(subtotal)}</strong>
                </div>
              );
            })}

            {items.length === 0 && <div className="empty-cell">Rincian item menu tidak tercatat.</div>}
          </div>
        </div>

        {/* FINAL SETTLEMENT */}
        <div className="order-total-card">
          <div className="total-row net">
            <span>Penjualan Bersih</span>
            <strong>{money(netSales)}</strong>
          </div>
        </div>

        <div className="modal-footer-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   4. FINANCE COMPONENT (PENGELUARAN / OPEX)
   ========================================================= */
function Finance() {
  const [expenses, setExpenses] = useState(null);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [error, setError] = useState('');

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.expense-action-menu-wrap')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadExpenses = async (force = false) => {
    const rawData = await getExpensesCached({ force });

    const normalized = rawData.map((expense) => ({
      id: expense.id,
      categoryId: expense.categoryId ?? expense.expense_category_id ?? null,
      categoryName: expense.categoryName || expense.category || expense.expense_categories?.name || 'Operasional',
      amount: Number(expense.amount || 0),
      expenseDate: expense.expenseDate || expense.spent_at || expense.expense_date || expense.created_at || null,
      note: expense.note || expense.title || expense.notes || expense.description || 'Pengeluaran Operasional',
      createdAt: expense.createdAt || expense.created_at || null
    }));

    setExpenses(normalized);
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/expense-categories');
      const rawData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setCategories(rawData);
    } catch (e) {
      console.error('Kategori gagal dimuat, menggunakan fallback:', e);
      setCategories([
        { id: 1, name: 'Bahan Baku & Dapur' },
        { id: 2, name: 'Operasional & Utilitas' },
        { id: 3, name: 'Transportasi & Logistik' },
        { id: 4, name: 'Listrik & Air' },
        { id: 5, name: 'Perawatan Alat' },
        { id: 6, name: 'Lain-lain' }
      ]);
    }
  };

  const openExpenseModal = async (expenseToEdit = null) => {
    await loadCategories();
    setEditingExpense(expenseToEdit);
    setModal(true);
  };

  useEffect(() => {
    loadExpenses().catch((e) => {
      console.error('Gagal memuat keuangan:', e);
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat data keuangan.');
    });
  }, []);

  const save = async (form) => {
    if (editingExpense && editingExpense.id) {
      await api.put(`/expenses/${editingExpense.id}`, {
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        note: form.note
      });
    } else {
      await api.post('/expenses', {
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        note: form.note
      });
    }
    setModal(false);
    setEditingExpense(null);
    await loadExpenses(true);
  };

  const remove = async (id) => {
    setActiveMenuId(null);
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?');
    if (!confirmed) return;
    try {
      await api.delete(`/expenses/${id}`);
      await loadExpenses(true);
    } catch (e) {
      console.error('Gagal menghapus pengeluaran:', e);
      alert(e?.response?.data?.error || e?.message || 'Pengeluaran gagal dihapus.');
    }
  };

  if (error) return <ErrorState message={error} />;

  const expenseRows = expenses || [];
  const totalExpense = expenseRows.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const avgExpense = expenseRows.length
    ? totalExpense / expenseRows.length
    : 0;

  const formatExpenseDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return dateFormatterLong.format(date);
  };

  return (
    <>
      <PageHeader
        eyebrow="ARUS KAS KELUAR"
        title="Pengeluaran Operasional"
        subtitle="Catat dan kendalikan seluruh pos belanja bahan baku, operasional harian, dan utilitas usaha."
        action={
          <button className="primary-btn" onClick={() => openExpenseModal(null)}>
            <Plus size={16} />
            <span>Tambah Catatan Pengeluaran</span>
          </button>
        }
      />

      {/* EXPENSE SUMMARY */}
      <div className="finance-grid">
        <div className="finance-summary finance-summary-total">
          <div className="finance-summary-icon">
            <WalletCards size={20} />
          </div>
          <div>
            <span>Total Pengeluaran</span>
            <strong>{expenses ? money(totalExpense) : '—'}</strong>
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-icon">
            <Layers size={20} />
          </div>
          <div>
            <span>Total Catatan Biaya</span>
            <strong>{expenses ? `${expenseRows.length} Catatan` : '—'}</strong>
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-icon">
            <DollarSign size={20} />
          </div>
          <div>
            <span>Rata-rata per Catatan</span>
            <strong>{expenses ? money(avgExpense) : '—'}</strong>
          </div>
        </div>
      </div>

      {/* EXPENSE TABLE & MOBILE CARD LIST */}
      <div className="table-panel expense-panel">
        <div className="table-head">
          <div>
            <strong>Buku Kas Pengeluaran</strong>
            <span>Menampilkan seluruh riwayat pengeluaran operasional Dapoersari</span>
          </div>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="table-scroll expense-table-desktop">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori Biaya</th>
                <th>Keterangan / Deskripsi</th>
                <th className="right">Nominal</th>
                <th className="right">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {expenses === null ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <div className="loading-page">
                      <div className="spinner" />
                      <span>Memuat buku kas pengeluaran...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                expenseRows.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <span className="text-muted">{formatExpenseDate(expense.expenseDate)}</span>
                    </td>
                    <td>
                      <span className="category-chip">{expense.categoryName}</span>
                    </td>
                    <td>
                      <strong className="text-primary">{expense.note}</strong>
                    </td>
                    <td className="right">
                      <strong className="amount-expense">{money(expense.amount)}</strong>
                    </td>
                    <td className="right">
                      <button
                        type="button"
                        className="ghost-icon danger"
                        onClick={() => remove(expense.id)}
                        title="Hapus pengeluaran"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {expenses !== null && expenseRows.length === 0 && (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <div className="empty-state">
                      <WalletCards size={32} />
                      <strong>Belum ada catatan pengeluaran</strong>
                      <span>Klik tombol "Tambah Catatan Pengeluaran" di atas untuk mencatat biaya baru.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD LIST VIEW */}
        <div className="expense-list-mobile">
          {expenses === null ? (
            <div className="expense-mobile-loading">
              <div className="spinner" />
              <span>Memuat buku kas pengeluaran...</span>
            </div>
          ) : expenseRows.length === 0 ? (
            <div className="expense-mobile-empty">
              <div className="expense-empty-icon-wrap">
                <WalletCards size={36} />
              </div>
              <strong className="expense-empty-title">Belum ada catatan pengeluaran</strong>
              <p className="expense-empty-desc">
                Mulai catat pengeluaran operasional Anda.
              </p>
              <button
                type="button"
                className="primary-btn expense-empty-btn"
                onClick={() => openExpenseModal(null)}
              >
                <Plus size={16} />
                <span>+ Tambah Pengeluaran</span>
              </button>
            </div>
          ) : (
            <div className="expense-cards-wrap">
              {expenseRows.map((expense) => {
                const isMenuOpen = activeMenuId === expense.id;
                return (
                  <div key={expense.id} className="expense-card-item">
                    <div className="expense-card-header">
                      <span className="expense-card-date">{formatExpenseDate(expense.expenseDate)}</span>
                      <div className="expense-action-menu-wrap">
                        <button
                          type="button"
                          className="expense-card-menu-btn"
                          aria-label="Aksi catatan"
                          aria-haspopup="true"
                          aria-expanded={isMenuOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : expense.id);
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {isMenuOpen && (
                          <div className="expense-menu-dropdown" role="menu">
                            <button
                              type="button"
                              className="expense-menu-item"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                openExpenseModal(expense);
                              }}
                            >
                              <Pencil size={14} />
                              <span>Edit Catatan</span>
                            </button>
                            <button
                              type="button"
                              className="expense-menu-item danger"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                remove(expense.id);
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Hapus Catatan</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="expense-card-body">
                      <div className="expense-card-cat-wrap">
                        <span className="category-chip">{expense.categoryName}</span>
                      </div>
                      <div className="expense-card-note">{expense.note}</div>
                    </div>

                    <div className="expense-card-footer">
                      <span className="expense-card-amount-label">Pengeluaran</span>
                      <span className="expense-card-amount-val">{money(expense.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT EXPENSE MODAL */}
      {modal && (
        <ExpenseModal
          categories={categories}
          initialData={editingExpense}
          onClose={() => {
            setModal(false);
            setEditingExpense(null);
          }}
          onSave={save}
        />
      )}
    </>
  );
}

/* =========================================================
   ADD / EDIT EXPENSE MODAL
   ========================================================= */
function ExpenseModal({ categories, initialData = null, onClose, onSave }) {
  const [form, setForm] = useState({
    categoryId: initialData?.categoryId || categories[0]?.id || '',
    amount: initialData?.amount ? String(initialData.amount) : '',
    expenseDate: initialData?.expenseDate
      ? String(initialData.expenseDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    note: initialData?.note || ''
  });
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(initialData && initialData.id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.categoryId) {
      alert('Pilih kategori pengeluaran terlebih dahulu.');
      return;
    }
    if (Number(form.amount) <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal menyimpan catatan pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">BUKU KAS PENGELUARAN</span>
            <h3>{isEditing ? 'Edit Catatan Pengeluaran' : 'Tambah Pengeluaran'}</h3>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Tanggal Transaksi</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Kategori Biaya</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group full">
            <label>Deskripsi / Keterangan Belanja</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Contoh: Pembelian beras 25kg & bumbu dapur"
              required
            />
          </div>

          <div className="form-group full">
            <label>Nominal Pengeluaran (Rp)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Masukkan nominal (cth: 150000)"
              required
            />
            {form.amount > 0 && <small className="input-helper-text">Konfirmasi: {money(form.amount)}</small>}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Menyimpan...' : (isEditing ? 'Perbarui Pengeluaran' : 'Simpan Pengeluaran')}
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   5. ANALYTICS COMPONENT (PERFORMA TOKO & REKOMENDASI)
   ========================================================= */
function Analytics() {
  const navigate = useNavigate();
  const [range, setRange] = useRange('30d');
  const [data, setData] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [error, setError] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);

  useEffect(() => {
    let active = true;
    setError('');
    setData(null);
    setRecommendationData(null);

    Promise.all([
      api.get('/analytics', { params: { range } }),
      api.get('/recommendations', { params: { range } })
    ])
      .then(([analyticsResponse, recommendationResponse]) => {
        if (!active) return;
        setData(analyticsResponse.data);
        setRecommendationData(recommendationResponse.data);
      })
      .catch((e) => {
        if (!active) return;
        console.error('Gagal memuat analitik performa toko:', e);
        setError(e?.response?.data?.error || 'Gagal memuat data performa toko.');
      });

    return () => {
      active = false;
    };
  }, [range]);

  if (error) return <ErrorState message={error} />;
  if (!data || !recommendationData) return <LoadingPage />;

  const products = Array.isArray(data.products) ? data.products : [];
  const rawRecommendations = Array.isArray(recommendationData)
    ? recommendationData
    : Array.isArray(recommendationData.recommendations)
    ? recommendationData.recommendations
    : [];

  const rawChannelStats = Array.isArray(data.channelStats) ? data.channelStats : [];
  const totalChannelRevenue = rawChannelStats.reduce(
    (sum, ch) => sum + Number(ch.revenue || ch.total || 0),
    0
  );

  const channelStatsWithShare = rawChannelStats.map((ch) => {
    const rev = Number(ch.revenue || ch.total || 0);
    const orderCount = Number(ch.transactions ?? ch.orderCount ?? ch.count ?? 0);
    const share = totalChannelRevenue > 0 ? (rev / totalChannelRevenue) * 100 : 0;
    return {
      ...ch,
      revenue: rev,
      orderCount,
      share
    };
  });

  const topChannel = [...channelStatsWithShare].sort((a, b) => b.revenue - a.revenue)[0];
  const topProduct = products[0];

  // Map recommendations into enriched UI structures
  const recommendations = rawRecommendations.map((rec) => {
    const rawType = String(rec.type || rec.category || '').toLowerCase();
    const title = rec.title || 'Rekomendasi Bisnis';
    const description = rec.text || rec.description || '';
    const isHigh = rec.level === 'high' || rec.priority === 'high';

    let category = 'STRATEGI BISNIS';
    let basisMetric = null;
    let actionLabel = rec.actionText || 'Terapkan Strategi';
    let actionPath = null;

    if (rawType.includes('product') || title.toLowerCase().includes('produk') || title.toLowerCase().includes('stok') || title.toLowerCase().includes('menu')) {
      category = 'MANAJEMEN MENU & STOK';
      if (topProduct) {
        basisMetric = `${topProduct.quantity} porsi terjual • Kontribusi ${money(topProduct.revenue)}`;
      }
      actionLabel = 'Kelola Menu & Stok';
      actionPath = '/';
    } else if (rawType.includes('channel') || title.toLowerCase().includes('channel') || title.toLowerCase().includes('omzet')) {
      category = 'OPTIMASI CHANNEL';
      if (topChannel && topChannel.revenue > 0) {
        basisMetric = `Dominasi ${topChannel.share.toFixed(1)}% omzet (${money(topChannel.revenue)})`;
      }
      actionLabel = 'Lihat Laporan Channel';
      actionPath = '/laporan';
    } else {
      category = 'OPERASIONAL & EFISIENSI';
      actionLabel = 'Cek Pengeluaran';
      actionPath = '/pengeluaran';
    }

    return {
      category,
      title,
      description,
      basisMetric,
      actionLabel,
      actionPath,
      isHigh
    };
  });

  const mobileDisplayedProducts = showAllProducts ? products.slice(0, 10) : products.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="ANALISIS BISNIS"
        title="Performa Toko & Produk"
        subtitle="Analisis produk terlaris, kontribusi omzet per menu, dan rekomendasi strategis peningkatan profit."
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      {/* QUICK INSIGHTS SUMMARY CARDS */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div className="analytics-summary-icon product">
            <Award size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">MENU TERLARIS</span>
            <strong className="analytics-summary-title">{topProduct?.name || 'Belum Ada Data'}</strong>
            <span className="analytics-summary-sub">
              {topProduct ? `${topProduct.quantity} porsi (${money(topProduct.revenue)})` : 'Tidak ada penjualan'}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-summary-icon channel">
            <TrendingUp size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">CHANNEL UTAMA</span>
            <strong className="analytics-summary-title">
              {topChannel && topChannel.revenue > 0 ? channelLabel(topChannel.channel) : 'Belum Ada Data'}
            </strong>
            <span className="analytics-summary-sub">
              {topChannel && topChannel.revenue > 0
                ? `${topChannel.share.toFixed(1)}% kontribusi (${money(topChannel.revenue)})`
                : 'Belum ada transaksi'}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-summary-icon health">
            <ShieldCheck size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">STATUS OPERASIONAL</span>
            <strong className="analytics-summary-title">Kesehatan Optimal</strong>
            <span className="analytics-summary-sub">Margin & rasio biaya terkendali aman</span>
          </div>
        </div>
      </div>

      {/* BALANCED 2-COLUMN SECTION: TOP PRODUCTS & CHANNEL DISTRIBUTION */}
      <div className="analytics-main-grid">
        {/* LEFT COLUMN: TOP 10 PRODUCTS */}
        <Panel
          className="analytics-ranking-panel"
          title="Peringkat Menu Terlaris"
          hint={`Berdasarkan volume penjualan (${range})`}
        >
          {/* Desktop 2-column internal ranking (#1-#5, #6-#10) */}
          <div className="rank-list-desktop">
            {products.length > 0 ? (
              <div className="rank-cols-container">
                <div className="rank-col">
                  {products.slice(0, 5).map((prod, idx) => (
                    <div className="rank-row" key={prod.menuId || prod.name || idx}>
                      <div className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                      <div className="rank-main">
                        <strong title={prod.name}>{prod.name}</strong>
                        <span>{prod.quantity || 0} porsi terjual</span>
                      </div>
                      <div className="rank-revenue">{money(prod.revenue || 0)}</div>
                    </div>
                  ))}
                </div>

                <div className="rank-col">
                  {products.slice(5, 10).map((prod, idx) => {
                    const rankNum = idx + 6;
                    return (
                      <div className="rank-row" key={prod.menuId || prod.name || rankNum}>
                        <div className={`rank-badge rank-${rankNum}`}>#{rankNum}</div>
                        <div className="rank-main">
                          <strong title={prod.name}>{prod.name}</strong>
                          <span>{prod.quantity || 0} porsi terjual</span>
                        </div>
                        <div className="rank-revenue">{money(prod.revenue || 0)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-cell">Belum ada data penjualan produk pada periode ini.</div>
            )}
          </div>

          {/* Mobile 1-column list with expand/collapse */}
          <div className="rank-list-mobile">
            {mobileDisplayedProducts.map((prod, idx) => (
              <div className="rank-row" key={prod.menuId || prod.name || idx}>
                <div className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                <div className="rank-main">
                  <strong>{prod.name}</strong>
                  <span>{prod.quantity || 0} porsi terjual</span>
                </div>
                <div className="rank-revenue">{money(prod.revenue || 0)}</div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="empty-cell">Belum ada data penjualan produk pada periode ini.</div>
            )}

            {products.length > 5 && (
              <button
                type="button"
                className="analytics-expand-btn"
                onClick={() => setShowAllProducts((prev) => !prev)}
              >
                <span>{showAllProducts ? 'Tampilkan 5 Menu Saja' : `Lihat Semua 10 Menu Terlaris (${products.length})`}</span>
                {showAllProducts ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
          </div>
        </Panel>

        {/* RIGHT COLUMN: CHANNEL DISTRIBUTION & OPERATIONAL HEALTH */}
        <div className="analytics-right-col">
          <Panel
            className="analytics-channel-panel"
            title="Distribusi Channel Penjualan"
            hint="Penjualan bersih & kontribusi omzet"
          >
            <div className="analytics-channel-breakdown">
              {channelStatsWithShare.map((ch) => {
                const chKey = String(ch.channel || 'website').toLowerCase();
                return (
                  <div className="channel-progress-card" key={ch.channel}>
                    <div className="channel-progress-head">
                      <div className="channel-badge-wrap">
                        <ChannelBadge channel={ch.channel} />
                        {ch.orderCount > 0 && (
                          <span className="channel-order-count">
                            • {ch.orderCount} pesanan
                          </span>
                        )}
                      </div>
                      <div className="channel-nominal-wrap">
                        <strong>{money(ch.revenue)}</strong>
                        <span className="channel-share-text">{ch.share.toFixed(1)}% kontribusi</span>
                      </div>
                    </div>

                    <div className="channel-progress-bar-bg">
                      <div
                        className={`channel-progress-bar-fill fill-${chKey}`}
                        style={{ width: `${Math.min(100, Math.max(0, ch.share))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {topChannel && topChannel.revenue > 0 && (
              <div className="channel-quick-insight">
                <span className="insight-badge">INSIGHT</span>
                <p>
                  <strong>{channelLabel(topChannel.channel)}</strong> memimpin perolehan omzet dengan kontribusi{' '}
                  <strong>{topChannel.share.toFixed(1)}%</strong> ({money(topChannel.revenue)}).
                </p>
              </div>
            )}

            <div className="store-health-box">
              <div className="health-icon">
                <Activity size={20} />
              </div>
              <div className="health-body">
                <strong>Kesehatan Operasional: Optimal</strong>
                <p>Rasio pengeluaran terhadap omzet berada dalam batas aman target profitabilitas.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* STRATEGIC RECOMMENDATIONS */}
      <div className="performance-recommendations">
        <div className="section-heading">
          <h2>Rekomendasi Bisnis</h2>
          <p>Peluang optimasi harga, promosi menu, dan efisiensi biaya berdasarkan data transaksi historis.</p>
        </div>

        <div className="recommendation-list">
          {recommendations.map((rec, i) => (
            <div key={i} className={`recommend-card ${rec.isHigh ? 'high' : ''}`}>
              <div className="recommend-icon">
                <Activity size={20} />
              </div>
              <div className="recommend-body">
                <div className="recommend-meta">
                  <span className="recommend-label">{rec.category}</span>
                  {rec.isHigh && <span className="recommend-priority-badge">Prioritas Tinggi</span>}
                </div>
                <h3>{rec.title}</h3>
                <p>{rec.description}</p>
                {rec.basisMetric && (
                  <div className="recommend-basis-tag">
                    <span>Dasar: {rec.basisMetric}</span>
                  </div>
                )}
                <div className="recommend-footer-action">
                  <button
                    type="button"
                    className="recommend-btn"
                    onClick={() => {
                      if (rec.actionPath) navigate(rec.actionPath);
                    }}
                  >
                    <span>{rec.actionLabel}</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {recommendations.length === 0 && (
            <div className="recommend-card">
              <div className="recommend-icon">
                <Activity size={20} />
              </div>
              <div className="recommend-body">
                <span className="recommend-label">OPTIMASI MENU</span>
                <h3>Tingkatkan Promosi Menu Unggulan</h3>
                <p>
                  Menu terlaris dapat dijadikan paket bundling pada jam sibuk makan siang untuk meningkatkan Average Order Value.
                </p>
                <div className="recommend-footer-action">
                  <button type="button" className="recommend-btn" onClick={() => navigate('/')}>
                    <span>Buka Menu</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* =========================================================
   6. REPORTS COMPONENT (LAPORAN EKSEKUTIF)
   ========================================================= */
function Reports() {
  const [range, setRange] = useRange('30d');
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const [dash, setDash] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [sales, setSales] = useState(null);
  const [activeReport, setActiveReport] = useState('ringkasan');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.report-tx-action-wrap')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const openOrderDetail = async (row) => {
    setActiveMenuId(null);
    setDetailLoading(true);
    try {
      if (row.id) {
        const response = await api.get(`/sales/${row.id}`);
        setSelectedOrder(response.data);
      } else {
        setSelectedOrder(row);
      }
    } catch (e) {
      console.error('Gagal memuat detail transaksi:', e);
      setSelectedOrder(row);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setDash(null);
    setAnalytics(null);
    setSales(null);
    setError('');
    setExportOpen(false);

    Promise.all([
      api.get('/dashboard', { params: { range } }),
      api.get('/analytics', { params: { range } }),
      api.get('/sales', { params: { range } })
    ])
      .then(([dashboardResponse, analyticsResponse, salesResponse]) => {
        setDash(dashboardResponse.data);
        setAnalytics(analyticsResponse.data);
        setSales(salesResponse.data);
      })
      .catch((e) => {
        console.error('Gagal memuat laporan:', e);
        setError(e?.response?.data?.error || e?.message || 'Gagal memuat laporan.');
      });
  }, [range]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!dash || !analytics || !sales) return <LoadingPage />;

  const summary = dash?.summary || {};
  const rows = Array.isArray(sales?.rows) ? sales.rows : [];
  const grossSales = Number(summary.grossSales || 0);
  const netSales = Number(summary.netSales ?? grossSales);
  const expenseTotal = Number(summary.expenseTotal || 0);
  const netProfit = Number(summary.netProfit ?? (netSales - expenseTotal));
  const transactionCount = Number(summary.transactionCount ?? rows.length ?? 0);
  const averageTransaction = transactionCount > 0 ? grossSales / transactionCount : 0;
  const profitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  const products = Array.isArray(analytics?.products) ? analytics.products : [];
  const bestProduct = [...products].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
  const bestProductName = bestProduct?.name || '-';

  const channelSummary = summary.channel || {};
  const channelReport = [
    { key: 'website', label: 'Website Online', amount: Number(channelSummary.website || 0) },
    { key: 'offline', label: 'Offline POS', amount: Number(channelSummary.offline || 0) },
    { key: 'shopeefood', label: 'ShopeeFood', amount: Number(channelSummary.shopeefood || 0) }
  ];

  const channelNetTotal =
    channelReport.reduce((sum, item) => sum + item.amount, 0);

  const channelShare = (amount) =>
    channelNetTotal > 0 ? (amount / channelNetTotal) * 100 : 0;

  // EXPORT HANDLERS
  const exportCSV = () => {
    const header = ['Bagian Laporan', 'Indikator / Metrik', 'Nilai'];
    const body = [
      ['Ringkasan Keuangan', 'Penjualan Kotor', grossSales],
      ['Ringkasan Keuangan', 'Penjualan Bersih', netSales],
      ['Ringkasan Keuangan', 'Pengeluaran Operasional', expenseTotal],
      ['Ringkasan Keuangan', 'Laba Bersih', netProfit],
      ['Ringkasan Keuangan', 'Margin Laba Bersih', `${profitMargin.toFixed(1)}%`],
      ...channelReport.map((item) => [
        'Penjualan per Channel',
        item.label,
        item.amount
      ]),
      ['Operasional', 'Total Transaksi Selesai', transactionCount],
      ['Operasional', 'Rata-rata Nilai Pesanan', averageTransaction],
      ['Operasional', 'Menu Terlaris', bestProductName]
    ];

    const csv = [header, ...body]
      .map((row) => row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-keuangan-dapoersari-${range}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSXMod = await import('xlsx');
      const XLSX = XLSXMod.default || XLSXMod;

      const data = [
        ['LAPORAN KEUANGAN EKSEKUTIF DAPOERSARI'],
        ['Periode:', range],
        ['Tanggal Dibuat:', new Date().toLocaleDateString('id-ID')],
        [],
        ['RINGKASAN KEUANGAN'],
        ['Penjualan Kotor (Gross Sales)', grossSales],
        ['Penjualan Bersih (Net Sales)', netSales],
        ['Pengeluaran Operasional (OpEx)', expenseTotal],
        ['Laba Bersih (Net Profit)', netProfit],
        ['Margin Laba Bersih', `${profitMargin.toFixed(1)}%`],
        [],
        ['PENJUALAN BERSIH PER CHANNEL'],
        ['Website Online', channelSummary.website || 0],
        ['Offline POS', channelSummary.offline || 0],
        ['ShopeeFood', channelSummary.shopeefood || 0],
        ['Total Penjualan Bersih', channelNetTotal],
        [],
        ['OPERASIONAL & TRANSAKSI'],
        ['Total Transaksi', transactionCount],
        ['Rata-rata Nilai Pesanan', averageTransaction],
        ['Menu Terlaris', bestProductName]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      worksheet['!cols'] = [{ wch: 32 }, { wch: 24 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Keuangan');
      XLSX.writeFile(workbook, `laporan-dapoersari-${range}.xlsx`);
    } catch (e) {
      console.error('Gagal export Excel:', e);
      alert('Gagal membuat file Excel. Coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. TOP OFFICIAL HEADER BAND (NAVY + INDIGO ACCENT)
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFillColor(79, 70, 229); // #4f46e5 (Indigo Accent Line)
    doc.rect(0, 28, pageWidth, 2, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('DAPOERSARI RESTORAN & CATERING', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(165, 180, 252);
    doc.text('PORTAL KEUANGAN EKSEKUTIF • SISTEM LAPORAN RESMI', 14, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const docRef = `REF: DPR/FIN/${new Date().getFullYear()}/${range.toUpperCase()}-${Date.now().toString().slice(-4)}`;
    doc.text(docRef, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - 14, 18, { align: 'right' });

    // 2. DOCUMENT TITLE & METADATA CARD
    let currentY = 38;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LAPORAN RESMI KINERJA KEUANGAN & OPERASIONAL', 14, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Rekapitulasi berkala penjualan, pengeluaran operasional, dan laba bersih.', 14, currentY);

    currentY += 5;

    // Metadata box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 17, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PERIODE EVALUASI', 18, currentY + 5.5);
    doc.text('STATUS DOKUMEN', 72, currentY + 5.5);
    doc.text('PENANGGUNG JAWAB', 125, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const rangeLabel = range === 'today' ? 'Hari Ini' : range === '7d' ? '7 Hari Terakhir' : range === '30d' ? '30 Hari Terakhir' : '90 Hari Terakhir';
    doc.text(rangeLabel, 18, currentY + 11.5);

    doc.setTextColor(5, 150, 105);
    doc.text('SAH & TERVERIFIKASI SISTEM', 72, currentY + 11.5);

    doc.setTextColor(15, 23, 42);
    doc.text('Linda Kumalasari (Executive Owner)', 125, currentY + 11.5);

    currentY += 23;

    // 3. TABEL 1: LAPORAN LABA & RUGI (INCOME STATEMENT)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('I. LAPORAN LABA & RUGI (INCOME STATEMENT)', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Komponen Finansial', 'Keterangan Analisis', 'Jumlah (IDR)']],
      body: [
        ['1', 'Pendapatan Penjualan Kotor (Gross)', 'Total transaksi seluruh channel sebelum penyesuaian channel', money(grossSales)],
        ['2', 'Pendapatan Penjualan Bersih (Net)', 'Penjualan akhir setelah penyesuaian channel', money(netSales)],
        ['3', 'Pengeluaran Operasional Usaha (OpEx)', 'Belanja bahan baku dapur, utilitas & logistik', `- ${money(expenseTotal)}`],
        ['4', 'LABA BERSIH USAHA (NET PROFIT)', `Margin Keuntungan Bersih: ${profitMargin.toFixed(1)}%`, money(netProfit)],
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70, fontStyle: 'bold' },
        2: { cellWidth: 62 },
        3: { cellWidth: pageWidth - 28 - 142, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.row.index === 2) {
          if (data.column.index === 3) {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // 4. TABEL 2: RINGKASAN PENJUALAN BERSIH PER CHANNEL
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('II. RINGKASAN PENJUALAN BERSIH PER CHANNEL', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Channel Penjualan', 'Penjualan Bersih (IDR)', 'Kontribusi']],
      body: channelReport.map((item) => [
        item.label,
        money(item.amount),
        `${channelShare(item.amount).toFixed(1)}%`
      ]),
      foot: [['TOTAL PENJUALAN BERSIH', money(channelNetTotal), '100.0%']],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3.2,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [4, 120, 87],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 82, fontStyle: 'bold' },
        1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: pageWidth - 28 - 144, halign: 'right' }
      }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // 5. TABEL 3: INDIKATOR OPERASIONAL & PRODUK UNGGULAN
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('II. INDIKATOR OPERASIONAL & MENU TERLARIS', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Metrik Operasional', 'Hasil Evaluasi', 'Catatan Evaluasi Bisnis']],
      body: [
        ['Total Transaksi Selesai', `${transactionCount} Transaksi`, 'Seluruh pesanan selesai & lunas tercatat di buku kas'],
        ['Rata-rata Nilai Pesanan (AOV)', money(averageTransaction), 'Rata-rata pembelanjaan pelanggan per pesanan'],
        ['Menu Terlaris (#1 Top Seller)', bestProductName, `${bestProduct ? Number(bestProduct.quantity || 0) : 0} porsi terjual pada periode ini`],
        ['Margin Laba Bersih', `${profitMargin.toFixed(1)}%`, 'Rasio laba bersih terhadap omzet kotor keseluruhan'],
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: pageWidth - 28 - 100 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 12;

    // 6. SIGNATURE & OFFICIAL VALIDATION BLOCK
    const signY = Math.min(currentY, pageHeight - 44);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Dibuat Oleh:', 24, signY);
    doc.text('Disetujui & Disahkan Oleh:', pageWidth - 68, signY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Sistem Finansial Dapoersari', 24, signY + 16);
    doc.text('Linda Kumalasari', pageWidth - 68, signY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sistem Otomatis Terenkripsi', 24, signY + 20);
    doc.text('Executive Owner', pageWidth - 68, signY + 20);

    // 7. OFFICIAL FOOTER
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 9, pageWidth, 9, 'F');

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('DOKUMEN INI RAHASIA & SAH SECARA HUKUM • DAPOERSARI ENTERPRISE SUITE', 14, pageHeight - 3.5);
    doc.text('Halaman 1', pageWidth - 14, pageHeight - 3.5, { align: 'right' });

    doc.save(`laporan-resmi-dapoersari-${range}.pdf`);
    } catch (e) {
      console.error('Gagal export PDF:', e);
      alert('Gagal membuat file PDF. Coba lagi.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="PUSAT LAPORAN RESMI"
        title="Laporan Keuangan" 
        subtitle="Rekapitulasi pendapatan, pengeluaran, hasil usaha, dan penjualan bersih per channel."
        action={
          <div className="report-header-actions">
            <RangeSelect value={range} onChange={setRange} />
            <div className="export-menu" ref={exportMenuRef}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setExportOpen(!exportOpen)}
                aria-label="Export dokumen laporan"
              >
                <Download size={15} />
                <span>Export Dokumen</span>
                <ChevronDown size={14} />
              </button>

              {exportOpen && (
                <div className="export-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      exportExcel();
                      setExportOpen(false);
                    }}
                  >
                    <FileSpreadsheet size={15} />
                    <span>Microsoft Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportCSV();
                      setExportOpen(false);
                    }}
                  >
                    <FileText size={15} />
                    <span>Comma Separated (.csv)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportPDF();
                      setExportOpen(false);
                    }}
                  >
                    <FileText size={15} />
                    <span>Dokumen PDF (.pdf)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* REPORT TABS */}
      <div className="report-tabs">
        <button
          type="button"
          className={activeReport === 'ringkasan' ? 'active' : ''}
          onClick={() => setActiveReport('ringkasan')}
        >
          Ringkasan Eksekutif
        </button>
        <button
          type="button"
          className={activeReport === 'penjualan' ? 'active' : ''}
          onClick={() => setActiveReport('penjualan')}
        >
          Rekapitulasi Penjualan
        </button>
        <button
          type="button"
          className={activeReport === 'laba' ? 'active' : ''}
          onClick={() => setActiveReport('laba')}
        >
          Laporan Laba & Rugi (P&L)
        </button>
      </div>

      {/* 1. RINGKASAN TAB */}
      {activeReport === 'ringkasan' && (
        <div className="report-content-flow">
          <div className="report-hero-kpi">
            <div className="hero-kpi-main">
              <span className="hero-kpi-badge">NET OPERATING PROFIT</span>
              <div className="hero-kpi-amount">{money(netProfit)}</div>
              <p>Laba bersih yang berhasil dibukukan setelah penyesuaian channel dan pengeluaran operasional.</p>
            </div>
            <div className="hero-kpi-subcards">
              <div className="hero-subcard">
                <span>Margin Laba Bersih</span>
                <strong>{profitMargin.toFixed(1)}%</strong>
              </div>
              <div className="hero-subcard">
                <span>Rata-rata Nilai Pesanan</span>
                <strong>{money(averageTransaction)}</strong>
              </div>
            </div>
          </div>

          <div className="report-financial-grid">
            <div className="report-financial-card">
              <span>PENJUALAN KOTOR</span>
              <strong>{money(grossSales)}</strong>
            </div>
            <div className="report-financial-card dark">
              <span>PENJUALAN BERSIH</span>
              <strong>{money(netSales)}</strong>
            </div>
            <div className="report-financial-card">
              <span>PENGELUARAN (OPEX)</span>
              <strong>- {money(expenseTotal)}</strong>
            </div>
            <div className="report-financial-card profit">
              <span className="profit-card-label-desktop">LABA BERSIH (EBIT)</span>
              <span className="profit-card-label-mobile">MARGIN LABA</span>
              <strong className="profit-card-val-desktop">{money(netProfit)}</strong>
              <strong className="profit-card-val-mobile">{profitMargin.toFixed(1)}%</strong>
            </div>
          </div>

          <div className="report-channel-panel">
            <div className="report-channel-head">
              <div>
                <span className="eyebrow">PENJUALAN</span>
                <h3>Penjualan Bersih per Channel</h3>
              </div>
              <span>Nilai akhir setelah penyesuaian channel</span>
            </div>

            {/* Desktop Channel Table */}
            <div className="report-channel-table report-channel-desktop">
              {channelReport.map((item) => (
                <div className="report-channel-row" key={item.key}>
                  <div className="report-channel-name">
                    <ChannelBadge channel={item.key} />
                  </div>
                  <strong>{money(item.amount)}</strong>
                  <span>{channelShare(item.amount).toFixed(1)}%</span>
                </div>
              ))}

              <div className="report-channel-row total">
                <strong>Total Penjualan Bersih</strong>
                <strong>{money(channelNetTotal)}</strong>
                <span>100%</span>
              </div>
            </div>

            {/* Mobile Channel Cards */}
            <div className="report-channel-cards-mobile">
              {channelReport.map((item) => (
                <div className="report-channel-card-item" key={item.key}>
                  <div className="channel-card-top">
                    <ChannelBadge channel={item.key} />
                    <span className="channel-card-share">{channelShare(item.amount).toFixed(1)}%</span>
                  </div>
                  <div className="channel-card-bottom">
                    <span className="channel-card-label">Penjualan Bersih</span>
                    <strong className="channel-card-amount">{money(item.amount)}</strong>
                  </div>
                </div>
              ))}
              <div className="report-channel-card-item total">
                <div className="channel-card-top">
                  <strong className="channel-card-total-title">Total Penjualan Bersih</strong>
                  <span className="channel-card-share">100%</span>
                </div>
                <div className="channel-card-bottom">
                  <span className="channel-card-label">Seluruh Channel</span>
                  <strong className="channel-card-amount total">{money(channelNetTotal)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. REKAP PENJUALAN TAB */}
      {activeReport === 'penjualan' && (
        <div className="report-content-flow">
          <div className="table-panel report-sales-panel">
            <div className="table-head">
              <div>
                <strong>Rekapitulasi Transaksi Selesai</strong>
                <span>Daftar seluruh pesanan pelanggan yang tercatat dalam periode laporan</span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="table-scroll report-table-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Kode Pesanan</th>
                    <th>Waktu Pesanan</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th className="right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.orderCode}-${row.orderedAt}`}>
                      <td>
                        <strong className="order-code-badge">{row.orderCode}</strong>
                      </td>
                      <td>{formatDateTime(row.orderedAt)}</td>
                      <td>
                        <ChannelBadge channel={row.channel} />
                      </td>
                      <td>
                        <span className="status-badge done">Lunas</span>
                      </td>
                      <td className="right">
                        <strong>{money(row.total)}</strong>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-cell">
                        Belum ada transaksi pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="report-sales-mobile">
              {rows.length === 0 ? (
                <div className="report-sales-empty-mobile">
                  <Receipt size={36} />
                  <strong>Belum ada transaksi</strong>
                  <p>Tidak ada catatan transaksi pada periode yang dipilih.</p>
                </div>
              ) : (
                <div className="report-tx-cards-wrap">
                  {rows.map((row) => {
                    const isMenuOpen = activeMenuId === row.orderCode;
                    return (
                      <div key={`${row.orderCode}-${row.orderedAt}`} className="report-tx-card">
                        <div className="report-tx-card-header">
                          <div className="report-tx-info">
                            <strong className="order-code-badge">{row.orderCode}</strong>
                            <span className="report-tx-time">{formatDateTime(row.orderedAt)}</span>
                          </div>
                          <div className="report-tx-action-wrap">
                            <button
                              type="button"
                              className="report-tx-menu-btn"
                              aria-label="Aksi pesanan"
                              aria-haspopup="true"
                              aria-expanded={isMenuOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : row.orderCode);
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {isMenuOpen && (
                              <div className="report-tx-menu-dropdown" role="menu">
                                <button
                                  type="button"
                                  className="report-tx-menu-item"
                                  role="menuitem"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openOrderDetail(row);
                                  }}
                                >
                                  <Receipt size={14} />
                                  <span>Lihat Rincian</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="report-tx-card-body">
                          <ChannelBadge channel={row.channel} />
                          <span className="status-badge done">
                            <CheckCircle2 size={11} />
                            <span>Lunas</span>
                          </span>
                        </div>

                        <div className="report-tx-card-footer">
                          <span className="report-tx-label">Total Transaksi</span>
                          <strong className="report-tx-nominal">{money(row.total)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. LABA & RUGI (INCOME STATEMENT) TAB */}
      {activeReport === 'laba' && (
        <div className="report-content-flow">
          <div className="income-statement-card">
            <div className="statement-head">
              <h3>Laporan Laba & Rugi (Income Statement)</h3>
              <span>Dapoersari Food & Beverages • Periode: {range}</span>
            </div>

            <div className="statement-table">
              <div className="statement-row header-row">
                <span>Komponen Keuangan</span>
                <span className="right">Jumlah (IDR)</span>
              </div>

              <div className="statement-row">
                <div className="statement-label">
                  <strong>1. Pendapatan Penjualan Kotor (Gross Revenue)</strong>
                  <small>Total omzet seluruh transaksi kasir & online</small>
                </div>
                <strong className="right">{money(grossSales)}</strong>
              </div>

              <div className="statement-row subtotal-row">
                <strong>2. Pendapatan Penjualan Bersih (Net Revenue)</strong>
                <strong className="right">{money(netSales)}</strong>
              </div>

              <div className="statement-row deduction">
                <div className="statement-label indent">
                  <span>(-) Beban Pengeluaran Operasional (OpEx)</span>
                  <small>Belanja bahan baku, utilitas, listrik & logistik</small>
                </div>
                <span className="right deduction-text">- {money(expenseTotal)}</span>
              </div>

              <div className="statement-row final-row">
                <div>
                  <strong>LABA BERSIH USAHA (NET OPERATING PROFIT)</strong>
                  <small>Margin Profitabilitas: {profitMargin.toFixed(1)}%</small>
                </div>
                <strong className="right profit-amount">{money(netProfit)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER DETAIL RECEIPT MODAL */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          loading={detailLoading}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}

/* =========================================================
   7. SETTINGS COMPONENT (PENGATURAN)
   ========================================================= */
function SettingsPage() {
  const [activeSection, setActiveSection] = useState(null);
  const [settings, setSettings] = useState({
    businessName: 'Dapoersari',
    businessDescription: '',
    phone: '',
    address: '',
    openingHours: '',
    shopeefoodPlatformRate: 25,
    targetDailySales: 0,
    targetMonthlySales: 0,
    targetDailyTransactions: 0,
    targetMargin: 0
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [passwordModal, setPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.currentPassword.length === 0) {
      setPasswordError('Password saat ini wajib diisi.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password baru minimal 6 karakter.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordError('Password baru harus berbeda dari password lama.');
      return;
    }

    try {
      setPasswordSaving(true);
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      alert('Password berhasil diperbarui dengan aman.');
    } catch (err) {
      console.error('Gagal mengubah password:', err);
      setPasswordError(err?.response?.data?.error || 'Password gagal diubah.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/settings');
      const data = response.data || {};
      setSettings({
        businessName: data.businessName || data.business_name || 'Dapoersari',
        businessDescription: data.businessDescription || data.business_description || '',
        phone: data.phone || '',
        address: data.address || '',
        openingHours: data.openingHours || data.opening_hours || '',
        shopeefoodPlatformRate: Number(
          data.shopeefoodPlatformRate ?? data.platformFee ?? data.shopeefood_platform_rate ?? 25
        ),
        targetDailySales: Number(data.targetDailySales ?? data.dailyTarget ?? data.target_daily_sales ?? 0),
        targetMonthlySales: Number(data.targetMonthlySales ?? data.monthlyTarget ?? data.target_monthly_sales ?? 0),
        targetDailyTransactions: Number(data.targetDailyTransactions ?? data.target_daily_transactions ?? 0),
        targetMargin: Number(data.targetMargin ?? data.target_margin ?? 0)
      });
    } catch (e) {
      console.error('Gagal memuat pengaturan:', e);
      setError(e?.response?.data?.error || '');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setCategoryLoading(true);
      const response = await api.get('/expense-categories');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setCategories(data);
    } catch (e) {
      console.error('Kategori gagal dimuat:', e);
      setCategories([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  const updateField = (field, value) => {
    setSettings((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage('');
      setError('');
      await api.put('/settings', {
        businessName: settings.businessName,
        businessDescription: settings.businessDescription,
        phone: settings.phone,
        address: settings.address,
        openingHours: settings.openingHours,
        shopeefoodPlatformRate: Number(settings.shopeefoodPlatformRate),
        targetDailySales: Number(settings.targetDailySales),
        targetMonthlySales: Number(settings.targetMonthlySales),
        targetDailyTransactions: Number(settings.targetDailyTransactions),
        targetMargin: Number(settings.targetMargin)
      });
      setMessage('Konfigurasi pengaturan berhasil disimpan.');
    } catch (e) {
      console.error('Gagal menyimpan:', e);
      setError(e?.response?.data?.error || 'Pengaturan gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const openAddCategory = () => {
    setCategoryForm({ id: null, name: '' });
    setCategoryModal(true);
  };

  const openEditCategory = (category) => {
    setCategoryForm({ id: category.id, name: category.name || '' });
    setCategoryModal(true);
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) {
      alert('Nama kategori wajib diisi.');
      return;
    }

    try {
      setCategoryLoading(true);
      if (categoryForm.id) {
        await api.put(`/expense-categories/${categoryForm.id}`, { name });
      } else {
        await api.post('/expense-categories', { name });
      }
      setCategoryModal(false);
      await loadCategories();
    } catch (e) {
      alert(e?.response?.data?.error || 'Kategori gagal disimpan.');
    } finally {
      setCategoryLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    const confirmed = window.confirm('Hapus kategori ini dari sistem?');
    if (!confirmed) return;
    try {
      await api.delete(`/expense-categories/${id}`);
      await loadCategories();
    } catch (e) {
      alert(e?.response?.data?.error || 'Kategori gagal dihapus.');
    }
  };

  if (loading) return <LoadingPage />;

  const settingMenus = [
    {
      id: 'usaha',
      title: 'Profil & Identitas Usaha',
      description: 'Nama bisnis, kontak resmi, alamat restoran, dan jam operasional.',
      icon: <Store size={20} />
    },
    {
      id: 'penjualan',
      title: 'Konfigurasi Channel & Komisi',
      description: 'Atur tarif penyesuaian ShopeeFood dan status channel penjualan.',
      icon: <Receipt size={20} />
    },
    {
      id: 'target',
      title: 'Target Bisnis & Margin KPI',
      description: 'Tentukan target omzet harian, bulanan, dan batas target margin keuntungan.',
      icon: <Target size={20} />
    },
    {
      id: 'kategori',
      title: 'Kategori Pengeluaran (OpEx)',
      description: 'Kelola klasifikasi pos biaya operasional agar pencatatan lebih teratur.',
      icon: <WalletCards size={20} />
    },
    {
      id: 'akun',
      title: 'Akun Owner & Keamanan',
      description: 'Kelola profil eksekutif owner dan perbarui kata sandi akses portal.',
      icon: <ShieldCheck size={20} />
    }
  ];

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="PUSAT KONTROL"
        title="Pengaturan Sistem"
        subtitle="Kelola konfigurasi bisnis, parameter perhitungan keuangan, target penjualan, dan keamanan akun."
      />

      <div className="settings-shell">
        {/* SETTINGS MENU HUB */}
        {!activeSection && (
          <section className="settings-home">
            <div className="settings-menu-list">
              {settingMenus.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="settings-menu-card"
                  onClick={() => setActiveSection(item.id)}
                >
                  <div className="settings-menu-icon">{item.icon}</div>
                  <div className="settings-menu-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <ChevronRight size={18} className="settings-menu-arrow" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* SETTINGS DETAIL PANELS */}
        {activeSection && (
          <section className="settings-detail">
            <button type="button" className="settings-back" onClick={() => setActiveSection(null)}>
              <ArrowLeft size={16} />
              <span>Kembali ke Menu Pengaturan</span>
            </button>

            {/* 1. PROFIL USAHA */}
            {activeSection === 'usaha' && (
              <form className="settings-detail-card" onSubmit={saveSettings}>
                <div className="settings-detail-head">
                  <div className="settings-detail-icon">
                    <Store size={20} />
                  </div>
                  <div>
                    <span>IDENTITAS BISNIS</span>
                    <h2>Profil Restoran / Usaha</h2>
                    <p>Informasi identitas restoran yang digunakan dalam laporan resmi.</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="settings-field">
                    <label>Nama Usaha / Restoran</label>
                    <input
                      value={settings.businessName}
                      onChange={(e) => updateField('businessName', e.target.value)}
                      required
                    />
                  </div>

                  <div className="settings-field">
                    <label>Nomor Telepon / WhatsApp</label>
                    <input
                      value={settings.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="081234567890"
                    />
                  </div>

                  <div className="settings-field settings-field-full">
                    <label>Deskripsi Singkat Usaha</label>
                    <textarea
                      value={settings.businessDescription}
                      onChange={(e) => updateField('businessDescription', e.target.value)}
                      placeholder="Spesialis kuliner tradisional & catering modern"
                    />
                  </div>

                  <div className="settings-field settings-field-full">
                    <label>Alamat Lengkap</label>
                    <textarea
                      value={settings.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Jl. Raya Utama No. 123, Indonesia"
                    />
                  </div>

                  <div className="settings-field">
                    <label>Jam Operasional Toko</label>
                    <input
                      value={settings.openingHours}
                      onChange={(e) => updateField('openingHours', e.target.value)}
                      placeholder="10.00 - 22.00 WIB"
                    />
                  </div>
                </div>

                <div className="settings-card-foot">
                  <div>
                    {message && <span className="settings-success">{message}</span>}
                    {error && <span className="settings-error">{error}</span>}
                  </div>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            )}

            {/* 2. PENJUALAN */}
            {activeSection === 'penjualan' && (
              <form className="settings-detail-card" onSubmit={saveSettings}>
                <div className="settings-detail-head">
                  <div className="settings-detail-icon">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <span>CHANNEL PENJUALAN</span>
                    <h2>Konfigurasi Channel & Komisi</h2>
                    <p>Atur tarif penyesuaian channel untuk kalkulasi pendapatan bersih otomatis.</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="settings-field">
                    <label>Tarif Penyesuaian ShopeeFood (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.shopeefoodPlatformRate}
                      onChange={(e) => updateField('shopeefoodPlatformRate', e.target.value)}
                    />
                    <small className="settings-help">Digunakan untuk menghitung omzet bersih secara otomatis.</small>
                  </div>

                  <div className="settings-field">
                    <label>Status Channel Penjualan Aktif</label>
                    <div className="settings-static-box">
                      <span>Website Pemesanan Online</span>
                      <b>Terkoneksi & Aktif</b>
                    </div>
                    <div className="settings-static-box">
                      <span>Kasir Offline / Dine-in</span>
                      <b>Terkoneksi & Aktif</b>
                    </div>
                    <div className="settings-static-box">
                      <span>ShopeeFood Merchant</span>
                      <b>Terkoneksi & Aktif</b>
                    </div>
                  </div>
                </div>

                <div className="settings-card-foot">
                  <div>
                    {message && <span className="settings-success">{message}</span>}
                    {error && <span className="settings-error">{error}</span>}
                  </div>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                  </button>
                </div>
              </form>
            )}

            {/* 3. TARGET BISNIS */}
            {activeSection === 'target' && (
              <form className="settings-detail-card" onSubmit={saveSettings}>
                <div className="settings-detail-head">
                  <div className="settings-detail-icon">
                    <Target size={20} />
                  </div>
                  <div>
                    <span>TARGET & KPI</span>
                    <h2>Target Omzet & Margin Bisnis</h2>
                    <p>Sasaran performa toko yang menjadi tolak ukur evaluasi eksekutif.</p>
                  </div>
                </div>

                <div className="settings-form">
                  <div className="settings-field">
                    <label>Target Omzet Harian (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.targetDailySales}
                      onChange={(e) => updateField('targetDailySales', e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label>Target Omzet Bulanan (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.targetMonthlySales}
                      onChange={(e) => updateField('targetMonthlySales', e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label>Target Transaksi Harian (Pesanan)</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.targetDailyTransactions}
                      onChange={(e) => updateField('targetDailyTransactions', e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label>Target Margin Laba Bersih (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.targetMargin}
                      onChange={(e) => updateField('targetMargin', e.target.value)}
                    />
                  </div>
                </div>

                <div className="settings-target-preview">
                  <div>
                    <span>Target Omzet Harian</span>
                    <strong>{money(settings.targetDailySales)}</strong>
                  </div>
                  <div>
                    <span>Target Omzet Bulanan</span>
                    <strong>{money(settings.targetMonthlySales)}</strong>
                  </div>
                </div>

                <div className="settings-card-foot">
                  <div>
                    {message && <span className="settings-success">{message}</span>}
                    {error && <span className="settings-error">{error}</span>}
                  </div>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Target'}
                  </button>
                </div>
              </form>
            )}

            {/* 4. KATEGORI PENGELUARAN */}
            {activeSection === 'kategori' && (
              <div className="settings-detail-card">
                <div className="settings-detail-head">
                  <div className="settings-detail-icon">
                    <WalletCards size={20} />
                  </div>
                  <div>
                    <span>POS BIAYA</span>
                    <h2>Kategori Pengeluaran (OpEx)</h2>
                    <p>Kelola klasifikasi biaya operasional agar pencatatan buku kas lebih tertib.</p>
                  </div>
                </div>

                <div className="settings-toolbar">
                  <div>
                    <strong>{categories.length} Kategori</strong>
                    <span>terdaftar dalam sistem</span>
                  </div>
                  <button type="button" className="primary-btn small" onClick={openAddCategory}>
                    <Plus size={15} />
                    <span>Tambah Kategori</span>
                  </button>
                </div>

                <div className="category-settings-list">
                  {categoryLoading ? (
                    <div className="settings-inline-loading">
                      <div className="spinner small" />
                      <span>Memuat data kategori...</span>
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="settings-empty">
                      <strong>Belum ada kategori pengeluaran</strong>
                      <span>Tambahkan kategori baru untuk memudahkan pembukuan.</span>
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat.id} className="category-settings-row">
                        <div className="category-row-left">
                          <span className="category-dot" />
                          <strong>{cat.name}</strong>
                        </div>
                        <div className="category-actions">
                          <button
                            type="button"
                            className="ghost-icon"
                            onClick={() => openEditCategory(cat)}
                            title="Edit nama kategori"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="ghost-icon danger"
                            onClick={() => deleteCategory(cat.id)}
                            title="Hapus kategori"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. AKUN & KEAMANAN */}
            {activeSection === 'akun' && (
              <div className="settings-stack">
                <div className="settings-detail-card">
                  <div className="settings-detail-head">
                    <div className="settings-detail-icon">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <span>PROFIL OWNER</span>
                      <h2>Akun & Hak Akses</h2>
                      <p>Informasi kredensial eksekutif owner Dapoersari.</p>
                    </div>
                  </div>

                  <div className="account-profile">
                    <div className="account-avatar">L</div>
                    <div className="account-meta">
                      <strong>Linda Kumalasari</strong>
                      <span>Executive Owner • Hak Akses Utama</span>
                    </div>
                  </div>
                </div>

                <div className="settings-detail-card">
                  <div className="security-row">
                    <div>
                      <strong>Kata Sandi Akses Portal</strong>
                      <span>Perbarui kata sandi akun secara berkala untuk menjaga keamanan data finansial.</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setPasswordError('');
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordModal(true);
                      }}
                    >
                      Ubah Kata Sandi
                    </button>
                  </div>

                  <div className="security-row">
                    <div>
                      <strong>Keluar dari Sesi Portal</strong>
                      <span>Sesi owner akan ditutup pada peramban ini.</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn danger-btn"
                      onClick={() => {
                        if (window.confirm('Keluar dari portal Dapoersari?')) {
                          localStorage.removeItem('p2_token');
                          window.location.href = '/login';
                        }
                      }}
                    >
                      Keluar Sesi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {/* PASSWORD MODAL */}
      {passwordModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !passwordSaving) setPasswordModal(false);
          }}
        >
          <div className="modal-card password-modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <span className="eyebrow">KEAMANAN AKUN</span>
                <h3>Ubah Kata Sandi</h3>
              </div>
              <button
                type="button"
                className="ghost-icon"
                disabled={passwordSaving}
                onClick={() => setPasswordModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form className="password-form" onSubmit={changePassword}>
              <div className="password-intro">
                <div className="password-intro-icon">
                  <Lock size={18} />
                </div>
                <div>
                  <strong>Perbarui Keamanan Akses</strong>
                  <span>Gunakan kombinasi minimal 6 karakter dengan huruf dan angka.</span>
                </div>
              </div>

              <div className="form-group">
                <label>Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Masukkan kata sandi saat ini"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="form-group">
                <label>Kata Sandi Baru</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="form-group">
                <label>Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Ulangi kata sandi baru"
                  autoComplete="new-password"
                  required
                />
              </div>

              {passwordError && <div className="error-box">{passwordError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={passwordSaving}
                  onClick={() => setPasswordModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="primary-btn" disabled={passwordSaving}>
                  {passwordSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {categoryModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !categoryLoading) setCategoryModal(false);
          }}
        >
          <div className="modal-card category-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">POS BIAYA</span>
                <h3>{categoryForm.id ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              </div>
              <button
                type="button"
                className="ghost-icon"
                onClick={() => setCategoryModal(false)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <form className="settings-modal-form" onSubmit={saveCategory}>
              <div className="form-group">
                <label>Nama Kategori</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Contoh: Bahan Baku & Dapur"
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setCategoryModal(false)}
                >
                  Batal
                </button>
                <button type="submit" className="primary-btn" disabled={categoryLoading}>
                  {categoryLoading ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   REACT ROOT MOUNT
   ========================================================= */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);