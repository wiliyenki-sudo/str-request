// STR Form — Google Apps Script
// Deploy as Web App: Execute as Me, Access: Anyone

function getTenantToken() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('lark_token');
  if (cached) return cached;

  var props = PropertiesService.getScriptProperties();
  var res = UrlFetchApp.fetch(
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
  var data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('Auth error: ' + data.msg);
  cache.put('lark_token', data.tenant_access_token, 6000);
  return data.tenant_access_token;
}

function larkSearch(appToken, tableId, filter, pageSize) {
  var token = getTenantToken();
  var url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/search';
  // Returns at most page_size records — no pagination loop; callers must filter to avoid silent truncation
  var payload = { page_size: pageSize || 500 };
  if (filter) payload.filter = filter;

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkSearch error: ' + data.msg);
  return data.data.items || [];
}

function larkCreate(appToken, tableId, fields) {
  var token = getTenantToken();
  var url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkCreate error: ' + data.msg);
  return data.data.record;
}

function larkUpdate(appToken, tableId, recordId, fields) {
  var token = getTenantToken();
  var url = 'https://open.larksuite.com/open-apis/bitable/v1/apps/' + appToken + '/tables/' + tableId + '/records/' + recordId;
  var res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ fields: fields }),
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (data.code !== 0) throw new Error('larkUpdate error: ' + data.msg);
  return data.data.record;
}

function testGetTenantToken() {
  var token = getTenantToken();
  if (!token || token.length < 20) throw new Error('Invalid token: ' + token);
  Logger.log('Token OK: ' + token.substring(0, 20) + '...');
}

function testLarkSearch() {
  var props = PropertiesService.getScriptProperties();
  var records = larkSearch(props.getProperty('MASTER_BASE_APP_TOKEN'), props.getProperty('MASTER_SITE_TABLE_ID'), null, 5);
  if (!Array.isArray(records) || records.length === 0) throw new Error('No records returned');
  Logger.log('larkSearch OK, first SITE: ' + records[0].fields['SITE']);
}

// Lark Base primary (title) fields return [{text:"...", type:"text"}] instead of a plain string.
// All other field types that may return objects are handled here too.
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

function getDropdowns() {
  var props = PropertiesService.getScriptProperties();

  var siteRecords = larkSearch(props.getProperty('MASTER_BASE_APP_TOKEN'), props.getProperty('MASTER_SITE_TABLE_ID'));
  var sites = siteRecords
    .map(function(r) { return { code: fieldText(r.fields['SITE']), name: fieldText(r.fields['STORE Name']) }; })
    .filter(function(s) { return s.code; });

  var typeRecords = larkSearch(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('STR_TYPE_TABLE_ID'));
  var strTypes = typeRecords.map(function(r) { return fieldText(r.fields['Type Name']); }).filter(Boolean);

  var deptRecords = larkSearch(props.getProperty('STR_BASE_APP_TOKEN'), props.getProperty('DEPT_TABLE_ID'));
  var departments = deptRecords.map(function(r) { return fieldText(r.fields['Dept Name']); }).filter(Boolean);

  return { sites: sites, strTypes: strTypes, departments: departments };
}

function generateSTRNumber(site) {
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var yyyymm = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMM');
  var prefix = 'STR/' + site + '/' + yyyymm + '/';

  var records = larkSearch(
    props.getProperty('STR_BASE_APP_TOKEN'),
    props.getProperty('STR_HEADER_TABLE_ID'),
    { conjunction: 'AND', conditions: [{ field_name: 'Site', operator: 'is', value: [site] }] }
  );

  var thisMonthCount = records.filter(function(r) {
    return (r.fields['STR Number'] || '').startsWith(prefix);
  }).length;

  var candidate = prefix + String(thisMonthCount + 1).padStart(4, '0');
  var exists = records.some(function(r) { return r.fields['STR Number'] === candidate; });
  if (exists) return prefix + String(thisMonthCount + 2).padStart(4, '0');
  return candidate;
}

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
      'Status':            'Waiting Approval by Mgr'
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

// Called from HTML via google.script.run — bypasses CORS restriction of fetch()
function submitSTR(data) {
  var header = data.header;
  var items = data.items;

  if (!header.site || !header.typeStr || !header.supplyingSite ||
      !header.department || !header.planReceiveDate || !header.requestedBy) {
    throw new Error('Field header tidak lengkap');
  }
  if (!items || items.length === 0) {
    throw new Error('Minimal 1 item diperlukan');
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
    'Status':            'Waiting Approval by Mgr'
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

  return { strNumber: strNumber };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function testGetDropdowns() {
  var result = getDropdowns();
  if (!result.sites || result.sites.length === 0) throw new Error('No sites');
  Logger.log('Dropdowns OK. Sites: ' + result.sites.length + ', Types: ' + result.strTypes.length + ', Depts: ' + result.departments.length);
}

function testGenerateSTRNumber() {
  var num = generateSTRNumber('J384');
  if (!/^STR\/J384\/\d{6}\/\d{4}$/.test(num)) throw new Error('Invalid format: ' + num);
  Logger.log('STR Number OK: ' + num);
}

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
