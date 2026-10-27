import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
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
   REGISTRATION STATUS PAGE (/status-pengajuan)
   Pemohon dapat memeriksa status pengajuannya secara transparan
   tanpa mengekspos data pemohon lainnya.
   ========================================================= */
export default function RegistrationStatusPage() {
  const [searchParams] = useLocation().search ? [new URLSearchParams(useLocation().search)] : [new URLSearchParams()];
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const checkStatus = async (targetEmail) => {
    const e = (targetEmail || email).trim().toLowerCase();
    if (!e) {
      setError('Masukkan alamat email yang didaftarkan.');
      return;
    }

    setBusy(true);
    setError('');
    setResult(null);

    try {
      const res = await axios.get(`${API}/auth/registration-status`, {
        params: { email: e }
      });
      setResult(res.data);
    } catch (err) {
      console.error('Check status error:', err);
      const serverErr = err?.response?.data?.error;
      setError(serverErr || 'Gagal memeriksa status permohonan. Pastikan email terdaftar.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialEmail) {
      checkStatus(initialEmail);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    checkStatus(email);
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
              <span className="portal-badge-eyebrow">STATUS PENGAJUAN</span>
              <h2>Cek Status Akun</h2>
              <p>Masukkan alamat email akun yang telah diajukan untuk melihat status persetujuan</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {error && (
                <div className="error-box">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="status-email">Alamat Email Terdaftar</label>
                <div className="input-with-icon">
                  <input
                    id="status-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="primary-btn login-submit" disabled={busy}>
                {busy ? (
                  <>
                    <div className="spinner small" />
                    <span>Memeriksa Status...</span>
                  </>
                ) : (
                  <>
                    <span>Periksa Status</span>
                    <Search size={16} />
                  </>
                )}
              </button>
            </form>

            {result && (
              <div className="status-result-panel" style={{ marginTop: '16px' }}>
                <div className="registration-status-card">
                  <div className="status-card-row">
                    <span>Nama Lengkap:</span>
                    <strong>{result.fullName}</strong>
                  </div>
                  <div className="status-card-row">
                    <span>Email:</span>
                    <strong>{result.email}</strong>
                  </div>
                  <div className="status-card-row">
                    <span>Status Saat Ini:</span>
                    {result.status === 'pending' && (
                      <span className="status-pill status-pill-pending">
                        <span className="pending-dot" />
                        <span>Menunggu Persetujuan</span>
                      </span>
                    )}
                    {result.status === 'approved' && (
                      <span className="status-pill status-pill-approved">
                        <CheckCircle2 size={13} />
                        <span>Disetujui</span>
                      </span>
                    )}
                    {result.status === 'rejected' && (
                      <span className="status-pill status-pill-rejected">
                        <AlertCircle size={13} />
                        <span>Ditolak</span>
                      </span>
                    )}
                  </div>

                  <div className="status-card-row">
                    <span>Waktu Pengajuan:</span>
                    <small>{formatDateTime(result.requestedAt)}</small>
                  </div>

                  {result.reviewedAt && (
                    <div className="status-card-row">
                      <span>Waktu Keputusan:</span>
                      <small>{formatDateTime(result.reviewedAt)}</small>
                    </div>
                  )}

                  {result.status === 'rejected' && result.rejectReason && (
                    <div className="status-notice-box status-notice-rejected">
                      <strong style={{ color: '#f87171', fontSize: '11.5px', display: 'block', marginBottom: '4px' }}>Alasan Penolakan dari Owner 1:</strong>
                      <p style={{ margin: 0, color: '#fca5a5', fontSize: '12.5px', lineHeight: 1.45 }}>{result.rejectReason}</p>
                    </div>
                  )}

                  {result.status === 'approved' && (
                    <div className="status-notice-box status-notice-approved">
                      <p style={{ margin: '0 0 10px 0', color: '#75bd88', fontSize: '12.5px', textAlign: 'center' }}>Akun Anda telah disetujui. Silakan masuk menggunakan kata sandi yang Anda daftarkan.</p>
                      <button
                        type="button"
                        className="login-submit"
                        onClick={() => navigate('/login')}
                      >
                        <span>Lanjut ke Login</span>
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="login-divider">
              <span>atau</span>
            </div>

            <div className="login-register-prompt">
              <span>Belum mengajukan akun?</span>
              <button
                type="button"
                className="register-owner-link"
                onClick={() => navigate('/register')}
              >
                Daftar sebagai Owner
              </button>
            </div>

            <div className="login-back-action" style={{ marginTop: '10px' }}>
              <button
                type="button"
                className="back-to-login-btn"
                onClick={() => navigate('/login')}
              >
                <ArrowLeft size={15} />
                <span>Kembali ke Login</span>
              </button>
            </div>

            <div className="login-security">
              <Lock size={13} className="tiny-lock" />
              <span>Sistem Verifikasi Akun • Dapoersari Enterprise</span>
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
