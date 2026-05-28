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
