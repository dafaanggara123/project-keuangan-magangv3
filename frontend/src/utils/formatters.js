export const moneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

export const dateFormatterShort = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short'
});

export const dateFormatterLong = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export const money = (n) =>
  moneyFormatter.format(Number(n || 0));

export const shortMoney = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000_000) {
    return `Rp ${(v / 1_000_000_000).toFixed(2)} M`;
  }
  if (Math.abs(v) >= 1_000_000) {
    return `Rp ${(v / 1_000_000).toFixed(1)} jt`;
  }
  if (Math.abs(v) >= 1_000) {
    return `Rp ${(v / 1_000).toFixed(0)} rb`;
  }
  return money(v);
};

export const dateLabel = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return dateFormatterShort.format(d);
};

export const formatDateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return dateFormatterLong.format(d);
};

export const relativeTimeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 jam lalu' : `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  return dateLabel(iso);
};

export function channelLabel(c) {
  const map = {
    website: 'Website Online',
    offline: 'Offline POS',
    shopeefood: 'ShopeeFood'
  };
  return map[c] || c || 'Website';
}

export const notifStorageKey = (profile) => {
  const id = profile?.id || profile?.email || 'owner';
  return `p2_notif_read_${id}`;
};

export const loadReadNotifIds = (profile) => {
  try {
    const raw = localStorage.getItem(notifStorageKey(profile));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveReadNotifIds = (profile, ids) => {
  try {
    localStorage.setItem(notifStorageKey(profile), JSON.stringify([...ids]));
  } catch {
    /* ignore quota errors */
  }
};

export const buildNotifications = (salesRows, expenseRows) => {
  const sales = (Array.isArray(salesRows) ? salesRows : [])
    .slice(0, 8)
    .map((row) => ({
      id: `sale-${row.id}`,
      type: 'sale',
      tone: 'success',
      title: 'Penjualan berhasil dicatat',
      body: `${row.orderCode || 'Pesanan'} · ${money(row.total)} · ${channelLabel(
        row.channel || 'website'
      )}`,
      at: row.orderedAt,
      href: '/penjualan'
    }));

  const expenses = (Array.isArray(expenseRows) ? expenseRows : [])
    .slice(0, 8)
    .map((row) => ({
      id: `expense-${row.id}`,
      type: 'expense',
      tone: 'primary',
      title: 'Pengeluaran operasional',
      body: `${row.categoryName || row.category || 'Operasional'} · ${money(
        row.amount
      )}${
        row.note && row.note !== '-'
          ? ` · ${row.note}`
          : row.description && row.description !== '-'
            ? ` · ${row.description}`
            : ''
      }`,
      at: row.createdAt || row.created_at || row.expenseDate || row.expense_date,
      href: '/pengeluaran'
    }));

  return [...sales, ...expenses]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20);
};
