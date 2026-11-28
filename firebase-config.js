/**
 * ============================================================================
 *  RAKSA — FIREBASE CONFIGURATION
 *  The ONLY place where the Firebase connection is configured.
 * ============================================================================
 *
 *  Firebase Console → Project settings → General → "Your apps" → Web app → SDK setup (Config).
 *  Copy the values into `firebaseConfig` below and save. The dashboard connects
 *  automatically on load — there is nothing to click or type in the website.
 *
 *  Required: databaseURL  (Realtime Database → Data tab shows it, e.g.
 *            https://my-project-default-rtdb.asia-southeast1.firebasedatabase.app)
 *  Others are optional for public-read rules but recommended.
 *
 *  Never put service-account credentials or private keys here. These web values are
 *  public identifiers; access is enforced by your Realtime Database Security Rules.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyCRy0pgzVv8dR0hn0rlQ_Q4MoVpUfhHSVw",
  authDomain: "satria-emergency-keychain.firebaseapp.com",
  databaseURL: "https://satria-emergency-keychain-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "satria-emergency-keychain",
  storageBucket: "satria-emergency-keychain.firebasestorage.app",
  messagingSenderId: "641911330937",
  appId: "1:641911330937:web:ae328318d14fc63b4d5ca8",
  measurementId: "G-9RSWWF19BW"
};

/** Dashboard behaviour (not credentials). */
export const dashboardSettings = {
  /** Realtime Database node whose children are hiker devices: pendaki/<DEVICE_ID> */
  databaseRoot: 'pendaki',
  /** Persistent unresolved SOS incidents node: sos_active/<DEVICE_ID> */
  sosActiveRoot: 'sos_active',
  /** Persistent resolved SOS history node: sos_history/<DEVICE_ID>/<INCIDENT_ID> */
  sosHistoryRoot: 'sos_history',
  /** age of `updated_at` <= this → LIVE */
  liveWithinSec: 60,
  /** LIVE < age <= this → DELAYED; older → OFFLINE */
  offlineAfterSec: 300,
};
