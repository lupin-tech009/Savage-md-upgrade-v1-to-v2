
import { getDatabase } from '../database.js';

function normalizePhoneNumber(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Phone number must be a string.');
  }

  const normalized = value.replace(/\D/g, '');

  if (!/^[0-9]{7,20}$/.test(normalized)) {
    throw new Error('Invalid phone number format.');
  }

  return normalized;
}

function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Username must be a string.');
  }

  const username = value.trim().toLowerCase();

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    throw new Error(
      'Username must contain 3–32 letters, numbers or underscores.'
    );
  }

  return username;
}

export async function createCustomer(username) {
  const database = getDatabase();
  const normalizedUsername = normalizeUsername(username);

  const result = await database.query(
    `INSERT INTO customers (username)
     VALUES ($1)
     RETURNING
       id,
       username,
       payment_status,
       subscription_status,
       created_at`,
    [normalizedUsername]
  );

  return result.rows[0];
}

export async function getCustomerById(customerId) {
  const database = getDatabase();

  const result = await database.query(
    `SELECT
       id,
       username,
       pairing_number,
       designated_number,
       payment_status,
       subscription_status,
       subscription_started_at,
       subscription_expires_at,
       created_at,
       updated_at
     FROM customers
     WHERE id = $1
     LIMIT 1`,
    [customerId]
  );

  return result.rows[0] || null;
}

export async function getCustomerByUsername(username) {
  const database = getDatabase();
  const normalizedUsername = normalizeUsername(username);

  const result = await database.query(
    `SELECT
       id,
       username,
       pairing_number,
       designated_number,
       payment_status,
       subscription_status,
       subscription_started_at,
       subscription_expires_at,
       created_at,
       updated_at
     FROM customers
     WHERE username = $1
     LIMIT 1`,
    [normalizedUsername]
  );

  return result.rows[0] || null;
}

export async function updateCustomerNumbers(
  customerId,
  pairingNumber,
  designatedNumber
) {
  const database = getDatabase();

  const pairing = normalizePhoneNumber(pairingNumber);
  const designated = normalizePhoneNumber(designatedNumber);

  if (pairing === designated) {
    throw new Error(
      'Pairing number and designated number must be different.'
    );
  }

  const result = await database.query(
    `UPDATE customers
     SET
       pairing_number = $2,
       designated_number = $3,
       updated_at = NOW()
     WHERE id = $1
     RETURNING
       id,
       username,
       pairing_number,
       designated_number,
       updated_at`,
    [customerId, pairing, designated]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

export async function clearCustomerNumbers(customerId) {
  const database = getDatabase();

  const result = await database.query(
    `UPDATE customers
     SET
       pairing_number = NULL,
       designated_number = NULL,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, updated_at`,
    [customerId]
  );

  return result.rows[0] || null;
}
  
