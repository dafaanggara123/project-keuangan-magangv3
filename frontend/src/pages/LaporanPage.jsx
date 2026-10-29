import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  Receipt
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import api, { getExpensesCached } from '../services/api';
import { formatDateTime, money } from '../utils/formatters';
import { generateCorporateFinancialPdf } from '../utils/generateFinancialReportPdf';
import {
  ChannelBadge,
  ErrorState,
  LoadingPage,
  PageHeader,
  RangeSelect,
  useRange,
  buildRangeParams,
  getRangeLabel
} from '../components/CommonUI';
import { OrderDetailModal } from './PenjualanPage';

/* =========================================================
   6. REPORTS COMPONENT (LAPORAN EKSEKUTIF)
   ========================================================= */
export default function LaporanPage() {
  const [range, setRange] = useRange('this_month');
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

    const params = buildRangeParams(range);

    Promise.all([
      api.get('/dashboard', { params }),
      api.get('/analytics', { params }),
      api.get('/sales', { params })
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
        ['Periode:', getRangeLabel(range)],
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
      // Ambil data pengeluaran aktual yang terfilter sesuai range agar sinkron dengan tabel operasional
      let currentExpenses = [];
      try {
        const rawExpenses = await getExpensesCached({ params: buildRangeParams(range) });
        currentExpenses = (rawExpenses || []).map((exp) => ({
          id: exp.id,
          categoryName: exp.categoryName || exp.category || exp.expense_categories?.name || 'Operasional',
          amount: Number(exp.amount || 0),
          expenseDate: exp.expenseDate || exp.spent_at || exp.expense_date || exp.created_at || null,
          note: exp.note || exp.title || exp.notes || exp.description || 'Pengeluaran'
        }));
      } catch (err) {
        console.warn('Gagal memuat detail pengeluaran untuk PDF, menggunakan data ringkasan:', err);
      }

      await generateCorporateFinancialPdf({
        range,
        rangeLabel: getRangeLabel(range),
        summary,
        salesRows: rows,
        analytics,
        expenses: currentExpenses,
        businessSettings: {
          businessName: dash?.settings?.businessName || 'Dapoersari Restoran & Catering',
          shopeefoodPlatformRate: dash?.settings?.shopeefoodPlatformRate || 25
        }
      });
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
              <span>Dapoersari Food & Beverages • Periode: {getRangeLabel(range)}</span>
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
