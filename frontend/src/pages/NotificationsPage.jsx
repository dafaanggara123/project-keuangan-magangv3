import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Receipt,
  WalletCards
} from 'lucide-react';
import api from '../services/api';
import {
  buildNotifications,
  formatDateTime,
  loadReadNotifIds,
  saveReadNotifIds
} from '../utils/formatters';
import { ErrorState, LoadingPage, PageHeader } from '../components/CommonUI';

/* =========================================================
   NOTIFICATIONS PAGE COMPONENT (/notifikasi)
   ========================================================= */
export default function NotificationsPage({ profile }) {
  const [notifications, setNotifications] = useState([]);
  const [readNotifIds, setReadNotifIds] = useState(() =>
    loadReadNotifIds(profile)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setReadNotifIds(loadReadNotifIds(profile));
  }, [profile]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [salesRes, expensesRes] = await Promise.all([
          api.get('/sales', { params: { range: '30d' } }),
          api.get('/expenses')
        ]);

        if (!active) return;

        const expenseRows = Array.isArray(expensesRes.data)
          ? expensesRes.data
          : expensesRes.data?.rows || expensesRes.data?.data || [];

        setNotifications(
          buildNotifications(
            salesRes.data?.rows || [],
            expenseRows
          )
        );
      } catch (e) {
        if (!active) return;
        setError(
          e?.response?.data?.error ||
          e?.message ||
          'Notifikasi gagal dimuat.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const unreadNotifications = notifications.filter(
    (item) => !readNotifIds.includes(item.id)
  );

  const markAllRead = () => {
    const next = [
      ...new Set([
        ...readNotifIds,
        ...notifications.map((item) => item.id)
      ])
    ];

    setReadNotifIds(next);
    saveReadNotifIds(profile, next);
  };

  const openNotification = (item) => {
    const next = readNotifIds.includes(item.id)
      ? readNotifIds
      : [...readNotifIds, item.id];

    setReadNotifIds(next);
    saveReadNotifIds(profile, next);

    if (item.href) {
      navigate(item.href);
    }
  };

  const groupedNotifications = notifications.reduce((groups, item) => {
    const key = new Date(item.at).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="PUSAT NOTIFIKASI"
        title="Notifikasi"
        subtitle="Pantau aktivitas penjualan dan pengeluaran terbaru dari satu halaman."
        action={
          unreadNotifications.length > 0 ? (
            <button
              type="button"
              className="secondary-btn"
              onClick={markAllRead}
            >
              <Check size={15} />
              <span>Tandai semua dibaca</span>
            </button>
          ) : null
        }
      />

      <div className="notification-page">
        <div className="notification-page-summary">
          <div className="notification-summary-main">
            <div className="notification-summary-icon">
              <Bell size={20} />
            </div>
            <div>
              <strong>
                {notifications.length} aktivitas terbaru
              </strong>
              <span>
                {unreadNotifications.length > 0
                  ? `${unreadNotifications.length} belum dibaca`
                  : 'Semua notifikasi sudah dibaca'}
              </span>
            </div>
          </div>

          <div className="notification-summary-date">
            <CalendarDays size={15} />
            <span>30 hari terakhir</span>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} />
        ) : loading ? (
          <LoadingPage />
        ) : notifications.length === 0 ? (
          <div className="notification-empty-page">
            <div className="notification-empty-icon">
              <Bell size={28} />
            </div>
            <h3>Belum ada aktivitas</h3>
            <p>
              Notifikasi penjualan dan pengeluaran akan muncul di halaman ini.
            </p>
          </div>
        ) : (
          <div className="notification-timeline">
            {Object.entries(groupedNotifications).map(
              ([date, items]) => (
                <section key={date} className="notification-day">
                  <div className="notification-day-label">
                    {date}
                  </div>

                  <div className="notification-list">
                    {items.map((item) => {
                      const unread = !readNotifIds.includes(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`notification-page-item ${
                            unread ? 'unread' : ''
                          }`}
                          onClick={() => openNotification(item)}
                        >
                          <div
                            className={`notification-page-icon ${item.tone}`}
                          >
                            {item.type === 'sale' ? (
                              <Receipt size={18} />
                            ) : (
                              <WalletCards size={18} />
                            )}
                          </div>

                          <div className="notification-page-content">
                            <div className="notification-page-title-row">
                              <strong>{item.title}</strong>
                              <span>
                                {formatDateTime(item.at)}
                              </span>
                            </div>

                            <p>{item.body}</p>

                            <div className="notification-page-meta">
                              <span>
                                {item.type === 'sale'
                                  ? 'Penjualan'
                                  : 'Pengeluaran'}
                              </span>
                              <ChevronRight size={14} />
                            </div>
                          </div>

                          {unread && (
                            <span
                              className="notification-page-unread"
                              aria-label="Belum dibaca"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>
    </>
  );
}
