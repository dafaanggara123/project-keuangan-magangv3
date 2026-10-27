import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatDateTime } from '../utils/formatters';
import { PageHeader } from '../components/CommonUI';

/* =========================================================
   7. ACCOUNT APPROVALS PAGE (/persetujuan-akun)
   Halaman Persetujuan Akun khusus Owner 1 (Approver resmi)
   ========================================================= */
export default function AccountApprovalsPage({ onDecisionMade }) {
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [detailItem, setDetailItem] = useState(null);
  const [approveItem, setApproveItem] = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchRegistrations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/registrations');
      setRegistrations(res.data?.registrations || []);
      setStats(res.data?.stats || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      console.error('Fetch registrations error:', err);
      setError(err?.response?.data?.error || 'Gagal memuat daftar pengajuan akun.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const handleApprove = async () => {
    if (!approveItem || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      const res = await api.post(`/admin/registrations/${approveItem.id}/approve`);
      setActionSuccess(res.data?.message || `Akun ${approveItem.email} berhasil disetujui.`);
      setApproveItem(null);
      await fetchRegistrations();
      if (onDecisionMade) onDecisionMade();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      console.error('Approve error:', err);
      setActionError(err?.response?.data?.error || 'Gagal menyetujui akun.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectItem || actionBusy) return;

    const trimmedReason = rejectReason.trim();
    if (!trimmedReason) {
      setActionError('Alasan penolakan wajib diisi agar riwayat keputusan dapat ditelusuri.');
      return;
    }

    setActionBusy(true);
    setActionError('');
    try {
      const res = await api.post(`/admin/registrations/${rejectItem.id}/reject`, {
        reason: trimmedReason
      });
      setActionSuccess(res.data?.message || `Pengajuan dari ${rejectItem.email} telah ditolak.`);
      setRejectItem(null);
      setRejectReason('');
      await fetchRegistrations();
      if (onDecisionMade) onDecisionMade();
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      console.error('Reject error:', err);
      setActionError(err?.response?.data?.error || 'Gagal menolak akun.');
    } finally {
      setActionBusy(false);
    }
  };

  // Filtered registrations
  const filteredList = registrations.filter((r) => {
    const matchesTab = r.status === activeTab;
    const matchesSearch =
      !searchQuery.trim() ||
      r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="approvals-page">
      <PageHeader
        eyebrow="SISTEM & OTORISASI"
        title="Persetujuan Akun Owner"
        subtitle="Kelola permohonan akses ke portal keuangan Dapoersari"
        action={
          <button
            type="button"
            className="secondary-btn"
            onClick={fetchRegistrations}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Segarkan Data</span>
          </button>
        }
      />

      {actionSuccess && (
        <div className="approval-toast success" style={{ marginBottom: '16px', padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{actionSuccess}</span>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="approval-kpi-grid">
        <div className="approval-kpi-card pending">
          <div className="kpi-icon-wrap pending">
            <Clock size={18} />
          </div>
          <div className="kpi-copy">
            <span className="kpi-label">
              <span className="label-full">Menunggu Persetujuan</span>
              <span className="label-short">Menunggu</span>
            </span>
            <strong className="kpi-value">{stats.pending}</strong>
            <span className="kpi-sub">Memerlukan tinjauan approver</span>
          </div>
        </div>

        <div className="approval-kpi-card approved">
          <div className="kpi-icon-wrap approved">
            <UserCheck size={18} />
          </div>
          <div className="kpi-copy">
            <span className="kpi-label">
              <span className="label-full">Disetujui</span>
              <span className="label-short">Disetujui</span>
            </span>
            <strong className="kpi-value">{stats.approved}</strong>
            <span className="kpi-sub">Memiliki akses penuh portal</span>
          </div>
        </div>

        <div className="approval-kpi-card rejected">
          <div className="kpi-icon-wrap rejected">
            <UserX size={18} />
          </div>
          <div className="kpi-copy">
            <span className="kpi-label">
              <span className="label-full">Ditolak</span>
              <span className="label-short">Ditolak</span>
            </span>
            <strong className="kpi-value">{stats.rejected}</strong>
            <span className="kpi-sub">Permohonan tidak disetujui</span>
          </div>
        </div>
      </div>

      {/* FILTER & TABS TOOLBAR */}
      <div className="approval-toolbar-panel">
        <div className="report-tabs approval-tabs">
          <button
            type="button"
            className={activeTab === 'pending' ? 'active' : ''}
            onClick={() => setActiveTab('pending')}
          >
            <span className="tab-label-full">Menunggu Persetujuan</span>
            <span className="tab-label-short">Menunggu</span>
            {stats.pending > 0 && (
              <span className="tab-pill-badge">{stats.pending}</span>
            )}
          </button>
          <button
            type="button"
            className={activeTab === 'approved' ? 'active' : ''}
            onClick={() => setActiveTab('approved')}
          >
            <span className="tab-label-full">Riwayat Disetujui</span>
            <span className="tab-label-short">Disetujui</span>
            <span className="tab-pill-badge muted">{stats.approved}</span>
          </button>
          <button
            type="button"
            className={activeTab === 'rejected' ? 'active' : ''}
            onClick={() => setActiveTab('rejected')}
          >
            <span className="tab-label-full">Riwayat Ditolak</span>
            <span className="tab-label-short">Ditolak</span>
            <span className="tab-pill-badge muted">{stats.rejected}</span>
          </button>
        </div>

        <div className="approval-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama lengkap atau email..."
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TABLE / CARD CONTAINER */}
      <div className="expense-panel table-panel approval-table-card">
        {loading ? (
          <div className="approval-loading-state">
            <div className="spinner small" />
            <span>Memuat data pengajuan akun...</span>
          </div>
        ) : error ? (
          <div className="approval-error-state">
            <AlertCircle size={28} style={{ color: '#dc2626' }} />
            <div>
              <h4>Gagal Memuat Data</h4>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="secondary-btn"
              onClick={fetchRegistrations}
              style={{ marginTop: '8px', height: '36px', padding: '0 14px' }}
            >
              <RefreshCw size={14} />
              <span>Coba Lagi</span>
            </button>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="approval-empty-state">
            <div className="empty-icon-wrap">
              {activeTab === 'pending' ? (
                <CheckCircle2 size={32} style={{ color: '#059669' }} />
              ) : (
                <Search size={32} style={{ color: '#94a3b8' }} />
              )}
            </div>
            <h4>
              {searchQuery
                ? 'Tidak Ada Pengajuan Ditemukan'
                : activeTab === 'pending'
                ? 'Belum Ada Pengajuan Akun'
                : activeTab === 'approved'
                ? 'Belum Ada Riwayat Akun Disetujui'
                : 'Belum Ada Riwayat Akun Ditolak'}
            </h4>
            <p>
              {searchQuery
                ? `Tidak ditemukan pengajuan dengan kata kunci "${searchQuery}". Coba gunakan kata kunci lain.`
                : activeTab === 'pending'
                ? 'Semua permohonan akses Owner telah selesai ditinjau. Tidak ada permohonan yang menunggu persetujuan.'
                : 'Daftar riwayat akan tersimpan otomatis saat Anda mengambil keputusan.'}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="approval-table-desktop">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pemohon</th>
                    <th>Alamat Email</th>
                    <th>Tanggal Pengajuan</th>
                    <th>Status</th>
                    {activeTab !== 'pending' && <th>Waktu Keputusan</th>}
                    {activeTab === 'rejected' && <th>Alasan Penolakan</th>}
                    <th style={{ textAlign: 'right' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="applicant-cell">
                          <div className="applicant-avatar">
                            {(item.full_name?.charAt(0) || 'O').toUpperCase()}
                          </div>
                          <div>
                            <strong>{item.full_name}</strong>
                            <span>Calon Owner</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="applicant-email">{item.email}</span>
                      </td>
                      <td>
                        <span className="applicant-date">{formatDateTime(item.requested_at)}</span>
                      </td>
                      <td>
                        {item.status === 'pending' && (
                          <span className="approval-status-pill pending">
                            <span className="status-dot" />
                            <span>Menunggu</span>
                          </span>
                        )}
                        {item.status === 'approved' && (
                          <span className="approval-status-pill approved">
                            <Check size={12} />
                            <span>Disetujui</span>
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="approval-status-pill rejected">
                            <X size={12} />
                            <span>Ditolak</span>
                          </span>
                        )}
                      </td>
                      {activeTab !== 'pending' && (
                        <td>
                          <span className="applicant-date">{formatDateTime(item.reviewed_at)}</span>
                        </td>
                      )}
                      {activeTab === 'rejected' && (
                        <td>
                          <span className="applicant-reason" title={item.reject_reason || '-'}>
                            {item.reject_reason || '-'}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>
                        <div className="approval-action-buttons">
                          <button
                            type="button"
                            className="action-btn-detail"
                            onClick={() => setDetailItem(item)}
                            title="Lihat Detail Permohonan"
                          >
                            <Eye size={14} />
                            <span>Detail</span>
                          </button>

                          {item.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="action-btn-approve"
                                onClick={() => {
                                  setActionError('');
                                  setApproveItem(item);
                                }}
                                title="Setujui Akun Ini"
                              >
                                <Check size={14} />
                                <span>Setujui</span>
                              </button>
                              <button
                                type="button"
                                className="action-btn-reject"
                                onClick={() => {
                                  setActionError('');
                                  setRejectReason('');
                                  setRejectItem(item);
                                }}
                                title="Tolak Akun Ini"
                              >
                                <X size={14} />
                                <span>Tolak</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="approval-cards-mobile">
              {filteredList.map((item) => (
                <div key={item.id} className="approval-mobile-card">
                  <div className="mobile-card-top">
                    <div className="applicant-cell">
                      <div className="applicant-avatar">
                        {(item.full_name?.charAt(0) || 'O').toUpperCase()}
                      </div>
                      <div>
                        <strong>{item.full_name}</strong>
                        <span className="applicant-email">{item.email}</span>
                      </div>
                    </div>
                    {item.status === 'pending' && (
                      <span className="approval-status-pill pending">
                        <span className="status-dot" />
                        <span>Menunggu</span>
                      </span>
                    )}
                    {item.status === 'approved' && (
                      <span className="approval-status-pill approved">
                        <Check size={12} />
                        <span>Disetujui</span>
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="approval-status-pill rejected">
                        <X size={12} />
                        <span>Ditolak</span>
                      </span>
                    )}
                  </div>

                  <div className="mobile-card-meta">
                    <div className="meta-row">
                      <span>Diajukan:</span>
                      <strong>{formatDateTime(item.requested_at)}</strong>
                    </div>
                    {item.reviewed_at && (
                      <div className="meta-row">
                        <span>Ditinjau:</span>
                        <strong>{formatDateTime(item.reviewed_at)}</strong>
                      </div>
                    )}
                    {item.reject_reason && (
                      <div className="meta-reason-box">
                        <span>Alasan Penolakan:</span>
                        <p>{item.reject_reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="mobile-card-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: '12.5px' }}
                      onClick={() => setDetailItem(item)}
                    >
                      <Eye size={14} />
                      <span>Detail</span>
                    </button>

                    {item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="action-btn-approve mobile"
                          style={{ flex: 1.2, justifyContent: 'center', padding: '8px 12px', fontSize: '12.5px' }}
                          onClick={() => {
                            setActionError('');
                            setApproveItem(item);
                          }}
                        >
                          <Check size={14} />
                          <span>Setujui</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn-reject mobile"
                          style={{ flex: 1, justifyContent: 'center', padding: '8px 10px', fontSize: '12.5px' }}
                          onClick={() => {
                            setActionError('');
                            setRejectReason('');
                            setRejectItem(item);
                          }}
                        >
                          <X size={14} />
                          <span>Tolak</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: DETAIL PERMOHONAN */}
      {detailItem && (
        <div className="modal-backdrop" onClick={() => setDetailItem(null)}>
          <div className="modal-card approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">RINCIAN PENGAJUAN AKUN</span>
                <h3>Detail Calon Owner</h3>
              </div>
              <button
                type="button"
                className="ghost-icon"
                onClick={() => setDetailItem(null)}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-detail-content">
              <div className="detail-profile-banner">
                <div className="detail-avatar">
                  {(detailItem.full_name?.charAt(0) || 'O').toUpperCase()}
                </div>
                <div>
                  <h4>{detailItem.full_name}</h4>
                  <span>{detailItem.email}</span>
                </div>
              </div>

              <div className="detail-rows-grid">
                <div className="detail-field">
                  <label>ID Pengguna (UID)</label>
                  <code>{detailItem.id}</code>
                </div>
                <div className="detail-field">
                  <label>Status Permohonan</label>
                  <div>
                    {detailItem.status === 'pending' && (
                      <span className="approval-status-pill pending">
                        <span className="status-dot" />
                        <span>Menunggu Persetujuan Owner 1</span>
                      </span>
                    )}
                    {detailItem.status === 'approved' && (
                      <span className="approval-status-pill approved">
                        <Check size={12} />
                        <span>Telah Disetujui (Role: Owner)</span>
                      </span>
                    )}
                    {detailItem.status === 'rejected' && (
                      <span className="approval-status-pill rejected">
                        <X size={12} />
                        <span>Ditolak</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="detail-field">
                  <label>Waktu Pengajuan</label>
                  <span>{formatDateTime(detailItem.requested_at)}</span>
                </div>
                {detailItem.reviewed_at && (
                  <div className="detail-field">
                    <label>Waktu Ditinjau</label>
                    <span>{formatDateTime(detailItem.reviewed_at)}</span>
                  </div>
                )}
                {detailItem.reject_reason && (
                  <div className="detail-field full">
                    <label>Alasan Penolakan</label>
                    <div className="reason-display-box">
                      {detailItem.reject_reason}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDetailItem(null)}
              >
                Tutup
              </button>
              {detailItem.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="action-btn-reject"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setRejectReason('');
                      setActionError('');
                      setRejectItem(item);
                    }}
                  >
                    <X size={14} />
                    <span>Tolak</span>
                  </button>
                  <button
                    type="button"
                    className="action-btn-approve"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setActionError('');
                      setApproveItem(item);
                    }}
                  >
                    <Check size={14} />
                    <span>Setujui</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: KONFIRMASI PERSETUJUAN */}
      {approveItem && (
        <div className="modal-backdrop" onClick={() => !actionBusy && setApproveItem(null)}>
          <div className="modal-card approval-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon-wrap approve">
              <UserCheck size={32} />
            </div>

            <div className="confirm-modal-body">
              <h3>Setujui Pengajuan Akun?</h3>
              <p>
                Anda akan menyetujui akun berikut untuk memperoleh akses penuh sebagai Owner pada portal keuangan Dapoersari Enterprise.
              </p>

              {actionError && (
                <div className="error-box" style={{ marginBottom: '12px' }}>
                  <AlertCircle size={15} />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="confirm-target-card">
                <div className="target-row">
                  <span>Nama Lengkap:</span>
                  <strong>{approveItem.full_name}</strong>
                </div>
                <div className="target-row">
                  <span>Alamat Email:</span>
                  <strong>{approveItem.email}</strong>
                </div>
                <div className="target-row">
                  <span>Hak Akses:</span>
                  <span className="role-pill">Executive Owner (Project 2)</span>
                </div>
              </div>

              <div className="confirm-note">
                <ShieldCheck size={15} />
                <span>
                  Setelah disetujui, akun ini akan dapat melihat laporan omzet, pengeluaran, margin, dan data finansial lainnya.
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setApproveItem(null)}
                disabled={actionBusy}
              >
                Batalkan
              </button>
              <button
                type="button"
                className="primary-btn approve-confirm-btn"
                onClick={handleApprove}
                disabled={actionBusy}
              >
                {actionBusy ? (
                  <>
                    <div className="spinner small" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Ya, Setujui</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: KONFIRMASI PENOLAKAN */}
      {rejectItem && (
        <div className="modal-backdrop" onClick={() => !actionBusy && setRejectItem(null)}>
          <form
            className="modal-card approval-confirm-modal"
            onSubmit={handleReject}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-wrap reject">
              <UserX size={32} />
            </div>

            <div className="confirm-modal-body">
              <h3>Tolak Pengajuan Akun?</h3>
              <p>
                Pengajuan akses Owner untuk pemohon ini akan ditolak. Pemohon tidak akan dapat login ke portal keuangan.
              </p>

              {actionError && (
                <div className="error-box" style={{ marginBottom: '12px' }}>
                  <AlertCircle size={15} />
                  <span>{actionError}</span>
                </div>
              )}

              <div className="confirm-target-card">
                <div className="target-row">
                  <span>Nama Pemohon:</span>
                  <strong>{rejectItem.full_name}</strong>
                </div>
                <div className="target-row">
                  <span>Alamat Email:</span>
                  <strong>{rejectItem.email}</strong>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px', textAlign: 'left' }}>
                <label htmlFor="reject-reason" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                  Alasan Penolakan <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Tuliskan alasan penolakan secara jelas (wajib diisi)..."
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Alasan ini akan dicatat dalam riwayat audit dan dapat dilihat oleh pemohon pada halaman cek status.
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setRejectItem(null)}
                disabled={actionBusy}
              >
                Batalkan
              </button>
              <button
                type="submit"
                className="primary-btn reject-confirm-btn"
                disabled={actionBusy || !rejectReason.trim()}
              >
                {actionBusy ? (
                  <>
                    <div className="spinner small" />
                    <span>Menolak...</span>
                  </>
                ) : (
                  <>
                    <UserX size={16} />
                    <span>Konfirmasi Penolakan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

