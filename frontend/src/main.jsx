import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Gauge,
  LogOut,
  Menu as MenuIcon,
  Receipt,
  Settings,
  WalletCards,
  X
} from 'lucide-react';
import { ThemeProvider } from './themeContext';
import './styles.css';
import RegistrationStatusPage from './pages/RegistrationStatusPage';
import Dashboard from './pages/Dashboard';
import PenjualanPage from './pages/PenjualanPage';
import PengeluaranPage from './pages/PengeluaranPage';
import AnalitikPage from './pages/AnalitikPage';
import LaporanPage from './pages/LaporanPage';
import NotificationsPage from './pages/NotificationsPage';
import AccountApprovalsPage from './pages/AccountApprovalsPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import RegisterOwner from './pages/auth/RegisterOwner';
import api, { getExpensesCached } from './services/api';
import { buildNotifications, loadReadNotifIds } from './utils/formatters';

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
            <Route path="/laporan" element={<LaporanPage />} />
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
   REACT ROOT MOUNT
   ========================================================= */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);