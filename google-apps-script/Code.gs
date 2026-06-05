// ─── Lark API Helpers ────────────────────────────────────────────────────────

function getLarkToken() {
  var props = PropertiesService.getScriptProperties();
  var appId     = props.getProperty('LARK_APP_ID');
  var appSecret = props.getProperty('LARK_APP_SECRET');
  var resp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  var data = JSON.parse(resp.getContentText());
  if (data.code !== 0) throw new Error('getLarkToken failed: ' + data.msg);
  return data.tenant_access_token;
}

function larkApiGet(url, token) {
  var resp = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  return JSON.parse(resp.getContentText());
}

function larkApiPost(url, token, payload) {
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload)
  });
  return JSON.parse(resp.getContentText());
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
var ADJ_HEADER  = 'tblFGno3ONx4BseJ';
var ADJ_DETAIL  = 'tblUShPPgJW3fqBn';
var BASE        = 'https://open.larksuite.com/open-apis/bitable/v1/apps/';

function getDropdowns() {
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
    var keys = Object.keys(r.fields);
    return fieldText(r.fields[keys[0]]);
  }).filter(Boolean);

  return { sites: sites, strTypes: strTypes, departments: departments };
}

// ─── STR Number Generation ────────────────────────────────────────────────────

function generateSTRNumber(site) {
  var now    = new Date();
  var yy     = now.getFullYear().toString().slice(-2);
  var mm     = ('0' + (now.getMonth() + 1)).slice(-2);
  var dd     = ('0' + now.getDate()).slice(-2);
  var dateStr = yy + mm + dd;

  var token = getLarkToken();
  var resp  = larkApiPost(BASE + STR_APP + '/tables/' + STR_HEADER + '/records/search', token, {
    filter: {
      conjunction: 'and',
      conditions: [{ field_name: 'STR Number', operator: 'contains', value: [dateStr] }]
    },
    page_size: 200
  });
  var count   = ((resp.data && resp.data.items) || []).length;
  var seq     = ('000' + (count + 1)).slice(-3);
  var siteCode = site ? site.replace(/\s/g,'').toUpperCase().slice(0, 4) : 'STR';
  return 'STR-' + siteCode + '-' + dateStr + '-' + seq;
}

// ─── ADJ Number Generation ────────────────────────────────────────────────────

function generateADJNumber(site) {
  var now     = new Date();
  var yy      = now.getFullYear().toString().slice(-2);
  var mm      = ('0' + (now.getMonth() + 1)).slice(-2);
  var dd      = ('0' + now.getDate()).slice(-2);
  var dateStr = yy + mm + dd;

  var token = getLarkToken();
  var resp  = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records/search', token, {
    filter: {
      conjunction: 'and',
      conditions: [{ field_name: 'ADJ Number', operator: 'contains', value: [dateStr] }]
    },
    page_size: 200
  });
  var count    = ((resp.data && resp.data.items) || []).length;
  var seq      = ('000' + (count + 1)).slice(-3);
  var siteCode = site ? site.replace(/\s/g, '').toUpperCase().slice(0, 4) : 'ADJ';
  return 'ADJ-' + siteCode + '-' + dateStr + '-' + seq;
}

// ─── File Upload to Lark Drive (for Lark Base attachment fields) ──────────────

// ─── Lark Drive Upload — upload file ke Bitable attachment field ─────────────
// parent_node = app_token Base, extra.bitable = app_token Base
function uploadFileToLark(base64Data, fileName, mimeType, parentNode, appToken) {
  var token     = getLarkToken();
  var fileBytes = Utilities.base64Decode(base64Data);
  var ct        = mimeType || 'application/octet-stream';
  var extra     = JSON.stringify({ bitable: appToken || parentNode });
  var boundary  = 'GASBndry' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var nl = '\r\n';
  var preText =
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="file_name"' + nl + nl + fileName + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="parent_type"' + nl + nl + 'bitable_file' + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="parent_node"' + nl + nl + parentNode + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="size"' + nl + nl + String(fileBytes.length) + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="extra"' + nl + nl + extra + nl +
    '--' + boundary + nl +
    'Content-Disposition: form-data; name="file"; filename="' + fileName + '"' + nl +
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
    throw new Error('uploadFileToLark failed: ' + result.msg + ' | ' + resp.getContentText().slice(0, 200));
  }
  return result.data.file_token;
}

// ─── Submit ADJ dari Form HTML ────────────────────────────────────────────────

function submitADJForm(header, items, attachment) {
  var token     = getLarkToken();
  var adjNumber = generateADJNumber(header.site);

  Logger.log('submitADJForm: adjNumber=' + adjNumber + ' itemsCount=' + (items ? items.length : 'null'));
  Logger.log('submitADJForm: items=' + JSON.stringify(items));

  // Validasi items tidak kosong
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('items kosong atau tidak valid: ' + JSON.stringify(items));
  }

  var attachmentField   = null;
  var attachmentWarning = null;
  if (attachment && attachment.data_base64) {
    try {
      var fileToken   = uploadFileToLark(attachment.data_base64, attachment.name, attachment.type, STR_APP, STR_APP);
      attachmentField = [{ file_token: fileToken, name: attachment.name }];
      Logger.log('submitADJForm: attachment uploaded, fileToken=' + fileToken);
    } catch(uploadErr) {
      attachmentWarning = uploadErr.message.slice(0, 120);
      Logger.log('ADJ attachment upload failed (non-fatal): ' + uploadErr.message);
    }
  }

  var headerResp = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_HEADER + '/records', token, {
    fields: {
      'ADJ Number':            adjNumber,
      'Site':                  header.site        || '',
      'Department':            header.department  || '',
      'Jenis Adjusment':       header.jenis       || '',   // typo di nama field Lark Base
      'Keterangan Adjustment': header.keterangan  || '',
      'Attachment':            attachmentField,
      'Requested By':          header.requestedBy || '',
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
    Logger.log('submitADJForm: detail baris ' + (i+1) + ' from=' + item.fromArticle + ' to=' + item.toArticle + ' qty=' + item.qty);
    var detailResp = larkApiPost(BASE + STR_APP + '/tables/' + ADJ_DETAIL + '/records', token, {
      fields: {
        'ADJ Number':   adjNumber,
        'From Article': item.fromArticle || '',
        'To Article':   item.toArticle   || '',
        'Qty':          parseFloat(item.qty) || 0
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

  var strNumber  = generateSTRNumber(data.site);

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
      // Fetch tanpa filter API (hindari format issue) — filter di GAS
      var resp      = larkApiPost(BASE + appToken + '/tables/' + tableId + '/records/search', token, { page_size: pageSize });
      var items     = (resp.data && resp.data.items) || [];
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
    if (action === 'baUploadForm') {
      var adjNum = e.parameter.adjNumber || '';
      var tpl    = HtmlService.createTemplateFromFile('adj-ba-upload');
      tpl.scriptUrl = ScriptApp.getService().getUrl();
      tpl.adjNumber = adjNum;
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

    // ADJ Form submission: { adjHeader: {...}, adjItems: [...], attachment: {...} }
    if (body.adjHeader && body.adjItems) {
      var adjResult = submitADJForm(body.adjHeader, body.adjItems, body.attachment || null);
      return ContentService.createTextOutput(JSON.stringify(adjResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // BA Salju Rugi upload: { action: 'uploadBA', adjNumber, attachment }
    if (body.action === 'uploadBA') {
      var adjNum  = body.adjNumber || '';
      var ba      = body.attachment;
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
  var strNumber = generateSTRNumber(header.site);

  var headerResp = larkApiPost(BASE + STR_APP + '/tables/' + STR_HEADER + '/records', token, {
    fields: {
      'STR Number':      strNumber,
      'Site':            header.site,
      'Site Name':       header.siteName    || '',
      'Type STR':        header.typeStr     || '',
      'Supplying Site':  header.supplyingSite || '',
      'Department':      header.department  || '',
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
