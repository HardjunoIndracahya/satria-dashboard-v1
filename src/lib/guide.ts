export const FIREBASE_ESP32_SNIPPET = `#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* DATABASE_URL = "https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* FIREBASE_ID_TOKEN = "<short-lived Firebase Auth ID token>";
const char* ROOT_CA_CERT = R"PEM(
-----BEGIN CERTIFICATE-----
...trusted root CA certificate...
-----END CERTIFICATE-----
)PEM";

void putHiker(double lat, double lon, double mdpl, double suhu, const String& status, uint64_t timestampMs) {
  WiFiClientSecure client;
  client.setCACert(ROOT_CA_CERT);
  HTTPClient http;
  String url = String(DATABASE_URL) + "/hikers/RAKSA_01.json?auth=" + FIREBASE_ID_TOKEN;
  if (!http.begin(client, url)) return;

  String body = "{\\"id\\":\\"RAKSA_01\\",\\"lat\\":" + String(lat, 6) +
    ",\\"lon\\":" + String(lon, 6) + ",\\"mdpl\\":" + String(mdpl, 1) +
    ",\\"suhu\\":" + String(suhu, 1) + ",\\"status\\":\\"" + status +
    "\\",\\"timestamp\\":" + String(timestampMs) + "}";
  http.addHeader("Content-Type", "application/json");
  int response = http.PUT(body);
  if (response < 200 || response >= 300) {
    Serial.printf("RTDB PUT failed: %d\\n", response);
  }
  http.end();
}`;
