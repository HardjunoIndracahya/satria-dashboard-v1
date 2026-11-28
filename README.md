# RAKSA — Basecamp Command Center

Private, authentication-protected outdoor GIS dashboard for mountain Basecamp & SAR teams tracking hikers carrying ESP32 + LoRa SX1278 (433 MHz) + GPS devices. All hiker locations, telemetry, and persistent SOS emergencies are protected by **Firebase Authentication**, **Role-Based Access Control (RBAC)**, and **deny-by-default Firebase Realtime Database Security Rules**.

## Quick Start

```bash
npm install
npm run dev      # On Windows PowerShell if scripts are blocked: npm.cmd run dev
npm run build
npm run typecheck
```

## 1. Firebase Project Configuration (`firebase-config.js`)

Open [`firebase-config.js`](firebase-config.js) and fill in your Firebase Web App config (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
- Never embed Firebase service-account private keys or Admin SDK credentials in `firebase-config.js` or any frontend file.

## 2. Enable Authentication & Deploy Deny-by-Default Security Rules

1. In **Firebase Console → Authentication → Sign-in method**, enable **Email/Password**.
   - Public self-registration is completely disabled in the RAKSA dashboard.
2. In **Firebase Console → Realtime Database → Rules**, paste and publish [`database.rules.json`](database.rules.json).
   - Default policy is **deny all** (`".read": false, ".write": false`).
   - Unauthenticated HTTP requests (e.g. `curl https://<project>.firebasedatabase.app/pendaki.json`) return `401 Permission denied`.
   - Authenticated accounts without an active authorized role (`ADMIN`, `OPERATOR`, or `VIEWER`) are blocked both by Firebase Security Rules and by the dashboard's Access Denied guard.

## 3. Provision Users & Roles (`ADMIN`, `OPERATOR`, `VIEWER`)

Run the administrator CLI [`scripts/admin-provision.mjs`](scripts/admin-provision.mjs) on a trusted admin workstation (requires a downloaded Firebase Service Account JSON — gitignored, never exposed to the browser):

```bash
npm install --no-save firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export FIREBASE_DATABASE_URL="https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app"

# Create or authorize personnel (sets Firebase Auth Custom Claims + /users/<uid>)
node scripts/admin-provision.mjs create-user --email admin@basecamp.org --name "Basecamp Admin" --role ADMIN
node scripts/admin-provision.mjs create-user --email op@basecamp.org --name "SAR Operator" --role OPERATOR
node scripts/admin-provision.mjs create-user --email viewer@basecamp.org --name "SAR Observer" --role VIEWER

# Change a user's role or immediately revoke access (disables account & invalidates tokens)
node scripts/admin-provision.mjs set-role --uid <UID> --role OPERATOR
node scripts/admin-provision.mjs revoke-user --uid <UID>
```

> **Quick Console bootstrap (without Admin SDK yet):** Create a user in **Firebase Console → Authentication → Users**, copy their UID, and add `/users/<UID>` in **Realtime Database → Data**:
> ```json
> {
>   "uid": "<UID>",
>   "email": "admin@basecamp.org",
>   "displayName": "Basecamp Admin",
>   "role": "ADMIN",
>   "active": true
> }
> ```

### Role Permissions Matrix (Enforced by Firebase Security Rules)

| Capability | `ADMIN` | `OPERATOR` | `VIEWER` | `BASECAMP_DEVICE` (ESP32) |
| --- | :---: | :---: | :---: | :---: |
| View live GPS map, telemetry, analytics & logs | Yes | Yes | Yes | `/pendaki` only |
| View active SOS alerts & emergency history | Yes | Yes | Yes | `/sos_active` only |
| Acknowledge SOS & Confirm Hiker Rescued | Yes | Yes | **Denied** | **Denied** |
| View `/users` & `/basecamp_devices` directory | Yes | **Denied** | **Denied** | **Denied** |
| Write `/pendaki` telemetry & create/patch `sos_active` | Yes | Yes | **Denied** | Yes (validated, no resolve/delete) |
| Modify `/users` roles from browser | **Denied** (Admin SDK only) | **Denied** | **Denied** | **Denied** |

## 4. Secure ESP32 Basecamp Receiver Ingestion

Choose either of the two secure ingestion options (neither reopens public database writes):

1. **Least-Privilege Device Account (built into [`firmware/esp32_basecamp_receiver/esp32_basecamp_receiver.ino`](firmware/esp32_basecamp_receiver/esp32_basecamp_receiver.ino)):**
   - Provision a dedicated device identity:
     ```bash
     node scripts/admin-provision.mjs register-basecamp --email basecamp-01@raksa.local --label "Basecamp Pos 1" --password "<STRONG_PASSWORD>"
     ```
   - Configure `FIREBASE_API_KEY`, `BASECAMP_EMAIL`, and `BASECAMP_PASSWORD` in the `.ino` sketch. The ESP32 refreshes its short-lived ID token automatically and can ONLY write `/pendaki/$device_id` and create/patch `/sos_active/$device_id` (cannot delete/resolve SOS, cannot read `/users` or `/sos_history`).
2. **Trusted Cloud Function / Cloud Run Backend (optional [`scripts/esp32-ingest-function.js`](scripts/esp32-ingest-function.js)):**
   - Deploy the HTTPS endpoint with `BASECAMP_INGEST_KEY` in Firebase Secret Manager; the backend verifies the device header and writes to RTDB with Firebase Admin SDK.

## 5. Acceptance Verification Tests

1. **Test 1 — Unauthenticated Access:** Open `/`, `/live-tracking`, or `/emergencies` in an incognito window → automatically redirected to `/login`; zero GPS coordinates, telemetry, or SOS data rendered or fetched.
2. **Test 2 — Invalid Login:** Submit wrong email/password → access denied with clear error message.
3. **Test 3 — Authorized Login:** Sign in with an authorized account → dashboard loads automatically according to assigned role.
4. **Test 4 — Unauthorized Direct Firebase Access:** Run `curl "https://<YOUR_DB_URL>/pendaki.json"` and `curl "https://<YOUR_DB_URL>/sos_active.json"` without auth → Firebase responds `401 Permission denied`.
5. **Test 5 — Viewer Permissions:** Sign in as `VIEWER` → can view map, hikers, and SOS alerts, but Acknowledge / Mark as Rescued buttons are restricted (`Read-only`) and direct writes are rejected by Firebase rules.
6. **Test 6 — Operator Permissions:** Sign in as `OPERATOR` → can monitor hikers, acknowledge SOS, and confirm rescues, but `Users` admin tab is hidden and `/users` directory reads are denied by Firebase rules.
7. **Test 7 — Admin Permissions:** Sign in as `ADMIN` → full access including the `Users` Access Control directory and provisioning CLI generator.
8. **Test 8 — Logout:** Click profile menu → **Sign Out**, then navigate manually to `/live-tracking` → RTDB listeners are detached, local telemetry & SOS state are wiped, siren stops, and browser redirects to `/login`.
9. **Test 9 — ESP32 Compatibility:** Transmit a LoRa packet through the authenticated Basecamp Receiver → `/pendaki/{device_id}` updates in real time while public RTDB remains locked.
10. **Test 10 — Persistent SOS:** Trigger SOS, release button to `NORMAL`, acknowledge as `OPERATOR`/`ADMIN`, refresh page, and confirm rescue → incident stays locked until rescue confirmation and archives to `/sos_history` with operator UID and server timestamp.
