import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Plus,
  Target,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../services/api';
import { channelLabel, dateLabel, money, shortMoney } from '../utils/formatters';
import {
  ErrorState,
  LoadingPage,
  Metric,
  PageHeader,
  Panel,
  RangeSelect,
  useRange
} from '../components/CommonUI';

/* =========================================================
   2. DASHBOARD COMPONENT
   ========================================================= */
export default function Dashboard({ greeting, ownerName, profile, pendingApprovalsCount }) {
  const [range, setRange] = useRange('30d');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setError('');
    api
      .get('/dashboard', { params: { range } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.data?.error || 'Gagal memuat ringkasan dashboard.'));
  }, [range]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingPage />;

  const s = data.summary || {};
  const grossSales = Number(s.grossSales || 0);
  const netSales = Number(s.netSales || 0);
  const expenseTotal = Number(s.expenseTotal || 0);
  const netProfit = Number(s.netProfit || 0);
  const transactionCount = Number(s.transactionCount || 0);
  const marginPercent = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(1) : '0.0';

  const channelData = s.channel || {};
  const channelTotalSum = Object.values(channelData).reduce((a, b) => a + Number(b || 0), 0) || 1;

  const pendingApprovals = Number(pendingApprovalsCount || 0);

  return (
    <>
      {/* APPROVAL ALERT BANNER FOR OWNER 1 */}
      {profile?.is_approver && pendingApprovals > 0 && (
        <section className="dashboard-approval-banner">
          <div className="approval-banner-icon">
            <ClipboardCheck size={20} />
          </div>
          <div className="approval-banner-info">
            <strong>
              <span className="banner-title-full">Ada {pendingApprovals} pengajuan akun yang menunggu persetujuan</span>
              <span className="banner-title-mobile">{pendingApprovals} pengajuan menunggu persetujuan</span>
            </strong>
            <p>Permohonan akses Owner baru memerlukan tinjauan dan keputusan persetujuan dari Anda.</p>
          </div>
          <button
            type="button"
            className="approval-banner-btn"
            onClick={() => navigate('/persetujuan-akun')}
          >
            <span>Tinjau Pengajuan</span>
            <ArrowUpRight size={15} />
          </button>
        </section>
      )}

      {/* EXECUTIVE GREETING BANNER */}
      <section className="dashboard-greeting">
        <div className="dashboard-greeting-main">
          <div className="dashboard-greeting-label">
            <span className="greeting-time">{greeting}</span>
            <span className="greeting-divider">•</span>
            <span className="greeting-status">Portal Eksekutif Aktif</span>
          </div>
          <h2>{ownerName}</h2>
          <p>Berikut adalah ringkasan kinerja penjualan, alokasi biaya, dan profitabilitas Dapoersari untuk periode terpilih.</p>
        </div>
        <div className="dashboard-greeting-actions">
          <button type="button" className="greeting-btn secondary" onClick={() => navigate('/laporan')}>
            <FileText size={15} />
            <span>Buka Laporan</span>
          </button>
          <button type="button" className="greeting-btn primary" onClick={() => navigate('/pengeluaran')}>
            <Plus size={15} />
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </section>

      {/* PAGE HEADER & RANGE FILTER */}
      <PageHeader
        eyebrow="IKHTISAR KEUANGAN"
        title="Ringkasan Kinerja Bisnis"
        subtitle="Analisis real-time omzet kotor, penjualan bersih, pengeluaran operasional, dan laba bersih."
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      {/* METRICS GRID */}
      <div className="metric-grid">
        <Metric
          label="Penjualan Kotor (Gross)"
          value={shortMoney(grossSales)}
          sub={`${transactionCount} transaksi berhasil`}
          icon={<CircleDollarSign size={20} />}
          positive={true}
        />
        <Metric
          label="Penjualan Bersih (Net Sales)"
          value={shortMoney(netSales)}
          sub="Nilai bersih seluruh channel"
          icon={<TrendingUp size={20} />}
          positive={true}
        />
        <Metric
          label="Pengeluaran Operasional"
          value={shortMoney(expenseTotal)}
          sub={`${data.expenseCount || 0} pos pengeluaran tercatat`}
          icon={<WalletCards size={20} />}
          positive={false}
        />
        <Metric
          label="Laba Bersih (Net Profit)"
          value={shortMoney(netProfit)}
          sub={`${marginPercent}% margin profitabilitas`}
          icon={<Target size={20} />}
          status={netProfit > 0 ? 'positive' : netProfit < 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* CHARTS & CHANNEL BREAKDOWN */}
      <div className="two-col-grid">
        <Panel
          title="Tren Arus Pendapatan"
          hint={`Fluktuasi penjualan harian (${range === 'today' ? 'Hari ini' : range})`}
          action={
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-dot gross" />
                <span>Penjualan</span>
              </span>
            </div>
          }
        >
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend || []} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="salesForestGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2d5a3c" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2d5a3c" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={dateLabel}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  fontSize={11}
                  stroke="#64748b"
                  dy={4}
                />
                <YAxis
                  tickFormatter={shortMoney}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="#64748b"
                  dx={-2}
                />
                <Tooltip
                  formatter={(v) => [money(v), 'Total Penjualan']}
                  labelFormatter={(l) => {
                    const d = new Date(l);
                    return isNaN(d.getTime())
                      ? l
                      : d.toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        });
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.94)',
                    backdropFilter: 'blur(8px)',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    color: '#ffffff',
                    padding: '10px 14px',
                    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.28)'
                  }}
                  itemStyle={{ color: '#86efac', fontWeight: 700, fontSize: '13px' }}
                  labelStyle={{ color: '#cbd5e1', fontSize: '11.5px', fontWeight: 600, marginBottom: '6px' }}
                  cursor={{ stroke: '#2d5a3c', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#2d5a3c"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#salesForestGradient)"
                  isAnimationActive={false}
                  dot={{ r: 3.5, fill: '#ffffff', stroke: '#2d5a3c', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#2d5a3c', stroke: '#ffffff', strokeWidth: 2.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Kontribusi Channel Penjualan" hint="Distribusi penjualan bersih per channel">
          {channelTotalSum <= 0 ? (
            <div className="channel-empty-state">
              <span>Belum ada data penjualan per kanal pada periode ini.</span>
            </div>
          ) : (
            <div className="channel-distribution-list">
              {['website', 'offline', 'shopeefood'].map((key) => {
                const amount = Number(channelData[key] || 0);
                const percentNum = channelTotalSum > 0 ? (amount / channelTotalSum) * 100 : 0;
                const percent = percentNum.toFixed(1);
                return (
                  <div className="channel-bar-row" key={key}>
                    <div className="channel-bar-meta">
                      <div className="channel-bar-label">
                        <span className={`channel-indicator ${key}`} />
                        <strong>{channelLabel(key)}</strong>
                      </div>
                      <div className="channel-bar-amounts">
                        <strong>{money(amount)}</strong>
                        <span className="channel-bar-pct">{percent}%</span>
                      </div>
                    </div>
                    <div className="channel-progress-track">
                      <div
                        className={`channel-progress-fill ${key}`}
                        style={{ width: percentNum > 0 ? `${Math.min(100, Math.max(2, percentNum))}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </Panel>
      </div>

      {/* EXECUTIVE ADVISOR INSIGHT STRIP */}
      <div className="insight-strip">
        <div className="insight-icon">
          <Activity size={20} />
        </div>
        <div className="insight-content">
          <strong>Ringkasan Bisnis</strong>
          <span>
            {transactionCount > 0
              ? `Periode ini membukukan ${transactionCount} transaksi dengan rata-rata omzet ${money(grossSales / transactionCount)} per pesanan. Laba bersih mencapai ${money(netProfit)} (${marginPercent}% margin). Gunakan tab Performa Toko untuk melihat menu terlaris dan jam sibuk.`
              : 'Belum ada transaksi pada rentang waktu ini. Ubah filter periode di atas untuk meninjau data historis usaha.'}
          </span>
        </div>
      </div>
    </>
  );
}

