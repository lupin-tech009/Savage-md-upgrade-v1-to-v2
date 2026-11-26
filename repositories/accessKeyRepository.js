
import { getDatabase } from '../database.js';
import { hashSecret } from '../security.js';

export async function issueAccessKey(customerId, rawKey, actor) {
  if (
    typeof rawKey !== 'string' ||
    rawKey.length < 32 ||
    rawKey.length > 256
  ) {
    throw new Error('Invalid access key.');
  }

  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('An issuing administrator is required.');
  }

  const database = getDatabase();
  const keyHash = hashSecret(rawKey);

  const result = await database.query(
    `INSERT INTO access_keys (
       customer_id,
       key_hash,
       created_by
     )
     SELECT id, $2, $3
     FROM customers
     WHERE id = $1
       AND payment_status = 'verified'
     RETURNING
       id,
       customer_id,
       issued_at,
       redeemed_at`,
    [customerId, keyHash, actor.trim()]
  );

  if (result.rowCount === 0) {
    throw new Error(
      'Customer not found or payment has not been verified.'
    );
  }

  // The unique customer_id constraint prevents issuing another key.
  // The unique key_hash constraint prevents duplicate keys.
  return result.rows[0];
}

export async function redeemAccessKey(rawKey) {
  if (
    typeof rawKey !== 'string' ||
    rawKey.length < 32 ||
    rawKey.length > 256
  ) {
    throw new Error('Invalid or unavailable access key.');
  }

  const database = getDatabase();
  const keyHash = hashSecret(rawKey);
  const client = await database.connect();

  try {
    await client.query('BEGIN');

    const keyResult = await client.query(
      `SELECT
         ak.id,
         ak.customer_id,
         ak.redeemed_at,
         c.payment_status,
         c.subscription_status
       FROM access_keys ak
       JOIN customers c ON c.id = ak.customer_id
       WHERE ak.key_hash = $1
       FOR UPDATE OF ak, c`,
      [keyHash]
    );

    if (keyResult.rowCount !== 1) {
      throw new Error('Invalid or unavailable access key.');
    }

    const key = keyResult.rows[0];

    if (key.redeemed_at) {
      throw new Error('Invalid or unavailable access key.');
    }

    if (key.payment_status !== 'verified') {
      throw new Error('Payment has not been verified.');
    }

    if (
      key.subscription_status === 'active' ||
      key.subscription_status === 'suspended'
    ) {
      throw new Error(
        'This customer account cannot redeem another activation key.'
      );
    }

    const activation = await client.query(
      `UPDATE customers
       SET
         subscription_status = 'active',
         subscription_started_at = NOW(),
         subscription_expires_at = NOW() + INTERVAL '30 days',
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         username,
         subscription_status,
         subscription_started_at,
         subscription_expires_at`,
      [key.customer_id]
    );

    const redeemed = await client.query(
      `UPDATE access_keys
       SET redeemed_at = NOW()
       WHERE id = $1
         AND redeemed_at IS NULL
       RETURNING id, redeemed_at`,
      [key.id]
    );

    if (redeemed.rowCount !== 1) {
      throw new Error('Access key has already been redeemed.');
    }

    await client.query('COMMIT');

    return activation.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
    
    
