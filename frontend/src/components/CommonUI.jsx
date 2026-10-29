import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
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

/* =========================================================
   PERIODE / RANGE UTILITIES & HELPERS
   ========================================================= */

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

/**
 * Mengubah value range terpadu menjadi query params backend
 * Contoh:
 * - 'this_month' => { range: 'this_month' }
 * - 'month:2026-09' => { range: 'month', month: '09', year: '2026' }
 * - 'year:2026' => { range: 'year', year: '2026' }
 * - 'today' => { range: 'today' }
 * - '7d' => { range: '7d' }
 */
export function buildRangeParams(val) {
  if (!val || val === 'this_month' || val === '30d') {
    return { range: val === '30d' ? '30d' : 'this_month' };
  }
  if (val.startsWith('month:')) {
    const [y, m] = val.replace('month:', '').split('-');
    return { range: 'month', month: m, year: y };
  }
  if (val.startsWith('year:')) {
    const y = val.replace('year:', '');
    return { range: 'year', year: y };
  }
  return { range: val };
}

/**
 * Mendapatkan label human-readable dalam Bahasa Indonesia untuk periode aktif
 */
export function getRangeLabel(val) {
  if (!val || val === 'this_month') return 'Bulan Ini';
  if (val === 'today') return 'Hari Ini';
  if (val === '7d') return '7 Hari Terakhir';
  if (val === '30d') return '30 Hari Terakhir';
  if (val === '90d') return '90 Hari Terakhir';
  if (val.startsWith('month:')) {
    const [y, m] = val.replace('month:', '').split('-');
    const mIdx = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[mIdx] || m} ${y}`;
  }
  if (val.startsWith('year:')) {
    const y = val.replace('year:', '');
    return `Tahun ${y}`;
  }
  return val;
}

export function useRange(initial = 'this_month') {
  const [range, setRange] = useState(initial);
  return [range, setRange];
}

/* =========================================================
   KOMPONEN FILTER PERIODE TERPADU (RangeSelect)
   Mendukung: Hari Ini, 7 Hari Terakhir, Bulan Ini, Pilih Bulan
   ========================================================= */

const PRESET_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d', label: '7 Hari Terakhir' },
  { value: 'this_month', label: 'Bulan Ini' },
  { value: 'custom_month', label: 'Pilih Bulan...' }
];

export function RangeSelect({ value = 'this_month', onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [subView, setSubView] = useState('menu'); // 'menu' | 'month_picker'
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Pilihan tahun yang tersedia berdasarkan histori data aplikasi (2024 s/d 2027)
  const availableYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];

  // Temporary selection state for month picker
  const [selectedYearForMonth, setSelectedYearForMonth] = useState(
    value?.startsWith('month:') ? parseInt(value.split(':')[1].split('-')[0], 10) : currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    value?.startsWith('month:') ? parseInt(value.split(':')[1].split('-')[1], 10) : currentMonth
  );

  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSubView('menu');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectPreset = (optValue) => {
    if (optValue === 'custom_month') {
      setSubView('month_picker');
      return;
    }
    onChange?.(optValue);
    setIsOpen(false);
    setSubView('menu');
  };

  const handleApplyMonth = () => {
    const mStr = String(selectedMonth).padStart(2, '0');
    const newValue = `month:${selectedYearForMonth}-${mStr}`;
    onChange?.(newValue);
    setIsOpen(false);
    setSubView('menu');
  };

  const activeLabel = getRangeLabel(value);

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown-container range-select-container ${className} ${isOpen ? 'is-open' : ''}`}
    >
      <button
        type="button"
        className={`custom-dropdown-trigger range-select-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSubView('menu');
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Filter Periode Waktu"
      >
        <span className="custom-dropdown-trigger-left">
          <Clock size={16} className="custom-dropdown-icon" aria-hidden="true" />
          <span className="custom-dropdown-label">{activeLabel}</span>
        </span>
        <ChevronDown
          size={14}
          className={`custom-dropdown-chevron ${isOpen ? 'rotate' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="custom-dropdown-popup range-select-popup">
          {subView === 'menu' && (
            <div className="range-menu-view">
              <ul className="range-menu-list">
                {PRESET_OPTIONS.map((opt) => {
                  let isSelected = false;
                  if (opt.value === 'custom_month') {
                    isSelected = value?.startsWith('month:');
                  } else {
                    isSelected = value === opt.value;
                  }

                  return (
                    <li
                      key={opt.value}
                      className={`custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectPreset(opt.value)}
                    >
                      <span className="custom-dropdown-item-text">{opt.label}</span>
                      {isSelected && (
                        <Check size={14} className="custom-dropdown-check" aria-hidden="true" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {subView === 'month_picker' && (
            <div className="range-picker-view">
              <div className="range-picker-header">
                <strong>Pilih Bulan & Tahun</strong>
                <button
                  type="button"
                  className="range-back-btn"
                  onClick={() => setSubView('menu')}
                >
                  Kembali
                </button>
              </div>

              <div className="range-picker-grid">
                <div className="range-picker-field">
                  <label htmlFor="range-select-month">Bulan</label>
                  <select
                    id="range-select-month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="range-native-select"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="range-picker-field">
                  <label htmlFor="range-select-year">Tahun</label>
                  <select
                    id="range-select-year"
                    value={selectedYearForMonth}
                    onChange={(e) => setSelectedYearForMonth(parseInt(e.target.value, 10))}
                    className="range-native-select"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="range-picker-actions">
                <button
                  type="button"
                  className="range-apply-btn"
                  onClick={handleApplyMonth}
                >
                  Terapkan Bulan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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
