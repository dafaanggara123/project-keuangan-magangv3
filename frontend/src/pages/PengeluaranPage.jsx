import React, { useEffect, useState } from 'react';
import {
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
import api, { getExpensesCached } from '../services/api';
import { dateFormatterLong, money } from '../utils/formatters';
import { ErrorState, PageHeader } from '../components/CommonUI';

/* =========================================================
   4. FINANCE COMPONENT (PENGELUARAN / OPEX)
   ========================================================= */
export default function PengeluaranPage() {
  const [expenses, setExpenses] = useState(null);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
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
    const rawData = await getExpensesCached({ force });

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

  const loadCategories = async () => {
    try {
      const response = await api.get('/expense-categories');
      const rawData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setCategories(rawData);
    } catch (e) {
      console.error('Kategori gagal dimuat, menggunakan fallback:', e);
      setCategories([
        { id: 1, name: 'Bahan Baku & Dapur' },
        { id: 2, name: 'Operasional & Utilitas' },
        { id: 3, name: 'Transportasi & Logistik' },
        { id: 4, name: 'Listrik & Air' },
        { id: 5, name: 'Perawatan Alat' },
        { id: 6, name: 'Lain-lain' }
      ]);
    }
  };

  const openExpenseModal = async (expenseToEdit = null) => {
    await loadCategories();
    setEditingExpense(expenseToEdit);
    setModal(true);
  };

  useEffect(() => {
    loadExpenses().catch((e) => {
      console.error('Gagal memuat keuangan:', e);
      setError(e?.response?.data?.error || e?.message || 'Gagal memuat data keuangan.');
    });
  }, []);

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
    setModal(false);
    setEditingExpense(null);
    await loadExpenses(true);
  };

  const remove = async (id) => {
    setActiveMenuId(null);
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?');
    if (!confirmed) return;
    try {
      await api.delete(`/expenses/${id}`);
      await loadExpenses(true);
    } catch (e) {
      console.error('Gagal menghapus pengeluaran:', e);
      alert(e?.response?.data?.error || e?.message || 'Pengeluaran gagal dihapus.');
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
                <th className="right">Tindakan</th>
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
                    <td className="right">
                      <button
                        type="button"
                        className="ghost-icon danger"
                        onClick={() => remove(expense.id)}
                        title="Hapus pengeluaran"
                      >
                        <Trash2 size={15} />
                      </button>
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
                                remove(expense.id);
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
    </>
  );
}

/* =========================================================
   ADD / EDIT EXPENSE MODAL
   ========================================================= */
function ExpenseModal({ categories, initialData = null, onClose, onSave }) {
  const [form, setForm] = useState({
    categoryId: initialData?.categoryId || categories[0]?.id || '',
    amount: initialData?.amount ? String(initialData.amount) : '',
    expenseDate: initialData?.expenseDate
      ? String(initialData.expenseDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    note: initialData?.note || ''
  });
  const [saving, setSaving] = useState(false);

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

