const fs = require('fs');

let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

// 1. Metric stat card neutral state
const oldMetricNeg = `.metric-icon-box.negative {
  background: #fef2f2;
  color: #dc2626;
}`;

const newMetricNeg = `.metric-icon-box.negative {
  background: #fef2f2;
  color: #dc2626;
}

.metric-icon-box.neutral {
  background: var(--surface-2);
  color: var(--text-muted);
}

.metric-sub.neutral {
  color: var(--text-muted);
}`;

if (css.includes(oldMetricNeg.replace(/\r?\n/g, '\r\n'))) {
  css = css.replace(oldMetricNeg.replace(/\r?\n/g, '\r\n'), newMetricNeg.replace(/\r?\n/g, '\r\n'));
} else if (css.includes(oldMetricNeg.replace(/\r?\n/g, '\n'))) {
  css = css.replace(oldMetricNeg.replace(/\r?\n/g, '\n'), newMetricNeg.replace(/\r?\n/g, '\n'));
} else {
  console.log('metric-icon-box.negative not found directly');
}

// 2. Channel progress track and fill styling updates
const oldTrack = `.channel-progress-track {
  width: 100%;
  height: 6px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  overflow: hidden;
}`;

const newTrack = `.channel-progress-track {
  width: 100%;
  height: 7px;
  background: #e2e8f0;
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.channel-progress-fill.total-bar {
  background: #64748b;
}

.channel-empty-state {
  padding: 18px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  background: var(--surface-2);
  border-radius: var(--radius-md);
  margin: 8px 0;
}

.report-channel-bar-col {
  width: 100%;
  min-width: 0;
}`;

if (css.includes(oldTrack.replace(/\r?\n/g, '\r\n'))) {
  css = css.replace(oldTrack.replace(/\r?\n/g, '\r\n'), newTrack.replace(/\r?\n/g, '\r\n'));
} else if (css.includes(oldTrack.replace(/\r?\n/g, '\n'))) {
  css = css.replace(oldTrack.replace(/\r?\n/g, '\n'), newTrack.replace(/\r?\n/g, '\n'));
}

// 3. Update desktop .report-channel-row grid columns to 4 columns: Name, Progress Bar, Nominal, Pct
const oldRepRow = `.report-channel-row{
  display:grid;

  grid-template-columns:
    minmax(0,1fr)
    150px
    65px;

  align-items:center;
  gap:12px;

  padding:13px 20px;

  border-bottom:1px solid var(--border-subtle);
}`;

const newRepRow = `.report-channel-row{
  display:grid;

  grid-template-columns:
    140px
    minmax(120px, 1fr)
    140px
    55px;

  align-items:center;
  gap:16px;

  padding:14px 20px;

  border-bottom:1px solid var(--border-subtle);
}`;

if (css.includes(oldRepRow.replace(/\r?\n/g, '\r\n'))) {
  css = css.replace(oldRepRow.replace(/\r?\n/g, '\r\n'), newRepRow.replace(/\r?\n/g, '\r\n'));
} else if (css.includes(oldRepRow.replace(/\r?\n/g, '\n'))) {
  css = css.replace(oldRepRow.replace(/\r?\n/g, '\n'), newRepRow.replace(/\r?\n/g, '\n'));
}

// 4. Update .report-financial-card.profit styles for is-positive, is-negative, is-neutral
const oldProfCard = `.report-financial-card.profit {
  background: var(--success-soft);
  border-color: var(--success-border);
}

.report-financial-card.profit span { color: var(--success-dark); }
.report-financial-card.profit strong { color: #065f46; }`;

const newProfCard = `.report-financial-card.profit {
  background: var(--success-soft);
  border-color: var(--success-border);
  transition: all 0.2s ease;
}

.report-financial-card.profit span { color: var(--success-dark); }
.report-financial-card.profit strong { color: #065f46; }

.report-financial-card.profit.is-positive {
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.report-financial-card.profit.is-positive span { color: #047857; }
.report-financial-card.profit.is-positive strong { color: #065f46; }

.report-financial-card.profit.is-negative {
  background: #fef2f2;
  border-color: #fecaca;
}
.report-financial-card.profit.is-negative span { color: #b91c1c; }
.report-financial-card.profit.is-negative strong { color: #991b1b; }

.report-financial-card.profit.is-neutral {
  background: #f8fafc;
  border-color: #e2e8f0;
}
.report-financial-card.profit.is-neutral span { color: #64748b; }
.report-financial-card.profit.is-neutral strong { color: #334155; }

/* Hero Subcard Profit Margin Indicators */
.hero-subcard.is-positive strong { color: #86efac; }
.hero-subcard.is-negative strong { color: #fca5a5; }
.hero-subcard.is-neutral strong { color: #cbd5e1; }`;

if (css.includes(oldProfCard.replace(/\r?\n/g, '\r\n'))) {
  css = css.replace(oldProfCard.replace(/\r?\n/g, '\r\n'), newProfCard.replace(/\r?\n/g, '\r\n'));
} else if (css.includes(oldProfCard.replace(/\r?\n/g, '\n'))) {
  css = css.replace(oldProfCard.replace(/\r?\n/g, '\n'), newProfCard.replace(/\r?\n/g, '\n'));
}

fs.writeFileSync('frontend/src/styles.css', css, 'utf8');
console.log('Successfully updated styles.css');
