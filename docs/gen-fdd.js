// ICONIC Mini App — Functional Design Document Generator
// Run: node docs/gen-fdd.js

const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  ExternalHyperlink
} = require('docx');

// ── Helpers ────────────────────────────────────────────────────────────────────

const BRAND  = '1A56B4'; // blue brand accent
const DARK   = '1A1A2E'; // dark text
const LIGHT  = 'EEF3FB'; // light blue fill
const GRAY   = 'F5F5F5'; // light gray fill
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS_ALL = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND, font: 'Arial' })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: DARK, font: 'Arial' })]
  });
}
function h3(text) {
  return new Paragraph({
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, color: DARK, font: 'Arial' })]
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: DARK, ...opts })]
  });
}
function pBold(label, rest) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: 'Arial', color: DARK }),
      new TextRun({ text: rest, size: 22, font: 'Arial', color: DARK })
    ]
  });
}
function bullet(text, sub = false) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: sub ? 1 : 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: DARK })]
  });
}
function hr() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND, space: 1 } },
    children: [new TextRun('')]
  });
}
function spacer(before = 120) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [new TextRun('')] });
}

// ── Section colored header ─────────────────────────────────────────────────────
function sectionLabel(text) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({ children: [
      new TableCell({
        borders: BORDERS_ALL,
        shading: { fill: BRAND, type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, size: 26, color: 'FFFFFF', font: 'Arial' })]
        })]
      })
    ]})]
  });
}

// ── Generic data table (rows: [[cell,...], ...], header: bool) ─────────────────
function dataTable(rows, headerCols, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((row, ri) => new TableRow({
      children: row.map((cell, ci) => new TableCell({
        borders: BORDERS_ALL,
        width: { size: colWidths[ci], type: WidthType.DXA },
        shading: { fill: ri === 0 ? LIGHT : (ri % 2 === 0 ? GRAY : 'FFFFFF'), type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: cell, size: 20, font: 'Arial', color: DARK,
            bold: ri === 0 || (ci === 0 && headerCols) })]
        })]
      }))
    }))
  });
}

// ── Flow step box ──────────────────────────────────────────────────────────────
function flowTable(steps) {
  // steps: [{no, who, action, result}]
  const W = [560, 1600, 4000, 3200];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: ['#', 'Aktor', 'Aksi', 'Hasil / Catatan'].map((h, i) =>
        new TableCell({
          borders: BORDERS_ALL,
          width: { size: W[i], type: WidthType.DXA },
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })]
        })
      )}),
      ...steps.map((s, si) => new TableRow({ children: [s.no, s.who, s.action, s.result].map((txt, ci) =>
        new TableCell({
          borders: BORDERS_ALL,
          width: { size: W[ci], type: WidthType.DXA },
          shading: { fill: si % 2 === 0 ? 'FFFFFF' : GRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          verticalAlign: VerticalAlign.TOP,
          children: [new Paragraph({ children: [new TextRun({ text: txt, size: 20, font: 'Arial', color: DARK })] })]
        })
      )}))
    ]
  });
}

// ── Status badge table ─────────────────────────────────────────────────────────
function statusTable(rows) {
  const W = [2800, 2400, 4160];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: ['Status', 'Aktor yang Update', 'Keterangan'].map((h, i) =>
        new TableCell({
          borders: BORDERS_ALL, width: { size: W[i], type: WidthType.DXA },
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })]
        })
      )}),
      ...rows.map((r, ri) => new TableRow({ children: r.map((txt, ci) =>
        new TableCell({
          borders: BORDERS_ALL, width: { size: W[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? 'FFFFFF' : GRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: txt, size: 20, font: 'Arial', color: DARK, bold: ci === 0 })] })]
        })
      )}))
    ]
  });
}

// ── Architecture component table ───────────────────────────────────────────────
function archTable(rows) {
  const W = [2200, 2400, 4760];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: W,
    rows: [
      new TableRow({ children: ['Komponen', 'Teknologi', 'Peran'].map((h, i) =>
        new TableCell({
          borders: BORDERS_ALL, width: { size: W[i], type: WidthType.DXA },
          shading: { fill: BRAND, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })]
        })
      )}),
      ...rows.map((r, ri) => new TableRow({ children: r.map((txt, ci) =>
        new TableCell({
          borders: BORDERS_ALL, width: { size: W[ci], type: WidthType.DXA },
          shading: { fill: ri % 2 === 0 ? 'FFFFFF' : GRAY, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: txt, size: 20, font: 'Arial', color: DARK, bold: ci === 0 })] })]
        })
      )}))
    ]
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 600, hanging: 300 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '-',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 300 } } } },
        ]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 22, color: DARK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: BRAND },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND, space: 1 } },
          children: [
            new TextRun({ text: 'ICONIC — Functional Design Document', size: 18, font: 'Arial', color: '666666' }),
            new TextRun({ text: '\tVersi 1.0  |  Juni 2026', size: 18, font: 'Arial', color: '999999' }),
          ],
          tabStops: [{ type: 'right', position: 9360 }]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BRAND, space: 1 } },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Halaman ', size: 18, font: 'Arial', color: '999999' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '999999' }),
            new TextRun({ text: ' dari ', size: 18, font: 'Arial', color: '999999' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: 'Arial', color: '999999' }),
          ]
        })]
      })
    },
    children: [

      // ──────────────────────────────────────────────────────────────────────────
      // COVER PAGE
      // ──────────────────────────────────────────────────────────────────────────
      spacer(1800),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'ICONIC', bold: true, size: 72, font: 'Arial', color: BRAND })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({ text: 'Integrated Centralized Operations — Lark Mini App', size: 28, font: 'Arial', color: '555555', italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 1 } },
        spacing: { before: 0, after: 300 },
        children: [new TextRun('')]
      }),
      spacer(200),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'Functional Design Document', bold: true, size: 40, font: 'Arial', color: DARK })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: 'Versi 1.0  |  Juni 2026', size: 24, font: 'Arial', color: '777777' })]
      }),
      spacer(600),
      new Table({
        width: { size: 5400, type: WidthType.DXA },
        columnWidths: [2400, 3000],
        rows: [
          ...[ ['Dokumen', 'Functional Design Document (FDD)'],
               ['Versi', '1.0'],
               ['Status', 'Draft'],
               ['Platform', 'Lark H5 Web App'],
               ['Modul', 'STR & ADJ Centralization'],
             ].map(r => new TableRow({ children: r.map((txt, ci) =>
              new TableCell({
                borders: BORDERS_ALL,
                width: { size: [2400,3000][ci], type: WidthType.DXA },
                shading: { fill: ci === 0 ? LIGHT : 'FFFFFF', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: txt, size: 20, font: 'Arial', bold: ci===0, color: DARK })] })]
              })
            )}))
        ]
      }),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 1. OVERVIEW
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('1. Gambaran Umum'),
      spacer(160),
      h2('1.1 Apa itu ICONIC?'),
      p('ICONIC (Integrated Centralized Operations) adalah mini app yang berjalan di dalam platform Lark. Aplikasi ini menjadi jembatan digital untuk proses operasional toko yang sebelumnya dilakukan secara manual atau lewat email/WhatsApp.'),
      spacer(80),
      p('Saat ini ICONIC mengelola dua proses utama:'),
      bullet('Stock Transfer Request (STR) — pengajuan permintaan transfer stok antar toko'),
      bullet('Adjustment Centralization (ADJ) — pengajuan dan pemrosesan penyesuaian stok SAP'),
      spacer(120),
      h2('1.2 Tujuan Sistem'),
      bullet('Menggantikan proses manual (chat/email) dengan alur digital yang terstruktur'),
      bullet('Memastikan setiap pengajuan terlacak statusnya secara real-time di Lark Base'),
      bullet('Memisahkan akses berdasarkan peran — tidak semua orang bisa mengeksekusi semua aksi'),
      bullet('Menyimpan bukti dokumen (foto, BA, nomor reservasi) dalam satu tempat terpusat'),
      spacer(120),
      h2('1.3 Pengguna Aplikasi'),
      spacer(60),
      dataTable([
        ['Peran', 'Siapa', 'Akses Utama'],
        ['Department Staff', 'Staf toko yang mengajukan permintaan', 'Mengisi form pengajuan STR / ADJ (via Google Form)'],
        ['ICO\n(Inventory Control Officer)', 'Tim ICO yang memproses ADJ di SAP', 'Melihat daftar ADJ, input nomor reservasi, upload BA, tandai selesai'],
        ['Store Manager (SM)', 'Kepala toko', 'Menyetujui/menolak STR, mem-posting ADJ di SAP, konfirmasi selesai'],
      ], true, [2400, 2400, 4560]),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 2. ARSITEKTUR SISTEM
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('2. Arsitektur Sistem'),
      spacer(160),
      h2('2.1 Gambaran Besar'),
      p('ICONIC dibangun dari tiga lapisan utama yang bekerja sama:'),
      spacer(120),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1000, 3200, 5160],
        rows: [
          new TableRow({ children: ['Lapisan', 'Komponen', 'Fungsi'].map((h, i) =>
            new TableCell({
              borders: BORDERS_ALL, width: { size: [1000,3200,5160][i], type: WidthType.DXA },
              shading: { fill: BRAND, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })] })]
            })
          )}),
          ...[
            ['1 — Tampilan', 'Lark H5 Mini App\n(GitHub Pages)', 'Halaman web yang tampil di dalam Lark. Pengguna mengakses via tab Lark di smartphone/PC. Tidak perlu install app terpisah.'],
            ['2 — Logika & Keamanan', 'Google Apps Script\n(GAS)', 'Bertindak sebagai "perantara" antara tampilan dan Lark Base. Semua pemanggilan API Lark dan penyimpanan data melewati GAS. Kredensial (password API) tersimpan aman di sini, tidak pernah terekspos ke browser.'],
            ['3 — Data', 'Lark Base\n(Bitable)', 'Database berbasis tabel di dalam Lark. Menyimpan semua data transaksi (STR, ADJ) dan data master (site, ICO mapping). Bisa dilihat langsung oleh admin dari Lark.'],
          ].map((r, ri) => new TableRow({ children: r.map((txt, ci) =>
            new TableCell({
              borders: BORDERS_ALL, width: { size: [1000,3200,5160][ci], type: WidthType.DXA },
              shading: { fill: ri % 2 === 0 ? 'FFFFFF' : GRAY, type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: txt, size: 20, font: 'Arial', color: DARK, bold: ci === 0 })] })]
            })
          )}))
        ]
      }),
      spacer(200),
      h2('2.2 Alur Data (Sederhana)'),
      spacer(60),
      p('Berikut alur umum saat pengguna melakukan aksi di ICONIC:'),
      spacer(120),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2320, 440, 2320, 440, 2320, 440, 1080],
        rows: [new TableRow({ children:
          ['Pengguna\nbuka halaman', '→', 'Lark H5 App\nminta data', '→', 'Google Apps Script\nambil/simpan ke API', '→', 'Lark Base\n(database)'].map(function(txt, i) {
            return new TableCell({
              borders: (i % 2 === 0) ? BORDERS_ALL : { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              width: { size: [2320,440,2320,440,2320,440,1080][i], type: WidthType.DXA },
              shading: { fill: i % 2 === 0 ? LIGHT : 'FFFFFF', type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: txt, size: i % 2 === 0 ? 20 : 28, font: 'Arial',
                  bold: i % 2 === 0, color: i % 2 === 0 ? DARK : BRAND })]
              })]
            });
          })
        })]
      }),
      spacer(160),
      p('Pengguna tidak pernah berkomunikasi langsung ke Lark Base — selalu melewati GAS. Ini menjaga keamanan karena token dan secret API tersimpan di GAS, bukan di browser.'),
      spacer(200),

      h2('2.3 Komponen Sistem'),
      spacer(80),
      archTable([
        ['Lark H5 Mini App', 'HTML + CSS + JavaScript\n(GitHub Pages)', 'Antarmuka pengguna. Berjalan di browser webview Lark. Setiap modul punya halaman tersendiri (list, detail, proses).'],
        ['Google Apps Script', 'Google Workspace\n(GAS)', 'Backend serverless. Menangani: autentikasi Lark, pemanggilan Lark API, penyimpanan ke Lark Base, serve form HTML untuk pengajuan.'],
        ['Lark Base', 'Lark Bitable\n(Database)', 'Penyimpanan data. Tabel-tabel untuk STR Header, STR Detail, ADJ Header, ADJ Detail, Master Site, Master ICO.'],
        ['Lark Platform', 'Lark H5 SDK\n(tt.*)', 'Menyediakan identitas pengguna (openId, nama) yang terautentikasi otomatis saat buka mini app di Lark.'],
        ['Form Pengajuan', 'GAS HtmlService', 'Halaman form publik untuk Department Staff submit pengajuan. Tidak perlu login Lark.'],
      ]),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 3. MODUL STR
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('3. Modul STR — Stock Transfer Request'),
      spacer(160),
      h2('3.1 Tujuan Modul'),
      p('Modul STR memfasilitasi pengajuan permintaan transfer stok dari satu toko ke toko lain. Department staff mengisi form, Store Manager menyetujui atau menolak.'),
      spacer(120),
      h2('3.2 Alur Proses'),
      spacer(80),
      flowTable([
        { no: '1', who: 'Department Staff', action: 'Buka link Google Form (diakses dari Lark atau browser biasa)', result: 'Form pengajuan tampil dengan dropdown Site, Type STR, dll.' },
        { no: '2', who: 'Department Staff', action: 'Isi data STR: site asal, site tujuan, departemen, artikel, qty, alasan', result: 'Data tervalidasi di form' },
        { no: '3', who: 'Department Staff', action: 'Klik Kirim', result: 'GAS simpan data ke Lark Base (STR_Header + STR_Detail). Status = "Open". Nomor STR otomatis dibuat.' },
        { no: '4', who: 'Store Manager', action: 'Buka ICONIC di Lark → tab "STR Approval"', result: 'Daftar STR milik site-nya tampil, filter berdasarkan status' },
        { no: '5', who: 'Store Manager', action: 'Klik kartu STR untuk lihat detail', result: 'Detail lengkap tampil: info header + tabel item (artikel, qty, alasan)' },
        { no: '6A', who: 'Store Manager', action: 'Klik "Approve"', result: 'Status STR berubah jadi "Approved". Data tersimpan di Lark Base.' },
        { no: '6B', who: 'Store Manager', action: 'Klik "Reject" + isi alasan', result: 'Status STR berubah jadi "Rejected". Alasan tersimpan.' },
      ]),
      spacer(160),
      h2('3.3 Status STR'),
      spacer(60),
      statusTable([
        ['Open', 'Sistem (saat submit)', 'Pengajuan baru masuk, belum diproses Manager'],
        ['Approved', 'Store Manager', 'Disetujui. Proses transfer bisa dilakukan.'],
        ['Rejected', 'Store Manager', 'Ditolak dengan alasan. Department perlu buat pengajuan baru jika diperlukan.'],
      ]),
      spacer(160),
      h2('3.4 Halaman-Halaman STR'),
      spacer(80),
      dataTable([
        ['Halaman', 'Akses Oleh', 'Fungsi'],
        ['Form STR (GAS)', 'Department Staff', 'Input pengajuan baru. Dropdown dinamis dari Lark Base (Type STR, artikel). Tidak perlu login.'],
        ['STR List (ICO View)', 'ICO', 'Lihat semua STR yang sudah masuk. Filter status.'],
        ['STR List (Approval)', 'Store Manager', 'Lihat STR yang menunggu persetujuan. Filter status.'],
        ['STR Detail', 'Store Manager / ICO', 'Lihat detail lengkap pengajuan. Aksi Approve/Reject tersedia di halaman ini.'],
      ], true, [2400, 2200, 4760]),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 4. MODUL ADJ
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('4. Modul ADJ — Adjustment Centralization'),
      spacer(160),
      h2('4.1 Tujuan Modul'),
      p('Modul ADJ mengelola penyesuaian stok yang perlu diproses di SAP. Department mengajukan, ICO memverifikasi dan mempersiapkan dokumen pendukung, lalu Store Manager mem-posting di SAP dan mengkonfirmasi selesai.'),
      spacer(120),
      h2('4.2 Jenis Adjustment yang Didukung'),
      spacer(60),
      dataTable([
        ['Jenis Adjustment', 'Keterangan'],
        ['Article to Article', 'Pindah artikel: dari satu artikel ke artikel lain'],
        ['Adjustment Minus', 'Pengurangan stok'],
        ['Adjustment Plus', 'Penambahan stok'],
        ['Create Sales', 'Pembuatan transaksi penjualan adjustment'],
      ], false, [3200, 6160]),
      spacer(120),
      dataTable([
        ['Keterangan Adjustment', 'Keterangan'],
        ['Salah Jual', 'Kesalahan penjualan biasa'],
        ['Salah Jual Rugi', 'Kesalahan penjualan dengan kerugian — WAJIB upload BA Salju Rugi'],
        ['Perubahan Article', 'Perubahan kode artikel'],
        ['Shipping Mark', 'Terkait shipping mark'],
      ], false, [3200, 6160]),
      spacer(160),
      h2('4.3 Alur Proses ADJ'),
      spacer(80),
      flowTable([
        { no: '1', who: 'Department Staff', action: 'Buka form ADJ (via link GAS). Isi: site, departemen, jenis adjustment, keterangan, upload foto bukti, list artikel + qty', result: 'Data tervalidasi. Jika Salah Jual Rugi, foto BA wajib diisi.' },
        { no: '2', who: 'Sistem', action: 'Simpan ke Lark Base: ADJ Header + ADJ Detail (satu baris per artikel)', result: 'Nomor ADJ otomatis dibuat (format: ADJ-[SITE]-[YYMMDD]-[urutan]). Status = "Waiting Create by ICO"' },
        { no: '3', who: 'ICO', action: 'Buka ICONIC → tab ADJ → lihat kartu ADJ dengan status "Waiting Create by ICO"', result: 'Daftar ADJ di site ICO tampil' },
        { no: '4', who: 'ICO', action: 'Klik kartu ADJ → halaman proses ICO. Isi nomor reservasi SAP. Isi nomor dokumen artikel per baris.', result: 'Form terisi. Jika keterangan = Salah Jual Rugi, tombol upload BA tersedia.' },
        { no: '4a', who: 'ICO', action: '(Jika Salah Jual Rugi) Klik Upload BA → form upload tampil. Pilih file foto/PDF → Upload', result: 'File BA tersimpan di Lark Base. Halaman otomatis refresh.' },
        { no: '5', who: 'ICO', action: 'Klik "Process Done" → konfirmasi', result: 'Status berubah ke "Need Posting by Mgr". ICO diarahkan kembali ke daftar ADJ.' },
        { no: '6', who: 'Store Manager', action: 'Buka ICONIC → tab ADJ → lihat ADJ status "Need Posting by Mgr". Klik → halaman detail', result: 'Detail ADJ tampil + kolom input "Approved By" (nama manager yang posting di SAP)' },
        { no: '7', who: 'Store Manager', action: 'Posting ADJ di SAP (di luar app). Kembali ke ICONIC → isi nama Approved By → klik "Mark as Posted"', result: 'Status berubah ke "Done Create ADJ". Data lengkap tersimpan.' },
        { no: '8', who: 'ICO / Manager', action: 'Buka tab "Master Detail" di ADJ List', result: 'Tabel lengkap semua ADJ yang sudah selesai/need posting, dengan semua item detailnya. Bisa di-export ke Excel.' },
      ]),
      spacer(160),
      h2('4.4 Status ADJ'),
      spacer(60),
      statusTable([
        ['Waiting Create by ICO', 'Sistem (saat submit)', 'Pengajuan baru masuk, ICO belum mulai proses'],
        ['Need Posting by Mgr', 'ICO (Process Done)', 'ICO sudah isi dokumen, menunggu Manager posting di SAP'],
        ['Done Create ADJ', 'Store Manager (Mark as Posted)', 'ADJ sudah diposting di SAP. Proses selesai.'],
        ['Reject', 'ICO / Manager', 'Pengajuan ditolak dengan alasan. Tidak bisa diproses lagi.'],
      ]),
      spacer(160),
      h2('4.5 Halaman-Halaman ADJ'),
      spacer(80),
      dataTable([
        ['Halaman', 'Akses Oleh', 'Fungsi'],
        ['Form ADJ (GAS)', 'Department Staff', 'Input pengajuan ADJ baru. Upload foto bukti. Dropdown dinamis.'],
        ['ADJ List', 'ICO + Store Manager', 'Daftar semua ADJ sesuai site. Filter per status (tab). Filter tanggal & pencarian. Tab "Master Detail" untuk laporan.'],
        ['ADJ Proses (ICO)', 'ICO', 'Isi nomor reservasi, nomor dokumen per artikel. Upload BA jika Salah Jual Rugi. Tombol Process Done.'],
        ['ADJ Proses (Manager)', 'Store Manager', 'Isi nama Approved By. Tombol Mark as Posted. Tombol Reject.'],
        ['ADJ Detail (Read-only)', 'Semua peran', 'Lihat detail ADJ tanpa aksi. Untuk ADJ yang sudah selesai atau reject.'],
        ['Master Detail (Table)', 'ICO + Store Manager', 'Tabel lengkap semua item ADJ yang sudah diproses. Bisa export ke CSV/Excel.'],
      ], true, [2600, 2200, 4560]),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 5. FITUR LINTAS MODUL
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('5. Fitur Lintas Modul'),
      spacer(160),
      h2('5.1 Autentikasi Otomatis'),
      bullet('Saat pengguna buka ICONIC di Lark, identitas mereka (nama, ID Lark) otomatis terbaca tanpa perlu login ulang.'),
      bullet('Cache sesi disimpan lokal, sehingga navigasi antar halaman terasa instan.'),
      bullet('Jika sesi habis (30 menit tidak aktif), otomatis refresh saat buka halaman baru.'),
      spacer(120),
      h2('5.2 Kontrol Akses Berbasis Peran'),
      bullet('ICO: lihat & proses ADJ di site yang menjadi tanggung jawabnya. Ditentukan di tabel Master ICO di Lark Base.'),
      bullet('Store Manager: lihat & setujui/tolak STR + ADJ di site yang menjadi tanggung jawabnya. Ditentukan di tabel Master Site.'),
      bullet('Pengguna yang tidak masuk kategori apapun tidak dapat melihat data.'),
      spacer(120),
      h2('5.3 Filter & Pencarian'),
      bullet('Filter tab status (All, Waiting, Need Posting, Done, Reject)'),
      bullet('Filter tanggal submit (dari — sampai, default: bulan berjalan)'),
      bullet('Pencarian teks bebas (nomor ADJ/STR, nama requester)'),
      spacer(120),
      h2('5.4 Export Master Detail'),
      bullet('Tab Master Detail di ADJ List menampilkan semua item ADJ yang sudah diproses dalam format tabel.'),
      bullet('Tombol Export Excel menghasilkan file CSV yang bisa dibuka di Excel/Google Sheets.'),
      bullet('Filter tanggal berlaku untuk export — bisa filter per bulan.'),
      spacer(120),
      h2('5.5 Keamanan Data'),
      bullet('Semua akses ke Lark API melalui GAS — tidak ada kredensial di browser.'),
      bullet('Token API di-cache di server GAS dengan TTL otomatis (mengikuti masa berlaku dari Lark).'),
      bullet('Jika token habis saat operasi berlangsung, sistem otomatis refresh token dan coba ulang.'),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 6. DATA & INTEGRASI
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('6. Ringkasan Data & Integrasi'),
      spacer(160),
      h2('6.1 Lark Base — Tabel Data Utama'),
      spacer(80),
      dataTable([
        ['Tabel', 'Berisi', 'Ditulis Oleh'],
        ['ADJ Header', 'Satu baris per pengajuan ADJ. Berisi nomor ADJ, site, status, requester, tanggal, dll.', 'GAS (saat submit form)'],
        ['ADJ Detail', 'Satu baris per artikel dalam pengajuan. Relasi ke ADJ Header via Nomor ADJ.', 'GAS (saat submit form)'],
        ['STR Header', 'Satu baris per pengajuan STR. Berisi nomor STR, site, status, approval info.', 'GAS (saat submit form)'],
        ['STR Detail', 'Satu baris per artikel dalam STR. Relasi ke STR Header via Nomor STR.', 'GAS (saat submit form)'],
        ['Master Site', 'Data toko: kode site, nama toko, Store Manager yang bertanggung jawab.', 'Admin (manual di Lark Base)'],
        ['Master ICO', 'Mapping ICO ke site: ICO A bertanggung jawab atas site X, Y, Z.', 'Admin (manual di Lark Base)'],
      ], true, [2400, 4560, 2400]),
      spacer(160),
      h2('6.2 Nomor Dokumen Otomatis'),
      spacer(80),
      dataTable([
        ['Dokumen', 'Format', 'Contoh'],
        ['STR Number', 'STR/[SITE]/[YYYYMM]/[urutan 4 digit]', 'STR/J384/202606/0001'],
        ['ADJ Number', 'ADJ-[SITE]-[YYMMDD]-[urutan]', 'ADJ-J384-260606-001'],
      ], true, [2000, 4000, 3360]),
      spacer(80),
      p('Nomor urutan dihitung otomatis oleh GAS — dicek berapa record yang sudah ada hari ini untuk site tersebut, lalu nomor berikutnya ditambahkan.'),
      spacer(160),
      h2('6.3 Titik Integrasi'),
      spacer(80),
      dataTable([
        ['Dari', 'Ke', 'Via', 'Data yang Dikirim'],
        ['Lark H5 App', 'Google Apps Script', 'JSONP (HTTP GET)', 'Parameter aksi + data yang dibutuhkan'],
        ['Google Apps Script', 'Lark Base API', 'HTTPS POST/PUT/GET', 'Token autentikasi + payload data'],
        ['Lark Platform', 'Lark H5 App', 'tt.* SDK', 'ID pengguna (openId), nama pengguna'],
        ['Lark Base', 'GAS → Lark H5 App', 'JSON Response', 'Record data: status, field-field tabel'],
        ['Form GAS', 'Google Apps Script', 'HTTPS POST', 'Data pengajuan dari Department Staff'],
      ], true, [2000, 2000, 2200, 3160]),
      spacer(240),
      new Paragraph({ children: [new PageBreak()] }),

      // ──────────────────────────────────────────────────────────────────────────
      // 7. BATASAN & CATATAN
      // ──────────────────────────────────────────────────────────────────────────
      sectionLabel('7. Batasan & Catatan Implementasi'),
      spacer(160),
      h2('7.1 Yang Ada di Dalam Scope'),
      bullet('Alur pengajuan STR: form → approval → history'),
      bullet('Alur pengajuan ADJ: form → ICO process → Manager post → done'),
      bullet('Upload BA Salju Rugi (foto/PDF, max 2.5 MB)'),
      bullet('Monitoring dan filter di ADJ List'),
      bullet('Export data Master Detail ke CSV/Excel'),
      bullet('Autentikasi via Lark identity'),
      bullet('Pembagian akses ICO vs Store Manager per site'),
      spacer(120),
      h2('7.2 Yang Tidak Ada di Scope (Saat Ini)'),
      bullet('Notifikasi otomatis via Lark chat — harus setup manual via Lark Automation'),
      bullet('Integrasi langsung dengan SAP — proses SAP tetap dilakukan manual'),
      bullet('Dashboard analytics / grafik tren'),
      bullet('Multi-level approval'),
      bullet('Fitur edit pengajuan setelah submit'),
      spacer(120),
      h2('7.3 Dependensi External'),
      bullet('Lark Developer Console: konfigurasi App ID, App Secret, dan whitelist URL'),
      bullet('Lark Base: tabel-tabel data dan Master Site / Master ICO harus diisi manual oleh admin'),
      bullet('Google Apps Script: harus di-deploy dan credentials tersimpan di Properties Service'),
      bullet('GitHub Pages: hosting file frontend, update otomatis saat code di-push'),
      spacer(240),

      // ──────────────────────────────────────────────────────────────────────────
      // CLOSING
      // ──────────────────────────────────────────────────────────────────────────
      hr(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: 'ICONIC — Functional Design Document  |  Versi 1.0  |  Juni 2026', size: 18, color: '999999', font: 'Arial', italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, 'ICONIC-Functional-Design-Document.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ Dokumen berhasil dibuat:', outPath);
});
