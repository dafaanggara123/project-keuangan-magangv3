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
  KeyRound,
  LogOut,
  Menu as MenuIcon,
  Minus,
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
  MoreVertical,
  ClipboardCheck,
  UserCheck,
  UserX,
  Palette,
  Sun,
  Moon,
  Laptop,
  AlertTriangle,
  TrendingDown,
  Info
} from 'lucide-react';
import { ThemeProvider, useTheme } from './themeContext';
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
  Cell,
  Pie,
  PieChart as RechartsPieChart
} from 'recharts';
import './styles.css';
import RegistrationStatusPage from './pages/RegistrationStatusPage';
import Dashboard from './pages/Dashboard';
import PenjualanPage from './pages/PenjualanPage';
import PengeluaranPage from './pages/PengeluaranPage';
import AnalitikPage from './pages/AnalitikPage';
import NotificationsPage from './pages/NotificationsPage';
import AccountApprovalsPage from './pages/AccountApprovalsPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import RegisterOwner from './pages/auth/RegisterOwner';

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
        <Route path="/status-pengajuan" element={<RegistrationStatusPage />} />
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
  const [pendingCount, setPendingCount] = useState(0);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  /* Cache timestamp: notifikasi hanya diperbarui jika sudah > 60 detik */
  const notifLastLoadedRef = useRef(0);

  const openLogoutModal = () => {
    setLogoutError(null);
    setLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    if (logoutBusy) return;
    setLogoutModalOpen(false);
    setLogoutError(null);
  };

  const handleConfirmLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      // Hapus token dan sesi dari localStorage
      localStorage.removeItem('p2_token');
      // Redirection ke /login
      navigate('/login', { replace: true });
    } catch (err) {
      setLogoutError(err?.message || 'Gagal memproses keluar sesi. Silakan coba lagi.');
      setLogoutBusy(false);
    }
  };

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!logoutModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeLogoutModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logoutModalOpen, logoutBusy]);

  const refreshPendingCount = () => {
    api
      .get('/admin/registrations')
      .then((res) => {
        setPendingCount(Number(res.data?.stats?.pending || 0));
      })
      .catch(() => {
        setPendingCount(0);
      });
  };

  useEffect(() => {
    let mounted = true;
    api
      .get('/me')
      .then((response) => {
        if (!mounted) return;
        const nextProfile = {
          ...(response.data.profile || {}),
          id: response.data.user?.id || response.data.profile?.id,
          email: response.data.user?.email || response.data.profile?.email,
          is_approver: !!response.data?.is_approver
        };
        setProfile(nextProfile);
        setReadNotifIds(loadReadNotifIds(nextProfile));

        if (nextProfile.is_approver) {
          api
            .get('/admin/registrations')
            .then((res) => {
              if (mounted) {
                setPendingCount(Number(res.data?.stats?.pending || 0));
              }
            })
            .catch(() => {});
        }
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

        <div className="sidebar-caption">MENU UTAMA</div>
        <nav className="nav-list">
          <NavItem to="/" icon={<Gauge size={18} />} label="Dashboard" />
        </nav>

        <nav className="nav-list">
          <NavItem to="/penjualan" icon={<Receipt size={18} />} label="Penjualan & Kasir" />
          <NavItem to="/pengeluaran" icon={<WalletCards size={18} />} label="Riwayat Pengeluaran" />
        </nav>

        <nav className="nav-list">
          <NavItem to="/analitik" icon={<BarChart3 size={18} />} label="Performa Toko" />
          <NavItem to="/laporan" icon={<FileText size={18} />} label="Laporan Eksekutif" />
        </nav>

        <nav className="nav-list">
          {profile?.is_approver && (
            <NavItem
              to="/persetujuan-akun"
              icon={<ClipboardCheck size={18} />}
              label="Persetujuan Akun"
              badge={pendingCount}
            />
          )}
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
          <button type="button" className="logout-btn" onClick={openLogoutModal} title="Keluar dari sesi">
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
            <Route path="/" element={<Dashboard greeting={greeting} ownerName={ownerName} profile={profile} pendingApprovalsCount={pendingCount} />} />
            <Route path="/notifikasi" element={<NotificationsPage profile={profile} />} />
            <Route path="/penjualan" element={<PenjualanPage />} />
            <Route path="/pengeluaran" element={<PengeluaranPage />} />
            <Route path="/analitik" element={<AnalitikPage />} />
            <Route path="/laporan" element={<Reports />} />
            {profile?.is_approver && (
              <Route
                path="/persetujuan-akun"
                element={<AccountApprovalsPage onDecisionMade={refreshPendingCount} />}
              />
            )}
            <Route path="/pengaturan" element={<SettingsPage profile={profile} onLogout={openLogoutModal} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* MODAL KONFIRMASI LOGOUT DAPOERSARI */}
      {logoutModalOpen && (
        <div
          className="modal-backdrop logout-modal-backdrop"
          onClick={() => !logoutBusy && closeLogoutModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div
            className="modal-card logout-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-modal-icon-wrap" aria-hidden="true">
              <LogOut size={22} />
            </div>

            <div className="logout-modal-content">
              <h3 id="logout-dialog-title" className="logout-modal-title">
                Keluar dari Sesi?
              </h3>
              <p className="logout-modal-desc">
                Apakah Anda yakin ingin keluar dari Dapoersari Executive Portal?
              </p>

              {logoutError && (
                <div className="error-box logout-error-box" role="alert">
                  <AlertCircle size={15} />
                  <span>{logoutError}</span>
                </div>
              )}
            </div>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="secondary-btn logout-modal-cancel-btn"
                onClick={closeLogoutModal}
                disabled={logoutBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="logout-modal-confirm-btn"
                onClick={handleConfirmLogout}
                disabled={logoutBusy}
              >
                {logoutBusy ? (
                  <>
                    <div className="spinner small" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={15} />
                    <span>Ya, Keluar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   NAVIGATION ITEM HELPER
   ========================================================= */
function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge !== undefined && badge !== null && badge > 0 ? (
        <span className="nav-pending-badge">{badge > 99 ? '99+' : badge}</span>
      ) : (
        <ChevronRight size={14} className="nav-arrow" />
      )}
    </NavLink>
  );
}

function pageName(path) {
  if (path === '/') return 'Dashboard Eksekutif';
  if (path.includes('persetujuan-akun')) return 'Persetujuan Akun Owner';
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
function Metric({ label, value, sub, icon, trend, positive = true, status, tooltip }) {
  const isPositive = status === 'positive' || (status === undefined && positive === true);
  const isNegative = status === 'negative' || (status === undefined && positive === false);
  const isNeutral = status === 'neutral';
  const statusClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <div className={`metric-icon-box ${statusClass}`}>{icon}</div>
      </div>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
      </div>
      <div className="metric-footer">
        <span className={`metric-sub ${statusClass}`}>
          {isPositive ? (
            <ArrowUpRight size={14} />
          ) : isNegative ? (
            <ArrowDownRight size={14} />
          ) : (
            <Minus size={14} />
          )}
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
              <div className={`hero-kpi-amount ${netProfit > 0 ? 'is-positive' : netProfit < 0 ? 'is-negative' : 'is-neutral'}`}>
                {money(netProfit)}
              </div>
              <p>Laba bersih yang berhasil dibukukan setelah penyesuaian channel dan pengeluaran operasional.</p>
            </div>
            <div className="hero-kpi-subcards">
              <div className={`hero-subcard ${netProfit > 0 ? 'is-positive' : netProfit < 0 ? 'is-negative' : 'is-neutral'}`}>
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
              <span>PENGELUARAN</span>
              <strong>- {money(expenseTotal)}</strong>
            </div>
            <div className={`report-financial-card profit ${netProfit > 0 ? 'is-positive' : netProfit < 0 ? 'is-negative' : 'is-neutral'}`}>
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
                <h3>Kontribusi Penjualan per Channel</h3>
              </div>
              <span>Nilai akhir setelah penyesuaian channel</span>
            </div>

            {channelNetTotal <= 0 ? (
              <div className="channel-empty-state report-channel-empty">
                <span>Belum ada transaksi penjualan per kanal pada periode ini.</span>
              </div>
            ) : (
              <div className="channel-donut-layout">
                {/* Donut Chart with Center Total */}
                <div className="channel-donut-chart-wrap">
                  <div className="channel-donut-container">
                    <ResponsiveContainer width="100%" height={230}>
                      <RechartsPieChart>
                        <Pie
                          data={channelReport.filter((c) => c.amount > 0)}
                          dataKey="amount"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={92}
                          paddingAngle={3}
                          stroke="#ffffff"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {channelReport.filter((c) => c.amount > 0).map((entry) => {
                            const colors = {
                              website: '#4d73a1',
                              offline: '#2f7a4f',
                              shopeefood: '#d4654a'
                            };
                            return <Cell key={entry.key} fill={colors[entry.key] || '#78716c'} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [money(value), 'Penjualan']}
                          contentStyle={{
                            background: '#1c1917',
                            border: '1px solid #3f3834',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px'
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                    <div className="channel-donut-center-info">
                      <span className="channel-donut-center-label">TOTAL BERSIH</span>
                      <strong className="channel-donut-center-val">{money(channelNetTotal)}</strong>
                    </div>
                  </div>
                </div>

                {/* Channel Legend & Stats Breakdown */}
                <div className="channel-donut-legend">
                  {channelReport.map((item) => {
                    const shareNum = channelShare(item.amount);
                    return (
                      <div className="channel-legend-item" key={item.key}>
                        <div className="channel-legend-main">
                          <ChannelBadge channel={item.key} />
                          <span className="channel-legend-share">{shareNum.toFixed(1)}%</span>
                        </div>
                        <div className="channel-legend-bar-wrap">
                          <div className="channel-progress-track">
                            <div
                              className={`channel-progress-fill ${item.key}`}
                              style={{ width: shareNum > 0 ? `${Math.min(100, Math.max(2, shareNum))}%` : '0%' }}
                            />
                          </div>
                        </div>
                        <div className="channel-legend-amount-row">
                          <span className="channel-legend-amount-label">Penjualan Bersih</span>
                          <strong className="channel-legend-amount-val">{money(item.amount)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  <span>(-) Beban Pengeluaran Operasional</span>
                  <small>Belanja bahan baku, utilitas, listrik & logistik</small>
                </div>
                <span className="right deduction-text">- {money(expenseTotal)}</span>
              </div>

              <div className={`statement-row final-row ${netProfit > 0 ? 'is-positive' : netProfit < 0 ? 'is-negative' : 'is-neutral'}`}>
                <div>
                  <strong>LABA BERSIH USAHA (NET OPERATING PROFIT)</strong>
                  <small>Margin Profitabilitas: {profitMargin.toFixed(1)}%</small>
                </div>
                <strong className={`right profit-amount ${netProfit > 0 ? 'is-positive' : netProfit < 0 ? 'is-negative' : 'is-neutral'}`}>{money(netProfit)}</strong>
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
   REACT ROOT MOUNT
   ========================================================= */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);