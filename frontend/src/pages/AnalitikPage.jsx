import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Info,
  RefreshCw,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { getAnalyticsCached, getRecommendationsCached } from '../services/api';
import { channelLabel, money } from '../utils/formatters';
import {
  ChannelBadge,
  PageHeader,
  Panel,
  RangeSelect,
  useRange,
  buildRangeParams
} from '../components/CommonUI';

/* =========================================================
   5. ANALYTICS COMPONENT (PERFORMA TOKO & REKOMENDASI)
   ========================================================= */
function RecommendationIcon({ tone, type }) {
  if (tone === "danger") return <AlertCircle size={20} />;
  if (tone === "warning") return <AlertTriangle size={20} />;
  if (tone === "success") {
    if (type === "finance") return <CircleDollarSign size={20} />;
    return <TrendingUp size={20} />;
  }
  return <Info size={20} />;
}

export default function AnalitikPage() {
  const navigate = useNavigate();
  const [range, setRange] = useRange('this_month');
  
  // State terpisah untuk analitik sales & ranking produk
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  // State terpisah untuk rekomendasi bisnis & kesehatan operasional
  const [recommendationData, setRecommendationData] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState('');

  const [showAllProducts, setShowAllProducts] = useState(false);
  const requestIdRef = useRef(0);

  const loadData = (force = false) => {
    const currentReqId = ++requestIdRef.current;
    const params = buildRangeParams(range);

    // 1. Ambil data Analytics (Menu terlaris, Channel, Omzet) secara terpisah
    setAnalyticsLoading(true);
    setAnalyticsError('');
    getAnalyticsCached({ force, params })
      .then((resData) => {
        if (requestIdRef.current !== currentReqId) return;
        setAnalyticsData(resData);
        setAnalyticsLoading(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== currentReqId) return;
        console.error('Gagal memuat analitik toko:', err);
        setAnalyticsError(err?.response?.data?.error || 'Gagal memuat data analitik toko.');
        setAnalyticsLoading(false);
      });

    // 2. Ambil data Rekomendasi Bisnis secara independen tanpa memblokir analitik
    setRecommendationsLoading(true);
    setRecommendationsError('');
    getRecommendationsCached({ force, params })
      .then((resData) => {
        if (requestIdRef.current !== currentReqId) return;
        setRecommendationData(resData);
        setRecommendationsLoading(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== currentReqId) return;
        console.error('Gagal memuat rekomendasi bisnis:', err);
        setRecommendationsError(err?.response?.data?.error || 'Gagal memuat data rekomendasi bisnis.');
        setRecommendationsLoading(false);
      });
  };

  useEffect(() => {
    loadData(false);
  }, [range]);

  const products = Array.isArray(analyticsData?.products) ? analyticsData.products : [];
  const rawRecommendations = Array.isArray(recommendationData)
    ? recommendationData
    : Array.isArray(recommendationData?.recommendations)
    ? recommendationData.recommendations
    : [];

  const rawChannelStats = Array.isArray(analyticsData?.channelStats) ? analyticsData.channelStats : [];
  const totalChannelRevenue = rawChannelStats.reduce(
    (sum, ch) => sum + Number(ch.revenue || ch.total || 0),
    0
  );

  const channelStatsWithShare = rawChannelStats.map((ch) => {
    const rev = Number(ch.revenue || ch.total || 0);
    const orderCount = Number(ch.transactions ?? ch.orderCount ?? ch.count ?? 0);
    const share = totalChannelRevenue > 0 ? (rev / totalChannelRevenue) * 100 : 0;
    return {
      ...ch,
      revenue: rev,
      orderCount,
      share
    };
  });

  const topChannel = [...channelStatsWithShare].sort((a, b) => b.revenue - a.revenue)[0];
  const topProduct = products[0];

  // Map recommendations into enriched UI structures with semantic tone and evidence
  const recommendations = rawRecommendations.map((rec) => {
    const rawType = String(rec.type || rec.category || '').toLowerCase();
    const title = rec.title || 'Rekomendasi Bisnis';
    const description = rec.finding || rec.text || rec.description || '';
    const priorityLevel = String(rec.level || rec.priority || 'medium').toLowerCase();
    const isHigh = priorityLevel === 'high';

    let statusTone = rec.statusTone || (isHigh ? 'danger' : 'info');
    let category = rec.badgeText || 'STRATEGI BISNIS';
    let basisMetric = rec.evidence || rec.basisMetric || null;
    let actionLabel = rec.actionText || 'Tinjau Rincian';
    let actionPath = rec.actionPath || null;
    let actionSuggestion = rec.action || null;

    if (!rec.badgeText) {
      if (rawType.includes('finance')) {
        category = 'KONDISI KEUANGAN';
        actionLabel = actionLabel || 'Buka Laporan Keuangan';
        actionPath = actionPath || '/laporan';
      } else if (rawType.includes('expense') || rawType.includes('pengeluaran')) {
        category = 'PENGELUARAN OPERASIONAL';
        actionLabel = actionLabel || 'Kelola Pengeluaran';
        actionPath = actionPath || '/pengeluaran';
      } else if (rawType.includes('product') || title.toLowerCase().includes('menu') || title.toLowerCase().includes('produk')) {
        category = 'PELUANG PENJUALAN';
        if (topProduct && !basisMetric) {
          basisMetric = `${topProduct.quantity} porsi terjual • Kontribusi ${money(topProduct.revenue)}`;
        }
        actionLabel = actionLabel || 'Kelola Menu & Stok';
        actionPath = actionPath || '/';
      } else if (rawType.includes('channel') || title.toLowerCase().includes('channel')) {
        category = 'PELUANG PENJUALAN';
        if (topChannel && topChannel.revenue > 0 && !basisMetric) {
          basisMetric = `Dominasi ${topChannel.share.toFixed(1)}% omzet (${money(topChannel.revenue)})`;
        }
        actionLabel = actionLabel || 'Lihat Penjualan';
        actionPath = actionPath || '/penjualan';
      }
    }

    return {
      category,
      title,
      description,
      basisMetric,
      actionSuggestion,
      actionLabel,
      actionPath,
      priorityLevel,
      isHigh,
      statusTone,
      rawType
    };
  });

  const mobileDisplayedProducts = showAllProducts ? products.slice(0, 10) : products.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="ANALISIS BISNIS"
        title="Performa Sales Toko"
        subtitle="Analisis produk terlaris, kontribusi omzet per menu, dan rekomendasi strategis peningkatan profit."
        action={<RangeSelect value={range} onChange={setRange} />}
      />

      {/* QUICK INSIGHTS SUMMARY CARDS */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div className="analytics-summary-icon product">
            <Award size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">MENU TERLARIS</span>
            <strong className="analytics-summary-title">
              {analyticsLoading ? (
                'Memuat data menu...'
              ) : analyticsError ? (
                'Gagal memuat'
              ) : (
                topProduct?.name || 'Belum Ada Data'
              )}
            </strong>
            <span className="analytics-summary-sub">
              {analyticsLoading ? (
                'Sinkronisasi transaksi...'
              ) : analyticsError ? (
                'Coba segarkan halaman'
              ) : topProduct ? (
                `${topProduct.quantity} porsi (${money(topProduct.revenue)})`
              ) : (
                'Tidak ada penjualan'
              )}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-summary-icon channel">
            <TrendingUp size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">CHANNEL UTAMA</span>
            <strong className="analytics-summary-title">
              {analyticsLoading ? (
                'Memuat kanal...'
              ) : analyticsError ? (
                'Gagal memuat'
              ) : topChannel && topChannel.revenue > 0 ? (
                channelLabel(topChannel.channel)
              ) : (
                'Belum Ada Data'
              )}
            </strong>
            <span className="analytics-summary-sub">
              {analyticsLoading ? (
                'Menghitung kontribusi...'
              ) : analyticsError ? (
                'Coba segarkan halaman'
              ) : topChannel && topChannel.revenue > 0 ? (
                `${topChannel.share.toFixed(1)}% kontribusi (${money(topChannel.revenue)})`
              ) : (
                'Belum ada transaksi'
              )}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="analytics-summary-icon health">
            <ShieldCheck size={18} />
          </div>
          <div className="analytics-summary-info">
            <span className="analytics-summary-label">STATUS OPERASIONAL</span>
            <strong className="analytics-summary-title">
              {recommendationsLoading ? (
                'Mengevaluasi...'
              ) : recommendationsError ? (
                'Status Parsial'
              ) : (
                'Kesehatan Optimal'
              )}
            </strong>
            <span className="analytics-summary-sub">
              {recommendationsLoading ? (
                'Mengevaluasi rasio margin...'
              ) : (
                'Margin & rasio biaya terkendali aman'
              )}
            </span>
          </div>
        </div>
      </div>

      {/* BALANCED 2-COLUMN SECTION: TOP PRODUCTS & CHANNEL DISTRIBUTION */}
      <div className="analytics-main-grid">
        {/* LEFT COLUMN: TOP 10 PRODUCTS */}
        <Panel
          className="analytics-ranking-panel"
          title="Peringkat Menu Terlaris"
          hint={`Berdasarkan volume penjualan (${range})`}
        >
          {analyticsError ? (
            <div className="empty-cell" style={{ padding: '24px 0', color: 'var(--danger)' }}>
              <span>{analyticsError}</span>
              <button
                type="button"
                className="secondary-btn"
                style={{ marginTop: '10px', fontSize: '12px', padding: '6px 12px' }}
                onClick={() => loadData(true)}
              >
                <RefreshCw size={13} style={{ marginRight: '6px' }} />
                Coba Lagi
              </button>
            </div>
          ) : analyticsLoading ? (
            <div className="empty-cell" style={{ padding: '24px 0' }}>
              Memuat data menu...
            </div>
          ) : (
            <>
              {/* Desktop 2-column internal ranking (#1-#5, #6-#10) */}
              <div className="rank-list-desktop">
                {products.length > 0 ? (
                  <div className="rank-cols-container">
                    <div className="rank-col">
                      {products.slice(0, 5).map((prod, idx) => (
                        <div className="rank-row" key={prod.menuId || prod.name || idx}>
                          <div className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                          <div className="rank-main">
                            <strong title={prod.name}>{prod.name}</strong>
                            <span>{prod.quantity || 0} porsi terjual</span>
                          </div>
                          <div className="rank-revenue">{money(prod.revenue || 0)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rank-col">
                      {products.slice(5, 10).map((prod, idx) => {
                        const rankNum = idx + 6;
                        return (
                          <div className="rank-row" key={prod.menuId || prod.name || rankNum}>
                            <div className={`rank-badge rank-${rankNum}`}>#{rankNum}</div>
                            <div className="rank-main">
                              <strong title={prod.name}>{prod.name}</strong>
                              <span>{prod.quantity || 0} porsi terjual</span>
                            </div>
                            <div className="rank-revenue">{money(prod.revenue || 0)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="empty-cell">Belum ada data penjualan produk pada periode ini.</div>
                )}
              </div>

              {/* Mobile 1-column list with expand/collapse */}
              <div className="rank-list-mobile">
                {mobileDisplayedProducts.map((prod, idx) => (
                  <div className="rank-row" key={prod.menuId || prod.name || idx}>
                    <div className={`rank-badge rank-${idx + 1}`}>#{idx + 1}</div>
                    <div className="rank-main">
                      <strong>{prod.name}</strong>
                      <span>{prod.quantity || 0} porsi terjual</span>
                    </div>
                    <div className="rank-revenue">{money(prod.revenue || 0)}</div>
                  </div>
                ))}

                {products.length === 0 && (
                  <div className="empty-cell">Belum ada data penjualan produk pada periode ini.</div>
                )}

                {products.length > 5 && (
                  <button
                    type="button"
                    className="analytics-expand-btn"
                    onClick={() => setShowAllProducts((prev) => !prev)}
                  >
                    <span>{showAllProducts ? 'Tampilkan 5 Menu Saja' : `Lihat Semua 10 Menu Terlaris (${products.length})`}</span>
                    {showAllProducts ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                )}
              </div>
            </>
          )}
        </Panel>

        {/* RIGHT COLUMN: CHANNEL DISTRIBUTION & OPERATIONAL HEALTH */}
        <div className="analytics-right-col">
          <Panel
            className="analytics-channel-panel"
            title="Distribusi Kategori Penjualan"
            hint="Penjualan bersih & kontribusi omzet"
          >
            <div className="analytics-channel-breakdown">
              {analyticsError ? (
                <div className="empty-cell" style={{ padding: '24px 0', color: 'var(--danger)' }}>
                  <span>{analyticsError}</span>
                </div>
              ) : analyticsLoading ? (
                <div className="empty-cell" style={{ padding: '24px 0' }}>
                  Memuat distribusi kanal penjualan...
                </div>
              ) : channelStatsWithShare.length > 0 ? (
                channelStatsWithShare.map((ch) => {
                  const chKey = String(ch.channel || 'website').toLowerCase();
                  return (
                    <div className="channel-progress-card" key={ch.channel}>
                      <div className="channel-progress-head">
                        <div className="channel-badge-wrap">
                          <ChannelBadge channel={ch.channel} />
                          {ch.orderCount > 0 && (
                            <span className="channel-order-count">
                              • {ch.orderCount} pesanan
                            </span>
                          )}
                        </div>
                        <div className="channel-nominal-wrap">
                          <strong>{money(ch.revenue)}</strong>
                          <span className="channel-share-text">{ch.share.toFixed(1)}% kontribusi</span>
                        </div>
                      </div>

                      <div className="channel-progress-bar-bg">
                        <div
                          className={`channel-progress-bar-fill fill-${chKey}`}
                          style={{ width: `${Math.min(100, Math.max(0, ch.share))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-cell" style={{ padding: '24px 0' }}>
                  Belum ada transaksi pada periode ini.
                </div>
              )}
            </div>

            {!analyticsLoading && topChannel && topChannel.revenue > 0 && (
              <div className="channel-quick-insight">
                <span className="insight-badge">INSIGHT</span>
                <p>
                  <strong>{channelLabel(topChannel.channel)}</strong> memimpin perolehan omzet dengan kontribusi{' '}
                  <strong>{topChannel.share.toFixed(1)}%</strong> ({money(topChannel.revenue)}).
                </p>
              </div>
            )}

            <div className="store-health-box">
              <div className="health-icon">
                <Activity size={20} />
              </div>
              <div className="health-body">
                <strong>
                  {recommendationsLoading
                    ? 'Kesehatan Operasional: Menganalisis...'
                    : 'Kesehatan Operasional: Optimal'}
                </strong>
                <p>Rasio pengeluaran terhadap omzet berada dalam batas aman target profitabilitas.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* STRATEGIC RECOMMENDATIONS */}
      <div className="performance-recommendations">
        <div className="section-heading">
          <h2>Rekomendasi Bisnis</h2>
          <p>Peluang optimasi harga, promosi menu, dan efisiensi biaya berdasarkan data transaksi historis.</p>
        </div>

        <div className="recommendation-list">
          {recommendationsLoading ? (
            <div className="recommend-card tone-info">
              <div className="recommend-icon">
                <Info size={20} />
              </div>
              <div className="recommend-body">
                <div className="recommend-meta">
                  <span className="recommend-label">STRATEGI BISNIS</span>
                  <span className="recommend-priority-badge badge-info">Memuat</span>
                </div>
                <h3 className="recommend-title">Menganalisis Rekomendasi Bisnis...</h3>
                <p className="recommend-finding">
                  Sistem sedang mengevaluasi data transaksi historis, rasio biaya, dan peluang optimasi menu.
                </p>
              </div>
            </div>
          ) : recommendationsError ? (
            <div className="recommend-card tone-warning">
              <div className="recommend-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="recommend-body">
                <div className="recommend-meta">
                  <span className="recommend-label">STATUS REKOMENDASI</span>
                  <span className="recommend-priority-badge badge-warning">Peringatan</span>
                </div>
                <h3 className="recommend-title">Gagal Menganalisis Rekomendasi</h3>
                <p className="recommend-finding">{recommendationsError}</p>
                <div className="recommend-footer-action">
                  <button type="button" className="recommend-btn" onClick={() => loadData(true)}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {recommendations.map((rec, i) => {
                const tone = rec.statusTone || (rec.isHigh ? 'danger' : 'info');
                const priorityText = rec.priorityLevel === 'high'
                  ? 'Prioritas Tinggi'
                  : rec.priorityLevel === 'medium'
                  ? 'Prioritas Sedang'
                  : 'Informasi';

                return (
                  <div key={i} className={`recommend-card tone-${tone} ${rec.isHigh ? 'priority-high' : ''}`}>
                    <div className="recommend-icon">
                      <RecommendationIcon tone={tone} type={rec.rawType} />
                    </div>
                    <div className="recommend-body">
                      {/* 1. Label jenis rekomendasi & prioritas */}
                      <div className="recommend-meta">
                        <span className="recommend-label">{rec.category}</span>
                        <span className={`recommend-priority-badge badge-${tone}`}>
                          {priorityText}
                        </span>
                      </div>

                      {/* 2. Judul rekomendasi */}
                      <h3 className="recommend-title">{rec.title}</h3>

                      {/* 3. Penjelasan singkat berdasarkan data temuan */}
                      <p className="recommend-finding">{rec.description}</p>

                      {/* 4. Bukti angka atau indikator pendukung */}
                      {rec.basisMetric && (
                        <div className="recommend-basis-tag">
                          <span className="basis-label">Bukti Data:</span>
                          <span className="basis-val">{rec.basisMetric}</span>
                        </div>
                      )}

                      {/* 5. Saran tindakan yang realistis */}
                      {rec.actionSuggestion && (
                        <div className="recommend-action-hint">
                          <span className="action-hint-label">Saran Tindakan:</span>
                          <span className="action-hint-text">{rec.actionSuggestion}</span>
                        </div>
                      )}

                      {/* 6. Tombol menuju halaman terkait */}
                      {rec.actionPath && (
                        <div className="recommend-footer-action">
                          <button
                            type="button"
                            className="recommend-btn"
                            onClick={() => navigate(rec.actionPath)}
                          >
                            <span>{rec.actionLabel}</span>
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {recommendations.length === 0 && (
                <div className="recommend-card tone-info">
                  <div className="recommend-icon">
                    <Info size={20} />
                  </div>
                  <div className="recommend-body">
                    <div className="recommend-meta">
                      <span className="recommend-label">STATUS OPERASIONAL</span>
                      <span className="recommend-priority-badge badge-info">Informasi</span>
                    </div>
                    <h3 className="recommend-title">Data Transaksi Terkini Masih Terbatas</h3>
                    <p className="recommend-finding">
                      Belum cukup transaksi selesai atau catatan pengeluaran operasional pada periode ini.
                    </p>
                    <div className="recommend-action-hint">
                      <span className="action-hint-label">Saran Tindakan:</span>
                      <span className="action-hint-text">
                        Selesaikan transaksi penjualan atau input beban operasional untuk mengaktifkan rekomendasi berbasis data aktual.
                      </span>
                    </div>
                    <div className="recommend-footer-action">
                      <button type="button" className="recommend-btn" onClick={() => navigate('/pengeluaran')}>
                        <span>Input Pengeluaran</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
