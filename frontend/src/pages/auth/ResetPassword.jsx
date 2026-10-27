import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  RefreshCw
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

/* =========================================================
   RESET PASSWORD COMPONENT
   ========================================================= */
export default function ResetPassword() {
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
              <h2>Buat Kata Sandi Baru</h2>
              <p>Tetapkan kata sandi baru untuk akun Owner Dapoersari</p>
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
