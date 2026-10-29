import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  WalletCards,
  X
} from 'lucide-react';
import api, { getExpensesCached, getExpenseCategoriesCached, clearAnalyticsCache } from '../services/api';
import { dateFormatterLong, money } from '../utils/formatters';
import { ErrorState, PageHeader, RangeSelect, useRange, buildRangeParams } from '../components/CommonUI';

/* =========================================================
   4. FINANCE COMPONENT (PENGELUARAN / OPEX)
   ========================================================= */
export default function PengeluaranPage() {
  const [range, setRange] = useRange('this_month');
  const [expenses, setExpenses] = useState(null);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Close overflow menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.expense-action-menu-wrap')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const loadExpenses = async (force = false) => {
    const rawData = await getExpensesCached({ force, params: buildRangeParams(range) });

    const normalized = rawData.map((expense) => ({
      id: expense.id,
      categoryId: expense.categoryId ?? expense.expense_category_id ?? null,
      categoryName: expense.categoryName || expense.category || expense.expense_categories?.name || 'Operasional',
      amount: Number(expense.amount || 0),
      expenseDate: expense.expenseDate || expense.spent_at || expense.expense_date || expense.created_at || null,
      note: expense.note || expense.title || expense.notes || expense.description || 'Pengeluaran Operasional',
      createdAt: expense.createdAt || expense.created_at || null
    }));

    setExpenses(normalized);
  };

  const loadCategories = async (force = false) => {
    try {
      const rawData = await getExpenseCategoriesCached({ force });
      setCategories(rawData);
      return rawData;
    } catch (e) {
      console.error('Kategori gagal dimuat, menggunakan fallback:', e);
      const fallback = [
        { id: 1, name: 'Bahan Baku & Dapur' },
        { id: 2, name: 'Operasional & Utilitas' },
        { id: 3, name: 'Transportasi & Logistik' },
        { id: 4, name: 'Listrik & Air' },
        { id: 5, name: 'Perawatan Alat' },
        { id: 6, name: 'Lain-lain' }
      ];
      setCategories(fallback);
      return fallback;
    }
  };

  const openExpenseModal = (expenseToEdit = null) => {
    // 1. Langsung buka modal dan set item aktif secara sinkron (instant response)
    setEditingExpense(expenseToEdit);
    setModal(true);

    // 2. Fetch/sinkronisasi kategori di background jika belum ada atau untuk memastikan data mutakhir
    if (categories.length === 0) {
      loadCategories();
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setExpenses(null);
    setError('');
    loadExpenses().catch((e) => {
      console.error('Gagal memuat keuangan:', e);
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat data keuangan.');
    });
  }, [range]);

  const save = async (form) => {
    if (editingExpense && editingExpense.id) {
      await api.put(`/expenses/${editingExpense.id}`, {
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        note: form.note
      });
    } else {
      await api.post('/expenses', {
        categoryId: Number(form.categoryId),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        note: form.note
      });
    }
    clearAnalyticsCache();
    setModal(false);
    setEditingExpense(null);
    await loadExpenses(true);
  };

  const promptDelete = (expense) => {
    setActiveMenuId(null);
    setDeleteError('');
    setDeletingExpense(expense);
  };

  const confirmDelete = async () => {
    if (!deletingExpense || !deletingExpense.id) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.delete(`/expenses/${deletingExpense.id}`);
      clearAnalyticsCache();
      setDeletingExpense(null);
      await loadExpenses(true);
      setSuccessToast('Catatan pengeluaran berhasil dihapus.');
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (e) {
      console.error('Gagal menghapus pengeluaran:', e);
      setDeleteError(e?.response?.data?.error || e?.message || 'Pengeluaran gagal dihapus.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (error) return <ErrorState message={error} />;

  const expenseRows = expenses || [];
  const totalExpense = expenseRows.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const avgExpense = expenseRows.length
    ? totalExpense / expenseRows.length
    : 0;

  const formatExpenseDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return dateFormatterLong.format(date);
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const rawSearchNumber = searchTerm.replace(/[^0-9]/g, '');

  const filteredExpenseRows = expenseRows.filter((expense) => {
    if (!normalizedSearch) return true;

    // 1. Deskripsi / Keterangan
    const note = String(expense.note || '').toLowerCase();
    if (note.includes(normalizedSearch)) return true;

    // 2. Kategori biaya
    const categoryName = String(expense.categoryName || '').toLowerCase();
    if (categoryName.includes(normalizedSearch)) return true;

    // 3. Tanggal transaksi (format tanggal terformat & raw ISO)
    const formattedDate = formatExpenseDate(expense.expenseDate).toLowerCase();
    const rawDate = String(expense.expenseDate || '').toLowerCase();
    if (formattedDate.includes(normalizedSearch) || rawDate.includes(normalizedSearch)) return true;

    // 4. Nominal pengeluaran (mendukung 100000, 100.000, Rp100.000)
    const amountNum = Number(expense.amount || 0);
    const amountStr = String(amountNum);
    const formattedMoney = money(amountNum).toLowerCase();

    if (rawSearchNumber && amountStr.includes(rawSearchNumber)) return true;
    if (formattedMoney.includes(normalizedSearch)) return true;

    return false;
  });

  return (
    <>
      <PageHeader
        eyebrow="ARUS KAS KELUAR"
        title="Riwayat Pengeluaran"
        subtitle="Catat dan kendalikan seluruh pos belanja bahan baku, operasional harian, dan utilitas usaha."
        action={
          <button className="primary-btn" onClick={() => openExpenseModal(null)}>
            <Plus size={16} />
            <span>Tambah Catatan Pengeluaran</span>
          </button>
        }
      />

      {successToast && (
        <div
          className="approval-toast success"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: 'var(--success-soft, #ecfdf5)',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'modalPop 0.2s ease-out'
          }}
          role="status"
        >
          <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{successToast}</span>
        </div>
      )}

      {/* EXPENSE SUMMARY */}
      <div className="finance-grid">
        <div className="finance-summary finance-summary-total">
          <div className="finance-summary-icon">
            <WalletCards size={20} />
          </div>
          <div>
            <span>Total Pengeluaran</span>
            <strong>{expenses ? money(totalExpense) : '—'}</strong>
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-icon">
            <Layers size={20} />
          </div>
          <div>
            <span>Total Catatan Biaya</span>
            <strong>{expenses ? `${expenseRows.length} Catatan` : '—'}</strong>
          </div>
        </div>

        <div className="finance-summary">
          <div className="finance-summary-icon">
            <DollarSign size={20} />
          </div>
          <div>
            <span>Rata-rata per Catatan</span>
            <strong>{expenses ? money(avgExpense) : '—'}</strong>
          </div>
        </div>
      </div>

      {/* EXPENSE TABLE & MOBILE CARD LIST */}
      <div className="table-panel expense-panel">
        <div className="table-head">
          <div>
            <strong>Buku Kas Pengeluaran</strong>
            <span>Menampilkan seluruh riwayat pengeluaran operasional Dapoersari</span>
          </div>
          <div className="expense-head-actions">
            <RangeSelect value={range} onChange={setRange} />
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="expense-search-bar-wrap">
          <label className="expense-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Cari deskripsi, kategori, tanggal, atau nominal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Cari transaksi pengeluaran"
            />
            {searchTerm && (
              <button
                type="button"
                className="expense-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Hapus pencarian"
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </label>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="table-scroll expense-table-desktop">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori Biaya</th>
                <th>Keterangan / Deskripsi</th>
                <th className="right">Nominal</th>
                <th className="expense-table-th-actions">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {expenses === null ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <div className="loading-page">
                      <div className="spinner" />
                      <span>Memuat buku kas pengeluaran...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenseRows.length > 0 ? (
                filteredExpenseRows.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <span className="text-muted">{formatExpenseDate(expense.expenseDate)}</span>
                    </td>
                    <td>
                      <span className="category-chip">{expense.categoryName}</span>
                    </td>
                    <td>
                      <strong className="text-primary">{expense.note}</strong>
                    </td>
                    <td className="right">
                      <strong className="amount-expense">{money(expense.amount)}</strong>
                    </td>
                    <td className="expense-table-td-actions">
                      <div className="expense-table-actions">
                        <button
                          type="button"
                          className="expense-action-btn edit"
                          onClick={() => openExpenseModal(expense)}
                          title="Edit pengeluaran"
                          aria-label={`Edit pengeluaran: ${expense.note || expense.categoryName}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="expense-action-btn delete"
                          onClick={() => promptDelete(expense)}
                          title="Hapus pengeluaran"
                          aria-label={`Hapus pengeluaran: ${expense.note || expense.categoryName}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : expenses !== null && expenseRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <div className="empty-state">
                      <WalletCards size={32} />
                      <strong>Belum ada catatan pengeluaran</strong>
                      <span>Klik tombol "Tambah Catatan Pengeluaran" di atas untuk mencatat biaya baru.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <div className="empty-state expense-search-empty">
                      <Search size={32} />
                      <strong>Pengeluaran tidak ditemukan</strong>
                      <span>Tidak ada transaksi yang cocok dengan kata kunci "{searchTerm}".</span>
                      <button
                        type="button"
                        className="secondary-btn btn-sm expense-clear-search-btn"
                        onClick={() => setSearchTerm('')}
                      >
                        <X size={14} />
                        <span>Hapus Pencarian</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD LIST VIEW */}
        <div className="expense-list-mobile">
          {expenses === null ? (
            <div className="expense-mobile-loading">
              <div className="spinner" />
              <span>Memuat buku kas pengeluaran...</span>
            </div>
          ) : filteredExpenseRows.length > 0 ? (
            <div className="expense-cards-wrap">
              {filteredExpenseRows.map((expense) => {
                const isMenuOpen = activeMenuId === expense.id;
                return (
                  <div key={expense.id} className="expense-card-item">
                    <div className="expense-card-header">
                      <span className="expense-card-date">{formatExpenseDate(expense.expenseDate)}</span>
                      <div className="expense-action-menu-wrap">
                        <button
                          type="button"
                          className="expense-card-menu-btn"
                          aria-label="Aksi catatan"
                          aria-haspopup="true"
                          aria-expanded={isMenuOpen}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : expense.id);
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {isMenuOpen && (
                          <div className="expense-menu-dropdown" role="menu">
                            <button
                              type="button"
                              className="expense-menu-item"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                openExpenseModal(expense);
                              }}
                            >
                              <Pencil size={14} />
                              <span>Edit Catatan</span>
                            </button>
                            <button
                              type="button"
                              className="expense-menu-item danger"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                promptDelete(expense);
                              }}
                            >
                              <Trash2 size={14} />
                              <span>Hapus Catatan</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="expense-card-body">
                      <div className="expense-card-cat-wrap">
                        <span className="category-chip">{expense.categoryName}</span>
                      </div>
                      <div className="expense-card-note">{expense.note}</div>
                    </div>

                    <div className="expense-card-footer">
                      <span className="expense-card-amount-label">Pengeluaran</span>
                      <span className="expense-card-amount-val">{money(expense.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : expenses !== null && expenseRows.length === 0 ? (
            <div className="expense-mobile-empty">
              <div className="expense-empty-icon-wrap">
                <WalletCards size={36} />
              </div>
              <strong className="expense-empty-title">Belum ada catatan pengeluaran</strong>
              <p className="expense-empty-desc">
                Mulai catat pengeluaran operasional Anda.
              </p>
              <button
                type="button"
                className="primary-btn expense-empty-btn"
                onClick={() => openExpenseModal(null)}
              >
                <Plus size={16} />
                <span>+ Tambah Pengeluaran</span>
              </button>
            </div>
          ) : (
            <div className="expense-mobile-empty">
              <div className="expense-empty-icon-wrap">
                <Search size={32} />
              </div>
              <strong className="expense-empty-title">Pengeluaran tidak ditemukan</strong>
              <p className="expense-empty-desc">
                Tidak ada transaksi yang cocok dengan kata kunci "{searchTerm}".
              </p>
              <button
                type="button"
                className="secondary-btn expense-clear-search-btn"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
                <span>Hapus Pencarian</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ADD / EDIT EXPENSE MODAL */}
      {modal && (
        <ExpenseModal
          categories={categories}
          initialData={editingExpense}
          onClose={() => {
            setModal(false);
            setEditingExpense(null);
          }}
          onSave={save}
        />
      )}

      {/* CONFIRM DELETE EXPENSE MODAL */}
      {deletingExpense && (
        <DeleteExpenseConfirmModal
          expense={deletingExpense}
          loading={deleteLoading}
          error={deleteError}
          onClose={() => {
            if (!deleteLoading) {
              setDeletingExpense(null);
              setDeleteError('');
            }
          }}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}

/* =========================================================
   ADD / EDIT EXPENSE MODAL
   ========================================================= */
function ExpenseModal({ categories = [], initialData = null, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    categoryId: initialData?.categoryId || (categories.length > 0 ? categories[0].id : ''),
    amount: initialData?.amount != null ? String(initialData.amount) : '',
    expenseDate: initialData?.expenseDate
      ? String(initialData.expenseDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    note: initialData?.note || ''
  }));
  const [saving, setSaving] = useState(false);

  // Jika categories baru selesai dimuat saat modal sudah terbuka untuk mode Tambah (belum ada categoryId yang dipilih)
  useEffect(() => {
    if (!form.categoryId && categories.length > 0 && !initialData?.categoryId) {
      setForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId, initialData]);

  const isEditing = Boolean(initialData && initialData.id);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.categoryId) {
      alert('Pilih kategori pengeluaran terlebih dahulu.');
      return;
    }
    if (Number(form.amount) <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari Rp 0.');
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      alert(e?.response?.data?.error || 'Gagal menyimpan catatan pengeluaran.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">BUKU KAS PENGELUARAN</span>
            <h3>{isEditing ? 'Edit Catatan Pengeluaran' : 'Tambah Pengeluaran'}</h3>
          </div>
          <button type="button" className="ghost-icon" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Tanggal Transaksi</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Kategori Biaya</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              <option value="">Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group full">
            <label>Deskripsi / Keterangan Belanja</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Contoh: Pembelian beras 25kg & bumbu dapur"
              required
            />
          </div>

          <div className="form-group full">
            <label>Nominal Pengeluaran (Rp)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Masukkan nominal (cth: 150000)"
              required
            />
            {form.amount > 0 && <small className="input-helper-text">Konfirmasi: {money(form.amount)}</small>}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={saving}>
            Batal
          </button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Menyimpan...' : (isEditing ? 'Perbarui Pengeluaran' : 'Simpan Pengeluaran')}
          </button>
        </div>
      </form>
    </div>
  );
}

/* =========================================================
   CONFIRM DELETE EXPENSE MODAL (CUSTOM MODAL)
   ========================================================= */
function DeleteExpenseConfirmModal({ expense, loading, error, onClose, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onClose]);

  const formatModalDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '-';
    return dateFormatterLong.format(date);
  };

  return (
    <div
      className="modal-backdrop theme-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-expense-title"
      aria-describedby="delete-expense-desc"
    >
      <div
        className="modal-card theme-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          padding: '28px 24px 22px',
          borderRadius: '18px',
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)'
        }}
      >
        <button
          type="button"
          className="ghost-icon theme-modal-close-btn"
          onClick={onClose}
          disabled={loading}
          aria-label="Tutup modal konfirmasi"
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          <X size={18} />
        </button>

        <div className="theme-modal-content" style={{ textAlign: 'center' }}>
          <div
            className="theme-modal-icon-wrap"
            style={{
              background: '#fef2f2',
              borderColor: '#fecaca',
              color: '#dc2626',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.12)'
            }}
            aria-hidden="true"
          >
            <AlertTriangle size={26} />
          </div>

          <h3
            id="delete-expense-title"
            className="theme-modal-title"
            style={{ margin: '0 0 8px 0', fontSize: '19px', fontWeight: 800, color: 'var(--text-main, #1c1917)' }}
          >
            Hapus Catatan Pengeluaran?
          </h3>

          <p
            id="delete-expense-desc"
            className="theme-modal-desc"
            style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: 'var(--text-muted, #78716c)', lineHeight: 1.5 }}
          >
            Tindakan ini akan menghapus catatan pengeluaran terpilih secara permanen dari sistem.
          </p>

          {/* DETAIL KARTU PENGELUARAN YANG AKAN DIHAPUS */}
          <div
            style={{
              width: '100%',
              background: 'var(--surface-2, #faf6ef)',
              border: '1px solid var(--border, #e7e0d6)',
              borderRadius: '12px',
              padding: '12px 14px',
              textAlign: 'left',
              marginBottom: '16px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span className="category-chip" style={{ margin: 0, fontSize: '11px' }}>
                {expense?.categoryName || 'Operasional'}
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #78716c)' }}>
                {formatModalDate(expense?.expenseDate)}
              </span>
            </div>

            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main, #1c1917)', marginBottom: '8px', wordBreak: 'break-word' }}>
              {expense?.note || 'Pengeluaran'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--border, #e7e0d6)', paddingTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #78716c)' }}>Nominal</span>
              <strong style={{ fontSize: '15px', color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                {money(expense?.amount || 0)}
              </strong>
            </div>
          </div>

          {error && (
            <div
              style={{
                width: '100%',
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12.5px',
                textAlign: 'left',
                boxSizing: 'border-box'
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="theme-modal-actions" style={{ width: '100%', marginTop: '6px', paddingTop: 0, borderTop: 0 }}>
            <button
              type="button"
              className="secondary-btn theme-modal-cancel-btn"
              onClick={onClose}
              disabled={loading}
              style={{ flex: 1, height: '42px' }}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1,
                height: '42px',
                background: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Trash2 size={15} />
              <span>{loading ? 'Menghapus...' : 'Hapus Catatan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

