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
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'YOUR_DATABASE_URL',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/** Dashboard behaviour (not credentials). */
export const dashboardSettings = {
  /** Realtime Database node whose children are hiker devices: pendaki/<DEVICE_ID> */
  databaseRoot: 'pendaki',
  /** age of `updated_at` <= this → LIVE */
  liveWithinSec: 60,
  /** LIVE < age <= this → DELAYED; older → OFFLINE */
  offlineAfterSec: 300,
};
