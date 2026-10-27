import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Minus,
  RefreshCw
} from 'lucide-react';
import CustomDropdown from './CustomDropdown';

export function PageHeader({ eyebrow, title, subtitle, action, badge }) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="page-head-title-row">
          <h1>{title}</h1>
          {badge && <span className="page-head-badge">{badge}</span>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="head-actions">{action}</div>}
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="loading-page">
      <div className="spinner" />
      <span>Mengambil data transaksi dan laporan...</span>
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="error-page">
      <div className="error-icon">
        <AlertCircle size={24} />
      </div>
      <h2>Gagal Memuat Data</h2>
      <p>{message || 'Terjadi gangguan saat menghubungkan ke server API.'}</p>
      <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
        <RefreshCw size={15} />
        <span>Coba Lagi</span>
      </button>
    </div>
  );
}

export function useRange(initial = '30d') {
  const [range, setRange] = useState(initial);
  return [range, setRange];
}

const RANGE_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d', label: '7 Hari Terakhir' },
  { value: '30d', label: '30 Hari Terakhir' },
  { value: '90d', label: '90 Hari Terakhir' }
];

export function RangeSelect({ value, onChange }) {
  return (
    <CustomDropdown
      id="range-select-dropdown"
      label="Rentang Waktu"
      icon={Clock}
      value={value}
      options={RANGE_OPTIONS}
      onChange={onChange}
      className="range-select-custom"
    />
  );
}

export function Metric({ label, value, sub, icon, trend, positive = true, status, tooltip }) {
  const isPositive = status === 'positive' || (status === undefined && positive === true);
  const isNegative = status === 'negative' || (status === undefined && positive === false);
  const isNeutral = status === 'neutral';
  const statusClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <div className={`metric-icon-box ${statusClass}`}>{icon}</div>
      </div>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
      </div>
      <div className="metric-footer">
        <span className={`metric-sub ${statusClass}`}>
          {isPositive ? (
            <ArrowUpRight size={14} />
          ) : isNegative ? (
            <ArrowDownRight size={14} />
          ) : (
            <Minus size={14} />
          )}
          <span>{sub}</span>
        </span>
      </div>
    </div>
  );
}

export function Panel({ title, hint, action, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <strong>{title}</strong>
          {hint && <span>{hint}</span>}
        </div>
        {action && <div className="panel-action">{action}</div>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function ChannelBadge({ channel }) {
  const ch = (channel || 'website').toLowerCase();
  const map = {
    website: 'Website Online',
    offline: 'Offline POS',
    shopeefood: 'ShopeeFood'
  };
  const label = map[ch] || ch || 'Website';

  return (
    <span className={`channel-badge ${ch}`}>
      <span className="channel-dot" />
      <span>{label}</span>
    </span>
  );
}

