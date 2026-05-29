# STR Mini App — Design Spec
**Date:** 2026-05-28
**Status:** Approved

---

## 1. Overview

Sistem dua komponen untuk mengelola Stock Transfer Request (STR):

1. **Google Apps Script Web App** — form publik yang bisa diakses siapa saja (requester tidak perlu akun Lark)
2. **Lark H5 Mini App** — halaman approval khusus untuk Store Manager (dalam ekosistem Lark)

---

## 2. Keputusan Arsitektur

| Keputusan | Pilihan |
|---|---|
| Form requester | Google Apps Script Web App (HTML publik) |
| Backend logic | Apps Script `doPost()` — no separate server |
| Approval UI | Lark H5 Mini App (webview dalam Lark) |
| Auth form | Tidak ada — form terbuka publik |
| Auth approval | Lark JSAPI (`tt.getAuthCode`, `tt.getUserInfo`) |
| API calls | `UrlFetchApp` (Apps Script) + `tt.request` (Mini App) |
| Notifikasi | Lark Automation (setup manual oleh user — di luar scope kode) |
| Region | Lark Singapore (`open.larksuite.com`) |
| Entry point Mini App | Lark Tab |

---

## 3. Lark Base — Data Layer

### 3.1 Base yang Ada (tidak diubah)
**Master Site Base**
- App Token: `CBu2bJJfraK08es2cnolJbMlgFe`
- Table ID: `tbl1vV6z4FJ2Ge07`
- Field yang dipakai:
  - `SITE` (Single Select) — kode toko, e.g. `J384`
  - `STORE Name` (Text) — nama toko
  - `STORE` (User) — Store Manager user(s) untuk site tersebut

### 3.2 Base Baru: "STR Management"

1 base, 4 tabel. Tabel master diisi manual oleh user setelah dibuat.

**Tabel: `STR_Header`**
| Field | Type | Keterangan |
|---|---|---|
| STR Number | Text (primary) | Format: `STR/{SITE}/{YYYYMM}/{SEQ4}` |
| Site | Text | Kode site |
| Site Name | Text | Nama toko |
| Type STR | Text | |
| Supplying Site | Text | Kode supplying site |
| Department | Text | |
| Plan Receive Date | Date | |
| Requested By | Text | Nama - NIP/ID (input manual) |
| Submit Date | Date | Auto-fill saat submit |
| Status | Single Select | `Open` / `Approved` / `Rejected` |
| Approved By | Text | Nama Store Manager |
| Approved Date | Date | |
| Reject Reason | Text | Diisi saat Reject |
| Submitted By User ID | Text | Kosong (requester tidak punya Lark) |

**Tabel: `STR_Detail`**
| Field | Type |
|---|---|
| STR Number | Text (primary) |
| Row Sequence | Number |
| Article | Text |
| Description | Text |
| Stock Qty | Number |
| Sales Qty | Number |
| Request Qty | Number |
| Reason | Text |

> Relasi STR_Header ↔ STR_Detail via nilai `STR Number` yang sama (Lark Base tidak support FK native).

---

## 4. File Structure

```
str-request/
├── google-apps-script/
│   ├── Code.gs           # doGet, doPost, STR logic, Lark Base API calls
│   └── form.html         # HTML form (dilayani oleh doGet, embedded di Code.gs)
│
└── lark-mini-app/
    ├── app.json           # Manifest: pages, window style, App ID
    ├── app.js             # Global lifecycle
    ├── app.css            # Global styles
    ├── pages/
    │   ├── approval/
    │   │   ├── index.html # List STR pending untuk Store Manager
    │   │   ├── index.js
    │   │   └── index.css
    │   └── approval-detail/
    │       ├── index.html # Detail STR + tombol Approve/Reject
    │       ├── index.js
    │       └── index.css
    └── utils/
        ├── config.js      # CONFIG constants (tokens, table IDs, field names)
        ├── api.js         # Wrapper tt.request → Lark Base CRUD
        └── auth.js        # tt.getAuthCode + getUserInfo
```

---

## 5. API & Logic Flow

### 5.1 Load Form (Apps Script)
```
User buka URL Apps Script
  → doGet() return HtmlService form.html
  → form.html onload: fetch /exec?action=getDropdowns
      → Apps Script query Master Site → Site options
      → Apps Script query STR_Type → Type STR options
      → Apps Script query Department → Department options
  → "Requested By" diisi manual oleh user
```

### 5.2 Submit STR (Apps Script → Lark Base)
```
User klik Submit
  → Validasi client-side (required, date, min 1 item)
  → POST ke Apps Script doPost()
      → Generate STR Number:
          query STR_Header filter Site=X AND Submit Date bulan ini
          count → SEQ = padStart(4, '0')
      → UrlFetchApp POST → Lark Base: create STR_Header (status=Open)
      → UrlFetchApp POST × N → Lark Base: create STR_Detail rows
      → Return JSON { success: true, strNumber: "STR/J384/202506/0001" }
  → form.html tampilkan layar sukses + STR Number
```

> Notifikasi ke Store Manager ditangani oleh **Lark Automation** (setup manual oleh user di Lark Base — trigger: record baru masuk STR_Header). Di luar scope kode ini.

### 5.3 Approval Flow (Lark Mini App)
```
Store Manager buka /approval/ (via Lark Tab)
  → tt.getUserInfo() → ambil open_id
  → Query Master Site: cari record dimana STORE contains currentUser open_id
      → dapat list SITE codes (e.g. ["J384", "J385"])
  → Query STR_Header: Status=Open AND Site IN [list site codes]
  → Render list

Tap satu STR → /approval-detail/?str=...
  → Fetch STR_Header by STR Number
  → Fetch STR_Detail by STR Number
  → Render header info + item table

Tap "Approve"
  → PATCH STR_Header: Status=Approved, Approved By, Approved Date

Tap "Reject"
  → Muncul input Reject Reason (required)
  → PATCH STR_Header: Status=Rejected, Reject Reason, Approved By, Approved Date
  → Kembali ke list
```

---

## 6. STR Number Generation

Format: `STR/{SITE}/{YYYYMM}/{SEQ}`
Contoh: `STR/J384/202506/0001`

Logika (di Apps Script):
1. Query `STR_Header` filter `Site = {site}` AND `Submit Date` dalam bulan berjalan
2. `count` = jumlah record yang ditemukan
3. `SEQ = String(count + 1).padStart(4, '0')`

> Race condition: untuk MVP/internal tool ini acceptable. Jika terjadi conflict (dua submit hampir bersamaan), Apps Script retry otomatis 1x dengan SEQ+1.

---

## 7. Validasi & Error Handling

### Client-side (form.html)
| Kondisi | Pesan |
|---|---|
| Header field kosong | "Field [nama] wajib diisi" |
| Plan Receive Date < hari ini | "Tanggal tidak boleh masa lalu" |
| Tidak ada item row | "Minimal 1 item harus diisi" |
| Request Qty = 0 atau kosong | "Request Qty wajib > 0" |

### Apps Script (doPost)
| Kondisi | Response |
|---|---|
| Dropdown gagal load | Return error, form tampil "Gagal memuat, coba lagi" + Retry |
| Lark Base API error | Return `{ success: false, error: message }`, form tidak direset |
| STR Number conflict | Retry 1x dengan count+1 |

### Lark Mini App
| Kondisi | Perilaku |
|---|---|
| Fetch list gagal | Tampil "Gagal memuat, coba lagi" + tombol Retry |
| Approve/Reject gagal | Toast error, status tidak berubah |
| STR Number tidak ditemukan | Tampil "STR tidak ditemukan" |

---

## 8. CONFIG Reference

```javascript
// utils/config.js (Lark Mini App)
const CONFIG = {
  LARK_APP_ID: 'GANTI_DENGAN_APP_ID',

  // Master Site Base (existing)
  MASTER_BASE_APP_TOKEN:  'CBu2bJJfraK08es2cnolJbMlgFe',
  MASTER_SITE_TABLE_ID:   'tbl1vV6z4FJ2Ge07',
  MASTER_SITE_FIELD:      'SITE',
  MASTER_SITE_NAME_FIELD: 'STORE Name',
  MASTER_SM_USER_FIELD:   'STORE',

  // STR Master Data Base (baru dibuat)
  STR_MASTER_APP_TOKEN:   'GANTI_SETELAH_DIBUAT',
  STR_TYPE_TABLE_ID:      'GANTI_SETELAH_DIBUAT',
  STR_TYPE_FIELD:         'Type Name',
  DEPT_TABLE_ID:          'GANTI_SETELAH_DIBUAT',
  DEPT_FIELD:             'Dept Name',

  // STR Management Base (baru dibuat)
  STR_BASE_APP_TOKEN:     'GANTI_SETELAH_DIBUAT',
  STR_HEADER_TABLE_ID:    'GANTI_SETELAH_DIBUAT',
  STR_DETAIL_TABLE_ID:    'GANTI_SETELAH_DIBUAT',
};
```

```javascript
// Code.gs (Google Apps Script) — properti yang sama tersimpan di PropertiesService
// Apps Script menyimpan: LARK_APP_ID, LARK_APP_SECRET, semua token & table ID di atas
```

---

## 9. Setup Steps

1. **Buat Lark Developer App** di open.larksuite.com
   - Type: Mini App (H5)
   - Aktifkan permissions: `bitable:app:readonly`, `bitable:app`, `contact:user.base:readonly`

2. **Buat Lark Base "STR Master Data"** — tambah tabel `STR_Type` dan `Department`

3. **Buat Lark Base "STR Management"** — tambah tabel `STR_Header` dan `STR_Detail` sesuai spec section 3.3

4. **Copy semua App Token & Table ID ke CONFIG**

5. **Deploy Google Apps Script**
   - Paste App ID, App Secret, semua token ke PropertiesService
   - Deploy sebagai Web App: "Execute as Me", "Access: Anyone"
   - Copy Web App URL → bagikan ke requester

6. **Build & Deploy Lark Mini App**
   - `npm install -g @lark-project/cli` (atau sesuai Lark CLI terbaru)
   - Isi `app.json` dengan App ID
   - `lark-cli dev` untuk test
   - Upload via Lark Open Platform

---
