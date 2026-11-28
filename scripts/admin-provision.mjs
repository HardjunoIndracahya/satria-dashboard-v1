#!/usr/bin/env node
/**
 * ============================================================================
 *  RAKSA — SECURE ADMINISTRATOR USER & DEVICE PROVISIONING CLI
 * ============================================================================
 *
 *  Runs strictly on an administrator workstation or trusted backend — NEVER
 *  bundle firebase-admin or service account keys into the browser app!
 *
 *  Prerequisites (one-time on admin workstation):
 *    npm install --no-save firebase-admin
 *    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
 *    export FIREBASE_DATABASE_URL="https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app"
 *
 *  Commands:
 *    node scripts/admin-provision.mjs create-user --email op@basecamp.org --name "Budi" --role OPERATOR [--password "StrongPass!123"]
 *    node scripts/admin-provision.mjs set-role    --uid <UID> --role ADMIN|OPERATOR|VIEWER
 *    node scripts/admin-provision.mjs revoke-user --uid <UID>
 *    node scripts/admin-provision.mjs register-basecamp --email basecamp@raksa.local --label "Basecamp Merbabu" [--password "..."]
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const VALID_ROLES = new Set(['ADMIN', 'OPERATOR', 'VIEWER']);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const val = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
      flags[key] = val;
    }
  }
  return { command, flags };
}

function initAdmin() {
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error('Set FIREBASE_DATABASE_URL environment variable before running this script.');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON file.');
  }
  const app = initializeApp({ credential: applicationDefault(), databaseURL });
  return { auth: getAuth(app), db: getDatabase(app) };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command) {
    console.log('Usage: node scripts/admin-provision.mjs <create-user|set-role|revoke-user|register-basecamp> [--flags]');
    process.exit(1);
  }

  const { auth, db } = initAdmin();

  if (command === 'create-user') {
    const email = flags.email?.trim();
    const displayName = flags.name?.trim() || email?.split('@')[0] || 'RAKSA Personnel';
    const role = (flags.role || '').toUpperCase();
    if (!email || !VALID_ROLES.has(role)) {
      throw new Error('Required: --email <email> --role ADMIN|OPERATOR|VIEWER [--name "Full Name"] [--password "..."]');
    }

    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`Found existing Firebase Auth user ${user.uid} (${email}); updating role to ${role}...`);
    } catch {
      user = await auth.createUser({
        email,
        displayName,
        password: flags.password || undefined,
        disabled: false,
      });
      console.log(`Created Firebase Auth user ${user.uid} (${email})`);
    }

    await auth.setCustomUserClaims(user.uid, { role, active: true });
    await db.ref(`users/${user.uid}`).set({
      uid: user.uid,
      email: user.email,
      displayName,
      role,
      active: true,
      updatedAt: Date.now(),
    });

    console.log(`Authorized ${email} as ${role} (custom claim + /users/${user.uid}).`);
    if (!flags.password) {
      const link = await auth.generatePasswordResetLink(email);
      console.log(`Send this one-time password setup link securely to the user:\n${link}`);
    }
    return;
  }

  if (command === 'set-role') {
    const uid = flags.uid?.trim();
    const role = (flags.role || '').toUpperCase();
    if (!uid || !VALID_ROLES.has(role)) {
      throw new Error('Required: --uid <UID> --role ADMIN|OPERATOR|VIEWER');
    }
    const user = await auth.getUser(uid);
    await auth.updateUser(uid, { disabled: false });
    await auth.setCustomUserClaims(uid, { role, active: true });
    await db.ref(`users/${uid}`).update({
      uid,
      email: user.email ?? uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'RAKSA Personnel',
      role,
      active: true,
      updatedAt: Date.now(),
    });
    console.log(`Updated ${uid} (${user.email}) to role ${role}.`);
    return;
  }

  if (command === 'revoke-user') {
    const uid = flags.uid?.trim();
    if (!uid) throw new Error('Required: --uid <UID>');
    await auth.updateUser(uid, { disabled: true });
    await auth.setCustomUserClaims(uid, { role: null, active: false, disabled: true });
    await auth.revokeRefreshTokens(uid);
    await db.ref(`users/${uid}`).update({ active: false, updatedAt: Date.now() });
    console.log(`Revoked & disabled account ${uid}. All active sessions invalidated.`);
    return;
  }

  if (command === 'register-basecamp') {
    const email = flags.email?.trim();
    const label = flags.label?.trim() || 'ESP32 Basecamp Receiver';
    if (!email) throw new Error('Required: --email <device-email> [--label "Basecamp Name"] [--password "..."]');

    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({
        email,
        displayName: label,
        password: flags.password || undefined,
        disabled: false,
      });
    }
    await auth.setCustomUserClaims(user.uid, { role: 'BASECAMP_DEVICE', active: true });
    await db.ref(`basecamp_devices/${user.uid}`).set({
      uid: user.uid,
      email: user.email,
      label,
      active: true,
      updatedAt: Date.now(),
    });
    console.log(`Registered least-privilege ESP32 Basecamp device ${user.uid} (${email}) under /basecamp_devices.`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
