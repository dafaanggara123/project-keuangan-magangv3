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
import api from '../services/api';
import { formatDateTime, money } from '../utils/formatters';
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
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable')
    ]);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. TOP OFFICIAL HEADER BAND (NAVY + INDIGO ACCENT)
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFillColor(79, 70, 229); // #4f46e5 (Indigo Accent Line)
    doc.rect(0, 28, pageWidth, 2, 'F');

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('DAPOERSARI RESTORAN & CATERING', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(165, 180, 252);
    doc.text('PORTAL KEUANGAN EKSEKUTIF • SISTEM LAPORAN RESMI', 14, 18);

    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    const docRef = `REF: DPR/FIN/${new Date().getFullYear()}/${range.toUpperCase()}-${Date.now().toString().slice(-4)}`;
    doc.text(docRef, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - 14, 18, { align: 'right' });

    // 2. DOCUMENT TITLE & METADATA CARD
    let currentY = 38;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LAPORAN RESMI KINERJA KEUANGAN & OPERASIONAL', 14, currentY);

    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Rekapitulasi berkala penjualan, pengeluaran operasional, dan laba bersih.', 14, currentY);

    currentY += 5;

    // Metadata box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, currentY, pageWidth - 28, 17, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('PERIODE EVALUASI', 18, currentY + 5.5);
    doc.text('STATUS DOKUMEN', 72, currentY + 5.5);
    doc.text('PENANGGUNG JAWAB', 125, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const rangeLabel = getRangeLabel(range);
    doc.text(rangeLabel, 18, currentY + 11.5);

    doc.setTextColor(5, 150, 105);
    doc.text('SAH & TERVERIFIKASI SISTEM', 72, currentY + 11.5);

    doc.setTextColor(15, 23, 42);
    doc.text('Linda Kumalasari (Executive Owner)', 125, currentY + 11.5);

    currentY += 23;

    // 3. TABEL 1: LAPORAN LABA & RUGI (INCOME STATEMENT)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('I. LAPORAN LABA & RUGI (INCOME STATEMENT)', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['No', 'Komponen Finansial', 'Keterangan Analisis', 'Jumlah (IDR)']],
      body: [
        ['1', 'Pendapatan Penjualan Kotor (Gross)', 'Total transaksi seluruh channel sebelum penyesuaian channel', money(grossSales)],
        ['2', 'Pendapatan Penjualan Bersih (Net)', 'Penjualan akhir setelah penyesuaian channel', money(netSales)],
        ['3', 'Pengeluaran Operasional Usaha (OpEx)', 'Belanja bahan baku dapur, utilitas & logistik', `- ${money(expenseTotal)}`],
        ['4', 'LABA BERSIH USAHA (NET PROFIT)', `Margin Keuntungan Bersih: ${profitMargin.toFixed(1)}%`, money(netProfit)],
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70, fontStyle: 'bold' },
        2: { cellWidth: 62 },
        3: { cellWidth: pageWidth - 28 - 142, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = [236, 253, 245];
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.row.index === 2) {
          if (data.column.index === 3) {
            data.cell.styles.textColor = [225, 29, 72];
          }
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    // 4. TABEL 2: RINGKASAN PENJUALAN BERSIH PER CHANNEL
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('II. RINGKASAN PENJUALAN BERSIH PER CHANNEL', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Channel Penjualan', 'Penjualan Bersih (IDR)', 'Kontribusi']],
      body: channelReport.map((item) => [
        item.label,
        money(item.amount),
        `${channelShare(item.amount).toFixed(1)}%`
      ]),
      foot: [['TOTAL PENJUALAN BERSIH', money(channelNetTotal), '100.0%']],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3.2,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [4, 120, 87],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 82, fontStyle: 'bold' },
        1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: pageWidth - 28 - 144, halign: 'right' }
      }
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // 5. TABEL 3: INDIKATOR OPERASIONAL & PRODUK UNGGULAN
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('II. INDIKATOR OPERASIONAL & MENU TERLARIS', 14, currentY);

    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [['Metrik Operasional', 'Hasil Evaluasi', 'Catatan Evaluasi Bisnis']],
      body: [
        ['Total Transaksi Selesai', `${transactionCount} Transaksi`, 'Seluruh pesanan selesai & lunas tercatat di buku kas'],
        ['Rata-rata Nilai Pesanan (AOV)', money(averageTransaction), 'Rata-rata pembelanjaan pelanggan per pesanan'],
        ['Menu Terlaris (#1 Top Seller)', bestProductName, `${bestProduct ? Number(bestProduct.quantity || 0) : 0} porsi terjual pada periode ini`],
        ['Margin Laba Bersih', `${profitMargin.toFixed(1)}%`, 'Rasio laba bersih terhadap omzet kotor keseluruhan'],
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: pageWidth - 28 - 100 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 12;

    // 6. SIGNATURE & OFFICIAL VALIDATION BLOCK
    const signY = Math.min(currentY, pageHeight - 44);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Dibuat Oleh:', 24, signY);
    doc.text('Disetujui & Disahkan Oleh:', pageWidth - 68, signY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Sistem Finansial Dapoersari', 24, signY + 16);
    doc.text('Linda Kumalasari', pageWidth - 68, signY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Sistem Otomatis Terenkripsi', 24, signY + 20);
    doc.text('Executive Owner', pageWidth - 68, signY + 20);

    // 7. OFFICIAL FOOTER
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 9, pageWidth, 9, 'F');

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('DOKUMEN INI RAHASIA & SAH SECARA HUKUM • DAPOERSARI ENTERPRISE SUITE', 14, pageHeight - 3.5);
    doc.text('Halaman 1', pageWidth - 14, pageHeight - 3.5, { align: 'right' });

    doc.save(`laporan-resmi-dapoersari-${range}.pdf`);
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
