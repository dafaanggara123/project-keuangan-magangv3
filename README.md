# Dapoersari Project 2 — Owner Analytics & Finance

Project 2 adalah workspace Owner yang memakai **database Supabase yang sama dengan Project 1**.
Project 1 tetap menjadi sumber transaksi (`orders`, `order_items`, `menu`). Project 2 menambahkan `expenses` dan `financial_settings` untuk keuangan owner.

## Modul
- Dashboard Owner
- Penjualan
- Keuangan / Pengeluaran
- Analitik produk, channel, dan jam ramai
- Sistem rekomendasi berbasis data
- Laporan + export CSV
- Pengaturan bisnis + potongan platform ShopeeFood

## Database yang digunakan
Project 1:
- `orders`
- `order_items`
- `menu`

Project 2:
- `expenses`
- `financial_settings`

Jalankan `database_project2.sql` di Supabase SQL Editor pada **project Supabase yang sama** dengan Project 1.

## Owner account
Project 2 hanya menerima profil dengan `role = 'owner'`.
Setelah SQL dijalankan, atur satu akun menjadi owner:

```sql
UPDATE public.profiles
SET role = 'owner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'EMAIL_OWNER');
```

## Backend
1. Masuk `backend`.
2. Copy `.env.example` menjadi `.env`.
3. Isi `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Install dan jalankan:

```powershell
npm install
npm run dev
```

Backend default: `http://localhost:4100`.

**Service Role Key hanya boleh berada di backend `.env`, jangan pernah dimasukkan ke frontend.**

## Frontend
1. Masuk `frontend`.
2. Copy `.env.example` menjadi `.env`.
3. Pastikan API mengarah ke backend:

```env
VITE_API_URL=http://localhost:4100/api
```

4. Install dan jalankan:

```powershell
npm install
npm run dev
```

Frontend default: `http://localhost:5174`.

## Catatan perhitungan
- Penjualan kotor = seluruh transaksi `completed`.
- ShopeeFood dihitung dengan potongan platform sesuai `financial_settings` (default 25%).
- Penjualan bersih = penjualan kotor - potongan platform.
- Laba bersih = penjualan bersih - total pengeluaran.
- Project 1 **tidak** dihitung ulang atau diduplikasi oleh Project 2.
