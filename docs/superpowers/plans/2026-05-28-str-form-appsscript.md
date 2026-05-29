# STR Form — Apps Script + Lark Base Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a publicly accessible STR request form (Google Apps Script Web App) that writes to Lark Base and serves as the data source for the approval Mini App.

**Architecture:** Google Apps Script serves an HTML form via `doGet()` and handles submission via `doPost()`. All Lark Base API calls are made server-side with `UrlFetchApp` using a tenant access token. The form is accessible to anyone with the URL — no Lark account required.

**Tech Stack:** Google Apps Script (GAS), Lark Bitable HTTP API (`open.larksuite.com`), HTML/CSS/JS (vanilla, served via HtmlService).

---

## File Map

| File | Responsibility |
|---|---|
| `google-apps-script/Code.gs` | doGet router, doPost submit handler, Lark API helpers, STR number generator |
| `google-apps-script/form.html` | Public request form — HTML structure, CSS, vanilla JS (dropdowns, item table, validation, submit) |

---

### Task 1: Create project directories

**Files:**
- Create: `str-request/google-apps-script/Code.gs` (placeholder)
- Create: `str-request/google-apps-script/form.html` (placeholder)

- [ ] **Step 1: Create directories**

```powershell
New-Item -ItemType Directory -Force "C:\Users\116116.wili\str-request\google-apps-script"
```

- [ ] **Step 2: Create placeholder Code.gs**

Create `str-request/google-apps-script/Code.gs`:
```javascript
// STR Form — Google Apps Script
// Deploy as Web App: Execute as Me, Access: Anyone
```

- [ ] **Step 3: Create placeholder form.html**

Create `str-request/google-apps-script/form.html`:
```html
<!DOCTYPE html>
<html><head><title>STR Form</title></head><body>placeholder</body></html>
```

- [ ] **Step 4: Commit**

```bash
git -C "C:\Users\116116.wili\str-request" init
git -C "C:\Users\116116.wili\str-request" add google-apps-script/
git -C "C:\Users\116116.wili\str-request" commit -m "chore: init str-request project structure"
```

---

### Task 2: Create Lark Base "STR Management" — 1 base, 4 tabel (manual)

**Files:** None (manual Lark action — record IDs di-paste ke CONFIG di Task 4)

- [ ] **Step 1: Create the base**

Buka Lark → Buat Base baru bernama `STR Management`.

- [ ] **Step 2: Create table STR_Type**

Rename tabel default → `STR_Type`. Fields:
- `Type Name` — Text (primary field)
- `Description` — Text

- [ ] **Step 3: Create table Department**

Tambah tabel baru → `Department`. Fields:
- `Dept Name` — Text (primary field)
- `Dept Code` — Text

- [ ] **Step 4: Create table STR_Header**

Tambah tabel baru → `STR_Header`. Fields:
- `STR Number` — Text (primary field)
- `Site` — Text
- `Site Name` — Text
- `Type STR` — Text
- `Supplying Site` — Text
- `Department` — Text
- `Plan Receive Date` — Date
- `Requested By` — Text
- `Submit Date` — Date
- `Status` — Single Select (options: `Open`, `Approved`, `Rejected`)
- `Approved By` — Text
- `Approved Date` — Date
- `Reject Reason` — Text
- `Submitted By User ID` — Text

- [ ] **Step 5: Create table STR_Detail**

Tambah tabel baru → `STR_Detail`. Fields:
- `STR Number` — Text (primary field)
- `Row Sequence` — Number
- `Article` — Text
- `Description` — Text
- `Stock Qty` — Number
- `Sales Qty` — Number
- `Request Qty` — Number
- `Reason` — Text

- [ ] **Step 6: Record the App Token and all Table IDs**

Buka URL base. Format: `https://ksglkd5w4qng.sg.larksuite.com/base/<APP_TOKEN>`

Catat (semua dari base yang sama):
- `STR_BASE_APP_TOKEN` = kode setelah `/base/` di URL
- `STR_TYPE_TABLE_ID` = buka tabel STR_Type → `tbl...` dari URL
- `DEPT_TABLE_ID` = buka tabel Department → `tbl...` dari URL
- `STR_HEADER_TABLE_ID` = buka tabel STR_Header → `tbl...` dari URL
- `STR_DETAIL_TABLE_ID` = buka tabel STR_Detail → `tbl...` dari URL

---

### Task 4: Create Google Apps Script project + PropertiesService config

**Files:** `google-apps-script/Code.gs` (append)

- [ ] **Step 1: Create a new Apps Script project**

1. Buka [script.google.com](https://script.google.com) → New project
2. Rename project menjadi `STR Request Form`

- [ ] **Step 2: Set PropertiesService values**

Di Apps Script editor → Project Settings → Script Properties, tambahkan:

| Property | Value |
|---|---|
| `LARK_APP_ID` | App ID dari Lark Developer Console |
| `LARK_APP_SECRET` | App Secret dari Lark Developer Console |
| `MASTER_BASE_APP_TOKEN` | `CBu2bJJfraK08es2cnolJbMlgFe` |
| `MASTER_SITE_TABLE_ID` | `tbl1vV6z4FJ2Ge07` |
| `STR_BASE_APP_TOKEN` | `NU3RwtirZipu3sk9nD8l7axOgHc` |
| `STR_TYPE_TABLE_ID` | `tblfBWxKU8Fh7EMJ` |
| `DEPT_TABLE_ID` | `tblH112oh1QPLPiZ` |
| `STR_HEADER_TABLE_ID` | `tblQ7qPdqgZ6QcOg` |
| `STR_DETAIL_TABLE_ID` | `tbluAki3HiMe1ppg` |

- [ ] **Step 3: Add setup test function to Code.gs**

```javascript
function testConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const required = [
    'LARK_APP_ID','LARK_APP_SECRET','MASTER_BASE_APP_TOKEN','MASTER_SITE_TABLE_ID',
    'STR_BASE_APP_TOKEN','STR_TYPE_TABLE_ID','DEPT_TABLE_ID',
    'STR_HEADER_TABLE_ID','STR_DETAIL_TABLE_ID'
  ];
  const missing = required.filter(k => !props[k]);
  if (missing.length) throw new Error('Missing props: ' + missing.join(', '));
  Logger.log('Config OK');
}
```

- [ ] **Step 4: Run testConfig from Apps Script editor**

Run → Run function → `testConfig`
Expected: Execution log shows `Config OK`

---

### Task 5: Implement Code.gs — Lark API core helpers

**Files:**
- Modify: `google-apps-script/Code.gs`

- [ ] **Step 1: Write test for getTenantToken**

Add to Code.gs:
```javascript
function testGetTenantToken() {
  const token = getTenantToken();
  if (!token || token.length < 20) throw new Error('Invalid token: ' + token);
  Logger.log('Token OK: ' + token.substring(0, 20) + '...');
}
```

- [ ] **Step 2: Run testGetTenantToken — expect fail (function not defined)**

- [ ] **Step 3: Implement getTenantToken**

```javascript
function getTenantToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('lark_token');
  if (cached) return cached;

  const props = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        app_id: props.getProperty('LARK_APP_ID'),
        app_secret: props.getProperty('LARK_APP_SECRET')
      })
    }
  );
  const data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('Auth error: ' + data.msg);
  cache.put('lark_token', data.tenant_access_token, 6000);
  return data.tenant_access_token;
}
```

- [ ] **Step 4: Run testGetTenantToken — expect PASS**

Expected in Execution log: `Token OK: t-...`

- [ ] **Step 5: Write test for larkSearch**

```javascript
function testLarkSearch() {
  const props = PropertiesService.getScriptProperties();
  const records = larkSearch(props.getProperty('MASTER_BASE_APP_TOKEN'), props.getProperty('MASTER_SITE_TABLE_ID'), null, 5);
  if (!Array.isArray(records) || records.length === 0) throw new Error('No records returned');
  Logger.log('larkSearch OK, first SITE: ' + records[0].fields['SITE']);
}
```

- [ ] **Step 6: Run testLarkSearch — expect fail**

- [ ] **Step 7: Implement larkSearch and larkCreate**

```javascript
function larkSearch(appToken, tableId, filter, pageSize) {
  const token = getTenantToken();
  const url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search';
  const payload = { page_size: pageSize || 500 };
  if (filter) payload.filter = filter;

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkSearch error: ' + data.msg);
  return data.data.items || [];
}

function larkCreate(appToken, tableId, fields) {
  const token = getTenantToken();
  const url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkCreate error: ' + data.msg);
  return data.data.record;
}

function larkUpdate(appToken, tableId, recordId, fields) {
  const token = getTenantToken();
  const url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId;
  const res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkUpdate error: ' + data.msg);
  return data.data.record;
}
```

- [ ] **Step 8: Run testLarkSearch — expect PASS**

Expected: `larkSearch OK, first SITE: J384` (or similar)

- [ ] **Step 9: Commit**

```bash
git -C "C:\Users\116116.wili\str-request" add google-apps-script/Code.gs
git -C "C:\Users\116116.wili\str-request" commit -m "feat: add Lark API core helpers (getTenantToken, larkSearch, larkCreate, larkUpdate)"
```

---

### Task 6: Implement Code.gs — getDropdowns, generateSTRNumber, doGet, doPost

**Files:**
- Modify: `google-apps-script/Code.gs`

- [ ] **Step 1: Write test for getDropdowns**

```javascript
function testGetDropdowns() {
  const result = getDropdowns();
  if (!result.sites || result.sites.length === 0) throw new Error('No sites');
  Logger.log('Dropdowns OK. Sites: ' + result.sites.length + ', Types: ' + result.strTypes.length + ', Depts: ' + result.departments.length);
}
```

- [ ] **Step 2: Implement getDropdowns**

```javascript
function getDropdowns() {
  const props = PropertiesService.getScriptProperties();

  const siteRecords = larkSearch(props.getProperty('MASTER_BASE_APP_TOKEN'), props.getProperty('MASTER_SITE_TABLE_ID'));
  const sites = siteRecords
    .map(function(r) { return { code: r.fields['SITE'], name: r.fields['STORE Name'] || '' }; })
    .filter(function(s) { return s.code; });

  const typeRecords = larkSearch(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('STR_TYPE_TABLE_ID'));
  const strTypes = typeRecords.map(function(r) { return r.fields['Type Name']; }).filter(Boolean);

  const deptRecords = larkSearch(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('DEPT_TABLE_ID'));
  const departments = deptRecords.map(function(r) { return r.fields['Dept Name']; }).filter(Boolean);

  return { sites: sites, strTypes: strTypes, departments: departments };
}
```

- [ ] **Step 3: Run testGetDropdowns — expect PASS**

Expected: `Dropdowns OK. Sites: 200+, Types: 0, Depts: 0`

- [ ] **Step 4: Write test for generateSTRNumber**

```javascript
function testGenerateSTRNumber() {
  const num = generateSTRNumber('J384');
  if (!/^STR\/J384\/\d{6}\/\d{4}$/.test(num)) throw new Error('Invalid format: ' + num);
  Logger.log('STR Number OK: ' + num);
}
```

- [ ] **Step 5: Implement generateSTRNumber**

```javascript
function generateSTRNumber(site) {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const yyyymm = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
  const prefix = 'STR/' + site + '/' + yyyymm + '/';

  const records = larkSearch(
    props.getProperty('STR_BASE_APP_TOKEN'),
    props.getProperty('STR_HEADER_TABLE_ID'),
    { conjunction: 'AND', conditions: [{ field_name: 'Site', operator: 'is', value: [site] }] }
  );

  const thisMonthCount = records.filter(function(r) {
    return (r.fields['STR Number'] || '').startsWith(prefix);
  }).length;

  const candidate = prefix + String(thisMonthCount + 1).padStart(4, '0');
  const exists = records.some(function(r) { return r.fields['STR Number'] === candidate; });
  if (exists) return prefix + String(thisMonthCount + 2).padStart(4, '0');
  return candidate;
}
```

- [ ] **Step 6: Run testGenerateSTRNumber — expect PASS**

Expected: `STR Number OK: STR/J384/202506/0001`

- [ ] **Step 7: Implement doGet and doPost**

```javascript
function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getDropdowns') {
    try {
      return ContentService.createTextOutput(JSON.stringify(getDropdowns()))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  var template = HtmlService.createTemplateFromFile('form');
  template.scriptUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle('Request New STR')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var header = data.header;
    var items = data.items;

    if (!header.site || !header.typeStr || !header.supplyingSite ||
        !header.department || !header.planReceiveDate || !header.requestedBy) {
      return jsonResponse({ success: false, error: 'Field header tidak lengkap' });
    }
    if (!items || items.length === 0) {
      return jsonResponse({ success: false, error: 'Minimal 1 item diperlukan' });
    }

    var props = PropertiesService.getScriptProperties();
    var strNumber = generateSTRNumber(header.site);
    var now = new Date();

    larkCreate(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('STR_HEADER_TABLE_ID'), {
      'STR Number':        strNumber,
      'Site':              header.site,
      'Site Name':         header.siteName || '',
      'Type STR':          header.typeStr,
      'Supplying Site':    header.supplyingSite,
      'Department':        header.department,
      'Plan Receive Date': new Date(header.planReceiveDate).getTime(),
      'Requested By':      header.requestedBy,
      'Submit Date':       now.getTime(),
      'Status':            'Open'
    });

    items.forEach(function(item, index) {
      larkCreate(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('STR_DETAIL_TABLE_ID'), {
        'STR Number':   strNumber,
        'Row Sequence': index + 1,
        'Article':      item.article || '',
        'Description':  item.description || '',
        'Stock Qty':    Number(item.stockQty) || 0,
        'Sales Qty':    Number(item.salesQty) || 0,
        'Request Qty':  Number(item.requestQty),
        'Reason':       item.reason || ''
      });
    });

    return jsonResponse({ success: true, strNumber: strNumber });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 8: Write test for doPost**

```javascript
function testDoPost() {
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        header: {
          site: 'J384', siteName: 'Test Store', typeStr: 'TEST_TYPE',
          supplyingSite: 'J768', department: 'TEST_DEPT',
          planReceiveDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          requestedBy: 'Test User - 000000'
        },
        items: [{ article: 'ART001', description: 'Test Item', stockQty: 10, salesQty: 5, requestQty: 3, reason: 'Test' }]
      })
    }
  };
  var result = JSON.parse(doPost(mockEvent).getContent());
  if (!result.success) throw new Error('doPost failed: ' + result.error);
  Logger.log('doPost OK, STR Number: ' + result.strNumber);
}
```

- [ ] **Step 9: Run testDoPost — expect PASS**

Expected: `doPost OK, STR Number: STR/J384/202506/0001`
Verify record muncul di Lark Base STR_Header dan STR_Detail.

- [ ] **Step 10: Commit**

```bash
git -C "C:\Users\116116.wili\str-request" add google-apps-script/Code.gs
git -C "C:\Users\116116.wili\str-request" commit -m "feat: implement getDropdowns, generateSTRNumber, doGet, doPost"
```

---

### Task 7: Build form.html — HTML structure + CSS

**Files:**
- Modify: `google-apps-script/form.html`

- [ ] **Step 1: Replace placeholder with full HTML + CSS**

Replace entire contents of `google-apps-script/form.html`:

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request New STR</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; background: #f5f5f5; color: #333; }
    #app { max-width: 960px; margin: 0 auto; padding: 16px; }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    label { font-weight: 500; font-size: 13px; }
    select, input[type="text"], input[type="date"] {
      border: 1px solid #d0d0d0; border-radius: 6px; padding: 8px 10px;
      font-size: 14px; width: 100%; background: #fff;
    }
    select:focus, input:focus { outline: none; border-color: #1a73e8; }

    hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }

    .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .table-container { overflow-x: auto; border: 1px solid #e0e0e0; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    thead { background: #f8f8f8; }
    th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 12px; white-space: nowrap; border-bottom: 1px solid #e0e0e0; }
    td { padding: 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    td input { border: 1px solid #d0d0d0; border-radius: 4px; padding: 6px 8px; font-size: 13px; width: 100%; min-width: 60px; }
    td input:focus { outline: none; border-color: #1a73e8; }
    td input[type="number"] { min-width: 70px; }
    .td-del { width: 32px; text-align: center; }
    .btn-del { background: none; border: none; color: #999; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px; }
    .btn-del:hover { background: #ffe0e0; color: #d00; }

    .btn-add { margin-top: 10px; background: none; border: 1px dashed #999; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; color: #555; }
    .btn-add:hover { border-color: #333; color: #333; }

    .error-msg { background: #fff0f0; border: 1px solid #ffcdd2; border-radius: 6px; padding: 10px 14px; color: #c62828; font-size: 13px; margin: 12px 0; }

    .footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    .btn-back { border: 1px solid #d0d0d0; background: #fff; border-radius: 6px; padding: 10px 22px; font-size: 14px; cursor: pointer; }
    .btn-submit { background: #111; color: #fff; border: none; border-radius: 6px; padding: 10px 22px; font-size: 14px; cursor: pointer; }
    .btn-submit:disabled { background: #888; cursor: not-allowed; }

    .screen { min-height: 200px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; }
    .success-box { background: #fff; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .str-badge { font-size: 20px; font-weight: 700; letter-spacing: 1px; background: #f0f4ff; color: #1a73e8; padding: 10px 20px; border-radius: 8px; margin: 12px 0; display: inline-block; }
    .btn-new { background: #111; color: #fff; border: none; border-radius: 6px; padding: 10px 22px; font-size: 14px; cursor: pointer; margin-top: 8px; }

    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div id="app">
    <div id="screen-loading" class="screen"><p>Memuat data, mohon tunggu...</p></div>

    <div id="screen-error" class="screen" style="display:none">
      <p>Gagal memuat data dropdown.</p>
      <button class="btn-back" onclick="loadDropdowns()">Coba Lagi</button>
    </div>

    <div id="screen-form" style="display:none">
      <h1>Request New STR</h1>
      <form id="str-form" novalidate>
        <div class="form-grid">
          <div class="form-group">
            <label for="f-site">Site *</label>
            <select id="f-site" required></select>
          </div>
          <div class="form-group">
            <label for="f-type">Type STR *</label>
            <select id="f-type" required></select>
          </div>
          <div class="form-group">
            <label for="f-supply">Supplying Site *</label>
            <select id="f-supply" required></select>
          </div>
          <div class="form-group">
            <label for="f-dept">Department *</label>
            <select id="f-dept" required></select>
          </div>
          <div class="form-group">
            <label for="f-date">Plan Receive Date *</label>
            <input type="date" id="f-date" required>
          </div>
          <div class="form-group">
            <label for="f-reqby">Requested By *</label>
            <input type="text" id="f-reqby" placeholder="Nama - NIP" required>
          </div>
        </div>

        <hr>

        <div class="table-section">
          <div class="table-header"><h3>Item List</h3></div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Article</th><th>Description</th><th>Stock Qty</th>
                  <th>Sales Qty</th><th>Request Qty *</th><th>Reason</th><th></th>
                </tr>
              </thead>
              <tbody id="item-tbody"></tbody>
            </table>
          </div>
          <button type="button" class="btn-add" id="btn-add-item">+ Add Item</button>
        </div>

        <div id="error-msg" class="error-msg" style="display:none"></div>

        <div class="footer">
          <button type="button" class="btn-back" id="btn-back">Back</button>
          <button type="submit" class="btn-submit" id="btn-submit">Submit STR</button>
        </div>
      </form>
    </div>

    <div id="screen-success" class="screen" style="display:none">
      <div class="success-box">
        <p style="font-size:16px;font-weight:600">STR Berhasil Dibuat!</p>
        <p style="color:#555;font-size:13px;margin-top:6px">Nomor STR kamu:</p>
        <div class="str-badge" id="str-number-display"></div>
        <p style="color:#555;font-size:12px">Screenshot atau catat nomor ini untuk tracking.</p>
        <button class="btn-new" onclick="resetForm()">Buat STR Baru</button>
      </div>
    </div>
  </div>
  <script>
    const SCRIPT_URL = '<?= scriptUrl ?>';
    // JS added in Task 8
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\116116.wili\str-request" add google-apps-script/form.html
git -C "C:\Users\116116.wili\str-request" commit -m "feat: add form.html HTML structure and CSS"
```

---

### Task 8: Build form.html — JavaScript logic

**Files:**
- Modify: `google-apps-script/form.html` (replace `// JS added in Task 8`)

- [ ] **Step 1: Replace `// JS added in Task 8` with full JS**

```javascript
let rowCount = 0;

async function loadDropdowns() {
  show('screen-loading');
  try {
    const res = await fetch(SCRIPT_URL + '?action=getDropdowns');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    fillSelect('f-site', data.sites.map(s => ({ value: s.code, label: s.code + (s.name ? ' — ' + s.name : '') })));
    fillSelect('f-supply', data.sites.map(s => ({ value: s.code, label: s.code + (s.name ? ' — ' + s.name : '') })));
    fillSelect('f-type', data.strTypes.map(t => ({ value: t, label: t })));
    fillSelect('f-dept', data.departments.map(d => ({ value: d, label: d })));
    if (document.getElementById('item-tbody').rows.length === 0) addRow();
    show('screen-form');
  } catch (e) {
    console.error(e);
    show('screen-error');
  }
}

function fillSelect(id, options) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="">-- Pilih --</option>';
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value; opt.textContent = label;
    sel.appendChild(opt);
  });
}

function addRow() {
  rowCount++;
  const id = rowCount;
  const tr = document.createElement('tr');
  tr.dataset.rid = id;
  tr.innerHTML =
    '<td><input type="text" class="c-art" placeholder="Kode artikel"></td>' +
    '<td><input type="text" class="c-desc" placeholder="Deskripsi"></td>' +
    '<td><input type="number" class="c-stock" min="0" value="0"></td>' +
    '<td><input type="number" class="c-sales" min="0" value="0"></td>' +
    '<td><input type="number" class="c-reqqty" min="1" placeholder="0"></td>' +
    '<td><input type="text" class="c-reason" placeholder="Alasan"></td>' +
    '<td class="td-del"><button type="button" class="btn-del" onclick="removeRow(' + id + ')">✕</button></td>';
  document.getElementById('item-tbody').appendChild(tr);
}

function removeRow(id) {
  const row = document.querySelector('tr[data-rid="' + id + '"]');
  if (row) row.remove();
}

function getRows() {
  return Array.from(document.querySelectorAll('#item-tbody tr')).map(row => ({
    article:     row.querySelector('.c-art').value.trim(),
    description: row.querySelector('.c-desc').value.trim(),
    stockQty:    row.querySelector('.c-stock').value,
    salesQty:    row.querySelector('.c-sales').value,
    requestQty:  row.querySelector('.c-reqqty').value,
    reason:      row.querySelector('.c-reason').value.trim()
  }));
}

function validate() {
  const errs = [];
  [['f-site','Site'],['f-type','Type STR'],['f-supply','Supplying Site'],
   ['f-dept','Department'],['f-date','Plan Receive Date'],['f-reqby','Requested By']
  ].forEach(([id, label]) => { if (!document.getElementById(id).value) errs.push(label + ' wajib diisi'); });
  const dateVal = document.getElementById('f-date').value;
  if (dateVal) {
    const picked = new Date(dateVal), today = new Date();
    today.setHours(0,0,0,0);
    if (picked < today) errs.push('Plan Receive Date tidak boleh masa lalu');
  }
  const rows = getRows();
  if (rows.length === 0) { errs.push('Minimal 1 item harus ditambahkan'); return errs; }
  if (!rows.some(r => Number(r.requestQty) > 0)) errs.push('Minimal 1 item dengan Request Qty > 0');
  return errs;
}

document.getElementById('str-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const errs = validate();
  const errEl = document.getElementById('error-msg');
  if (errs.length) {
    errEl.textContent = errs.join(' • ');
    errEl.style.display = 'block';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  errEl.style.display = 'none';
  const siteEl = document.getElementById('f-site');
  const siteName = siteEl.options[siteEl.selectedIndex].text.split(' — ').slice(1).join(' — ');
  const payload = {
    header: {
      site:            siteEl.value,
      siteName:        siteName,
      typeStr:         document.getElementById('f-type').value,
      supplyingSite:   document.getElementById('f-supply').value,
      department:      document.getElementById('f-dept').value,
      planReceiveDate: document.getElementById('f-date').value,
      requestedBy:     document.getElementById('f-reqby').value.trim()
    },
    items: getRows()
  };
  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Submit gagal');
    document.getElementById('str-number-display').textContent = result.strNumber;
    show('screen-success');
  } catch (err) {
    errEl.textContent = 'Submit gagal: ' + err.message;
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Submit STR';
  }
});

document.getElementById('btn-add-item').addEventListener('click', addRow);
document.getElementById('btn-back').addEventListener('click', () => window.history.back());

function resetForm() {
  document.getElementById('str-form').reset();
  document.getElementById('item-tbody').innerHTML = '';
  rowCount = 0;
  loadDropdowns();
}

function show(id) {
  ['screen-loading','screen-error','screen-form','screen-success'].forEach(s => {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

window.onload = loadDropdowns;
```

- [ ] **Step 2: Commit**

```bash
git -C "C:\Users\116116.wili\str-request" add google-apps-script/form.html
git -C "C:\Users\116116.wili\str-request" commit -m "feat: add form.html JS (dropdowns, item table, validation, submit)"
```

---

### Task 9: Deploy + end-to-end test

- [ ] **Step 1: Copy files to Apps Script editor**

1. Paste seluruh isi `Code.gs` ke file Code.gs
2. Buat file HTML baru → rename ke `form` (tanpa ekstensi) → paste isi `form.html`
   > Di Apps Script, file HTML diakses dengan `createTemplateFromFile('form')` — nama tanpa `.html`

- [ ] **Step 2: Deploy as Web App**

Deploy → New Deployment → Web App → Execute as: **Me** → Who has access: **Anyone** → Deploy → copy URL.

- [ ] **Step 3: Test dropdown endpoint**

Buka: `<DEPLOY_URL>?action=getDropdowns`
Expected: `{"sites":[{"code":"J384","name":"..."},...], "strTypes":[], "departments":[]}`

- [ ] **Step 4: Test form UI**

Buka `<DEPLOY_URL>` di browser:
- Loading screen → form muncul
- Dropdown Site & Supplying Site terisi 200+ options
- Klik `+ Add Item` → row baru
- Klik ✕ → row terhapus

- [ ] **Step 5: Test submit + verify in Lark Base**

1. Isi semua field, tambah 2 item rows
2. Klik Submit → success screen + STR Number muncul
3. Buka Lark Base "STR Management" → STR_Header ada 1 record baru, STR_Detail ada 2 records

- [ ] **Step 6: Test validation**

- Submit kosong → error message muncul
- Plan Receive Date = kemarin → error "tidak boleh masa lalu"
- Submit tanpa item → error "minimal 1 item"

- [ ] **Step 7: Final commit**

```bash
git -C "C:\Users\116116.wili\str-request" add .
git -C "C:\Users\116116.wili\str-request" commit -m "feat: Plan A complete — STR form deployed and tested"
```

---

