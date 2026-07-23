// ─── Lark API Helpers ────────────────────────────────────────────────────────

var _TOKEN_CACHE_KEY = 'lark_token_cache';
var _TOKEN_CACHE_TTL = 110 * 60; // 110 menit (token valid 2 jam, sedikit margin)

// getLarkToken — cache token di CacheService dengan LockService supaya tidak concurrent fetch
// (concurrent fetch akan saling invalidate token di Lark)
function getLarkToken() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(_TOKEN_CACHE_KEY);
  if (cached) return cached;

  // Hanya satu execution yang boleh fetch token; sisanya tunggu lalu hit cache
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // tunggu maks 10 detik
  try {
    // Double-check setelah dapat lock (execution lain mungkin sudah isi cache)
    cached = cache.get(_TOKEN_CACHE_KEY);
    if (cached) return cached;

    var props     = PropertiesService.getScriptProperties();
    var appId     = props.getProperty('LARK_APP_ID');
    var appSecret = props.getProperty('LARK_APP_SECRET');
    var resp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ app_id: appId, app_secret: appSecret })
    });
    var data = JSON.parse(resp.getContentText());
    if (data.code !== 0) throw new Error('getLarkToken failed: ' + data.msg);
    var token = data.tenant_access_token;
    // Gunakan expiry dari Lark (biasanya 7200 detik) dikurangi 60 detik margin
    var ttl = Math.max(60, (data.expire || 7200) - 60);
    cache.put(_TOKEN_CACHE_KEY, token, ttl);
    return token;
  } finally {
    lock.releaseLock();
  }
}

// Utility: reset semua cache (token + dropdowns) — jalankan manual dari GAS editor jika token error
function clearCaches() {
  var cache = CacheService.getScriptCache();
  cache.remove(_TOKEN_CACHE_KEY);
  cache.remove('dropdowns_v4');
  Logger.log('Cache cleared.');
}

// Lark error code untuk invalid/expired token — trigger auto-refresh
var _LARK_TOKEN_ERRORS = { 99991663: true, 99991668: true, 99991677: true };

function _larkFetch(opts) {
  var resp = UrlFetchApp.fetch(opts.url, {
    method:              opts.method || 'get',
    headers:             opts.headers,
    payload:             opts.payload || undefined,
    muteHttpExceptions:  true
  });
  var body = JSON.parse(resp.getContentText());
  // Kalau Lark return token error, clear cache dan retry SEKALI dengan token baru
  if (body && _LARK_TOKEN_ERRORS[body.code]) {
    CacheService.getScriptCache().remove(_TOKEN_CACHE_KEY);
    var freshToken = getLarkToken();
    opts.headers['Authorization'] = 'Bearer ' + freshToken;
    var resp2 = UrlFetchApp.fetch(opts.url, {
      method:             opts.method || 'get',
      headers:            opts.headers,
      payload:            opts.payload || undefined,
      muteHttpExceptions: true
    });
    return JSON.parse(resp2.getContentText());
  }
  return body;
}

function larkApiGet(url, token) {
  return _larkFetch({
    url:     url,
    headers: { 'Authorization': 'Bearer ' + token }
  });
}

function larkApiPost(url, token, payload) {
  return _larkFetch({
    url:     url,
    method:  'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload)
  });
}

function fieldText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(function(v){ return (v && v.text) ? v.text : String(v); }).join('');
  if (val.text) return val.text;
  return String(val);
}

// ─── JSAPI Config untuk tt.config() di H5 Web App ────────────────────────────

function getJsapiConfig(pageUrl) {
  var props  = PropertiesService.getScriptProperties();
  var appId  = props.getProperty('LARK_APP_ID');

  // 1. Get tenant_access_token
  var token = getLarkToken();

  // 2. Get jsapi_ticket
  var ticketResp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/jssdk/ticket/get', {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: '{}'
  });
  var ticketData = JSON.parse(ticketResp.getContentText());
  if (ticketData.code !== 0) throw new Error('getJsapiTicket failed: ' + ticketData.msg);
  var ticket = ticketData.data.ticket;

  // 3. Generate SHA1 signature
  // Keys alphabetical: jsapi_ticket < noncestr < timestamp < url
  var timestamp = Math.floor(Date.now() / 1000);
  var nonceStr  = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var signStr   = 'jsapi_ticket=' + ticket +
                  '&noncestr='    + nonceStr +
                  '&timestamp='   + timestamp +
                  '&url='         + pageUrl;

  var signBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_1, signStr, Utilities.Charset.UTF_8
  );
  var signature = signBytes.map(function(b) {
    var h = (b & 0xFF).toString(16);
    return h.length === 1 ? '0' + h : h;
  }).join('');

  return { appId: appId, timestamp: timestamp, nonceStr: nonceStr, signature: signature };
}

// ─── Get User Info by Auth Code ───────────────────────────────────────────────

function getUserByCode(code) {
  // tt.requestAuthCode (H5 app) → exchange via authen/v1/access_token (bukan OIDC).
  // Endpoint ini butuh tenant_access_token (Bearer), bukan Basic appId:appSecret.
  // Response langsung berisi open_id dan name, tidak perlu call user_info terpisah.
  var token = getLarkToken();

  var tokenResp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/authen/v1/access_token', {
    method: 'post',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify({ grant_type: 'authorization_code', code: code })
  });
  var tokenData = JSON.parse(tokenResp.getContentText());
  if (tokenData.code !== 0) {
    throw new Error('getUserByCode failed: ' + JSON.stringify(tokenData));
  }

  return {
    openId:   tokenData.data.open_id || '',
    nickName: tokenData.data.name    || ''
  };
}

// ─── Form Dropdowns ───────────────────────────────────────────────────────────

var MASTER_APP  = 'CBu2bJJfraK08es2cnolJbMlgFe';
var MASTER_SITE = 'tbl1vV6z4FJ2Ge07';
var STR_APP     = 'Z0BrbJIloaJtSxsOTY4lOsQagEb';
var STR_TYPE    = 'tblfBWxKU8Fh7EMJ';
var DEPT_TABLE  = 'tblH112oh1QPLPiZ';
var STR_HEADER  = 'tblQ7qPdqgZ6QcOg';
var STR_DETAIL  = 'tbluAki3HiMe1ppg';
var ADJ_HEADER         = 'tblFGno3ONx4BseJ';
var ADJ_DETAIL         = 'tblUShPPgJW3fqBn';
var BASE               = 'https://open.larksuite.com/open-apis/bitable/v1/apps/';
var ARTICLE_GSHEET_ID  = '1OtUbXfM7CAAghfRkk3oe16xoqF1FuM8rwPkZybUB_dQ';
var ART_CHUNK_PREFIX   = 'artd_';
var ART_META_KEY       = 'artd_meta';

function getDropdowns() {
  // Cache dropdown data 15 menit — Sites/Types/Depts jarang berubah
  var cache     = CacheService.getScriptCache();
  var cacheKey  = 'dropdowns_v5';
  var cached    = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var token = getLarkToken();

  // Sites — pakai POST /records/search (konsisten dengan H5 app), page_size 500
  // Field 'SITE' = kode site (J999), 'STORE Name' = nama toko
  var sitesResp = larkApiPost(
    BASE + MASTER_APP + '/tables/' + MASTER_SITE + '/records/search', token,
    { page_size: 500 }
  );
  var sites = ((sitesResp.data && sitesResp.data.items) || []).map(function(r) {
    var code = fieldText(r.fields['SITE']);
    var name = fieldText(r.fields['STORE Name']);
    return { code: code, name: name };
  }).filter(function(s) { return !!s.code; });

  // Supplying Sites — kolom J (index 9) dan K (index 10) dari Google Sheet master article
  var supplySites = getSupplySitesFromGSheet_();

  // STR Types — pakai POST /records/search
  var typesResp = larkApiPost(
    BASE + STR_APP + '/tables/' + STR_TYPE + '/records/search', token,
    { page_size: 500 }
  );
  var strTypes = ((typesResp.data && typesResp.data.items) || []).map(function(r) {
    var keys = Object.keys(r.fields);
    return fieldText(r.fields[keys[0]]);
  }).filter(Boolean);

  // Departments — pakai POST /records/search
  var deptResp = larkApiPost(
    BASE + STR_APP + '/tables/' + DEPT_TABLE + '/records/search', token,
    { page_size: 500 }
  );
  var departments = ((deptResp.data && deptResp.data.items) || []).map(function(r) {
    return {
      code: fieldText(r.fields['Dept Code']),
      name: fieldText(r.fields['Dept Name'])
    };
  }).filter(function(d) { return d.code; });

  var result = { sites: sites, supplySites: supplySites, strTypes: strTypes, departments: departments };
  try { cache.put(cacheKey, JSON.stringify(result), 15 * 60); } catch(e) {}
  return result;
}

// Baca Supplying Site dari kolom J (index 9) dan K (index 10) Google Sheet master article
// Deduplikasi berdasarkan kode, abaikan baris kosong
function getSupplySitesFromGSheet_() {
  try {
    var ss    = SpreadsheetApp.openById(ARTICLE_GSHEET_ID);
    var sheet = ss.getSheets()[0];
    var data  = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var seen   = {};
    var result = [];
    for (var i = 1; i < data.length; i++) {
      var code       = String(data[i][9]  != null ? data[i][9]  : '').trim(); // col J = Site DC
      var name       = String(data[i][10] != null ? data[i][10] : '').trim(); // col K = Nama DC
      var vendorCode = String(data[i][12] != null ? data[i][12] : '').trim(); // col M = Kode Vendor
      if (code && !seen[code]) {
        seen[code] = true;
        result.push({ code: code, name: name, vendorCode: vendorCode });
      }
    }
    return result;
  } catch(e) {
    Logger.log('getSupplySitesFromGSheet_ error: ' + e.message);
    return [];
  }
}

// ─── Article Lookup from Google Sheets ───────────────────────────────────────

function buildArticleMap_() {
  var ss     = SpreadsheetApp.openById(ARTICLE_GSHEET_ID);
  var sheet  = ss.getSheets()[0];
  var data   = sheet.getDataRange().getValues();
  if (!data.length) throw new Error('Master Article sheet kosong');

  // Detect column positions from header row (partial match untuk toleransi typo)
  var header = data[0];
  var artCol = -1, descCol = -1;
  header.forEach(function(h, i) {
    var hn = String(h || '').toLowerCase().trim();
    if (artCol  < 0 && hn.indexOf('article') !== -1) artCol  = i;
    if (descCol < 0 && hn.indexOf('desc')    !== -1) descCol = i;
  });
  // Fallback: kolom pertama = Article, kedua = Description
  if (artCol  < 0) artCol  = 0;
  if (descCol < 0) descCol = 1;

  // Build {code(lowercase) → {desc, dept}} map — semua status di-include
  // Kolom C (index 2) = department code
  var DEPT_COL = 2;
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var code = String(row[artCol]   != null ? row[artCol]   : '').trim();
    var desc = String(row[descCol]  != null ? row[descCol]  : '').trim();
    var dept = String(row[DEPT_COL] != null ? row[DEPT_COL] : '').trim();
    if (code) map[code.toLowerCase()] = { desc: desc, dept: dept };
  }

  // Cache in CacheService split into 90 KB chunks (support 70k+ entries)
  var mapStr    = JSON.stringify(map);
  var chunkSize = 90000;
  var numChunks = Math.ceil(mapStr.length / chunkSize);
  var cacheObj  = {};
  cacheObj[ART_META_KEY] = String(numChunks);
  for (var i = 0; i < numChunks; i++) {
    cacheObj[ART_CHUNK_PREFIX + i] = mapStr.substring(i * chunkSize, (i + 1) * chunkSize);
  }
  try { CacheService.getScriptCache().putAll(cacheObj, 20 * 60); } catch(e) {}
  return map;
}

function getArticleMap_() {
  var cache    = CacheService.getScriptCache();
  var metaStr  = cache.get(ART_META_KEY);
  if (metaStr) {
    try {
      var num    = parseInt(metaStr, 10);
      var keys   = [];
      for (var i = 0; i < num; i++) keys.push(ART_CHUNK_PREFIX + i);
      var chunks = cache.getAll(keys);
      var full   = '';
      for (var j = 0; j < num; j++) {
        var c = chunks[ART_CHUNK_PREFIX + j];
        if (!c) { full = null; break; }
        full += c;
      }
      if (full) return JSON.parse(full);
    } catch(e) {}
  }
  return buildArticleMap_();
}

function warmArticleCache() {
  // Jalankan manual dari GAS editor untuk trigger authorization + build cache
  var map = buildArticleMap_();
  Logger.log('Article cache built: ' + Object.keys(map).length + ' entries');
}

function lookupArticle(code, dept) {
  if (!code) return { found: false };
  try {
    var map   = getArticleMap_();
    var key   = String(code).toLowerCase().trim();
    if (!map.hasOwnProperty(key)) return { found: false, mapSize: Object.keys(map).length };
    var entry    = map[key];
    var desc     = entry.desc || '';
    var artDept  = entry.dept || '';
    // Validasi dept hanya jika keduanya diisi
    if (dept && artDept && artDept.toLowerCase() !== String(dept).toLowerCase().trim()) {
      return { found: true, wrongDept: true, articleDept: artDept };
    }
    return { found: true, description: desc, dept: artDept };
  } catch(e) {
    return { found: false, error: e.message };
  }
}

// ─── STR Number Generation ────────────────────────────────────────────────────

function generateSTRNumber(site, dept) {
  var now    = new Date();
  var mm     = ('0' + (now.getMonth() + 1)).slice(-2);
  var yyyy   = now.getFullYear().toString();
  var marker = '/' + mm + '/' + yyyy; // cari semua STR bulan ini

  var token = getLarkToken();
  var resp  = larkApiPost(BASE + STR_APP + '/tables/' + STR_HEADER + '/records/search', token, {
    filter: {
      conjunction: 'and',
      conditions: [{ field_name: 'STR Number', operator: 'contains', value: [marker] }]
    },
    page_size: 500
  });
  var count = ((resp.data && resp.data.items) || []).length;
  var seq   = ('000' + (count + 1)).slice(-3);
  return seq + '/' + (site || '') + '/' + (dept || '') + '/' + mm + '/' + yyyy;
}

// ─── ADJ Number Generation ────────────────────────────────────────────────────

function generateADJNumber(site, dept) {
  var now    = new Date();
  var mm     = ('0' + (now.getMonth() + 1)).slice(-2);
  var yyyy   = now.getFullYear().toString();
  var marker = '/' + mm + '/' + yyyy; // cari semua ADJ bulan ini

  var token = getLarkToken();
  var resp  = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records/search', token, {
    filter: {
      conjunction: 'and',
      conditions: [{ field_name: 'ADJ Number', operator: 'contains', value: [marker] }]
    },
    page_size: 500
  });
  var count = ((resp.data && resp.data.items) || []).length;
  var seq   = ('000' + (count + 1)).slice(-3);
  return seq + '/' + (site || '') + '/' + (dept || '') + '/' + mm + '/' + yyyy;
}

// ─── Upload Validation ────────────────────────────────────────────────────────

var UPLOAD_ALLOWED_SIGS = {
  'image/jpeg':      [0xFF, 0xD8, 0xFF],
  'image/png':       [0x89, 0x50, 0x4E, 0x47],
  'image/gif':       [0x47, 0x49, 0x46, 0x38],
  'image/webp':      [0x52, 0x49, 0x46, 0x46],  // RIFF header
  'image/bmp':       [0x42, 0x4D],
  'application/pdf': [0x25, 0x50, 0x44, 0x46]   // %PDF
};
var UPLOAD_MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

function sanitizeFileName(name) {
  if (!name || typeof name !== 'string') return 'attachment';
  // Buang path traversal + karakter ilegal, pertahankan huruf/angka/spasi/dot/dash/underscore
  var safe = name.replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\.{2,}/g, '_').trim();
  if (safe.length > 120) safe = safe.substring(0, 120);
  return safe || 'attachment';
}

// Validasi base64, ukuran, dan magic bytes. Lempar Error jika gagal.
// Return { bytes, safeName, safeMime }
function validateUpload(base64Data, fileName, clientMime) {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Data file tidak valid.');
  }
  // Cek format base64 dasar (boleh ada padding =)
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64Data.replace(/[\r\n]/g, ''))) {
    throw new Error('Format file tidak valid.');
  }

  // Decode
  var bytes;
  try { bytes = Utilities.base64Decode(base64Data); }
  catch(e) { throw new Error('Gagal membaca file. Pastikan file tidak rusak.'); }

  if (bytes.length === 0)               throw new Error('File kosong.');
  if (bytes.length > UPLOAD_MAX_BYTES)  throw new Error('Ukuran file melebihi batas 2.5 MB.');

  // Sanitasi nama file
  var safeName = sanitizeFileName(fileName);

  // Deteksi tipe file dari magic bytes (bukan dari client)
  var detectedMime = null;
  for (var mime in UPLOAD_ALLOWED_SIGS) {
    if (!UPLOAD_ALLOWED_SIGS.hasOwnProperty(mime)) continue;
    var sig = UPLOAD_ALLOWED_SIGS[mime];
    var ok  = true;
    for (var i = 0; i < sig.length; i++) {
      // GAS bytes bisa bertanda negatif (Java signed byte) → normalkan
      var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
      if (b !== sig[i]) { ok = false; break; }
    }
    if (ok) { detectedMime = mime; break; }
  }

  if (!detectedMime) {
    throw new Error('Tipe file tidak diizinkan. Hanya gambar (JPG/PNG/GIF/WebP/BMP) dan PDF yang diterima.');
  }

  return { bytes: bytes, safeName: safeName, safeMime: detectedMime };
}

// ─── Lark Drive Upload — upload file ke Bitable attachment field ─────────────
// parent_node = app_token Base, extra.bitable = app_token Base
function uploadFileToLark(base64Data, fileName, mimeType, parentNode, appToken) {
  // Validasi & sanitasi sebelum menyentuh API
  var validated = validateUpload(base64Data, fileName, mimeType);
  var fileBytes = validated.bytes;
  var safeName  = validated.safeName;
  var ct       = validated.safeMime;
  var token    = getLarkToken();
  var extra    = JSON.stringify({ bitable: appToken || parentNode });
  var boundary = 'GASBndry' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var nl = '\r\n';
  var preText =
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="file_name"' + nl + nl + safeName + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="parent_type"' + nl + nl + 'bitable_file' + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="parent_node"' + nl + nl + parentNode + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="size"' + nl + nl + String(fileBytes.length) + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="extra"' + nl + nl + extra + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="file"; filename="' + safeName + '"' + nl +
    'Content-Type: ' + ct + nl + nl;
  var postText = nl + '--' + boundary + '--' + nl;
  var allBytes = Utilities.newBlob(preText).getBytes()
    .concat(fileBytes)
    .concat(Utilities.newBlob(postText).getBytes());
  var resp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/drive/v1/medias/upload_all', {
    method:  'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'multipart/form-data; boundary=' + boundary
    },
    payload:            allBytes,
    muteHttpExceptions: true
  });
  var result = JSON.parse(resp.getContentText());
  if (result.code !== 0) {
    Logger.log('uploadFileToLark error: code=' + result.code + ' msg=' + result.msg);
    throw new Error('Upload file gagal. Silakan coba lagi.');
  }
  return result.data.file_token;
}

// ─── Submit ADJ dari Form HTML ────────────────────────────────────────────────

function submitADJForm(header, items, attachments) {
  var token     = getLarkToken();
  var adjNumber = generateADJNumber(header.site, header.department);

  Logger.log('submitADJForm: adjNumber=' + adjNumber + ' itemsCount=' + (items ? items.length : 'null'));
  Logger.log('submitADJForm: items=' + JSON.stringify(items));

  // Validasi items tidak kosong
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items kosong atau tidak valid: ' + JSON.stringify(items));
  }

  // Upload semua attachment (maks 3 dari form) — gagal satu file tidak menggagalkan submit
  var attachmentField   = null;
  var attachmentWarning = null;
  var attList  = attachments || [];
  var uploaded = [];
  var warnings = [];
  for (var a = 0; a < attList.length; a++) {
    var att = attList[a];
    if (!att || !att.data_base64) continue;
    try {
      var fileToken = uploadFileToLark(att.data_base64, att.name, att.type, STR_APP, STR_APP);
      uploaded.push({ file_token: fileToken, name: att.name });
      Logger.log('submitADJForm: attachment ' + (a+1) + ' uploaded, fileToken=' + fileToken);
    } catch(uploadErr) {
      warnings.push((att.name || ('file ' + (a+1))) + ': ' + uploadErr.message.slice(0, 80));
      Logger.log('ADJ attachment ' + (a+1) + ' upload failed (non-fatal): ' + uploadErr.message);
    }
  }
  if (uploaded.length) attachmentField   = uploaded;
  if (warnings.length) attachmentWarning = warnings.join('; ');

  var headerResp = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records', token, {
    fields: {
      'ADJ Number':            adjNumber,
      'Site':                  header.site        || '',
      'Department':            header.department  || '',
      'Jenis Adjusment':       header.jenis       || '',   // typo di nama field Lark Base
      'Keterangan Adjustment': header.keterangan    || '',
      'Attachment':            attachmentField,
      'Requested By':          header.requestedBy   || '',
      'Submit Date':           Date.now(),
      'Status':                'Waiting Create by ICO'
    }
  });
  if (!headerResp.data || !headerResp.data.record) {
    throw new Error('Gagal buat ADJ Header: ' + JSON.stringify(headerResp));
  }
  Logger.log('submitADJForm: header OK record_id=' + headerResp.data.record.record_id);

  for (var i = 0; i < items.length; i++) {
    var item       = items[i];
    Logger.log('submitADJForm: detail baris ' + (i+1) + ' article=' + item.article + ' sys=' + item.system + ' fis=' + item.fisik);
    var detailResp = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_DETAIL + '/records', token, {
      fields: {
        'ADJ Number':    adjNumber,
        'Article':       item.article      || '',
        'Description':   item.description  || '',
        'System Qty':    parseFloat(item.system) || 0,
        'Fisik Qty':     parseFloat(item.fisik)  || 0,
        'DISC':          parseFloat(item.disc)   || 0,
        'Receipt Email': item.receiptEmail || ''
      }
    });
    Logger.log('submitADJForm: detail resp baris ' + (i+1) + ' = ' + JSON.stringify(detailResp));
    if (!detailResp.data || !detailResp.data.record) {
      throw new Error('Gagal buat ADJ Detail baris ' + (i + 1) + ': ' + JSON.stringify(detailResp));
    }
  }

  return { success: true, adjNumber: adjNumber, itemsCreated: items.length, attachmentWarning: attachmentWarning };
}

// ─── Submit STR ───────────────────────────────────────────────────────────────

function submitSTR(data) {
  var token = getLarkToken();

  var strNumber  = generateSTRNumber(data.site, data.department);

  // Create header
  var headerResp = larkApiPost(BASE + STR_APP + '/tables/' + STR_HEADER + '/records', token, {
    fields: {
      'STR Number':     strNumber,
      'Site':           data.site,
      'STR Type':       data.strType,
      'Department':     data.department,
      'Request Date':   new Date(data.requestDate).getTime(),
      'Requester Name': data.requesterName,
      'Requester Email':data.requesterEmail,
      'Notes':          data.notes || '',
      'Status':         'Waiting Approval by Mgr'
    }
  });
  if (!headerResp.data || !headerResp.data.record) {
    throw new Error('Failed to create STR Header: ' + JSON.stringify(headerResp));
  }
  var headerId = headerResp.data.record.record_id;

  // Create detail rows
  var items = data.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    larkApiPost(BASE + STR_APP + '/tables/' + STR_DETAIL + '/records', token, {
      fields: {
        'STR Number':     [{ id: headerId }],
        'Item Description': item.description,
        'UOM':            item.uom,
        'Quantity':       parseFloat(item.quantity) || 0,
        'Notes':          item.notes || ''
      }
    });
  }

  return { success: true, strNumber: strNumber, recordId: headerId };
}

// ─── JSONP helper ────────────────────────────────────────────────────────────
function jsonpOut(e, obj) {
  var out = JSON.stringify(obj);
  var cb  = e.parameter.callback;
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + out + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// ─── Web App Entry Points ─────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  try {
    if (action === 'getUserByCode') {
      var code = e.parameter.code;
      if (!code) throw new Error('code parameter required');
      var result = getUserByCode(code);
      return jsonpOut(e, { status: 'ok', data: result });
    }
    if (action === 'jsapiConfig') {
      var pageUrl = decodeURIComponent(e.parameter.url || '');
      if (!pageUrl) throw new Error('url parameter required');
      var cfg = getJsapiConfig(pageUrl);
      return jsonpOut(e, { status: 'ok', data: cfg });
    }
    if (action === 'larkSearch') {
      var appToken  = e.parameter.appToken;
      var tableId   = e.parameter.tableId;
      var filter    = e.parameter.filter ? JSON.parse(e.parameter.filter) : null;
      var pageSize  = parseInt(e.parameter.pageSize || '500');
      var token     = getLarkToken();
      // Fetch tanpa filter API (hindari format issue) — filter di GAS.
      // Loop semua halaman (tabel bisa >500 baris, record baru bisa jatuh di halaman berikutnya).
      var items       = [];
      var pageToken   = null;
      var searchUrl   = BASE + appToken + '/tables/' + tableId + '/records/search';
      do {
        var searchBody = { page_size: pageSize, automatic_fields: true };
        if (pageToken) searchBody.page_token = pageToken;
        var resp = larkApiPost(searchUrl, token, searchBody);
        if (resp.code !== 0) throw new Error('Lark search error ' + resp.code + ': ' + resp.msg);
        items     = items.concat((resp.data && resp.data.items) || []);
        pageToken = (resp.data && resp.data.has_more) ? resp.data.page_token : null;
      } while (pageToken);
      // Terapkan filter di GAS
      if (filter && filter.conditions && filter.conditions.length > 0) {
        items = items.filter(function(item) {
          var match = filter.conjunction === 'or' ? false : true;
          for (var i = 0; i < filter.conditions.length; i++) {
            var cond    = filter.conditions[i];
            var rawVal  = item.fields[cond.field_name];
            var textVal = fieldText(rawVal);
            var condMet = false;
            if (cond.operator === 'is') {
              condMet = cond.value.indexOf(textVal) >= 0;
            } else if (cond.operator === 'isNot') {
              condMet = cond.value.indexOf(textVal) < 0;
            } else if (cond.operator === 'contains') {
              condMet = cond.value.some(function(v) { return textVal.indexOf(v) >= 0; });
            } else if (cond.operator === 'isEmpty') {
              condMet = !textVal;
            } else if (cond.operator === 'isNotEmpty') {
              condMet = !!textVal;
            }
            if (filter.conjunction === 'or') { if (condMet) { match = true; break; } }
            else { if (!condMet) { match = false; break; } }
          }
          return match;
        });
      }
      return jsonpOut(e, { status: 'ok', data: { items: items } });
    }
    if (action === 'larkUpdate') {
      var appToken  = e.parameter.appToken;
      var tableId   = e.parameter.tableId;
      var recordId  = e.parameter.recordId;
      var fields    = JSON.parse(e.parameter.fields);
      var token     = getLarkToken();
      var url       = BASE + appToken + '/tables/' + tableId + '/records/' + recordId;
      var resp      = UrlFetchApp.fetch(url, {
        method: 'put',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ fields: fields }),
        muteHttpExceptions: true
      });
      var result = JSON.parse(resp.getContentText());
      if (result.code !== 0) throw new Error('Lark update error ' + result.code + ': ' + result.msg);
      return jsonpOut(e, { status: 'ok', data: result.data || {} });
    }
    if (action === 'attachmentUrl') {
      // Ambil temporary download URL untuk attachment Bitable (dipanggil dari mini-app via JSONP)
      var fileToken = String(e.parameter.fileToken || '').trim();
      if (!fileToken) throw new Error('fileToken parameter required');
      var atToken = getLarkToken();
      var atUrl   = 'https://open.larksuite.com/open-apis/drive/v1/medias/batch_get_tmp_download_url' +
                    '?file_tokens=' + encodeURIComponent(fileToken);
      if (e.parameter.extra) atUrl += '&extra=' + encodeURIComponent(e.parameter.extra);
      var atResp = larkApiGet(atUrl, atToken);
      if (atResp.code !== 0) throw new Error('attachmentUrl error ' + atResp.code + ': ' + atResp.msg);
      return jsonpOut(e, { status: 'ok', data: atResp.data || {} });
    }
    if (action === 'larkCreate') {
      var appToken  = e.parameter.appToken;
      var tableId   = e.parameter.tableId;
      var fields    = JSON.parse(e.parameter.fields);
      var token     = getLarkToken();
      var result    = larkApiPost(BASE + appToken + '/tables/' + tableId + '/records', token, { fields: fields });
      if (result.code !== 0) throw new Error('Lark create error ' + result.code + ': ' + result.msg);
      return jsonpOut(e, { status: 'ok', data: result.data || {} });
    }
    if (action === 'getDropdowns') {
      // form.html menggunakan fetch() biasa, bukan JSONP — kembalikan plain JSON langsung
      var dd = getDropdowns();
      return ContentService.createTextOutput(JSON.stringify(dd))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'lookupArticle') {
      var artCode = e.parameter.code || '';
      var artDept = e.parameter.dept || '';
      var artResult = lookupArticle(artCode, artDept);
      return ContentService.createTextOutput(JSON.stringify(artResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'debugArticle') {
      try {
        var ss      = SpreadsheetApp.openById(ARTICLE_GSHEET_ID);
        var sh      = ss.getSheets()[0];
        var lastRow = sh.getLastRow();
        var lastCol = sh.getLastColumn();
        var sample  = sh.getRange(1, 1, Math.min(4, lastRow), lastCol).getValues();
        var cache   = CacheService.getScriptCache();
        return ContentService.createTextOutput(JSON.stringify({
          sheetName:   sh.getName(),
          lastRow:     lastRow,
          lastCol:     lastCol,
          sampleRows:  sample,
          cacheStatus: cache.get(ART_META_KEY) ? 'ada (' + cache.get(ART_META_KEY) + ' chunks)' : 'kosong'
        })).setMimeType(ContentService.MimeType.JSON);
      } catch(ex) {
        return ContentService.createTextOutput(JSON.stringify({ error: ex.message }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    if (action === 'clearArticleCache') {
      var cache = CacheService.getScriptCache();
      var meta  = cache.get(ART_META_KEY);
      if (meta) {
        var keys = [ART_META_KEY];
        for (var ci = 0; ci < parseInt(meta, 10); ci++) keys.push(ART_CHUNK_PREFIX + ci);
        cache.removeAll(keys);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'cleared' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'baUploadForm') {
      var adjNum    = e.parameter.adjNumber || '';
      var returnUrl = e.parameter.returnUrl || '';
      var tpl       = HtmlService.createTemplateFromFile('adj-ba-upload');
      tpl.scriptUrl = ScriptApp.getService().getUrl();
      tpl.adjNumber = adjNum;
      tpl.returnUrl = returnUrl;
      return tpl.evaluate()
        .setTitle('Upload BA Salju Rugi')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // Default: serve form HTML — harus pakai createTemplateFromFile agar <?= scriptUrl ?> ter-inject
    var tpl = HtmlService.createTemplateFromFile('form');
    tpl.scriptUrl = ScriptApp.getService().getUrl();
    return tpl.evaluate()
      .setTitle('Request New STR')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return jsonpOut(e, { status: 'error', message: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Form HTML submission: { header: {...}, items: [...] }
    if (body.header && body.items) {
      var result = submitSTRForm(body.header, body.items);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Legacy action format: { action: 'submitSTR', data: {...} }
    if (body.action === 'submitSTR') {
      var r2 = submitSTR(body.data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', data: r2 }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ADJ Form submission: { adjHeader: {...}, adjItems: [...], attachments: [...] }
    // (legacy single `attachment` tetap didukung)
    if (body.adjHeader && body.adjItems) {
      var adjAtts   = body.attachments || (body.attachment ? [body.attachment] : []);
      var adjResult = submitADJForm(body.adjHeader, body.adjItems, adjAtts);
      return ContentService.createTextOutput(JSON.stringify(adjResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // BA Salju Rugi upload: { action: 'uploadBA', adjNumber, attachment }
    if (body.action === 'uploadBA') {
      var adjNum  = String(body.adjNumber || '').trim();
      // Validasi format ADJ Number: ADJ-SITE-YYYYMMDD-N (contoh: ADJ-ABCD-20240101-1)
      if (!/^\d{3}\/[^\/]+\/[^\/]+\/\d{2}\/\d{4}$/.test(adjNum)) {
        throw new Error('Format ADJ Number tidak valid.');
      }
      var ba      = body.attachment;
      if (!ba || !ba.data_base64) throw new Error('File BA tidak ditemukan dalam request.');
      var tok     = getLarkToken();
      var srResp  = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records/search', tok, {
        filter: { conjunction: 'and', conditions: [{ field_name: 'ADJ Number', operator: 'is', value: [adjNum] }] },
        page_size: 1
      });
      var srItems = (srResp.data && srResp.data.items) || [];
      if (srItems.length === 0) throw new Error('ADJ tidak ditemukan: ' + adjNum);
      var recId   = srItems[0].record_id;
      var baToken = uploadFileToLark(ba.data_base64, ba.name, ba.type, STR_APP, STR_APP);
      var upUrl   = BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records/' + recId;
      UrlFetchApp.fetch(upUrl, {
        method:  'put',
        headers: { 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ fields: { 'BA Salju Rugi': [{ file_token: baToken, name: ba.name }] } })
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error('Unknown request format');
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Submit STR dari Form HTML ────────────────────────────────────────────────
// Dipanggil oleh doPost ketika form.html mengirim { header, items }

function submitSTRForm(header, items) {
  var token     = getLarkToken();
  var strNumber = generateSTRNumber(header.site, header.department);

  var headerResp = larkApiPost(BASE + STR_APP + '/tables/' + STR_HEADER + '/records', token, {
    fields: {
      'STR Number':      strNumber,
      'Site':            header.site,
      'Site Name':       header.siteName      || '',
      'Type STR':        header.typeStr        || '',
      'Supplying Site':  header.supplyingSite  || '',
      'Kode Vendor':     header.vendorCode     || '',
      'Department':      header.department     || '',
      'Plan Receive Date': header.planReceiveDate ? new Date(header.planReceiveDate).getTime() : null,
      'Requested By':    header.requestedBy || '',
      'Submit Date':     Date.now(),
      'Status':          'Waiting Approval by Mgr'
    }
  });
  if (!headerResp.data || !headerResp.data.record) {
    throw new Error('Gagal buat STR Header: ' + JSON.stringify(headerResp));
  }
  var headerId = headerResp.data.record.record_id;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    larkApiPost(BASE + STR_APP + '/tables/' + STR_DETAIL + '/records', token, {
      fields: {
        'STR Number':   strNumber,          // text field — pakai string, bukan linked-record
        'Row Sequence': i + 1,
        'Article':      item.article     || '',
        'Description':  item.description || '',
        'Stock Qty':    parseFloat(item.stockQty)  || 0,
        'Sales Qty':    parseFloat(item.salesQty)  || 0,
        'Request Qty':  parseFloat(item.requestQty) || 0,
        'Reason':       item.reason      || ''
      }
    });
  }

  return { success: true, strNumber: strNumber };
}
