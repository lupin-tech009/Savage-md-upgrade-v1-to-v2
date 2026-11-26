
import { getDatabase } from '../database.js';

const ALLOWED_ACTIONS = new Set([
  'customer_created',
  'customer_updated',
  'customer_numbers_updated',
  'payment_verified',
  'payment_rejected',
  'access_key_issued',
  'access_key_redeemed',
  'subscription_renewed',
  'subscription_expired',
  'customer_suspended',
  'customer_reactivated',
  'admin_login',
  'admin_login_failed',
  'admin_logout'
]);

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'accesskey',
  'access_key',
  'pairingcode',
  'pairing_code',
  'authorization',
  'session',
  'sessiontoken',
  'session_token',
  'phone',
  'phonenumber',
  'phone_number',
  'databaseurl',
  'privatekey'
]);

function sanitizeDetails(value, depth = 0) {
  if (depth > 5) {
    return '[MAX_DEPTH]';
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map(item => sanitizeDetails(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const safe = {};

    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key
        .toLowerCase()
        .replace(/[-\s]/g, '');

      if (SENSITIVE_KEYS.has(normalizedKey)) {
        safe[key] = '[REDACTED]';
        continue;
      }

      safe[key] = sanitizeDetails(item, depth + 1);
    }

    return safe;
  }

  if (
    typeof value === 'string' &&
    value.length > 500
  ) {
    return `${value.slice(0, 500)}...[TRUNCATED]`;
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return String(value);
}

export async function recordAudit({
  actor,
  action,
  customerId = null,
  details = {}
}) {
  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('Audit actor is required.');
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error('Unsupported audit action.');
  }

  const safeDetails = sanitizeDetails(details);

  const database = getDatabase();

  const result = await database.query(
    `INSERT INTO audit_logs (
       actor,
       action,
       customer_id,
       details
     )
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING
       id,
       actor,
       action,
       customer_id,
       details,
       created_at`,
    [
      actor.trim().slice(0, 64),
      action,
      customerId,
      JSON.stringify(safeDetails)
    ]
  );

  return result.rows[0];
}

export async function getCustomerAuditHistory(
  customerId,
  limit = 50
) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error('Audit limit must be between 1 and 100.');
  }

  const database = getDatabase();

  const result = await database.query(
    `SELECT
       id,
       actor,
       action,
       details,
       created_at
     FROM audit_logs
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [customerId, limit]
  );

  return result.rows;
}
