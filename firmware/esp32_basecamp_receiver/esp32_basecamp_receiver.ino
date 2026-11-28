/*
 * ============================================================================
 *  RAKSA — ESP32 BASECAMP RECEIVER (LoRa -> Firebase RTDB with Persistent SOS)
 * ============================================================================
 *
 *  Incoming LoRa packet format:
 *    RAKSA_01|-7.559294|110.255239|347.7|22.3|SOS
 *    RAKSA_01|-7.559294|110.255239|347.7|22.3|NORMAL
 *
 *  Behavior:
 *    1. LoRa reception runs non-blocking in loop() (Core 1) and pushes parsed
 *       packets into a FreeRTOS queue.
 *    2. A dedicated Firebase worker task on Core 0 dequeues packets and talks
 *       to Firebase RTDB over HTTPS without blocking LoRa packet reception.
 *    3. Every valid packet updates `/pendaki/{device_id}`.
 *    4. On SOS:
 *         - Checks Firebase `GET /sos_active/{device_id}.json` (source of truth,
 *           survives ESP32 restarts).
 *         - If null: creates a new ACTIVE incident with a unique incident_id
 *           and Firebase server timestamp for `triggered_at` & `last_sos_at`.
 *         - If already ACTIVE or ACKNOWLEDGED: PATCHes ONLY `last_sos_at`,
 *           GPS coordinates, altitude, temperature, rssi, snr. Original
 *           `incident_id`, `state`, `triggered_at`, and `acknowledged_*` are
 *           NEVER overwritten.
 *    5. On NORMAL:
 *         - Updates ONLY `/pendaki/{device_id}`.
 *         - NEVER deletes, resolves, or alters `/sos_active/{device_id}`.
 *
 *  Required libraries (Arduino Library Manager):
 *    - LoRa (by Sandeep Mistry)
 *    - ArduinoJson (v7)
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>

// -------------------------- Wi-Fi & Firebase Config -------------------------
const char* WIFI_SSID         = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD     = "YOUR_WIFI_PASSWORD";

// Firebase Realtime Database URL (no trailing slash)
const char* FIREBASE_DB_URL   = "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app";

// Firebase Web API Key + dedicated Basecamp device Email/Password account
// (Add this account's UID under /basecamp_devices/<uid>: true in Firebase RTDB)
const char* FIREBASE_API_KEY  = "YOUR_FIREBASE_WEB_API_KEY";
const char* BASECAMP_EMAIL    = "basecamp-receiver@your-domain.org";
const char* BASECAMP_PASSWORD = "YOUR_BASECAMP_DEVICE_PASSWORD";

// ---------------------------- LoRa Pinout (SX1278) --------------------------
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  26
#define LORA_FREQ  433E6

// ------------------------------ Packet Struct -------------------------------
struct TelemetryPacket {
  char deviceId[32];
  double latitude;
  double longitude;
  float altitude;
  float temperature;
  char status[16];
  int rssi;
  float snr;
};

static QueueHandle_t packetQueue = nullptr;
static String firebaseIdToken = "";
static unsigned long tokenExpiresAtMs = 0;

// ------------------------ Firebase Auth (ID Token) --------------------------
bool ensureFirebaseAuth() {
  if (firebaseIdToken.length() > 0 && millis() < tokenExpiresAtMs) {
    return true;
  }
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  // For production hardening, replace setInsecure() with client.setCACert(ROOT_CA_PEM).
  client.setInsecure();

  HTTPClient http;
  String authUrl = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
  if (!http.begin(client, authUrl)) return false;

  http.addHeader("Content-Type", "application/json");
  JsonDocument req;
  req["email"] = BASECAMP_EMAIL;
  req["password"] = BASECAMP_PASSWORD;
  req["returnSecureToken"] = true;

  String body;
  serializeJson(req, body);
  int code = http.POST(body);
  if (code == 200) {
    JsonDocument res;
    if (!deserializeJson(res, http.getString())) {
      firebaseIdToken = res["idToken"].as<String>();
      unsigned long expiresInSec = res["expiresIn"].as<String>().toInt();
      if (expiresInSec < 120) expiresInSec = 3600;
      tokenExpiresAtMs = millis() + (expiresInSec - 90) * 1000UL;
      Serial.println("[AUTH] Firebase ID token refreshed.");
      http.end();
      return true;
    }
  } else {
    Serial.printf("[AUTH] Sign-in failed (%d): %s\n", code, http.getString().c_str());
  }
  http.end();
  return false;
}

String buildRtdbUrl(const String& path) {
  String url = String(FIREBASE_DB_URL) + path + ".json";
  if (firebaseIdToken.length() > 0) {
    url += "?auth=" + firebaseIdToken;
  }
  return url;
}

// --------------------------- Firebase REST Helpers --------------------------
int rtdbRequest(const char* method, const String& path, const String& payload, String* outBody = nullptr) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  ensureFirebaseAuth();

  WiFiClientSecure client;
  // For production hardening, replace setInsecure() with client.setCACert(ROOT_CA_PEM).
  client.setInsecure();

  HTTPClient http;
  http.setTimeout(6000);
  if (!http.begin(client, buildRtdbUrl(path))) return -2;

  if (payload.length() > 0) {
    http.addHeader("Content-Type", "application/json");
  }

  int code = http.sendRequest(method, payload);
  if (outBody && code > 0) {
    *outBody = http.getString();
  }
  if (code == 401) {
    // Force token refresh on next attempt
    firebaseIdToken = "";
    tokenExpiresAtMs = 0;
  }
  http.end();
  return code;
}

// 1. Always update `/pendaki/{device_id}` with latest telemetry
void updateTelemetryNode(const TelemetryPacket& pkt) {
  JsonDocument doc;
  doc["device_id"]   = pkt.deviceId;
  doc["latitude"]    = pkt.latitude;
  doc["longitude"]   = pkt.longitude;
  doc["altitude"]    = pkt.altitude;
  doc["temperature"] = pkt.temperature;
  doc["status"]      = pkt.status;
  doc["rssi"]        = pkt.rssi;
  doc["snr"]         = pkt.snr;
  doc["updated_at"][".sv"] = "timestamp";

  String body;
  serializeJson(doc, body);
  int code = rtdbRequest("PUT", String("/pendaki/") + pkt.deviceId, body);
  Serial.printf("[RTDB] PUT /pendaki/%s -> %d\n", pkt.deviceId, code);
}

// 2. Persistent SOS latching (called ONLY when status == "SOS")
void latchPersistentSos(const TelemetryPacket& pkt) {
  String activePath = String("/sos_active/") + pkt.deviceId;
  String existingBody;
  int getCode = rtdbRequest("GET", activePath, "", &existingBody);
  if (getCode < 200 || getCode >= 300) {
    Serial.printf("[SOS] Unable to query %s (HTTP %d); will retry on next SOS packet.\n", activePath.c_str(), getCode);
    return;
  }

  existingBody.trim();
  bool hasUnresolvedIncident = false;

  if (existingBody.length() > 0 && existingBody != "null") {
    JsonDocument existing;
    if (!deserializeJson(existing, existingBody)) {
      String state = existing["state"] | "";
      state.toUpperCase();
      if (state == "ACTIVE" || state == "ACKNOWLEDGED") {
        hasUnresolvedIncident = true;
      }
    }
  }

  if (hasUnresolvedIncident) {
    // Repeated SOS for an ALREADY ACTIVE/ACKNOWLEDGED incident:
    // PATCH ONLY latest telemetry & last_sos_at — preserve incident_id, state, triggered_at, acknowledged_*
    JsonDocument patch;
    patch["last_sos_at"][".sv"] = "timestamp";
    patch["latitude"]    = pkt.latitude;
    patch["longitude"]   = pkt.longitude;
    patch["altitude"]    = pkt.altitude;
    patch["temperature"] = pkt.temperature;
    patch["rssi"]        = pkt.rssi;
    patch["snr"]         = pkt.snr;

    String body;
    serializeJson(patch, body);
    int patchCode = rtdbRequest("PATCH", activePath, body);
    Serial.printf("[SOS] PATCH existing %s -> %d\n", activePath.c_str(), patchCode);
  } else {
    // First SOS (or new SOS after previous incident was RESOLVED):
    // Create a brand-new unique incident in /sos_active/{device_id}
    char incidentId[64];
    snprintf(incidentId, sizeof(incidentId), "INC-%s-%lu-%04X",
             pkt.deviceId, (unsigned long)millis(), (unsigned int)(esp_random() & 0xFFFF));

    JsonDocument doc;
    doc["device_id"]       = pkt.deviceId;
    doc["incident_id"]     = incidentId;
    doc["state"]           = "ACTIVE";
    doc["triggered_at"][".sv"] = "timestamp";
    doc["last_sos_at"][".sv"]  = "timestamp";
    doc["latitude"]        = pkt.latitude;
    doc["longitude"]       = pkt.longitude;
    doc["altitude"]        = pkt.altitude;
    doc["temperature"]     = pkt.temperature;
    doc["rssi"]            = pkt.rssi;
    doc["snr"]             = pkt.snr;
    doc["acknowledged_at"] = nullptr;
    doc["acknowledged_by"] = nullptr;
    doc["resolved_at"]     = nullptr;
    doc["resolved_by"]     = nullptr;
    doc["resolution_note"] = nullptr;

    String body;
    serializeJson(doc, body);
    int putCode = rtdbRequest("PUT", activePath, body);
    Serial.printf("[SOS] CREATED new incident %s (%s) -> %d\n", incidentId, activePath.c_str(), putCode);
  }
}

// --------------------- Non-Blocking Network Worker Task ---------------------
void firebaseWorkerTask(void* /*pvParameters*/) {
  TelemetryPacket pkt;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect();
      vTaskDelay(pdMS_TO_TICKS(1500));
      continue;
    }
    if (xQueueReceive(packetQueue, &pkt, pdMS_TO_TICKS(250)) == pdTRUE) {
      updateTelemetryNode(pkt);

      // CRITICAL SAFETY RULE:
      // Only latch on SOS. When status == NORMAL, NEVER touch or clear /sos_active!
      if (strcasecmp(pkt.status, "SOS") == 0) {
        latchPersistentSos(pkt);
      }
    }
  }
}

// --------------------------- LoRa Packet Parser -----------------------------
bool parseLoraPayload(const String& raw, int rssi, float snr, TelemetryPacket& out) {
  int idx[5];
  int start = 0;
  for (int i = 0; i < 5; i++) {
    idx[i] = raw.indexOf('|', start);
    if (idx[i] < 0) return false;
    start = idx[i] + 1;
  }

  String idStr     = raw.substring(0, idx[0]);
  String latStr    = raw.substring(idx[0] + 1, idx[1]);
  String lonStr    = raw.substring(idx[1] + 1, idx[2]);
  String altStr    = raw.substring(idx[2] + 1, idx[3]);
  String tempStr   = raw.substring(idx[3] + 1, idx[4]);
  String statusStr = raw.substring(idx[4] + 1);

  idStr.trim();
  statusStr.trim();
  statusStr.toUpperCase();

  double lat = latStr.toDouble();
  double lon = lonStr.toDouble();
  if (idStr.length() < 2 || lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0 || (lat == 0.0 && lon == 0.0)) {
    return false;
  }

  strncpy(out.deviceId, idStr.c_str(), sizeof(out.deviceId) - 1);
  out.deviceId[sizeof(out.deviceId) - 1] = '\0';
  out.latitude    = lat;
  out.longitude   = lon;
  out.altitude    = altStr.toFloat();
  out.temperature = tempStr.toFloat();
  strncpy(out.status, statusStr.c_str(), sizeof(out.status) - 1);
  out.status[sizeof(out.status) - 1] = '\0';
  out.rssi = rssi;
  out.snr  = snr;
  return true;
}

// ------------------------------- Setup & Loop -------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] Connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected!" : " continuing offline (will retry)");

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("[LORA] Initialization failed! Check wiring.");
    while (true) delay(1000);
  }
  Serial.println("[LORA] Basecamp Receiver ready.");

  packetQueue = xQueueCreate(24, sizeof(TelemetryPacket));
  xTaskCreatePinnedToCore(firebaseWorkerTask, "FirebaseWorker", 8192, nullptr, 1, nullptr, 0);
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize > 0) {
    String raw = "";
    while (LoRa.available()) {
      raw += (char)LoRa.read();
    }
    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();
    Serial.printf("[LORA] RX (%d dBm, %.1f dB): %s\n", rssi, snr, raw.c_str());

    TelemetryPacket pkt;
    if (parseLoraPayload(raw, rssi, snr, pkt)) {
      if (xQueueSend(packetQueue, &pkt, 0) != pdTRUE) {
        Serial.println("[QUEUE] Full — dropping oldest packet to preserve latest.");
        TelemetryPacket dropped;
        xQueueReceive(packetQueue, &dropped, 0);
        xQueueSend(packetQueue, &pkt, 0);
      }
    } else {
      Serial.println("[LORA] Ignored invalid/malformed packet.");
    }
  }
}
