# STR Approval Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Lark H5 Mini App covering the full STR workflow: all-user STR List monitoring, Manager approval flow, ICO processing flow (with CSV download + PR number input), role-based navigation, and a read-only STR Master Detail page.

**Architecture:** Lark H5 Mini App — standard HTML/CSS/JS pages. `tt.getUserInfo()` identifies the current user. Role is determined by checking `open_id` against the `STORE` field of Master Site records (Manager) and against `CONFIG.ICO_USER_IDS` (ICO). Bottom tab nav is rendered based on role. All API calls go through `tt.request()` to Lark Bitable HTTP API. No backend required.

**Tech Stack:** Lark H5 Mini App, Lark JSAPI (`tt.*`), vanilla HTML/CSS/JS (`var` only — no `const`/`let`), Lark Bitable HTTP API.

**Prerequisite:** Plan A complete — Lark Bases and all tables exist. The `PR Number` (Text) field must be manually added to STR_Header table in Lark Base before Task 8.

---

## File Map

| File | Responsibility |
|---|---|
| `lark-mini-app/app.json` | App manifest — pages list (all 7 pages), window style, App ID |
| `lark-mini-app/app.js` | Global lifecycle (onLaunch) |
| `lark-mini-app/app.css` | Global reset + CSS variables |
| `lark-mini-app/utils/config.js` | CONFIG: tokens, table IDs, field names, `ICO_USER_IDS` array |
| `lark-mini-app/utils/auth.js` | `getUserInfo()` → `Promise<{openId, nickName}>` |
| `lark-mini-app/utils/api.js` | `larkSearch()`, `larkUpdate()`, `larkCreate()` |
| `lark-mini-app/pages/home/index.{html,js,css}` | Role detection, bottom tab nav, default to STR List |
| `lark-mini-app/pages/str-list/index.{html,js,css}` | All STR monitoring with filter tabs (All/Waiting Approval/Waiting Create/Done/Reject) |
| `lark-mini-app/pages/str-detail/index.{html,js,css}` | Read-only master detail: header + items table + PR number |
| `lark-mini-app/pages/approval/index.{html,js,css}` | Manager: list of STR with `Status = 'Waiting Approval by Mgr'` for their sites |
| `lark-mini-app/pages/approval-detail/index.{html,js,css}` | Manager: Approve (→ `Waiting Create by ICO`) or Reject (→ `Reject`) |
| `lark-mini-app/pages/ico-list/index.{html,js,css}` | ICO: list of STR with `Status = 'Waiting Create by ICO'` |
| `lark-mini-app/pages/ico-detail/index.{html,js,css}` | ICO: input PR number, Process Done or Reject, CSV download |

---

### Task 1: Initialize project structure

**Files:** All directories and placeholder files, `app.json`, `app.js`, `app.css`

- [ ] **Step 1: Create directory structure**

```powershell
$base = "C:\Users\116116.wili\str-request\lark-mini-app"
New-Item -ItemType Directory -Force "$base\utils"
New-Item -ItemType Directory -Force "$base\pages\home"
New-Item -ItemType Directory -Force "$base\pages\str-list"
New-Item -ItemType Directory -Force "$base\pages\str-detail"
New-Item -ItemType Directory -Force "$base\pages\approval"
New-Item -ItemType Directory -Force "$base\pages\approval-detail"
New-Item -ItemType Directory -Force "$base\pages\ico-list"
New-Item -ItemType Directory -Force "$base\pages\ico-detail"
```

- [ ] **Step 2: Create `lark-mini-app/app.json`**

```json
{
  "appId": "GANTI_DENGAN_APP_ID",
  "pages": [
    "pages/home/index",
    "pages/str-list/index",
    "pages/str-detail/index",
    "pages/approval/index",
    "pages/approval-detail/index",
    "pages/ico-list/index",
    "pages/ico-detail/index"
  ],
  "window": {
    "navigationBarTitleText": "STR Manager",
    "navigationBarBackgroundColor": "#111111",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f5f5f5"
  }
}
```

- [ ] **Step 3: Create `lark-mini-app/app.js`**

```javascript
App({ onLaunch: function() {} });
```

- [ ] **Step 4: Create `lark-mini-app/app.css`**

```css
page { background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

- [ ] **Step 5: Create placeholder files for all pages**

For each page dir (`home`, `str-list`, `str-detail`, `approval`, `approval-detail`, `ico-list`, `ico-detail`) create:
- `index.html`: `<!DOCTYPE html><html><body>loading...</body></html>`
- `index.js`: `// placeholder`
- `index.css`: (empty)

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/
git -C "C:/Users/116116.wili/str-request" commit -m "chore: init lark-mini-app full project structure (7 pages)"
```

---

### Task 2: Implement utils/config.js

**Files:** Create `lark-mini-app/utils/config.js`

- [ ] **Step 1: Create config.js with all tokens, table IDs, and ICO_USER_IDS**

```javascript
var CONFIG = {
  // Master Site Base
  MASTER_BASE_APP_TOKEN:  'CBu2bJJfraK08es2cnolJbMlgFe',
  MASTER_SITE_TABLE_ID:   'tbl1vV6z4FJ2Ge07',
  MASTER_SITE_FIELD:      'SITE',
  MASTER_SITE_NAME_FIELD: 'STORE Name',
  MASTER_SM_USER_FIELD:   'STORE',       // array of {id, open_id} — Store Manager users

  // STR Management Base
  STR_BASE_APP_TOKEN:    'NU3RwtirZipu3sk9nD8l7axOgHc',
  STR_HEADER_TABLE_ID:   'tblQ7qPdqgZ6QcOg',
  STR_DETAIL_TABLE_ID:   'tbluAki3HiMe1ppg',
  STR_TYPE_TABLE_ID:     'tblfBWxKU8Fh7EMJ',
  DEPT_TABLE_ID:         'tblH112oh1QPLPiZ',

  // Status values (exact strings used in Lark Base)
  STATUS_WAITING_MGR:    'Waiting Approval by Mgr',
  STATUS_WAITING_ICO:    'Waiting Create by ICO',
  STATUS_DONE:           'Done Create STR',
  STATUS_REJECT:         'Reject',

  // ICO user open_ids — admins maintain this list manually
  ICO_USER_IDS: [],   // e.g. ['ou_xxxxxxxxxxxxxxxx', 'ou_yyyyyyyyyyyyyyyy']

  API_BASE: 'https://open.larksuite.com'
};
```

- [ ] **Step 2: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/utils/config.js
git -C "C:/Users/116116.wili/str-request" commit -m "feat: add utils/config.js with all tokens, table IDs, status values, ICO_USER_IDS"
```

---

### Task 3: Implement utils/auth.js and utils/api.js

**Files:** Create `lark-mini-app/utils/auth.js`, Create `lark-mini-app/utils/api.js`

- [ ] **Step 1: Create `utils/auth.js`**

```javascript
function getUserInfo() {
  return new Promise(function(resolve, reject) {
    tt.getUserInfo({
      withCredentials: false,
      success: function(res) {
        resolve({
          openId:   res.userInfo.openId   || res.userInfo.open_id  || '',
          nickName: res.userInfo.nickName || res.userInfo.nick_name || ''
        });
      },
      fail: function(err) { reject(err); }
    });
  });
}
```

- [ ] **Step 2: Create `utils/api.js`**

```javascript
// fieldText: safely extract a plain string from any Lark field value.
// Primary/title fields return [{text:'...', type:'text'}] — this handles that case.
function fieldText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    return val.map(function(v) {
      return typeof v === 'string' ? v : (v.text || v.value || '');
    }).join('');
  }
  if (typeof val === 'object') return val.text || val.value || '';
  return String(val);
}

// larkSearch: POST /records/search — filter is optional {conjunction, conditions}
// Returns array of {record_id, fields: {...}}
function larkSearch(appToken, tableId, filter, pageSize) {
  return new Promise(function(resolve, reject) {
    var body = { page_size: pageSize || 500 };
    if (filter) body.filter = filter;
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data:   body,
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.items || []);
        } else {
          reject(new Error('larkSearch failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// larkUpdate: PUT /records/:recordId
// Returns updated record object
function larkUpdate(appToken, tableId, recordId, fields) {
  return new Promise(function(resolve, reject) {
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId,
      method: 'PUT',
      header: { 'Content-Type': 'application/json' },
      data:   { fields: fields },
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.record);
        } else {
          reject(new Error('larkUpdate failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}

// larkCreate: POST /records — creates a new record
// Returns created record object
function larkCreate(appToken, tableId, fields) {
  return new Promise(function(resolve, reject) {
    tt.request({
      url:    CONFIG.API_BASE + '/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data:   { fields: fields },
      success: function(res) {
        var d = res.data;
        if (d && d.code === 0) {
          resolve(d.data.record);
        } else {
          reject(new Error('larkCreate failed: ' + JSON.stringify(d)));
        }
      },
      fail: function(err) { reject(err); }
    });
  });
}
```

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/utils/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: add utils/auth.js and utils/api.js (larkSearch, larkUpdate, larkCreate)"
```

---

### Task 4: Home page — role detection and tab nav

**Files:** Modify `lark-mini-app/pages/home/index.{html,js,css}`

Logic: On load, call `getUserInfo()`, fetch all Master Site records, check if `open_id` appears in any site's `STORE` field → Manager. Check `CONFIG.ICO_USER_IDS` → ICO. Otherwise → default (read-only). Render bottom tabs accordingly, then navigate to str-list.

- [ ] **Step 1: Write `pages/home/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STR Manager</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat...</p></div>
    <div id="screen-error" class="center-msg" style="display:none">
      <p id="err-text" class="err-text"></p>
      <button id="btn-retry" class="btn-retry">Coba Lagi</button>
    </div>
    <!-- Tab nav injected by JS based on role -->
    <div id="tab-nav" class="tab-nav" style="display:none"></div>
    <!-- Content area: each tab loads via tt.navigateTo -->
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `pages/home/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; }
.page { min-height: 100vh; }
.center-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.btn-retry { background: #111; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; }
.tab-nav { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e0e0e0; display: flex; z-index: 50; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 0 10px; font-size: 11px; color: #888; cursor: pointer; }
.tab-item.active { color: #111; font-weight: 600; }
.tab-icon { font-size: 20px; margin-bottom: 2px; }
```

- [ ] **Step 3: Write `pages/home/index.js`**

```javascript
var TABS_ALL = [
  { id: 'str-list',  label: 'STR List',      icon: '📋', url: '/pages/str-list/index',  roles: ['manager','ico','default'] },
  { id: 'approval',  label: 'Need Approval', icon: '✅', url: '/pages/approval/index',  roles: ['manager'] },
  { id: 'ico-list',  label: 'Need Create',   icon: '📦', url: '/pages/ico-list/index',  roles: ['ico'] }
];

function showEl(id) {
  document.getElementById('screen-loading').style.display = 'none';
  document.getElementById('screen-error').style.display   = 'none';
  if (id === 'error') document.getElementById('screen-error').style.display = '';
}

function renderTabs(role) {
  var tabs = TABS_ALL.filter(function(t) { return t.roles.indexOf(role) !== -1; });
  var nav = document.getElementById('tab-nav');
  nav.innerHTML = tabs.map(function(t) {
    return '<div class="tab-item" data-url="' + t.url + '">' +
      '<span class="tab-icon">' + t.icon + '</span>' +
      '<span>' + t.label + '</span></div>';
  }).join('');
  nav.style.display = '';
  nav.querySelectorAll('.tab-item').forEach(function(el) {
    el.addEventListener('click', function() {
      nav.querySelectorAll('.tab-item').forEach(function(x) { x.classList.remove('active'); });
      el.classList.add('active');
      tt.navigateTo({ url: el.dataset.url });
    });
  });
  // Activate first tab
  if (nav.querySelector('.tab-item')) nav.querySelector('.tab-item').classList.add('active');
}

function init() {
  document.getElementById('screen-loading').style.display = '';
  document.getElementById('screen-error').style.display   = 'none';

  getUserInfo().then(function(user) {
    var openId = user.openId;

    // Check ICO first (simple array lookup)
    if (CONFIG.ICO_USER_IDS.indexOf(openId) !== -1) {
      renderTabs('ico');
      tt.navigateTo({ url: '/pages/str-list/index' });
      document.getElementById('screen-loading').style.display = 'none';
      return;
    }

    // Fetch master site to check Manager
    larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null).then(function(siteRecords) {
      var isManager = siteRecords.some(function(r) {
        var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
        if (!smUsers) return false;
        var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
        return arr.some(function(u) { return (u.id || u.open_id || u.openId) === openId; });
      });

      var role = isManager ? 'manager' : 'default';
      renderTabs(role);
      tt.navigateTo({ url: '/pages/str-list/index' });
      document.getElementById('screen-loading').style.display = 'none';
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat role: ' + (err.message || String(err));
      showEl('error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    showEl('error');
  });
}

document.getElementById('btn-retry').addEventListener('click', init);
init();
```

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/pages/home/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: home page — role detection and bottom tab nav"
```

---

### Task 5: STR List page

**Files:** Modify `lark-mini-app/pages/str-list/index.{html,js,css}`

Fetches ALL STR_Header records. Filter tabs at top: All / Waiting Approval / Waiting Create / Done / Reject. Each card shows: STR Number, Status badge, Site, Department, Submit Date, Plan Receive Date, PR Number. Tap card → `str-detail`.

- [ ] **Step 1: Write `pages/str-list/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>STR List</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <!-- Filter tabs -->
    <div class="filter-tabs" id="filter-tabs">
      <div class="filter-tab active" data-filter="all">All</div>
      <div class="filter-tab" data-filter="waiting-mgr">Waiting Approval</div>
      <div class="filter-tab" data-filter="waiting-ico">Waiting Create</div>
      <div class="filter-tab" data-filter="done">Done</div>
      <div class="filter-tab" data-filter="reject">Reject</div>
    </div>

    <div id="screen-loading" class="center-msg"><p>Memuat data...</p></div>
    <div id="screen-error" class="center-msg" style="display:none">
      <p id="err-text" class="err-text"></p>
      <button id="btn-retry" class="btn-retry">Coba Lagi</button>
    </div>
    <div id="screen-empty" class="center-msg" style="display:none"><p>Tidak ada data STR.</p></div>
    <div id="screen-list" style="display:none">
      <div id="list-container" class="list"></div>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `pages/str-list/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 0 0 72px; min-height: 100vh; }
.filter-tabs { display: flex; overflow-x: auto; background: #fff; border-bottom: 1px solid #e0e0e0; padding: 0 8px; gap: 0; position: sticky; top: 0; z-index: 10; }
.filter-tab { flex-shrink: 0; padding: 10px 14px; font-size: 13px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
.filter-tab.active { color: #111; font-weight: 600; border-bottom-color: #111; }
.center-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.btn-retry { background: #111; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; }
.list { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.card { background: #fff; border-radius: 10px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); cursor: pointer; }
.card:active { opacity: .85; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.str-num { font-weight: 700; font-size: 14px; color: #111; }
.badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
.badge-waiting-mgr  { background: #fff8e1; color: #e65100; }
.badge-waiting-ico  { background: #e3f2fd; color: #1565c0; }
.badge-done         { background: #e8f5e9; color: #2e7d32; }
.badge-reject       { background: #ffebee; color: #c62828; }
.card-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
.lbl { color: #888; min-width: 100px; flex-shrink: 0; }
```

- [ ] **Step 3: Write `pages/str-list/index.js`**

```javascript
var _allRecords = [];
var _activeFilter = 'all';

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_WAITING_MGR) return 'badge-waiting-mgr';
  if (status === CONFIG.STATUS_WAITING_ICO) return 'badge-waiting-ico';
  if (status === CONFIG.STATUS_DONE)        return 'badge-done';
  if (status === CONFIG.STATUS_REJECT)      return 'badge-reject';
  return 'badge-waiting-mgr';
}

function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('id-ID');
}

function filterRecords(records, filter) {
  if (filter === 'all') return records;
  var map = {
    'waiting-mgr': CONFIG.STATUS_WAITING_MGR,
    'waiting-ico': CONFIG.STATUS_WAITING_ICO,
    'done':        CONFIG.STATUS_DONE,
    'reject':      CONFIG.STATUS_REJECT
  };
  var target = map[filter];
  return records.filter(function(r) { return r.status === target; });
}

function renderList(records) {
  var filtered = filterRecords(records, _activeFilter);
  if (filtered.length === 0) { show('screen-empty'); return; }
  var container = document.getElementById('list-container');
  container.innerHTML = filtered.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header">' +
        '<span class="str-num">' + escHtml(item.strNumber) + '</span>' +
        '<span class="badge ' + statusBadgeClass(item.status) + '">' + escHtml(item.status) + '</span>' +
      '</div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Department</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit Date</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
      (item.prNumber ? '<div class="card-row"><span class="lbl">PR Number</span><span>' + escHtml(item.prNumber) + '</span></div>' : '') +
    '</div>';
  }).join('');
  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      tt.navigateTo({
        url: '/pages/str-detail/index?str=' + encodeURIComponent(card.dataset.str) + '&record=' + card.dataset.record
      });
    });
  });
  show('screen-list');
}

function loadList() {
  show('screen-loading');
  larkSearch(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, null)
    .then(function(records) {
      _allRecords = records.map(function(r) {
        return {
          recordId:       r.record_id,
          strNumber:      fieldText(r.fields['STR Number']),
          site:           fieldText(r.fields['Site']),
          siteName:       fieldText(r.fields['Site Name']),
          department:     fieldText(r.fields['Department']),
          status:         fieldText(r.fields['Status']),
          submitDate:     fmtDate(r.fields['Submit Date']),
          planReceiveDate: fmtDate(r.fields['Plan Receive Date']),
          prNumber:       fieldText(r.fields['PR Number'])
        };
      });
      renderList(_allRecords);
    })
    .catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
      show('screen-error');
    });
}

// Filter tab clicks
document.getElementById('filter-tabs').querySelectorAll('.filter-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    _activeFilter = tab.dataset.filter;
    renderList(_allRecords);
  });
});

document.getElementById('btn-retry').addEventListener('click', loadList);

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) loadList();
});

loadList();
```

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/pages/str-list/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: STR List page with filter tabs and status badges"
```

---

### Task 6: STR Master Detail page (read-only)

**Files:** Modify `lark-mini-app/pages/str-detail/index.{html,js,css}`

Receives URL params `str` (STR Number) and `record` (record_id). Fetches header + detail records. Displays full info and item table. No action buttons.

- [ ] **Step 1: Write `pages/str-detail/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detail STR</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat detail...</p></div>
    <div id="screen-error" class="center-msg" style="display:none">
      <p id="err-text" class="err-text"></p>
    </div>
    <div id="screen-content" style="display:none">
      <div class="section" id="section-header"></div>
      <div class="section">
        <div class="section-title" id="items-title">Item List</div>
        <div class="table-wrap" id="items-table"></div>
      </div>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `pages/str-detail/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 12px; min-height: 100vh; }
.center-msg { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.section { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
.section-title { font-weight: 700; font-size: 12px; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .5px; }
.info-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.info-lbl { color: #888; min-width: 110px; flex-shrink: 0; }
.info-val { flex: 1; }
.bold { font-weight: 700; }
.badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
.badge-waiting-mgr  { background: #fff8e1; color: #e65100; }
.badge-waiting-ico  { background: #e3f2fd; color: #1565c0; }
.badge-done         { background: #e8f5e9; color: #2e7d32; }
.badge-reject       { background: #ffebee; color: #c62828; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #f8f8f8; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #e0e0e0; white-space: nowrap; }
td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
td.num { text-align: right; font-weight: 600; }
```

- [ ] **Step 3: Write `pages/str-detail/index.js`**

```javascript
function getParams() {
  var qs = location.search.substring(1);
  var params = {};
  qs.split('&').forEach(function(p) {
    var kv = p.split('=');
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  return params;
}

function show(id) {
  ['screen-loading','screen-error','screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('id-ID');
}

function statusBadgeClass(status) {
  if (status === CONFIG.STATUS_WAITING_MGR) return 'badge-waiting-mgr';
  if (status === CONFIG.STATUS_WAITING_ICO) return 'badge-waiting-ico';
  if (status === CONFIG.STATUS_DONE)        return 'badge-done';
  if (status === CONFIG.STATUS_REJECT)      return 'badge-reject';
  return 'badge-waiting-mgr';
}

function renderHeader(h) {
  var rows = [
    ['STR Number',    '<span class="bold">' + escHtml(h.strNumber) + '</span>'],
    ['Status',        '<span class="badge ' + statusBadgeClass(h.status) + '">' + escHtml(h.status) + '</span>'],
    ['Site',          escHtml(h.site) + (h.siteName ? ' — ' + escHtml(h.siteName) : '')],
    ['Type STR',      escHtml(h.typeStr)],
    ['Supplying Site',escHtml(h.supplyingSite)],
    ['Department',    escHtml(h.department)],
    ['Plan Receive',  escHtml(h.planReceiveDate)],
    ['Requested By',  escHtml(h.requestedBy)],
    ['Submit Date',   escHtml(h.submitDate)],
    ['Approved By',   escHtml(h.approvedBy)],
    ['Approved Date', escHtml(h.approvedDate)],
    ['PR Number',     escHtml(h.prNumber) || '-'],
    ['Reject Reason', escHtml(h.rejectReason) || '-']
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val">' + r[1] + '</span></div>';
    }).join('');
}

function renderItems(items) {
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>Stock</th><th>Sales</th><th>Req Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr><td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td><td class="num">' + escHtml(it.salesQty) + '</td>' +
      '<td class="num">' + escHtml(it.requestQty) + '</td><td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function loadDetail() {
  show('screen-loading');
  var params = getParams();
  var strNumber = params.str || '';

  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [strNumber] }] }
    ).then(function(detailRecords) {
      detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      renderHeader({
        strNumber:       fieldText(h.fields['STR Number']),
        status:          fieldText(h.fields['Status']),
        site:            fieldText(h.fields['Site']),
        siteName:        fieldText(h.fields['Site Name']),
        typeStr:         fieldText(h.fields['Type STR']),
        supplyingSite:   fieldText(h.fields['Supplying Site']),
        department:      fieldText(h.fields['Department']),
        planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
        requestedBy:     fieldText(h.fields['Requested By']),
        submitDate:      fmtDate(h.fields['Submit Date']),
        approvedBy:      fieldText(h.fields['Approved By']),
        approvedDate:    fmtDate(h.fields['Approved Date']),
        prNumber:        fieldText(h.fields['PR Number']),
        rejectReason:    fieldText(h.fields['Reject Reason'])
      });

      renderItems(detailRecords.map(function(r) {
        return {
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
          salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
          requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
          reason:      fieldText(r.fields['Reason'])
        };
      }));

      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

loadDetail();
```

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/pages/str-detail/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: STR Master Detail page (read-only, all fields + items)"
```

---

### Task 7: Manager approval list + detail pages

**Files:** Modify `lark-mini-app/pages/approval/index.{html,js,css}`, Modify `lark-mini-app/pages/approval-detail/index.{html,js,css}`

Status corrections vs old plan: filter uses `'Waiting Approval by Mgr'`, Approve sets `'Waiting Create by ICO'`, Reject sets `'Reject'`.

- [ ] **Step 1: Write `pages/approval/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Need Approval</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat data...</p></div>
    <div id="screen-error" class="center-msg" style="display:none">
      <p id="err-text" class="err-text"></p>
      <button id="btn-retry" class="btn-retry">Coba Lagi</button>
    </div>
    <div id="screen-empty" class="center-msg" style="display:none">
      <p>Tidak ada STR yang perlu diapprove.</p>
    </div>
    <div id="screen-list" style="display:none">
      <div id="list-container" class="list"></div>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `pages/approval/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 12px 12px 72px; min-height: 100vh; }
.center-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.btn-retry { background: #111; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; }
.list { display: flex; flex-direction: column; gap: 10px; }
.card { background: #fff; border-radius: 10px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); cursor: pointer; }
.card:active { opacity: .85; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.str-num { font-weight: 700; font-size: 14px; color: #111; }
.badge-pending { background: #fff8e1; color: #e65100; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
.card-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
.lbl { color: #888; min-width: 80px; flex-shrink: 0; }
```

- [ ] **Step 3: Write `pages/approval/index.js`**

```javascript
function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) {
  if (!ms) return '-';
  return new Date(ms).toLocaleDateString('id-ID');
}

function renderList(list) {
  var container = document.getElementById('list-container');
  container.innerHTML = list.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header"><span class="str-num">' + escHtml(item.strNumber) + '</span><span class="badge-pending">Waiting Approval</span></div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Type</span><span>' + escHtml(item.typeStr) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Diajukan</span><span>' + escHtml(item.requestedBy) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      tt.navigateTo({
        url: '/pages/approval-detail/index?str=' + encodeURIComponent(card.dataset.str) + '&record=' + card.dataset.record
      });
    });
  });
}

function loadList() {
  show('screen-loading');
  getUserInfo().then(function(user) {
    var openId = user.openId;
    larkSearch(CONFIG.MASTER_BASE_APP_TOKEN, CONFIG.MASTER_SITE_TABLE_ID, null).then(function(siteRecords) {
      var mySites = siteRecords
        .filter(function(r) {
          var smUsers = r.fields[CONFIG.MASTER_SM_USER_FIELD];
          if (!smUsers) return false;
          var arr = Array.isArray(smUsers) ? smUsers : [smUsers];
          return arr.some(function(u) { return (u.id || u.open_id || u.openId) === openId; });
        })
        .map(function(r) { return fieldText(r.fields[CONFIG.MASTER_SITE_FIELD]); });

      if (mySites.length === 0) { show('screen-empty'); return; }

      larkSearch(
        CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
        { conjunction: 'AND', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_WAITING_MGR] }] }
      ).then(function(strRecords) {
        var list = strRecords
          .filter(function(r) { return mySites.indexOf(fieldText(r.fields['Site'])) !== -1; })
          .map(function(r) {
            return {
              recordId:    r.record_id,
              strNumber:   fieldText(r.fields['STR Number']),
              site:        fieldText(r.fields['Site']),
              siteName:    fieldText(r.fields['Site Name']),
              typeStr:     fieldText(r.fields['Type STR']),
              department:  fieldText(r.fields['Department']),
              requestedBy: fieldText(r.fields['Requested By']),
              submitDate:  fmtDate(r.fields['Submit Date'])
            };
          });

        if (list.length === 0) { show('screen-empty'); return; }
        renderList(list);
        show('screen-list');
      }).catch(function(err) {
        document.getElementById('err-text').textContent = 'Gagal memuat STR: ' + (err.message || String(err));
        show('screen-error');
      });
    }).catch(function(err) {
      document.getElementById('err-text').textContent = 'Gagal memuat site: ' + (err.message || String(err));
      show('screen-error');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal login: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
```

- [ ] **Step 4: Write `pages/approval-detail/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Approve STR</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat detail...</p></div>
    <div id="screen-error" class="center-msg" style="display:none"><p id="err-text" class="err-text"></p></div>
    <div id="screen-content" style="display:none">
      <div class="section" id="section-header"></div>
      <div class="section">
        <div class="section-title" id="items-title">Item List</div>
        <div class="table-wrap" id="items-table"></div>
      </div>
      <div class="section" id="section-reject" style="display:none">
        <div class="section-title">Alasan Reject *</div>
        <textarea id="reject-reason" class="reject-input" placeholder="Tuliskan alasan reject..."></textarea>
      </div>
    </div>
    <div id="toast" class="toast" style="display:none"></div>
    <div class="footer" id="footer-main" style="display:none">
      <button class="btn-reject" id="btn-start-reject">Reject</button>
      <button class="btn-approve" id="btn-approve">Approve</button>
    </div>
    <div class="footer" id="footer-reject" style="display:none">
      <button class="btn-cancel" id="btn-cancel-reject">Batal</button>
      <button class="btn-confirm-reject" id="btn-confirm-reject" disabled>Konfirmasi Reject</button>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `pages/approval-detail/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 12px 12px 80px; min-height: 100vh; }
.center-msg { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.section { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
.section-title { font-weight: 700; font-size: 12px; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .5px; }
.info-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.info-lbl { color: #888; min-width: 100px; flex-shrink: 0; }
.info-val { flex: 1; }
.bold { font-weight: 700; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #f8f8f8; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #e0e0e0; white-space: nowrap; }
td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
td.num { text-align: right; font-weight: 600; }
.reject-input { width: 100%; min-height: 80px; border: 1px solid #d0d0d0; border-radius: 6px; padding: 8px; font-size: 14px; box-sizing: border-box; }
.toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 8px 18px; border-radius: 20px; font-size: 13px; z-index: 100; }
.footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e0e0e0; padding: 10px 16px; display: flex; gap: 10px; }
.btn-reject { flex: 1; border: 1px solid #d0d0d0; background: #fff; border-radius: 6px; padding: 10px; font-size: 14px; color: #c62828; cursor: pointer; }
.btn-approve { flex: 2; background: #111; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
.btn-cancel { flex: 1; border: 1px solid #d0d0d0; background: #fff; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
.btn-confirm-reject { flex: 2; background: #c62828; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 6: Write `pages/approval-detail/index.js`**

```javascript
var _recordId  = '';
var _strNumber = '';
var _acting    = false;

function getParams() {
  var qs = location.search.substring(1);
  var params = {};
  qs.split('&').forEach(function(p) {
    var kv = p.split('=');
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  return params;
}

function show(id) {
  ['screen-loading','screen-error','screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, 2000);
}

function setActing(val) {
  _acting = val;
  document.getElementById('btn-approve').disabled = val;
  document.getElementById('btn-start-reject').disabled = val;
  document.getElementById('btn-approve').textContent = val ? 'Menyimpan...' : 'Approve';
  var confirmBtn = document.getElementById('btn-confirm-reject');
  confirmBtn.disabled = val || !document.getElementById('reject-reason').value.trim();
  confirmBtn.textContent = val ? 'Menyimpan...' : 'Konfirmasi Reject';
}

function renderHeader(h) {
  var rows = [
    ['STR Number',    h.strNumber, true],
    ['Site',          h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Type STR',      h.typeStr, false],
    ['Supplying Site',h.supplyingSite, false],
    ['Department',    h.department, false],
    ['Plan Receive',  h.planReceiveDate, false],
    ['Requested By',  h.requestedBy, false],
    ['Submit Date',   h.submitDate, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function renderItems(items) {
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>Stock</th><th>Sales</th><th>Req Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr><td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td><td class="num">' + escHtml(it.salesQty) + '</td>' +
      '<td class="num">' + escHtml(it.requestQty) + '</td><td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

function loadDetail() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];
    _recordId = h.record_id;

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    ).then(function(detailRecords) {
      detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      renderHeader({
        strNumber:       fieldText(h.fields['STR Number']),
        site:            fieldText(h.fields['Site']),
        siteName:        fieldText(h.fields['Site Name']),
        typeStr:         fieldText(h.fields['Type STR']),
        supplyingSite:   fieldText(h.fields['Supplying Site']),
        department:      fieldText(h.fields['Department']),
        planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
        requestedBy:     fieldText(h.fields['Requested By']),
        submitDate:      fmtDate(h.fields['Submit Date'])
      });

      renderItems(detailRecords.map(function(r) {
        return {
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
          salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
          requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
          reason:      fieldText(r.fields['Reason'])
        };
      }));

      document.getElementById('footer-main').style.display = '';
      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// Approve: Status → 'Waiting Create by ICO'
document.getElementById('btn-approve').addEventListener('click', function() {
  if (_acting) return;
  setActing(true);
  getUserInfo().then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':        CONFIG.STATUS_WAITING_ICO,
      'Approved By':   user.nickName || 'Manager',
      'Approved Date': Date.now()
    });
  }).then(function() {
    showToast('STR Approved! → Waiting Create by ICO', '#2e7d32');
    setTimeout(function() { tt.navigateBack(); }, 1500);
  }).catch(function(err) {
    showToast('Approve gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Start reject flow
document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = '';
  document.getElementById('footer-main').style.display = 'none';
  document.getElementById('footer-reject').style.display = '';
});

// Cancel reject
document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  document.getElementById('footer-reject').style.display = 'none';
  document.getElementById('footer-main').style.display = '';
});

// Enable confirm button when reason is filled
document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

// Confirm reject: Status → 'Reject'
document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  getUserInfo().then(function(user) {
    return larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
      'Status':        CONFIG.STATUS_REJECT,
      'Approved By':   user.nickName || 'Manager',
      'Approved Date': Date.now(),
      'Reject Reason': reason
    });
  }).then(function() {
    showToast('STR Rejected.', '#c62828');
    setTimeout(function() { tt.navigateBack(); }, 1500);
  }).catch(function(err) {
    showToast('Reject gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Init
var params = getParams();
_strNumber = params.str || '';
_recordId  = params.record || '';
loadDetail();
```

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/pages/approval/ lark-mini-app/pages/approval-detail/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: Manager approval list + detail (corrected status values)"
```

---

### Task 8: ICO List + Detail pages

**Files:** Modify `lark-mini-app/pages/ico-list/index.{html,js,css}`, Modify `lark-mini-app/pages/ico-detail/index.{html,js,css}`

**Prerequisite:** Add `PR Number` (Text) field manually to STR_Header table in Lark Base before testing this task.

ICO List filters `Status = 'Waiting Create by ICO'`. ICO Detail shows header + items + two actions: Process Done (input PR number → Status `Done Create STR`) or Reject (input reason → Status `Reject`, PR Number = `-`). Also has CSV download of article list.

- [ ] **Step 1: Write `pages/ico-list/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Need Create</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat data...</p></div>
    <div id="screen-error" class="center-msg" style="display:none">
      <p id="err-text" class="err-text"></p>
      <button id="btn-retry" class="btn-retry">Coba Lagi</button>
    </div>
    <div id="screen-empty" class="center-msg" style="display:none">
      <p>Tidak ada STR yang perlu diproses.</p>
    </div>
    <div id="screen-list" style="display:none">
      <div id="list-container" class="list"></div>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `pages/ico-list/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 12px 12px 72px; min-height: 100vh; }
.center-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.btn-retry { background: #111; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer; }
.list { display: flex; flex-direction: column; gap: 10px; }
.card { background: #fff; border-radius: 10px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.08); cursor: pointer; }
.card:active { opacity: .85; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.str-num { font-weight: 700; font-size: 14px; color: #111; }
.badge-ico { background: #e3f2fd; color: #1565c0; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
.card-row { display: flex; gap: 8px; margin-bottom: 4px; font-size: 13px; }
.lbl { color: #888; min-width: 80px; flex-shrink: 0; }
```

- [ ] **Step 3: Write `pages/ico-list/index.js`**

```javascript
function show(id) {
  ['screen-loading','screen-error','screen-empty','screen-list'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function renderList(list) {
  var container = document.getElementById('list-container');
  container.innerHTML = list.map(function(item) {
    return '<div class="card" data-str="' + escHtml(item.strNumber) + '" data-record="' + escHtml(item.recordId) + '">' +
      '<div class="card-header"><span class="str-num">' + escHtml(item.strNumber) + '</span><span class="badge-ico">Waiting Create</span></div>' +
      '<div class="card-row"><span class="lbl">Site</span><span>' + escHtml(item.site) + (item.siteName ? ' — ' + escHtml(item.siteName) : '') + '</span></div>' +
      '<div class="card-row"><span class="lbl">Dept</span><span>' + escHtml(item.department) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Submit</span><span>' + escHtml(item.submitDate) + '</span></div>' +
      '<div class="card-row"><span class="lbl">Plan Receive</span><span>' + escHtml(item.planReceiveDate) + '</span></div>' +
    '</div>';
  }).join('');

  container.querySelectorAll('.card').forEach(function(card) {
    card.addEventListener('click', function() {
      tt.navigateTo({
        url: '/pages/ico-detail/index?str=' + encodeURIComponent(card.dataset.str) + '&record=' + card.dataset.record
      });
    });
  });
}

function loadList() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'AND', conditions: [{ field_name: 'Status', operator: 'is', value: [CONFIG.STATUS_WAITING_ICO] }] }
  ).then(function(records) {
    var list = records.map(function(r) {
      return {
        recordId:       r.record_id,
        strNumber:      fieldText(r.fields['STR Number']),
        site:           fieldText(r.fields['Site']),
        siteName:       fieldText(r.fields['Site Name']),
        department:     fieldText(r.fields['Department']),
        submitDate:     fmtDate(r.fields['Submit Date']),
        planReceiveDate: fmtDate(r.fields['Plan Receive Date'])
      };
    });
    if (list.length === 0) { show('screen-empty'); return; }
    renderList(list);
    show('screen-list');
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

document.getElementById('btn-retry').addEventListener('click', loadList);
document.addEventListener('visibilitychange', function() { if (!document.hidden) loadList(); });
loadList();
```

- [ ] **Step 4: Write `pages/ico-detail/index.html`**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Process STR</title>
  <link rel="stylesheet" href="index.css">
</head>
<body>
  <div class="page">
    <div id="screen-loading" class="center-msg"><p>Memuat detail...</p></div>
    <div id="screen-error" class="center-msg" style="display:none"><p id="err-text" class="err-text"></p></div>
    <div id="screen-content" style="display:none">
      <div class="section" id="section-header"></div>
      <div class="section">
        <div class="section-title" id="items-title">Item List</div>
        <div class="table-wrap" id="items-table"></div>
      </div>
      <!-- PR Number input (shown for Process Done) -->
      <div class="section" id="section-pr" style="display:none">
        <div class="section-title">PR Number dari SAP *</div>
        <input type="text" id="pr-number-input" class="text-input" placeholder="Masukkan PR Number...">
      </div>
      <!-- Reject reason input -->
      <div class="section" id="section-reject" style="display:none">
        <div class="section-title">Alasan Reject *</div>
        <textarea id="reject-reason" class="reject-input" placeholder="Tuliskan alasan reject..."></textarea>
      </div>
    </div>
    <div id="toast" class="toast" style="display:none"></div>
    <!-- Main footer: Download CSV + Process Done + Reject -->
    <div class="footer footer-3" id="footer-main" style="display:none">
      <button class="btn-csv" id="btn-csv">📥 CSV</button>
      <button class="btn-reject" id="btn-start-reject">Reject</button>
      <button class="btn-done" id="btn-start-done">Process Done</button>
    </div>
    <!-- PR confirm footer -->
    <div class="footer" id="footer-pr" style="display:none">
      <button class="btn-cancel" id="btn-cancel-pr">Batal</button>
      <button class="btn-confirm-done" id="btn-confirm-done" disabled>Konfirmasi Done</button>
    </div>
    <!-- Reject confirm footer -->
    <div class="footer" id="footer-reject" style="display:none">
      <button class="btn-cancel" id="btn-cancel-reject">Batal</button>
      <button class="btn-confirm-reject" id="btn-confirm-reject" disabled>Konfirmasi Reject</button>
    </div>
  </div>
  <script src="/utils/config.js"></script>
  <script src="/utils/auth.js"></script>
  <script src="/utils/api.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `pages/ico-detail/index.css`**

```css
body { margin: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; }
.page { padding: 12px 12px 80px; min-height: 100vh; }
.center-msg { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #666; font-size: 14px; }
.err-text { color: #c62828; }
.section { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
.section-title { font-weight: 700; font-size: 12px; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .5px; }
.info-row { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; }
.info-lbl { color: #888; min-width: 100px; flex-shrink: 0; }
.info-val { flex: 1; }
.bold { font-weight: 700; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #f8f8f8; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #e0e0e0; white-space: nowrap; }
td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
td.num { text-align: right; font-weight: 600; }
.text-input { width: 100%; border: 1px solid #d0d0d0; border-radius: 6px; padding: 8px; font-size: 14px; box-sizing: border-box; }
.reject-input { width: 100%; min-height: 80px; border: 1px solid #d0d0d0; border-radius: 6px; padding: 8px; font-size: 14px; box-sizing: border-box; }
.toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #333; color: #fff; padding: 8px 18px; border-radius: 20px; font-size: 13px; z-index: 100; }
.footer { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid #e0e0e0; padding: 10px 16px; display: flex; gap: 8px; }
.footer-3 { gap: 6px; }
.btn-csv    { flex: 1; border: 1px solid #1565c0; background: #fff; border-radius: 6px; padding: 10px 6px; font-size: 13px; color: #1565c0; cursor: pointer; }
.btn-reject { flex: 1; border: 1px solid #d0d0d0; background: #fff; border-radius: 6px; padding: 10px 6px; font-size: 13px; color: #c62828; cursor: pointer; }
.btn-done   { flex: 2; background: #111; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
.btn-cancel { flex: 1; border: 1px solid #d0d0d0; background: #fff; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
.btn-confirm-done   { flex: 2; background: #2e7d32; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
.btn-confirm-reject { flex: 2; background: #c62828; color: #fff; border: none; border-radius: 6px; padding: 10px; font-size: 14px; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 6: Write `pages/ico-detail/index.js`**

```javascript
var _recordId   = '';
var _strNumber  = '';
var _acting     = false;
var _itemsCache = [];   // cache for CSV export

function getParams() {
  var qs = location.search.substring(1);
  var params = {};
  qs.split('&').forEach(function(p) {
    var kv = p.split('=');
    if (kv[0]) params[kv[0]] = decodeURIComponent(kv[1] || '');
  });
  return params;
}

function show(id) {
  ['screen-loading','screen-error','screen-content'].forEach(function(s) {
    document.getElementById(s).style.display = (s === id) ? '' : 'none';
  });
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(ms) { if (!ms) return '-'; return new Date(ms).toLocaleDateString('id-ID'); }

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color || '#333';
  t.style.display = '';
  setTimeout(function() { t.style.display = 'none'; }, 2500);
}

function setActing(val) {
  _acting = val;
  ['btn-csv','btn-start-reject','btn-start-done','btn-confirm-done','btn-confirm-reject'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.disabled = val;
  });
  if (val) {
    document.getElementById('btn-confirm-done').textContent   = 'Menyimpan...';
    document.getElementById('btn-confirm-reject').textContent = 'Menyimpan...';
  } else {
    document.getElementById('btn-confirm-done').textContent   = 'Konfirmasi Done';
    document.getElementById('btn-confirm-reject').textContent = 'Konfirmasi Reject';
  }
}

function showFooter(which) {
  ['footer-main','footer-pr','footer-reject'].forEach(function(id) {
    document.getElementById(id).style.display = (id === which) ? '' : 'none';
  });
}

function renderHeader(h) {
  var rows = [
    ['STR Number',    h.strNumber, true],
    ['Site',          h.site + (h.siteName ? ' — ' + h.siteName : ''), false],
    ['Type STR',      h.typeStr, false],
    ['Supplying Site',h.supplyingSite, false],
    ['Department',    h.department, false],
    ['Plan Receive',  h.planReceiveDate, false],
    ['Requested By',  h.requestedBy, false],
    ['Approved By',   h.approvedBy, false],
    ['Submit Date',   h.submitDate, false]
  ];
  document.getElementById('section-header').innerHTML =
    '<div class="section-title">Info STR</div>' +
    rows.map(function(r) {
      return '<div class="info-row"><span class="info-lbl">' + r[0] + '</span><span class="info-val' + (r[2] ? ' bold' : '') + '">' + escHtml(r[1]) + '</span></div>';
    }).join('');
}

function renderItems(items) {
  _itemsCache = items;
  document.getElementById('items-title').textContent = 'Item List (' + items.length + ')';
  var thead = '<thead><tr><th>#</th><th>Article</th><th>Description</th><th>Stock</th><th>Sales</th><th>Req Qty</th><th>Reason</th></tr></thead>';
  var tbody = '<tbody>' + items.map(function(it) {
    return '<tr><td>' + escHtml(it.seq) + '</td><td>' + escHtml(it.article) + '</td><td>' + escHtml(it.description) + '</td>' +
      '<td class="num">' + escHtml(it.stockQty) + '</td><td class="num">' + escHtml(it.salesQty) + '</td>' +
      '<td class="num">' + escHtml(it.requestQty) + '</td><td>' + escHtml(it.reason) + '</td></tr>';
  }).join('') + '</tbody>';
  document.getElementById('items-table').innerHTML = '<table>' + thead + tbody + '</table>';
}

// CSV download using data URI + hidden anchor
function downloadCsv() {
  var BOM = '﻿';  // UTF-8 BOM for Excel compatibility
  var header = 'No,Article,Description,Stock Qty,Sales Qty,Request Qty,Reason\n';
  var rows = _itemsCache.map(function(it) {
    function csvCell(v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }
    return [it.seq, it.article, it.description, it.stockQty, it.salesQty, it.requestQty, it.reason]
      .map(csvCell).join(',');
  }).join('\n');
  var csvContent = BOM + header + rows;
  var uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  var a = document.createElement('a');
  a.href = uri;
  a.download = _strNumber + '-items.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadDetail() {
  show('screen-loading');
  larkSearch(
    CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID,
    { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
  ).then(function(headerRecords) {
    if (headerRecords.length === 0) throw new Error('STR tidak ditemukan');
    var h = headerRecords[0];
    _recordId = h.record_id;

    return larkSearch(
      CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_DETAIL_TABLE_ID,
      { conjunction: 'AND', conditions: [{ field_name: 'STR Number', operator: 'is', value: [_strNumber] }] }
    ).then(function(detailRecords) {
      detailRecords.sort(function(a, b) { return (a.fields['Row Sequence'] || 0) - (b.fields['Row Sequence'] || 0); });

      renderHeader({
        strNumber:       fieldText(h.fields['STR Number']),
        site:            fieldText(h.fields['Site']),
        siteName:        fieldText(h.fields['Site Name']),
        typeStr:         fieldText(h.fields['Type STR']),
        supplyingSite:   fieldText(h.fields['Supplying Site']),
        department:      fieldText(h.fields['Department']),
        planReceiveDate: fmtDate(h.fields['Plan Receive Date']),
        requestedBy:     fieldText(h.fields['Requested By']),
        approvedBy:      fieldText(h.fields['Approved By']),
        submitDate:      fmtDate(h.fields['Submit Date'])
      });

      renderItems(detailRecords.map(function(r) {
        return {
          seq:         fieldText(r.fields['Row Sequence']),
          article:     fieldText(r.fields['Article']),
          description: fieldText(r.fields['Description']),
          stockQty:    r.fields['Stock Qty']     != null ? r.fields['Stock Qty'] : '',
          salesQty:    r.fields['Sales Qty']     != null ? r.fields['Sales Qty'] : '',
          requestQty:  r.fields['Request Qty']   != null ? r.fields['Request Qty'] : '',
          reason:      fieldText(r.fields['Reason'])
        };
      }));

      showFooter('footer-main');
      show('screen-content');
    });
  }).catch(function(err) {
    document.getElementById('err-text').textContent = 'Gagal memuat: ' + (err.message || String(err));
    show('screen-error');
  });
}

// CSV download
document.getElementById('btn-csv').addEventListener('click', function() {
  if (_itemsCache.length === 0) { showToast('Tidak ada item.', '#c62828'); return; }
  downloadCsv();
});

// Start Process Done flow: show PR input
document.getElementById('btn-start-done').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = '';
  document.getElementById('section-reject').style.display = 'none';
  showFooter('footer-pr');
  document.getElementById('pr-number-input').focus();
});

// Cancel PR input
document.getElementById('btn-cancel-pr').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = 'none';
  document.getElementById('pr-number-input').value = '';
  document.getElementById('btn-confirm-done').disabled = true;
  showFooter('footer-main');
});

// Enable Done confirm when PR input filled
document.getElementById('pr-number-input').addEventListener('input', function() {
  document.getElementById('btn-confirm-done').disabled = !this.value.trim();
});

// Confirm Done: Status → 'Done Create STR', PR Number = entered value
document.getElementById('btn-confirm-done').addEventListener('click', function() {
  var prNumber = document.getElementById('pr-number-input').value.trim();
  if (_acting || !prNumber) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status':    CONFIG.STATUS_DONE,
    'PR Number': prNumber
  }).then(function() {
    showToast('STR Done! PR: ' + prNumber, '#2e7d32');
    setTimeout(function() { tt.navigateBack(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Start Reject flow
document.getElementById('btn-start-reject').addEventListener('click', function() {
  document.getElementById('section-pr').style.display = 'none';
  document.getElementById('section-reject').style.display = '';
  showFooter('footer-reject');
  document.getElementById('reject-reason').focus();
});

// Cancel Reject
document.getElementById('btn-cancel-reject').addEventListener('click', function() {
  document.getElementById('section-reject').style.display = 'none';
  document.getElementById('reject-reason').value = '';
  document.getElementById('btn-confirm-reject').disabled = true;
  showFooter('footer-main');
});

// Enable Reject confirm when reason filled
document.getElementById('reject-reason').addEventListener('input', function() {
  document.getElementById('btn-confirm-reject').disabled = !this.value.trim();
});

// Confirm Reject: Status → 'Reject', PR Number = '-'
document.getElementById('btn-confirm-reject').addEventListener('click', function() {
  var reason = document.getElementById('reject-reason').value.trim();
  if (_acting || !reason) return;
  setActing(true);
  larkUpdate(CONFIG.STR_BASE_APP_TOKEN, CONFIG.STR_HEADER_TABLE_ID, _recordId, {
    'Status':        CONFIG.STATUS_REJECT,
    'PR Number':     '-',
    'Reject Reason': reason
  }).then(function() {
    showToast('STR Rejected by ICO.', '#c62828');
    setTimeout(function() { tt.navigateBack(); }, 1500);
  }).catch(function(err) {
    showToast('Gagal: ' + (err.message || err), '#c62828');
    setActing(false);
  });
});

// Init
var params = getParams();
_strNumber = params.str || '';
_recordId  = params.record || '';
loadDetail();
```

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/pages/ico-list/ lark-mini-app/pages/ico-detail/
git -C "C:/Users/116116.wili/str-request" commit -m "feat: ICO List + Detail pages (PR input, CSV download, Process Done/Reject)"
```

---

### Task 9: Register Lark Developer App + permissions

- [ ] **Step 1: Create Lark Developer App**

Open [open.larksuite.com](https://open.larksuite.com) → Create App → Mini Program (Gadget):
- App Name: `STR Manager`
- Note the App ID

- [ ] **Step 2: Update app.json with real App ID**

In `lark-mini-app/app.json`, replace `GANTI_DENGAN_APP_ID` with the actual App ID.

- [ ] **Step 3: Add API permissions in Lark Developer Console**

Permissions & Scopes → add:
- `bitable:app:readonly`
- `bitable:app`
- `contact:user.base:readonly`

- [ ] **Step 4: Populate ICO_USER_IDS in config.js**

After identifying ICO users' `open_id` values, update `CONFIG.ICO_USER_IDS` array in `utils/config.js`.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/116116.wili/str-request" add lark-mini-app/app.json lark-mini-app/utils/config.js
git -C "C:/Users/116116.wili/str-request" commit -m "chore: set App ID and ICO_USER_IDS in config"
```

---

### Task 10: Test all roles + deploy

- [ ] **Step 1: Install Lark Mini Program IDE (Developer Tools)**

Download from Lark Open Platform documentation page.

- [ ] **Step 2: Open project**

Developer Tools → Import Project → select folder `str-request/lark-mini-app/` → enter App ID.

- [ ] **Step 3: Test as default user (read-only)**

Login as user not in STORE field and not in ICO_USER_IDS:
- Expected: Bottom tab shows only "STR List". Can browse all STR, tap into detail (read-only).

- [ ] **Step 4: Test as Manager**

Login as Store Manager (open_id in STORE field of a Master Site record):
- Expected: Bottom tab shows "STR List" + "Need Approval". STR List shows all STR. Need Approval shows only `Waiting Approval by Mgr` for manager's sites.
- Test Approve: tap STR → detail → Approve. Verify status = `Waiting Create by ICO` in Lark Base.
- Test Reject: tap Reject → input reason → confirm. Verify status = `Reject`, Reject Reason filled.

- [ ] **Step 5: Test as ICO**

Login as ICO user (open_id in ICO_USER_IDS):
- Expected: Bottom tab shows "STR List" + "Need Create". Need Create shows only `Waiting Create by ICO`.
- Test CSV download: tap STR → detail → CSV button → file downloads with article list.
- Test Process Done: tap Process Done → input PR number → confirm. Verify status = `Done Create STR`, PR Number filled.
- Test Reject: tap Reject → input reason → confirm. Verify status = `Reject`, PR Number = `-`, Reject Reason filled.

- [ ] **Step 6: Test empty states and error states**

- Manager with no pending STRs → "Tidak ada STR yang perlu diapprove."
- ICO with no pending STRs → "Tidak ada STR yang perlu diproses."
- Network failure → error screen with Coba Lagi button.

- [ ] **Step 7: Deploy via Lark Developer Console**

Developer Tools → Upload → enter version number → Upload.
Lark Developer Console → Version Management → set as Production version.

- [ ] **Step 8: Add Mini App as Lark Tab**

Developer Console → App Features → Lark Workplace → add as Tab App.

- [ ] **Step 9: Final commit**

```bash
git -C "C:/Users/116116.wili/str-request" add .
git -C "C:/Users/116116.wili/str-request" commit -m "feat: Plan B complete — full STR system deployed (Manager + ICO + STR List)"
```

---
