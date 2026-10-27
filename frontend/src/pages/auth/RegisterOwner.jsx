import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Search
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

const dateFormatterLong = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return dateFormatterLong.format(d);
};

/* =========================================================
   REGISTER OWNER COMPONENT (/register)
   ========================================================= */
export default function RegisterOwner() {
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
        message: response.data?.message || 'Permintaan akses Owner Anda telah diterima dan sedang menunggu persetujuan Owner 1.',
        requestedAt: new Date().toISOString()
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
    <div className="login-page login-page-centered phase-login">
      {/* BACKGROUND AYAM GEPREK & SINGLE MEASURED CHARCOAL OVERLAY */}
      <div className="login-background">
        <div className="login-food-bg" />
        <div className="login-center-darkening" />
      </div>

      {/* CENTERED CARD CONTAINER */}
      <div className="login-panel">
        <div className="login-center">
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-card-logo">
                <img src="/favicon-dapoersari.png" alt="Dapoersari" />
              </div>
              <div className="login-brand-meta">
                <h3 className="login-brand-title">Dapoersari Enterprise</h3>
                <span className="login-brand-subtitle">Financial Control</span>
              </div>
              <span className="portal-badge-eyebrow">OWNER PORTAL</span>
              <h2>Buat Akun Owner</h2>
              <p>Daftarkan akun untuk mengajukan akses ke portal keuangan Dapoersari</p>
            </div>

            {successData ? (
              <div className="reset-success-box">
                <div className="reset-success-icon-wrap">
                  <CheckCircle2 size={36} className="reset-success-icon" />
                </div>
                <strong className="reset-success-title">Pengajuan Akun Berhasil Dikirim</strong>
                <p className="reset-success-desc">
                  Akun Anda sedang menunggu persetujuan Owner 1. Akses dashboard keuangan akan dibuka otomatis setelah permohonan disetujui.
                </p>

                <div className="registration-status-card">
                  <div className="status-card-row">
                    <span>Email Pemohon:</span>
                    <strong>{successData.email}</strong>
                  </div>
                  <div className="status-card-row">
                    <span>Status:</span>
                    <span className="status-pill status-pill-pending">
                      <span className="pending-dot" />
                      <span>Menunggu Persetujuan</span>
                    </span>
                  </div>
                  {successData.requestedAt && (
                    <div className="status-card-row">
                      <span>Waktu Pengajuan:</span>
                      <small>{formatDateTime(successData.requestedAt)}</small>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '8px' }}>
                  <button
                    type="button"
                    className="login-submit"
                    style={{ textDecoration: 'none' }}
                    onClick={() => navigate(`/status-pengajuan?email=${encodeURIComponent(successData.email)}`)}
                  >
                    <Search size={15} />
                    <span>Cek Status Pengajuan</span>
                  </button>
                  <button
                    type="button"
                    className="back-to-login-btn"
                    style={{ justifyContent: 'center' }}
                    onClick={() => navigate('/login')}
                  >
                    <ArrowLeft size={16} />
                    <span>Kembali ke Login</span>
                  </button>
                </div>
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

                <div className="login-divider">
                  <span>atau</span>
                </div>

                <div className="login-register-prompt">
                  <span>Sudah punya akun?</span>
                  <button
                    type="button"
                    className="register-owner-link"
                    onClick={() => navigate('/login')}
                  >
                    Kembali ke Login
                  </button>
                </div>

                <div className="login-status-prompt" style={{ marginTop: '4px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="status-check-link"
                    onClick={() => navigate('/status-pengajuan')}
                  >
                    Sudah mendaftar? Cek Status Pengajuan Akun
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
