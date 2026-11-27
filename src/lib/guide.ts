export const APPS_SCRIPT = `/**
 * RAKSA — spreadsheet gateway for the ESP32 Basecamp receiver.
 * Deploy: Deploy > New deployment > Web app
 *         Execute as: Me   |   Who has access: Anyone
 */
const SHEET_NAME = 'Telemetry';
const HEADERS = ['Timestamp', 'ID', 'Lat', 'Lon', 'MDPL', 'Suhu', 'Status', 'RSSI', 'SNR', 'Raw'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function val_(x) { return x === undefined || x === null ? '' : x; }

// ESP32 -> HTTP POST. Send either the raw LoRa string in "data"
// (RAKSA_01|-7.482529|110.214327|370.8|26.4|NORMAL|-92|7.5)
// or discrete fields: id, lat, lon, mdpl, suhu, status, rssi, snr.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    let body = {};
    if (e && e.postData && /json/i.test(e.postData.type || '')) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
    }
    const v = Object.assign({}, p, body);
    // Neutralise spreadsheet formula injection from noisy payloads.
    const raw = String(val_(v.data || v.payload || v.raw)).replace(/^([=+\\-@])/, "'$1");
    sheet_().appendRow([
      new Date(), val_(v.id), val_(v.lat), val_(v.lon), val_(v.mdpl),
      val_(v.suhu !== undefined ? v.suhu : v.temp), val_(v.status),
      val_(v.rssi), val_(v.snr), raw,
    ]);
    return ContentService.createTextOutput('OK');
  } finally {
    lock.releaseLock();
  }
}

// Dashboard -> HTTP GET. Returns the newest rows as JSON (?limit=2000).
function doGet(e) {
  const sh = sheet_();
  const limit = Math.min(Number((e && e.parameter && e.parameter.limit) || 2000), 20000);
  const last = sh.getLastRow();
  const cols = sh.getLastColumn();
  const out = [sh.getRange(1, 1, 1, cols).getValues()[0]];
  if (last >= 2) {
    const start = Math.max(2, last - limit + 1);
    sh.getRange(start, 1, last - start + 1, cols).getValues().forEach(function (r) { out.push(r); });
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
`;

export const ESP32_SNIPPET = `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* SCRIPT_URL = "https://script.google.com/macros/s/AKfy.../exec";

String urlEncode(const String& s) {
  String o; char buf[4];
  for (char c : s) {
    if (isalnum(c) || c == '_' || c == '-' || c == '.') o += c;
    else { snprintf(buf, sizeof(buf), "%%%02X", (uint8_t)c); o += buf; }
  }
  return o;
}

// payload = exactly what LoRa.readString() returned, noise included:
// RAKSA_01|-7.482529|110.214327|370.8|26.4|NORMAL|-92|7.5
void postPacket(const String& payload) {
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  http.begin(client, SCRIPT_URL);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  http.POST("data=" + urlEncode(payload));
  http.end();
}
`;
