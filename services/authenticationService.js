
import { randomUUID } from 'node:crypto';

import { getDatabase } from '../database.js';
import { newSecret, hashSecret, safeEqual } from '../security.js';
import { config } from '../config.js';
import { recordAudit } from '../repositories/auditRepository.js';

const CUSTOMER_SESSION_HOURS = 24;
const ADMIN_SESSION_HOURS = 2;

function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function getSessionExpiry(hours) {
  const expiry = new Date();

  expiry.setHours(expiry.getHours() + hours);

  return expiry;
}

async function createSession({
  customerId = null,
  role,
  durationHours
}) {
  const database = getDatabase();

  const token = newSecret(48);
  const tokenHash = hashSecret(token);
  const sessionId = randomUUID();
  const expiresAt = getSessionExpiry(durationHours);

  await database.query(
    `INSERT INTO auth_sessions (
       id,
       customer_id,
       role,
       token_hash,
       expires_at
     )
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sessionId,
      customerId,
      role,
      tokenHash,
      expiresAt
    ]
  );

  return {
    token,
    sessionId,
    expiresAt
  };
}

export async function loginCustomer({
  username,
  accessCredential
}) {
  const normalizedUsername = requireText(
    username,
    'Username'
  ).toLowerCase();

  const credential = requireText(
    accessCredential,
    'Access credential'
  );

  const database = getDatabase();

  const result = await database.query(
    `SELECT
       id,
       username,
       subscription_status,
       subscription_expires_at
     FROM customers
     WHERE username = $1
     LIMIT 1`,
    [normalizedUsername]
  );

  if (result.rowCount !== 1) {
    throw new Error('Invalid login credentials.');
  }

  const customer = result.rows[0];

  // The customer credential must be securely established
  // and stored by the account-registration flow.
  const credentialResult = await database.query(
    `SELECT credential_hash
     FROM customer_credentials
     WHERE customer_id = $1
     LIMIT 1`,
    [customer.id]
  );

  if (credentialResult.rowCount !== 1) {
    throw new Error('Invalid login credentials.');
  }

  const suppliedHash = hashSecret(credential);
  const storedHash = credentialResult.rows[0].credential_hash;

  if (!safeEqual(suppliedHash, storedHash)) {
    throw new Error('Invalid login credentials.');
  }

  if (
    customer.subscription_status !== 'active' ||
    !customer.subscription_expires_at ||
    new Date(customer.subscription_expires_at) <= new Date()
  ) {
    throw new Error('Your subscription is not active.');
  }

  const session = await createSession({
    customerId: customer.id,
    role: 'customer',
    durationHours: CUSTOMER_SESSION_HOURS
  });

  return {
    customer: {
      id: customer.id,
      username: customer.username
    },
    ...session
  };
}

export async function loginAdmin(secret) {
  const suppliedSecret = requireText(
    secret,
    'Administrator secret'
  );

  if (!config.ownerAdminSecret) {
    throw new Error('Administrator authentication is not configured.');
  }

  if (!safeEqual(suppliedSecret, config.ownerAdminSecret)) {
    await recordAudit({
      actor: 'unknown',
      action: 'admin_login_failed',
      details: {
        reason: 'invalid_credentials'
      }
    });

    throw new Error('Invalid administrator credentials.');
  }

  const session = await createSession({
    role: 'admin',
    durationHours: ADMIN_SESSION_HOURS
  });

  await recordAudit({
    actor: 'admin',
    action: 'admin_login',
    details: {
      sessionCreated: true
    }
  });

  return session;
}

export async function validateSession(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return null;
  }

  const database = getDatabase();
  const tokenHash = hashSecret(token);

  const result = await database.query(
    `SELECT
       id,
       customer_id,
       role,
       expires_at
     FROM auth_sessions
     WHERE token_hash = $1
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

export async function logoutSession(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return false;
  }

  const database = getDatabase();

  const result = await database.query(
    `DELETE FROM auth_sessions
     WHERE token_hash = $1
     RETURNING id, role`,
    [hashSecret(token)]
  );

  if (result.rowCount === 0) {
    return false;
  }

  if (result.rows[0].role === 'admin') {
    await recordAudit({
      actor: 'admin',
      action: 'admin_logout',
      details: {
        sessionRemoved: true
      }
    });
  }

  return true;
}
