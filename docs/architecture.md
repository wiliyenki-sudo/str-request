# STR Request System — Architecture Design

**Project:** Stock Transfer Request (STR) Mini App  
**Platform:** Lark H5 Web App + Google Apps Script + Lark Base  
**Last Updated:** 2026-06-02

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            LARK APP (Mobile/Desktop)                    │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    Lark H5 Web App                               │  │
│   │              (GitHub Pages — Static HTML/CSS/JS)                 │  │
│   │                                                                  │  │
│   │   Home → STR List → STR Detail                                   │  │
│   │               ↓                                                  │  │
│   │        Approval Detail  (Manager)                                │  │
│   │        ICO List / ICO Detail  (ICO)                              │  │
│   └──────────────────┬───────────────────────────────────────────────┘  │
└─────────────────────-│──────────────────────────────────────────────────┘
                        │ JSONP (no CORS preflight)
                        ▼
         ┌──────────────────────────────┐
         │   Google Apps Script (GAS)   │
         │   · doGet()  — form + proxy  │
         │   · doPost() — STR submit    │
         │   · App Secret (secret safe) │
         └──────────────┬───────────────┘
                        │ HTTPS (Lark Open API)
                        ▼
         ┌──────────────────────────────┐       ┌───────────────────────┐
         │         Lark Base            │       │     Master Base        │
         │                              │       │                        │
         │  STR Header  (tblQ7q…)       │       │  Site Master  (tbl1v…) │
         │  STR Detail  (tbluAk…)       │       │  · Site code           │
         │  STR Type    (tblfBW…)       │       │  · Store name          │
         │  Department  (tblH11…)       │       │  · SM user list        │
         └──────────────────────────────┘       └───────────────────────┘

         ┌──────────────────────────────┐
         │    GAS Form (separate URL)   │
         │    form.html — STR creation  │
         │    (opened in browser/Lark)  │
         └──────────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Lark H5 Web App (GitHub Pages)

**URL:** `https://wiliyenki-sudo.github.io/str-request/lark-mini-app/`  
**Deploy:** Push to `main` branch → auto-deploy via GitHub Pages (no manual publish)

```
lark-mini-app/
├── app.js                      ← Root entry / router
├── utils/
│   ├── config.js   (v7)        ← Constants: tokens, table IDs, status values, ICO IDs
│   ├── auth.js     (v14)       ← Lark identity + role detection + localStorage cache
│   ├── api.js      (v5)        ← JSONP wrapper + GAS proxy + larkSearch/Update/Create
│   └── debug.js    (v3)        ← Debug panel (role override via sessionStorage)
└── pages/
    ├── home/                   ← Entry point, auth trigger, navigation menu
    ├── str-list/               ← STR list: tabs + search + date filter + Master Detail
    ├── str-detail/             ← Read-only STR header + item list
    ├── approval-detail/        ← Manager: Approve / Reject STR
    ├── ico-list/               ← ICO task list (Waiting Create)
    └── ico-detail/             ← ICO: Process Done (PR Number) / Reject
```

**Cache busting:** All JS files use `?v=N` suffix to force Lark WebView to reload.

---

### 2.2 Google Apps Script (GAS)

**File:** `google-apps-script/Code.gs`  
**Deployment:** Google Apps Script Web App — deployed as "Anyone can access"

| Handler | Trigger | Responsibility |
|---------|---------|----------------|
| `doGet()` | GET request | Serve `form.html` (STR creation) OR act as JSONP proxy for H5 app |
| `doPost()` | POST request | Receive STR submission, create Header + Detail records in Lark Base |

**Actions handled by `doGet()` (JSONP proxy):**

| `?action=` | Called By | Description |
|------------|-----------|-------------|
| `getDropdowns` | GAS Form | Return sites, STR types, departments |
| `getUserByCode` | H5 Auth | Exchange Lark auth code → openId + nickName |
| `larkSearch` | H5 App | Search records in any Lark Base table |
| `larkUpdate` | H5 App | Update a record field |
| `larkCreate` | H5 App | Create a new record |

> **Security:** `LARK_APP_SECRET` is stored exclusively in GAS PropertiesService.  
> It is **never** in any file or GitHub repository.

---

### 2.3 Lark Base (Database)

#### STR Base (`NU3RwtirZipu3sk9nD8l7axOgHc`)

**STR Header Table** (`tblQ7qPdqgZ6QcOg`)

| Field | Type | Description |
|-------|------|-------------|
| STR Number | Text | PK — format: `STR-{SITE}-{YYMMDD}-{NNN}` |
| Site | Text | 4-digit site code (e.g. `J338`) |
| Site Name | Text | Store name |
| Type STR | Select | Consignment / Regular / etc. |
| Supplying Site | Text | Source site code |
| Department | Select | LIVING / BUILDING / etc. |
| Plan Receive Date | Date | Target receive date |
| Requested By | Text | `{NIP} {Name}` |
| Submit Date | DateTime | Auto-set on creation |
| Status | Select | See Status Flow below |
| PR Number | Text | SAP PR Number (filled by ICO) |
| Reject Reason | Text | Filled on rejection |

**STR Detail Table** (`tbluAki3HiMe1ppg`)

| Field | Type | Description |
|-------|------|-------------|
| STR Number | Text | FK → STR Header.STR Number |
| Article | Text | Article code |
| Description | Text | Article description |
| Stock Qty | Number | Current stock |
| Sales Qty | Number | Recent sales |
| Request Qty | Number | Requested transfer quantity |
| Reason | Text | Reason for request |

**STR Type Table** (`tblfBWxKU8Fh7EMJ`) — dropdown source  
**Department Table** (`tblH112oh1QPLPiZ`) — dropdown source

#### Master Base (`CBu2bJJfraK08es2cnolJbMlgFe`)

**Site Master Table** (`tbl1vV6z4FJ2Ge07`)

| Field | Type | Description |
|-------|------|-------------|
| SITE | Text | 4-digit site code |
| STORE Name | Text | Full store name |
| STORE | User[] | Array of Store Manager Lark users (openId) |

---

## 3. Status Flow

```
                     [GAS Form Submit]
                            │
                            ▼
               ┌────────────────────────┐
               │  Waiting Approval      │  ← Initial status
               │  by Mgr                │
               └────────────┬───────────┘
                            │
              ┌─────────────┴──────────────┐
        [Approve]                      [Reject]
              │                            │
              ▼                            ▼
  ┌────────────────────────┐   ┌────────────────────┐
  │  Waiting Create        │   │      Reject         │  ← Terminal
  │  by ICO                │   └────────────────────┘
  └────────────┬───────────┘
               │
  ┌────────────┴──────────────┐
  │  [Process Done]       [Reject]
  │       │                   │
  ▼       ▼                   ▼
  ┌────────────────────┐  ┌────────────────────┐
  │  Done Create STR   │  │      Reject         │  ← Terminal
  │  + PR Number       │  └────────────────────┘
  └────────────────────┘
         ↑
  Appears in Master Detail tab
```

---

## 4. Authentication & Role Flow

```
User opens Home Page (Lark WebView)
          │
          ▼
   localStorage cache?
    ├─ YES (< 30 min) ──────────────────────────────────────────────────►
    └─ NO                                                                │
          │                                                             │
          ▼                                                             │
  tt.requestAuthCode()          ← Lark JSAPI                           │
          │                                                             │
          ▼                                                             │
  GAS: getUserByCode?code=...   ← JSONP                                │
          │                                                             │
          ▼                                                             │
  Lark API: /authen/v1/          ← GAS uses App Secret                 │
  access_token + user.info                                             │
          │                                                             │
          ▼                                                             │
  Returns { openId, nickName }                                         │
          │                                                             │
          ▼◄────────────────────────────────────────────────────────────┘
  Cache to localStorage (TTL 30 min)
          │
          ▼
   Role Detection (isICO)
    ├─ openId in ICO_USER_IDS[] → ICO role
    ├─ openId in Site Master STORE field → Manager role (site-filtered)
    └─ no openId → Anonymous (read-only, sees all)
```

### Role Access Matrix

| Feature | ICO | Manager | Anonymous |
|---------|-----|---------|-----------|
| STR List | All records | Own sites only | All records |
| STR Detail | ✅ | ✅ | ✅ |
| Approval Detail | ❌ | ✅ (own sites) | ❌ |
| ICO List | ✅ | ❌ | ❌ |
| ICO Detail | ✅ | ❌ | ❌ |
| Master Detail | All records | Own sites only | All records |
| Export CSV | ✅ | ✅ | ✅ |

---

## 5. Data Flows

### 5.1 STR Creation (GAS Form)

```
Browser / Lark WebView
        │
        │  1. Open GAS_URL (browser)
        ▼
   GAS doGet()
        │  2. Render form.html + inject scriptUrl
        ▼
   form.html loads
        │  3. GET ?action=getDropdowns (JSONP-like fetch)
        ▼
   GAS reads Lark Base → returns { sites, strTypes, departments }
        │  4. User fills form + Submit
        ▼
   Validation (client-side)
        │  5. POST JSON payload to GAS_URL
        ▼
   GAS doPost()
        ├── Generate STR Number: STR-{SITE}-{YYMMDD}-{NNN}
        ├── Create STR Header record (Lark API)
        ├── Create STR Detail records x N items (Lark API)
        └── Return { success: true, strNumber: "STR-J999-260530-001" }
        │
        ▼
   form.html shows success screen + STR Number
```

### 5.2 Manager Approval

```
Manager (Lark App)
        │
        │  1. Open STR List → "Waiting Approval" tab
        ▼
   larkSearch(STR_HEADER) + larkSearch(SITE_MASTER)
   Filter: Status = "Waiting Approval by Mgr"
           Site in Manager's assigned sites
        │
        │  2. Tap STR card
        ▼
   approval-detail?id={recordId}
   Fetch header + fetch all details for this STR Number
        │
        │  3a. Approve
        ▼
   larkUpdate: Status → "Waiting Create by ICO"

        │  3b. Reject (requires Reject Reason)
        ▼
   larkUpdate: Status → "Reject", Reject Reason → {text}
```

### 5.3 ICO Processing

```
ICO (Lark App)
        │
        │  1. Open ICO List (or STR List → "Waiting Create" tab)
        ▼
   larkSearch(STR_HEADER)
   Filter: Status = "Waiting Create by ICO"
        │
        │  2. Tap STR card
        ▼
   ico-detail?id={recordId}
   Fetch header + fetch all details
        │
        │  3a. Process Done (requires PR Number)
        ▼
   larkUpdate: Status → "Done Create STR", PR Number → {input}

        │  3b. Reject
        ▼
   larkUpdate: Status → "Reject", Reject Reason → {text}
```

---

## 6. API Communication Pattern

All H5 App → Lark Base communication goes through GAS as a proxy to avoid CORS.

```
H5 App                    GAS Proxy                    Lark Open API
   │                          │                              │
   │  JSONP ?action=larkSearch│                              │
   │  &appToken=...           │                              │
   │  &tableId=...            │                              │
   │  &filter=...             │                              │
   │  &callback=_cb123        │                              │
   ├─────────────────────────►│                              │
   │                          │  POST /bitable/v1/...        │
   │                          │  Authorization: Bearer {token}│
   │                          ├─────────────────────────────►│
   │                          │◄─────────────────────────────┤
   │                          │  { items: [...] }            │
   │  _cb123({ status:"ok",   │                              │
   │    data: { items:[...] } })                              │
   │◄─────────────────────────┤                              │
```

**Why JSONP?** Lark WebView blocks `fetch()` cross-origin requests to `script.google.com`. JSONP (`<script src="...&callback=fn">`) bypasses CORS entirely since script tags are not subject to same-origin policy.

**GAS App Token lifecycle:** GAS obtains a Lark tenant access token per call using `LARK_APP_ID` + `LARK_APP_SECRET` (both in PropertiesService), then uses it for Lark API requests.

---

## 7. STR List — Client-Side Filtering

The STR List page loads all accessible records once, then filters in-memory:

```
loadList()
    │
    ├── larkSearch(STR_HEADER) → _allRecords[]
    ├── larkSearch(SITE_MASTER) → build _headerMap{}  ← role filter applied here
    └── _detailsLoaded = false

User interaction (tab / search / date)
    │
    └── renderList() or renderMasterDetail()
            │
            ├── Tab filter   : status match OR "master-detail"
            ├── Text search  : STR Number / Site / Requester contains query
            ├── Date filter  : Submit Date within [dateFrom, dateTo]
            └── Role filter  : Manager sees only sites in _headerMap
                               (ICO / Anonymous see all)

Master Detail tab (lazy-loaded on first click):
    ├── loadDetails() → larkSearch(STR_DETAIL) → join with _headerMap
    ├── Filter: Status = "Done Create STR" AND PR Number ≠ empty
    └── _detailsLoaded = true (cached, not re-fetched)
```

---

## 8. Security Model

| Asset | Where Stored | Exposure |
|-------|-------------|----------|
| `LARK_APP_SECRET` | GAS PropertiesService only | Never in code or GitHub ✅ |
| `LARK_APP_ID` | GAS PropertiesService + config.js | Safe to expose ✅ |
| `STR_BASE_APP_TOKEN` | config.js (GitHub) | Safe — read-only Base token ✅ |
| Table IDs | config.js (GitHub) | Safe — not sensitive ✅ |
| `ICO_USER_IDS` | config.js (GitHub) | Acceptable — no secret data ✅ |
| User `openId` | localStorage (device) | TTL 30 min, no PII ✅ |

> Role enforcement is **client-side** (filter by site). The Lark Base itself is not row-level secured — a determined user with the Base token can bypass role filters. This is acceptable for internal tooling within Lark's authenticated environment.

---

## 9. Deployment

### Lark H5 Web App
```
git push origin main
    └── GitHub Pages auto-deploy (~1 min)
         └── Live at https://wiliyenki-sudo.github.io/str-request/
```
No separate publish step needed.

### Google Apps Script
```
Edit Code.gs / form.html in GAS Editor
    └── Deploy → New deployment (or update existing)
         └── GAS_URL in config.js must match deployment URL
```
> After updating GAS, always re-deploy with a new version or "Deploy as existing" to update the live URL.

### Cache Busting (Lark WebView)
Lark WebView aggressively caches static files. After any JS/CSS change:
- Increment `?v=N` on all `<script>` and `<link>` tags in the affected HTML file
- Commit and push

---

## 10. Key Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Lark H5 JS SDK | 1.5.20 | `tt.requestAuthCode()` — Lark identity |
| Lark Open API | v1 | Bitable CRUD, user auth |
| GitHub Pages | — | Static file hosting (free, auto-deploy) |
| Google Apps Script | — | Proxy + form backend (free tier) |
| Lark Base | — | Database (no server needed) |
