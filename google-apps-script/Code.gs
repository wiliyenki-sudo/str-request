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
  var props     = PropertiesService.getScriptProperties();
  var appId     = props.getProperty('LARK_APP_ID');
  var appSecret = props.getProperty('LARK_APP_SECRET');

  // Exchange code for user access token
  var tokenResp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
    method: 'post',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Basic ' + Utilities.base64Encode(appId + ':' + appSecret)
    },
    payload: JSON.stringify({ grant_type: 'authorization_code', code: code })
  });
  var tokenData = JSON.parse(tokenResp.getContentText());
  if (tokenData.code !== 0) throw new Error('getAccessToken failed: ' + tokenData.msg);

  // Get user info
  var userResp = UrlFetchApp.fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
    headers: { 'Authorization': 'Bearer ' + tokenData.data.access_token }
  });
  var userData = JSON.parse(userResp.getContentText());
  if (userData.code !== 0) throw new Error('getUserInfo failed: ' + userData.msg);

  return {
    openId:   userData.data.open_id,
    nickName: userData.data.name
  };
}

// ─── Form Dropdowns ───────────────────────────────────────────────────────────

var MASTER_APP  = 'CBu2bJJfraK08es2cnolJbMlgFe';
var MASTER_SITE = 'tbl1vV6z4FJ2Ge07';
var STR_APP     = 'NU3RwtirZipu3sk9nD8l7axOgHc';
var STR_TYPE    = 'tblfBWxKU8Fh7EMJ';
var DEPT_TABLE  = 'tblH112oh1QPLPiZ';
var STR_HEADER  = 'tblQ7qPdqgZ6QcOg';
var STR_DETAIL  = 'tbluAki3HiMe1ppg';
var BASE        = 'https://open.larksuite.com/open-apis/bitable/v1/apps/';

function getDropdowns() {
  var token = getLarkToken();

  // Sites
  var sitesResp = larkApiGet(BASE + MASTER_APP + '/tables/' + MASTER_SITE + '/records?page_size=200', token);
  var sites = (sitesResp.data.items || []).map(function(r) {
    return fieldText(r.fields['STORE Name']);
  }).filter(Boolean);

  // STR Types
  var typesResp = larkApiGet(BASE + STR_APP + '/tables/' + STR_TYPE + '/records?page_size=200', token);
  var types = (typesResp.data.items || []).map(function(r) {
    var keys = Object.keys(r.fields);
    return fieldText(r.fields[keys[0]]);
  }).filter(Boolean);

  // Departments
  var deptResp = larkApiGet(BASE + STR_APP + '/tables/' + DEPT_TABLE + '/records?page_size=200', token);
  var departments = (deptResp.data.items || []).map(function(r) {
    var keys = Object.keys(r.fields);
    return fieldText(r.fields[keys[0]]);
  }).filter(Boolean);

  return { sites: sites, types: types, departments: departments };
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
  var siteCode = site ? site.replace(/\s/g,'').toUpperCase().slice(0, 3) : 'STR';
  return 'STR-' + siteCode + '-' + dateStr + '-' + seq;
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

// ─── Web App Entry Points ─────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  try {
    if (action === 'getUserByCode') {
      var code = e.parameter.code;
      if (!code) throw new Error('code parameter required');
      result = getUserByCode(code);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'jsapiConfig') {
      var pageUrl = decodeURIComponent(e.parameter.url || '');
      if (!pageUrl) throw new Error('url parameter required');
      var cfg = getJsapiConfig(pageUrl);
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', data: cfg }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getToken') {
      var tok = getLarkToken();
      var out = JSON.stringify({ status: 'ok', data: { token: tok } });
      var cb  = e.parameter.callback;
      if (cb) {
        return ContentService.createTextOutput(cb + '(' + out + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
    }
    if (action === 'getDropdowns') {
      var dd = getDropdowns();
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok', data: dd }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // Default: serve form HTML
    return HtmlService.createHtmlOutputFromFile('form')
      .setTitle('STR Request Form')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var result;
    if (action === 'submitSTR') {
      result = submitSTR(body.data);
    } else {
      throw new Error('Unknown action: ' + action);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', data: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
