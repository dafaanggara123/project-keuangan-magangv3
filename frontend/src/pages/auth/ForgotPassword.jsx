import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Lock
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4100/api';

/* =========================================================
   FORGOT PASSWORD COMPONENT
   ========================================================= */
export default function ForgotPassword() {
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
              <h2>Lupa Kata Sandi?</h2>
              <p>Masukkan email yang terdaftar pada akun Owner Dapoersari</p>
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
