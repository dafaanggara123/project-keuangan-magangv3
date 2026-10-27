import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Filter,
  Receipt,
  Search,
  ShoppingBag,
  X
} from 'lucide-react';
import api from '../services/api';
import { formatDateTime, money } from '../utils/formatters';
import CustomDropdown from '../components/CustomDropdown';
import {
  ChannelBadge,
  ErrorState,
  LoadingPage,
  PageHeader,
  RangeSelect,
  useRange
} from '../components/CommonUI';

/* =========================================================
   3. SALES COMPONENT (PENJUALAN)
   ========================================================= */
const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Semua Channel' },
  { value: 'website', label: 'Website Online' },
  { value: 'offline', label: 'Offline POS' },
  { value: 'shopeefood', label: 'ShopeeFood' }
];

export default function PenjualanPage() {
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

          <CustomDropdown
            id="sales-channel-filter"
            label="Filter channel penjualan"
            icon={Filter}
            value={channelFilter}
            options={CHANNEL_OPTIONS}
            onChange={setChannelFilter}
            className="sales-filter-dropdown"
          />

          <div className="sales-filter-dropdown-wrap">
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
            <div
              key={`mobile-${row.orderCode}-${row.orderedAt}`}
              className="sales-mobile-card"
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

                <button
                  type="button"
                  className="table-action-btn mobile-detail-btn"
                  onClick={() => openOrderDetail(row)}
                >
                  <span>Detail</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
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
          overflow: visible;
          position: relative;
          z-index: 20;
        }

        .sales-filter-dropdown-wrap {
          min-width: 0;
          width: 100%;
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
export function OrderDetailModal({ order, loading, onClose }) {
  const [copied, setCopied] = useState(false);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div
        className="order-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* STICKY HEADER */}
        <div className="order-detail-header-sticky">
          <div>
            <span className="order-detail-eyebrow">RINCIAN INVOICE PESANAN</span>
            <div className="order-code-title-row">
              <h3 id="invoice-modal-title">{order?.order_code || '-'}</h3>
              <button
                type="button"
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={copyOrderCode}
                title="Salin nomor invoice"
                aria-label="Salin nomor invoice ke clipboard"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            className="ghost-icon"
            onClick={onClose}
            aria-label="Tutup modal invoice"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="order-detail-body-scrollable">
          {/* ORDER INFO TILES */}
          <div className="order-detail-info">
            <div>
              <span className="info-label">Waktu Pemesanan</span>
              <strong className="info-val">{formatDateTime(order?.ordered_at)}</strong>
            </div>
            <div>
              <span className="info-label">Channel Penjualan</span>
              <div style={{ marginTop: '2px' }}>
                <ChannelBadge channel={channel} />
              </div>
            </div>
            <div>
              <span className="info-label">Status Transaksi</span>
              <div style={{ marginTop: '2px' }}>
                <span className="status-badge done">
                  <CheckCircle2 size={12} />
                  <span>Selesai & Lunas</span>
                </span>
              </div>
            </div>
            <div>
              <span className="info-label">Metode Pembayaran</span>
              <strong className="info-val">{(order?.payment_method || 'CASH').toUpperCase()}</strong>
            </div>
          </div>

          {/* ORDER ITEMS LIST */}
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

              {items.length === 0 && (
                <div className="empty-cell" style={{ padding: '16px', textAlign: 'center' }}>
                  Rincian item menu tidak tercatat.
                </div>
              )}
            </div>
          </div>

          {/* FINAL SETTLEMENT SUMMARY */}
          <div className="order-total-card">
            <div className="total-row net">
              <span>Penjualan Bersih</span>
              <strong>{money(netSales)}</strong>
            </div>
          </div>
        </div>

        {/* STICKY FOOTER ACTION */}
        <div className="order-detail-footer-sticky">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

