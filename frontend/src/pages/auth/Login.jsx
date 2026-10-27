import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

/* =========================================================
   LOGIN COMPONENT (ENTERPRISE SPLIT SCREEN / CENTERING)
   ========================================================= */
export default function Login() {
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
    <div className={`login-page login-page-centered phase-${loginPhase}`}>
      {/* BACKGROUND AYAM GEPREK & SINGLE MEASURED CHARCOAL OVERLAY */}
      <div className="login-background">
        <div className="login-food-bg" />
        <div className="login-center-darkening" />
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

      {/* CENTERED LOGIN CONTAINER */}
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
                    placeholder="Masukkan alamat email"
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
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Portal</span>
                    <ArrowUpRight size={18} />
                  </>
                )}
              </button>

              <div className="login-divider">
                <span>atau</span>
              </div>

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

              <div className="login-status-prompt" style={{ marginTop: '10px', textAlign: 'center' }}>
                <button
                  type="button"
                  className="status-check-link"
                  onClick={() => navigate('/status-pengajuan')}
                >
                  Sudah mendaftar? Cek Status Pengajuan Akun
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
