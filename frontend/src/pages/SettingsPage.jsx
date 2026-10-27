import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Plus,
  Receipt,
  ShieldCheck,
  Store,
  Sun,
  Target,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import api from '../services/api';
import { useTheme } from '../themeContext';
import { money } from '../utils/formatters';
import { LoadingPage, PageHeader } from '../components/CommonUI';

/* =========================================================
   7. SETTINGS COMPONENT (PENGATURAN)
   ========================================================= */
export default function SettingsPage({ profile, onLogout }) {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [activeSection, setActiveSection] = useState(null);

  // Modal konfirmasi perubahan tema
  const [pendingThemeMode, setPendingThemeMode] = useState(null);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [themeApplying, setThemeApplying] = useState(false);

  const getThemeDisplayName = (mode) => {
    if (mode === 'light') return 'Mode Terang';
    if (mode === 'dark') return 'Mode Gelap';
    if (mode === 'system') return 'Ikuti Sistem';
    return mode;
  };

  const handleSelectTheme = (mode) => {
    if (mode === themeMode) {
      // Tidak ada perubahan, jangan buka modal
      return;
    }
    setPendingThemeMode(mode);
    setThemeModalOpen(true);
  };

  const closeThemeModal = () => {
    if (themeApplying) return;
    setThemeModalOpen(false);
    setPendingThemeMode(null);
  };

  const handleConfirmTheme = () => {
    if (themeApplying || !pendingThemeMode) return;
    setThemeApplying(true);
    try {
      setThemeMode(pendingThemeMode);
      setThemeModalOpen(false);
      setPendingThemeMode(null);
    } finally {
      setThemeApplying(false);
    }
  };

  // Keyboard shortcut: Escape to close theme modal
  useEffect(() => {
    if (!themeModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeThemeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [themeModalOpen, themeApplying]);
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
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: '' });
  const [categoryModalError, setCategoryModalError] = useState('');
  const [categoryBannerMsg, setCategoryBannerMsg] = useState({ type: '', text: '' });
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

  const parseBusinessName = (raw) => {
    if (!raw) return 'Dapoersari';
    if (typeof raw === 'object') {
      return raw.businessName || raw.business_name || 'Dapoersari';
    }
    if (typeof raw === 'string') {
      let cleaned = raw.trim();
      if (cleaned.startsWith('__JSON__')) {
        cleaned = cleaned.slice(8);
      }
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleaned);
          return parsed?.businessName || parsed?.business_name || 'Dapoersari';
        } catch (e) {
          // Fallback jika bukan JSON valid
        }
      }
      return raw;
    }
    return String(raw);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/settings');
      const data = response.data || {};
      const rawBusinessName = data.businessName ?? data.business_name;
      setSettings({
        businessName: parseBusinessName(rawBusinessName),
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
    setCategoryModalError('');
    setCategoryModal(true);
  };

  const openEditCategory = (category) => {
    setCategoryForm({ id: category.id, name: category.name || '' });
    setCategoryModalError('');
    setCategoryModal(true);
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    const name = categoryForm.name.trim();
    if (!name) {
      setCategoryModalError('Nama kategori wajib diisi.');
      return;
    }
    if (name.length < 2) {
      setCategoryModalError('Nama kategori minimal 2 karakter.');
      return;
    }

    try {
      setCategorySubmitting(true);
      setCategoryModalError('');
      if (categoryForm.id) {
        await api.put(`/expense-categories/${categoryForm.id}`, { name });
        setCategoryBannerMsg({ type: 'success', text: `Kategori "${name}" berhasil diperbarui.` });
      } else {
        await api.post('/expense-categories', { name });
        setCategoryBannerMsg({ type: 'success', text: `Kategori "${name}" berhasil ditambahkan.` });
      }
      setCategoryModal(false);
      await loadCategories();
    } catch (e) {
      console.error('Gagal menyimpan kategori:', e);
      const errorMsg = e?.response?.data?.error || (e?.response?.status === 404 ? 'Endpoint API kategori tidak ditemukan.' : 'Terjadi kesalahan saat menyimpan kategori.');
      setCategoryModalError(errorMsg);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const deleteCategory = async (id, catName) => {
    const label = catName ? ` "${catName}"` : '';
    const confirmed = window.confirm(`Hapus kategori${label} dari sistem?`);
    if (!confirmed) return;
    try {
      setCategoryBannerMsg({ type: '', text: '' });
      await api.delete(`/expense-categories/${id}`);
      setCategoryBannerMsg({ type: 'success', text: `Kategori${label} berhasil dihapus.` });
      await loadCategories();
    } catch (e) {
      console.error('Gagal menghapus kategori:', e);
      const errorMsg = e?.response?.data?.error || 'Kategori gagal dihapus.';
      setCategoryBannerMsg({ type: 'error', text: errorMsg });
    }
  };

  if (loading) return <LoadingPage />;

  const accountPreferenceMenus = [
    {
      id: 'akun',
      title: 'Akun Owner & Keamanan',
      description: 'Kelola profil eksekutif owner dan perbarui kata sandi akses portal.',
      icon: <ShieldCheck size={20} />
    },
    {
      id: 'tema',
      title: 'Tampilan & Tema',
      description: 'Atur tampilan aplikasi sesuai preferensi Anda.',
      icon: <Palette size={20} />
    }
  ];

  const businessConfigMenus = [
    {
      id: 'usaha',
      title: 'Profil & Identitas Usaha',
      description: 'Nama bisnis, kontak resmi, alamat restoran, dan jam operasional.',
      icon: <Store size={20} />
    },
    {
      id: 'penjualan',
      title: 'Konfigurasi Tarif PPN ShopeeFood',
      description: 'Atur tarif penyesuaian ShopeeFood dan status kategori penjualan.',
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
            {/* GROUP 1: AKUN & PREFERENSI */}
            <div className="settings-group">
              <div className="settings-group-header">
                <span className="settings-group-label">Akun & Preferensi</span>
              </div>
              <div className="settings-featured-grid">
                {accountPreferenceMenus.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="settings-featured-card"
                    onClick={() => setActiveSection(item.id)}
                  >
                    <div className="settings-featured-icon">{item.icon}</div>
                    <div className="settings-featured-copy">
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <div className="settings-featured-arrow-wrap">
                      <ChevronRight size={18} className="settings-menu-arrow" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* GROUP 2: KONFIGURASI USAHA */}
            <div className="settings-group">
              <div className="settings-group-header">
                <span className="settings-group-label">Konfigurasi Usaha</span>
              </div>
              <div className="settings-list-container">
                {businessConfigMenus.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="settings-list-row"
                    onClick={() => setActiveSection(item.id)}
                  >
                    <div className="settings-list-icon">{item.icon}</div>
                    <div className="settings-list-copy">
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <ChevronRight size={18} className="settings-menu-arrow" />
                  </button>
                ))}
              </div>
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
                    <span>KATEGORI PENJUALAN</span>
                    <h2>Konfigurasi Tarif PPN ShopeeFood</h2>
                    <p>Atur tarif penyesuaian kategori untuk kalkulasi pendapatan bersih otomatis.</p>
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
                    <label>Status Kategori Penjualan Aktif</label>
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
              <div className="settings-detail-card category-detail-card">
                <div className="settings-detail-head">
                  <div className="settings-detail-icon">
                    <WalletCards size={20} />
                  </div>
                  <div className="settings-detail-head-info">
                    <span className="eyebrow-chip">POS BIAYA OPERASIONAL</span>
                    <h2>Kategori Pengeluaran</h2>
                    <p>Klasifikasi pos pengeluaran (OpEx) untuk pembukuan buku kas dan laporan laba rugi.</p>
                  </div>
                </div>

                {categoryBannerMsg.text && (
                  <div className={`category-banner ${categoryBannerMsg.type === 'error' ? 'category-banner-error' : 'category-banner-success'}`}>
                    {categoryBannerMsg.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
                    <span>{categoryBannerMsg.text}</span>
                    <button
                      type="button"
                      className="category-banner-close"
                      onClick={() => setCategoryBannerMsg({ type: '', text: '' })}
                      aria-label="Tutup notifikasi"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="category-toolbar">
                  <div className="category-toolbar-count">
                    <span className="category-badge">{categories.length}</span>
                    <div className="category-count-label">
                      <strong>Kategori Pengeluaran</strong>
                      <span>Tersimpan aktif di database</span>
                    </div>
                  </div>
                  <button type="button" className="primary-btn category-add-btn" onClick={openAddCategory}>
                    <Plus size={16} />
                    <span>Tambah Kategori</span>
                  </button>
                </div>

                <div className="category-settings-list">
                  {categoryLoading ? (
                    <div className="settings-inline-loading">
                      <div className="spinner small" />
                      <span>Memuat data kategori dari database...</span>
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="category-empty-state">
                      <div className="category-empty-icon">
                        <WalletCards size={32} />
                      </div>
                      <strong>Belum Ada Kategori Pengeluaran</strong>
                      <p>Tambahkan klasifikasi pos biaya seperti Bahan Baku, Operasional, atau Transportasi untuk mempermudah pencatatan kas.</p>
                      <button type="button" className="primary-btn small" onClick={openAddCategory}>
                        <Plus size={14} />
                        <span>Buat Kategori Pertama</span>
                      </button>
                    </div>
                  ) : (
                    categories.map((cat, idx) => (
                      <div key={cat.id || idx} className="category-settings-row">
                        <div className="category-row-left">
                          <span className="category-number-badge">#{idx + 1}</span>
                          <span className="category-dot" />
                          <strong className="category-row-name">{cat.name}</strong>
                        </div>
                        <div className="category-actions">
                          <button
                            type="button"
                            className="category-action-btn edit"
                            onClick={() => openEditCategory(cat)}
                            title="Edit nama kategori"
                            aria-label={`Edit kategori ${cat.name}`}
                          >
                            <Pencil size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="category-action-btn delete"
                            onClick={() => deleteCategory(cat.id, cat.name)}
                            title="Hapus kategori"
                            aria-label={`Hapus kategori ${cat.name}`}
                          >
                            <Trash2 size={14} />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* AKUN OWNER & KEAMANAN */}
            {activeSection === 'akun' && (
              <div className="settings-stack security-settings-view">
                {/* 1. Header Bagian */}
                <div className="security-page-header">
                  <div className="security-header-content">
                    <span className="eyebrow">PENGATURAN AKUN</span>
                    <h2>Akun Owner & Keamanan</h2>
                    <p>Kelola identitas pemilik usaha, kredensial login, dan kontrol sesi portal finansial Dapoersari.</p>
                  </div>
                </div>

                {/* 2. Kartu Profil Owner */}
                <div className="settings-detail-card owner-profile-card">
                  <div className="owner-profile-main">
                    <div className="owner-profile-avatar" aria-hidden="true">
                      {(profile?.full_name?.trim() || 'Owner Dapoersari').charAt(0).toUpperCase()}
                    </div>
                    <div className="owner-profile-info">
                      <div className="owner-name-row">
                        <h3>{profile?.full_name?.trim() || 'Owner Dapoersari'}</h3>
                        <span className="owner-role-badge">
                          <ShieldCheck size={13} />
                          <span>{profile?.is_approver ? 'Executive Owner • Approver' : 'Executive Owner'}</span>
                        </span>
                      </div>
                      <p className="owner-profile-desc">
                        Pemilik akun memiliki otoritas penuh terhadap pemantauan finansial, rekonsiliasi kasir, dan konfigurasi sistem Dapoersari.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Kartu Tindakan Keamanan: Ubah Kata Sandi */}
                <div className="settings-detail-card security-action-card">
                  <div className="security-card-header">
                    <div className="security-card-icon-wrap">
                      <KeyRound size={18} />
                    </div>
                    <div className="security-card-titles">
                      <h4>Kredensial & Kata Sandi</h4>
                      <p>Perlindungan autentikasi akun pemilik usaha</p>
                    </div>
                  </div>

                  <div className="security-action-row">
                    <div className="security-action-copy">
                      <strong>Kata Sandi Akses Portal</strong>
                      <p>Perbarui kata sandi akun secara berkala untuk menjaga kerahasiaan dan keamanan data finansial.</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn security-action-btn"
                      onClick={() => {
                        setPasswordError('');
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordModal(true);
                      }}
                    >
                      <KeyRound size={15} />
                      <span>Ubah Kata Sandi</span>
                    </button>
                  </div>
                </div>

                {/* 4. Kartu Tindakan Keamanan: Keluar Sesi */}
                <div className="settings-detail-card security-action-card session-action-card">
                  <div className="security-card-header">
                    <div className="security-card-icon-wrap session-icon-wrap">
                      <LogOut size={18} />
                    </div>
                    <div className="security-card-titles">
                      <h4>Sesi Peramban</h4>
                      <p>Manajemen koneksi aktif pada perangkat ini</p>
                    </div>
                  </div>

                  <div className="security-action-row">
                    <div className="security-action-copy">
                      <strong>Keluar dari Sesi Portal</strong>
                      <p>Sesi login akan ditutup dan token otorisasi akan dihapus dari peramban ini.</p>
                    </div>
                    <button
                      type="button"
                      className="logout-session-btn"
                      onClick={() => {
                        if (typeof onLogout === 'function') {
                          onLogout();
                        } else {
                          localStorage.removeItem('p2_token');
                          window.location.href = '/login';
                        }
                      }}
                    >
                      <LogOut size={15} />
                      <span>Keluar Sesi</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 6. TAMPILAN & TEMA */}
            {activeSection === 'tema' && (
              <div className="settings-stack">
                <div className="settings-detail-card">
                  <div className="settings-detail-head">
                    <div className="settings-detail-icon">
                      <Palette size={20} />
                    </div>
                    <div>
                      <span>PREFERENSI SISTEM</span>
                      <h2>Tampilan & Tema</h2>
                      <p>Sesuaikan visual aplikasi Dapoersari dengan kenyamanan mata dan lingkungan kerja Anda.</p>
                    </div>
                  </div>

                  <div className="theme-settings-wrapper" style={{ marginTop: '20px' }}>
                    <div className="theme-options-grid" role="radiogroup" aria-label="Pilihan Tema Aplikasi">
                      {/* A. Mode Terang */}
                      <button
                        type="button"
                        className={`theme-radio-card ${themeMode === 'light' ? 'active' : ''}`}
                        onClick={() => handleSelectTheme('light')}
                        role="radio"
                        aria-checked={themeMode === 'light'}
                      >
                        <div className="theme-card-top">
                          <div className="theme-card-icon">
                            <Sun size={20} />
                          </div>
                          <div className="theme-radio-indicator">
                            {themeMode === 'light' && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <div className="theme-card-info">
                          <strong>Mode Terang</strong>
                          <p>Latar krem hangat, kartu putih lembut, dan aksen hijau khas restoran Dapoersari.</p>
                        </div>
                        <div className="theme-card-mini-preview light-preview" aria-hidden="true">
                          <div className="preview-topbar" />
                          <div className="preview-body">
                            <div className="preview-sidebar" />
                            <div className="preview-content">
                              <div className="preview-card" />
                              <div className="preview-card" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* B. Mode Gelap */}
                      <button
                        type="button"
                        className={`theme-radio-card ${themeMode === 'dark' ? 'active' : ''}`}
                        onClick={() => handleSelectTheme('dark')}
                        role="radio"
                        aria-checked={themeMode === 'dark'}
                      >
                        <div className="theme-card-top">
                          <div className="theme-card-icon">
                            <Moon size={20} />
                          </div>
                          <div className="theme-radio-indicator">
                            {themeMode === 'dark' && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <div className="theme-card-info">
                          <strong>Mode Gelap</strong>
                          <p>Latar charcoal gelap dan permukaan kontras tinggi yang nyaman di mata pada malam hari.</p>
                        </div>
                        <div className="theme-card-mini-preview dark-preview" aria-hidden="true">
                          <div className="preview-topbar" />
                          <div className="preview-body">
                            <div className="preview-sidebar" />
                            <div className="preview-content">
                              <div className="preview-card" />
                              <div className="preview-card" />
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* C. Ikuti Sistem */}
                      <button
                        type="button"
                        className={`theme-radio-card ${themeMode === 'system' ? 'active' : ''}`}
                        onClick={() => handleSelectTheme('system')}
                        role="radio"
                        aria-checked={themeMode === 'system'}
                      >
                        <div className="theme-card-top">
                          <div className="theme-card-icon">
                            <Laptop size={20} />
                          </div>
                          <div className="theme-radio-indicator">
                            {themeMode === 'system' && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                        <div className="theme-card-info">
                          <strong>Ikuti Sistem</strong>
                          <p>Otomatis sinkron dengan pengaturan tema terang/gelap pada perangkat komputer atau ponsel Anda.</p>
                        </div>
                        <div className="theme-card-mini-preview system-preview" aria-hidden="true">
                          <div className="preview-topbar" />
                          <div className="preview-body">
                            <div className="preview-sidebar" />
                            <div className="preview-content">
                              <div className="preview-card" />
                              <div className="preview-card" />
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="theme-active-status-bar">
                      <span>
                        Mode aktif saat ini:
                        <strong>
                          {themeMode === 'system'
                            ? `Ikuti Sistem (${resolvedTheme === 'dark' ? 'Gelap' : 'Terang'})`
                            : themeMode === 'dark'
                            ? 'Mode Gelap'
                            : 'Mode Terang'}
                        </strong>
                      </span>
                      <span className="theme-active-badge">
                        <CheckCircle2 size={13} />
                        Tersimpan di Peramban
                      </span>
                    </div>
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
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !categorySubmitting) setCategoryModal(false);
          }}
        >
          <div className="modal-card category-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">POS BIAYA OPERASIONAL</span>
                <h3 id="category-modal-title">{categoryForm.id ? 'Edit Kategori Pengeluaran' : 'Tambah Kategori Pengeluaran'}</h3>
              </div>
              <button
                type="button"
                className="ghost-icon"
                disabled={categorySubmitting}
                onClick={() => setCategoryModal(false)}
                aria-label="Tutup modal"
              >
                <X size={18} />
              </button>
            </div>

            <form className="settings-modal-form" onSubmit={saveCategory}>
              <div className="form-group">
                <label htmlFor="category-name-input">
                  Nama Kategori <span className="required-star">*</span>
                </label>
                <input
                  id="category-name-input"
                  type="text"
                  className={`category-modal-input ${categoryModalError ? 'input-error' : ''}`}
                  value={categoryForm.name}
                  onChange={(e) => {
                    setCategoryForm({ ...categoryForm, name: e.target.value });
                    if (categoryModalError) setCategoryModalError('');
                  }}
                  placeholder="Contoh: Bahan Baku & Dapur"
                  autoFocus
                  disabled={categorySubmitting}
                  maxLength={60}
                />
                <span className="category-input-hint">
                  Gunakan nama yang ringkas dan deskriptif untuk pos biaya operasional.
                </span>
                {categoryModalError && (
                  <div className="category-field-error" role="alert">
                    <AlertCircle size={14} />
                    <span>{categoryModalError}</span>
                  </div>
                )}
              </div>

              <div className="modal-actions category-modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={categorySubmitting}
                  onClick={() => setCategoryModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-btn category-submit-btn"
                  disabled={categorySubmitting}
                >
                  {categorySubmitting ? (
                    <>
                      <div className="spinner small" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{categoryForm.id ? 'Perbarui Kategori' : 'Simpan Kategori'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THEME CONFIRMATION MODAL */}
      {themeModalOpen && pendingThemeMode && (
        <div
          className="modal-backdrop theme-modal-backdrop"
          onClick={() => !themeApplying && closeThemeModal()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="theme-dialog-title"
          aria-describedby="theme-dialog-desc"
        >
          <div
            className="modal-card theme-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="ghost-icon theme-modal-close-btn"
              onClick={closeThemeModal}
              disabled={themeApplying}
              aria-label="Tutup modal"
            >
              <X size={18} />
            </button>

            <div className="theme-modal-icon-wrap" aria-hidden="true">
              {pendingThemeMode === 'light' ? (
                <Sun size={24} />
              ) : pendingThemeMode === 'dark' ? (
                <Moon size={24} />
              ) : (
                <Laptop size={24} />
              )}
            </div>

            <div className="theme-modal-content">
              <h3 id="theme-dialog-title" className="theme-modal-title">
                Terapkan Perubahan Tema?
              </h3>
              <p id="theme-dialog-desc" className="theme-modal-desc">
                Anda akan mengubah tampilan dari <strong>{getThemeDisplayName(themeMode)}</strong> ke <strong>{getThemeDisplayName(pendingThemeMode)}</strong>. Apakah Anda ingin melanjutkan?
              </p>
            </div>

            <div className="theme-modal-actions">
              <button
                type="button"
                className="secondary-btn theme-modal-cancel-btn"
                onClick={closeThemeModal}
                disabled={themeApplying}
              >
                Batal
              </button>
              <button
                type="button"
                className="primary-btn theme-modal-confirm-btn"
                onClick={handleConfirmTheme}
                disabled={themeApplying}
              >
                {themeApplying ? (
                  <>
                    <div className="spinner small" />
                    <span>Menerapkan...</span>
                  </>
                ) : (
                  <>
                    <Palette size={16} />
                    <span>Terapkan Tema</span>
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

