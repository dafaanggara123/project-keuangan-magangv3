/**
 * GENERATOR LAPORAN KEUANGAN PDF — MODERN CORPORATE EXECUTIVE REPORTING
 * Dapoersari Restoran & Catering
 *
 * Standar Visual: Modern Corporate Executive (A4 Portrait)
 * Palet Warna Resmi:
 * - Deep Navy:   #111827  [17, 24, 39]
 * - Charcoal:    #292D32  [41, 45, 50]
 * - White:       #FFFFFF  [255, 255, 255]
 * - Soft Gray:   #F3F5F7  [243, 245, 247]
 * - Border Gray: #DCE2E8  [220, 226, 232]
 * - Forest Green:#28734D  [40, 115, 77]
 * - Muted Red:   #B54747  [181, 71, 71]
 */

import { DAPOERSARI_LOGO_BASE64 } from './logoBase64.js';

// Helper format mata uang Rupiah
function formatIDR(amount) {
  const val = Number(amount || 0);
  return 'Rp ' + Math.round(val).toLocaleString('id-ID');
}

// Helper format angka & persentase
function formatPercent(val) {
  const num = Number(val || 0);
  return `${num.toFixed(1)}%`;
}

export async function generateCorporateFinancialPdf({
  range = 'this_month',
  rangeLabel = 'Bulan Ini',
  summary = {},
  salesRows = [],
  analytics = {},
  expenses = [],
  businessSettings = {}
}) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const autoTable = autoTableMod.default || autoTableMod;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182 mm

  // Palet Warna Resmi
  const C_NAVY = [17, 24, 39];       // #111827
  const C_CHARCOAL = [41, 45, 50];   // #292D32
  const C_WHITE = [255, 255, 255];   // #FFFFFF
  const C_SOFT_GRAY = [243, 245, 247]; // #F3F5F7
  const C_BORDER = [220, 226, 232];  // #DCE2E8
  const C_GREEN = [40, 115, 77];     // #28734D
  const C_RED = [181, 71, 71];       // #B54747
  const C_MUTED = [100, 116, 139];   // #64748B (Secondary text)
  const C_LIGHT_GREEN = [236, 248, 241];
  const C_LIGHT_RED = [254, 242, 242];

  // Kalkulasi & Normalisasi Data Keuangan
  const grossSales = Number(summary.grossSales || 0);
  const platformDeduction = Number(summary.platformDeduction || 0);
  const netSales = Number(summary.netSales ?? (grossSales - platformDeduction));
  const expenseTotal = Number(summary.expenseTotal || 0);
  const netProfit = Number(summary.netProfit ?? (netSales - expenseTotal));
  const transactionCount = Number(summary.transactionCount ?? salesRows.length ?? 0);
  
  // AOV berbasis Penjualan Bersih (net revenue per order) dan Penjualan Kotor
  const averageTransaction = transactionCount > 0 ? netSales / transactionCount : 0;
  // Margin Laba dihitung konsisten terhadap Penjualan Bersih
  const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

  // Breakdown Channel Penjualan
  const channelSummary = summary.channel || {};
  const channelReport = [
    { key: 'website', label: 'Website Online', amount: Number(channelSummary.website || 0) },
    { key: 'offline', label: 'Offline POS Kasir', amount: Number(channelSummary.offline || 0) },
    { key: 'shopeefood', label: 'ShopeeFood (Net)', amount: Number(channelSummary.shopeefood || 0) }
  ];
  const channelNetTotal = channelReport.reduce((sum, item) => sum + item.amount, 0);

  // Top Products dari Analytics
  const products = Array.isArray(analytics?.products) ? analytics.products : [];
  const sortedProducts = [...products].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
  const bestProduct = sortedProducts[0] || null;

  // Nama Bisnis dari Settings
  const businessName = businessSettings.businessName || 'Dapoersari';
  const platformRate = Number(businessSettings.shopeefoodPlatformRate || 25);

  // Generate Reference Number
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const docRef = `DPR-FIN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${range.toUpperCase()}`;

  // Helper untuk menambahkan Running Header pada Halaman Lanjutan (Page >= 2)
  function renderSubPageHeader(sectionTitle) {
    doc.setFillColor(...C_WHITE);
    doc.rect(0, 0, pageWidth, 22, 'F');

    // Brand mark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_NAVY);
    doc.text(businessName.toUpperCase(), marginX, 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_MUTED);
    doc.text(`|  ${sectionTitle}`, marginX + 32, 11);

    // Ref & Periode di kanan
    doc.setFontSize(7);
    doc.text(`Ref: ${docRef}  •  Periode: ${rangeLabel}`, pageWidth - marginX, 11, { align: 'right' });

    // Garis pembatas halus
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.35);
    doc.line(marginX, 15, pageWidth - marginX, 15);
  }

  // =========================================================================
  // HALAMAN 1: RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
  // =========================================================================

  // A. Header Laporan Utama
  let currentY = 14;

  // Logo Dapoersari
  if (DAPOERSARI_LOGO_BASE64) {
    try {
      doc.addImage(DAPOERSARI_LOGO_BASE64, 'PNG', marginX, currentY, 15, 15);
    } catch (e) {
      console.warn('Gagal render logo pada PDF:', e);
    }
  }

  const headerTextX = DAPOERSARI_LOGO_BASE64 ? marginX + 18 : marginX;

  // Nama Perusahaan & Badge Kategori
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_NAVY);
  doc.text(businessName.toUpperCase(), headerTextX, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('PORTAL KEUANGAN EKSEKUTIF', headerTextX, currentY + 9.5);

  // Metadata di sisi kanan header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Nomor Referensi', pageWidth - marginX, currentY + 2.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C_NAVY);
  doc.text(docRef, pageWidth - marginX, currentY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C_MUTED);
  doc.text(`Dibuat: ${dateStr}, ${timeStr} WIB`, pageWidth - marginX, currentY + 11.5, { align: 'right' });

  currentY += 19;

  // Garis pemisah header
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 6;

  // Judul Laporan & Subjudul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C_NAVY);
  doc.text('Laporan Kinerja Keuangan & Operasional', marginX, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C_MUTED);
  doc.text(`Periode Evaluasi: ${rangeLabel}   •   Klasifikasi: Dokumen Finansial Internal`, marginX, currentY);

  currentY += 6;

  // B. 4 Kartu KPI Eksekutif (Grid 4 Kolom Rapi)
  const cardGap = 3.5;
  const numCards = 4;
  const cardWidth = (contentWidth - cardGap * (numCards - 1)) / numCards; // ~42.8 mm
  const cardHeight = 19;

  const kpis = [
    { label: 'PENJUALAN KOTOR', value: formatIDR(grossSales), sub: 'Omzet sebelum biaya', isHighlight: false, color: C_NAVY },
    { label: 'PENJUALAN BERSIH', value: formatIDR(netSales), sub: 'Setelah fee platform', isHighlight: false, color: C_NAVY },
    { label: 'PENGELUARAN', value: formatIDR(expenseTotal), sub: 'Beban operasional', isHighlight: false, color: C_RED },
    { 
      label: 'LABA BERSIH USAHA', 
      value: formatIDR(netProfit), 
      sub: `Margin: ${formatPercent(profitMargin)}`, 
      isHighlight: true, 
      color: netProfit >= 0 ? C_GREEN : C_RED 
    }
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = marginX + idx * (cardWidth + cardGap);
    
    // Background kartu
    if (kpi.isHighlight) {
      doc.setFillColor(...(netProfit >= 0 ? C_LIGHT_GREEN : C_LIGHT_RED));
      doc.setDrawColor(...(netProfit >= 0 ? C_GREEN : C_RED));
    } else {
      doc.setFillColor(...C_SOFT_GRAY);
      doc.setDrawColor(...C_BORDER);
    }
    doc.setLineWidth(0.35);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Label KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    doc.text(kpi.label, cardX + 3.5, currentY + 5);

    // Nilai KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, cardX + 3.5, currentY + 11.5);

    // Keterangan / Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    doc.text(kpi.sub, cardX + 3.5, currentY + 16);
  });

  currentY += cardHeight + 8;

  // C. Ringkasan Laba Rugi (Ringkas)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  doc.text('I. RINGKASAN LAPORAN LABA & RUGI', marginX, currentY);

  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Komponen Finansial', 'Dasar Perhitungan / Keterangan', 'Jumlah (IDR)']],
    body: [
      ['Pendapatan Penjualan Kotor (Gross)', 'Total seluruh transaksi pesanan kasir POS dan online', formatIDR(grossSales)],
      ['Penyesuaian Biaya Platform (ShopeeFood)', `Potongan komisi mitra agregator (${platformRate}%)`, `- ${formatIDR(platformDeduction)}`],
      ['Pendapatan Penjualan Bersih (Net)', 'Dasar acuan pendapatan riil yang diterima bisnis', formatIDR(netSales)],
      ['Beban Pengeluaran Operasional (OpEx)', 'Total belanja bahan baku, utilitas, listrik & logistik', `- ${formatIDR(expenseTotal)}`],
      ['LABA BERSIH USAHA (NET PROFIT)', `Rasio laba bersih: ${formatPercent(profitMargin)} dari Penjualan Bersih`, formatIDR(netProfit)]
    ],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.8,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 68 },
      2: { cellWidth: contentWidth - 138, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        // Baris Laba Bersih (Row 4)
        if (data.row.index === 4) {
          data.cell.styles.fillColor = netProfit >= 0 ? C_LIGHT_GREEN : C_LIGHT_RED;
          data.cell.styles.textColor = netProfit >= 0 ? C_GREEN : C_RED;
          data.cell.styles.fontStyle = 'bold';
        }
        // Baris Pengeluaran / Potongan
        if (data.row.index === 1 || data.row.index === 3) {
          if (data.column.index === 2) {
            data.cell.styles.textColor = C_RED;
          }
        }
      }
    }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // D. Distribusi Penjualan per Kanal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  doc.text('II. DISTRIBUSI PENJUALAN PER KANAL (CHANNEL)', marginX, currentY);

  currentY += 2.5;

  const channelTableBody = channelReport.map(item => {
    const share = channelNetTotal > 0 ? (item.amount / channelNetTotal) * 100 : 0;
    return [
      item.label,
      formatIDR(item.amount),
      formatPercent(share)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Kanal Penjualan', 'Penjualan Bersih (IDR)', 'Kontribusi (%)']],
    body: channelTableBody,
    foot: [['TOTAL PENJUALAN BERSIH', formatIDR(channelNetTotal), '100.0%']],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.8,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 8
    },
    footStyles: {
      fillColor: C_SOFT_GRAY,
      textColor: C_NAVY,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    columnStyles: {
      0: { cellWidth: 85, fontStyle: 'bold' },
      1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: contentWidth - 140, halign: 'right' }
    }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // Catatan Ringkasan & Sign-off Netral
  doc.setFillColor(...C_SOFT_GRAY);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_NAVY);
  doc.text('CATATAN EKSEKUTIF & PENGESAHAN DOKUMEN', marginX + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C_MUTED);
  doc.text(
    `Dokumen laporan ini dihasilkan secara otomatis oleh Sistem Finansial ${businessName} untuk keperluan evaluasi internal.`,
    marginX + 4,
    currentY + 9.5
  );
  doc.text(
    `Perhitungan margin didasarkan pada rasio Laba Bersih terhadap Penjualan Bersih. Seluruh angka bersumber langsung dari pembukuan kas.`,
    marginX + 4,
    currentY + 14
  );

  // =========================================================================
  // HALAMAN 2: DETAIL KEUANGAN & REKAP PENJUALAN
  // =========================================================================
  doc.addPage();
  renderSubPageHeader('Detail Keuangan & Transaksi Penjualan');

  currentY = 24;

  // Judul Bagian III
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_NAVY);
  doc.text('III. INDIKATOR TRANSAKSI & PENJUALAN', marginX, currentY);

  currentY += 4;

  // Metrik Transaksi
  const metricCards = [
    { label: 'TOTAL TRANSAKSI', val: `${transactionCount} Pesanan`, note: 'Pesanan lunas tercatat' },
    { label: 'RATA-RATA NILAI PESANAN (AOV)', val: formatIDR(averageTransaction), note: 'Penjualan bersih / pesanan' },
    { label: 'PRODUK TERLARIS (#1)', val: bestProduct?.name || 'Belum ada data', note: `${bestProduct ? Number(bestProduct.quantity || 0) : 0} porsi terjual` }
  ];
  const mCardWidth = (contentWidth - 2 * 4) / 3;
  const mCardHeight = 17;

  metricCards.forEach((card, i) => {
    const cX = marginX + i * (mCardWidth + 4);
    doc.setFillColor(...C_SOFT_GRAY);
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cX, currentY, mCardWidth, mCardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    doc.text(card.label, cX + 3.5, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C_NAVY);
    doc.text(card.val, cX + 3.5, currentY + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C_MUTED);
    doc.text(card.note, cX + 3.5, currentY + 14.5);
  });

  currentY += mCardHeight + 8;

  // Daftar Transaksi Selesai
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  doc.text('DAFTAR TRANSAKSI PENJUALAN (SAMPEL PERIODE)', marginX, currentY);

  currentY += 2.5;

  const sampleRows = salesRows.slice(0, 20); // Maksimal 20 transaksi representatif agar rapi
  const salesTableBody = sampleRows.map((r, i) => {
    let orderTime = '-';
    if (r.orderedAt) {
      const dt = new Date(r.orderedAt);
      orderTime = dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    const channelName = r.channel === 'shopeefood' ? 'ShopeeFood' : r.channel === 'offline' ? 'Offline POS' : 'Website';
    return [
      String(i + 1),
      r.orderCode || `#ORD-${r.id || '-'}`,
      orderTime,
      channelName,
      'Lunas',
      formatIDR(r.total)
    ];
  });

  if (salesTableBody.length === 0) {
    salesTableBody.push(['-', 'Tidak ada transaksi', '-', '-', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Kode Pesanan', 'Waktu Transaksi', 'Kanal', 'Status', 'Nominal (IDR)']],
    body: salesTableBody,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 7.8
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 42 },
      3: { cellWidth: 32 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: contentWidth - 144, halign: 'right', fontStyle: 'bold' }
    }
  });

  // =========================================================================
  // HALAMAN 3: PENGELUARAN OPERASIONAL (OPEX)
  // =========================================================================
  doc.addPage();
  renderSubPageHeader('Rincian Pengeluaran Operasional (OpEx)');

  currentY = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_NAVY);
  doc.text('IV. BEBAN PENGELUARAN OPERASIONAL USAHA', marginX, currentY);

  currentY += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Rekapitulasi beban belanja bahan baku, utilitas dapur, dan pemeliharaan alat.', marginX, currentY + 3);

  currentY += 6;

  // Agregasi Pengeluaran per Kategori
  const categoryMap = new Map();
  expenses.forEach(exp => {
    const cat = exp.categoryName || exp.category || 'Operasional Lainnya';
    const cur = categoryMap.get(cat) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(exp.amount || 0);
    categoryMap.set(cat, cur);
  });

  const categoryRows = Array.from(categoryMap.entries()).map(([cat, data]) => {
    const share = expenseTotal > 0 ? (data.amount / expenseTotal) * 100 : 0;
    return [
      cat,
      `${data.count} Transaksi`,
      formatPercent(share),
      formatIDR(data.amount)
    ];
  });

  if (categoryRows.length === 0) {
    categoryRows.push(['Belum ada catatan pengeluaran', '-', '0.0%', 'Rp 0']);
  }

  // Tabel Rekap Kategori Pengeluaran
  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['Kategori Pengeluaran', 'Frekuensi', 'Porsi Biaya', 'Total Biaya (IDR)']],
    body: categoryRows,
    foot: [['TOTAL PENGELUARAN OPERASIONAL', `${expenses.length} Transaksi`, '100.0%', formatIDR(expenseTotal)]],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 7.8
    },
    footStyles: {
      fillColor: C_SOFT_GRAY,
      textColor: C_RED,
      fontStyle: 'bold',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 27, halign: 'right' },
      3: { cellWidth: contentWidth - 132, halign: 'right', fontStyle: 'bold' }
    }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Rincian Transaksi Pengeluaran Terbaru
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...C_NAVY);
  doc.text('CATATAN PENGELUARAN (SAMPEL PERIODE)', marginX, currentY);

  currentY += 2.5;

  const expenseSampleRows = expenses.slice(0, 15).map((exp, idx) => {
    let expDate = '-';
    if (exp.expenseDate) {
      const dt = new Date(exp.expenseDate);
      expDate = dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return [
      String(idx + 1),
      expDate,
      exp.categoryName || exp.category || 'Operasional',
      exp.note || exp.description || '-',
      formatIDR(exp.amount)
    ];
  });

  if (expenseSampleRows.length === 0) {
    expenseSampleRows.push(['-', '-', 'Belum ada data', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Tanggal', 'Kategori', 'Keterangan Transaksi', 'Jumlah (IDR)']],
    body: expenseSampleRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      cellPadding: 2.2,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 7.8
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 46 },
      3: { cellWidth: 60 },
      4: { cellWidth: contentWidth - 142, halign: 'right', fontStyle: 'bold' }
    }
  });

  // =========================================================================
  // HALAMAN 4: ANALITIK MENU & PENGESAHAN DOKUMEN
  // =========================================================================
  doc.addPage();
  renderSubPageHeader('Analitik Menu & Pengesahan Dokumen');

  currentY = 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...C_NAVY);
  doc.text('V. KINERJA PENJUALAN PRODUK / MENU TERLARIS', marginX, currentY);

  currentY += 3;

  const topProducts = sortedProducts.slice(0, 10);
  const productRows = topProducts.map((p, idx) => {
    return [
      String(idx + 1),
      p.name || `Menu #${p.menuId}`,
      `${Number(p.quantity || 0)} Porsi`,
      formatIDR(p.revenue)
    ];
  });

  if (productRows.length === 0) {
    productRows.push(['-', 'Belum ada data penjualan menu pada periode ini', '-', 'Rp 0']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Nama Menu / Produk', 'Volume Terjual', 'Estimasi Omzet (IDR)']],
    body: productRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: C_CHARCOAL,
      lineColor: C_BORDER,
      lineWidth: 0.25
    },
    headStyles: {
      fillColor: C_NAVY,
      textColor: C_WHITE,
      fontStyle: 'bold',
      fontSize: 7.8
    },
    alternateRowStyles: {
      fillColor: C_SOFT_GRAY
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 80, fontStyle: 'bold' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: contentWidth - 125, halign: 'right', fontStyle: 'bold' }
    }
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // Catatan Metodologi & Kebijakan Dokumen
  doc.setFillColor(...C_SOFT_GRAY);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, currentY, contentWidth, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_NAVY);
  doc.text('METODOLOGI & DASAR PERHITUNGAN KEUANGAN', marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...C_MUTED);
  doc.text(
    `1. Penjualan Kotor (Gross Sales) mencakup total transaksi kotor sebelum pemotongan fee mitra agregator ShopeeFood.`,
    marginX + 4,
    currentY + 10
  );
  doc.text(
    `2. Penjualan Bersih (Net Sales) merupakan basis pendapatan resmi setelah dikurangi biaya fee platform sebesar ${platformRate}%.`,
    marginX + 4,
    currentY + 14
  );
  doc.text(
    `3. Laba Bersih Usaha = Penjualan Bersih - Beban Pengeluaran Operasional (OpEx). Seluruh data disinkronisasi dari database kas.`,
    marginX + 4,
    currentY + 18
  );

  currentY += 32;

  // Lembar Pengesahan Netral & Profesional (Tanpa klaim palsu)
  const signBoxWidth = (contentWidth - 20) / 2;
  const signLeftX = marginX + 5;
  const signRightX = marginX + signBoxWidth + 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C_MUTED);
  doc.text('Disusun Secara Sistematis Oleh:', signLeftX, currentY);
  doc.text('Ditinjau & Diterima Oleh:', signRightX, currentY);

  currentY += 18;

  // Garis tanda tangan halus
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.35);
  doc.line(signLeftX, currentY, signLeftX + 55, currentY);
  doc.line(signRightX, currentY, signRightX + 55, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C_NAVY);
  doc.text('Sistem Finansial Dapoersari', signLeftX, currentY);
  doc.text('Manajemen Dapoersari', signRightX, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C_MUTED);
  doc.text('Laporan Komputerisasi Otomatis', signLeftX, currentY);
  doc.text('Executive Owner', signRightX, currentY);

  // =========================================================================
  // STANDAR FOOTER RESMI DI SEMUA HALAMAN (Halaman X dari Y)
  // =========================================================================
  const totalPages = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Garis pemisah footer
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);

    // Teks Footer Kiri: Nama Dokumen & Status Kerahasiaan Netral
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...C_MUTED);
    doc.text(
      `Dapoersari Financial Report  •  Ref: ${docRef}  •  Dokumen Internal`,
      marginX,
      pageHeight - 6.5
    );

    // Teks Footer Kanan: Nomor Halaman
    doc.text(
      `Halaman ${i} dari ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  // Simpan / Unduh Dokumen PDF
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    doc.save(`laporan-keuangan-dapoersari-${range}.pdf`);
  }
  return doc;
}
