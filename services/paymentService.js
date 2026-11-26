
import { getDatabase } from '../database.js';

const SUBSCRIPTION_PRICE_KOBO = 300000;
const CURRENCY = 'NGN';

function validateActor(actor) {
  if (typeof actor !== 'string' || !actor.trim()) {
    throw new Error('An authorized administrator is required.');
  }

  return actor.trim().slice(0, 64);
}

export async function recordCustomerPayment({
  customerId,
  paymentReference = null
}) {
  if (
    typeof customerId !== 'string' ||
    !customerId.trim()
  ) {
    throw new Error('A valid customer ID is required.');
  }

  if (
    paymentReference !== null &&
    (
      typeof paymentReference !== 'string' ||
      paymentReference.trim().length === 0 ||
      paymentReference.length > 128
    )
  ) {
    throw new Error('Invalid payment reference.');
  }

  const database = getDatabase();

  const result = await database.query(
    `INSERT INTO payments (
       customer_id,
       amount_minor,
       currency,
       payment_reference
     )
     SELECT id, $2, $3, $4
     FROM customers
     WHERE id = $1
     RETURNING
       id,
       customer_id,
       amount_minor,
       currency,
       payment_status,
       created_at`,
    [
      customerId,
      SUBSCRIPTION_PRICE_KOBO,
      CURRENCY,
      paymentReference?.trim() || null
    ]
  );

  if (result.rowCount !== 1) {
    throw new Error('Customer account not found.');
  }

  return result.rows[0];
}

export async function verifyCustomerPayment({
  paymentId,
  actor
}) {
  const administrator = validateActor(actor);
  const database = getDatabase();
  const client = await database.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT
         id,
         customer_id,
         amount_minor,
         currency,
         payment_status
       FROM payments
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    );

    if (paymentResult.rowCount !== 1) {
      throw new Error('Payment record not found.');
    }

    const payment = paymentResult.rows[0];

    if (payment.payment_status !== 'pending') {
      throw new Error('Payment is not awaiting verification.');
    }

    if (
      Number(payment.amount_minor) !== SUBSCRIPTION_PRICE_KOBO ||
      payment.currency !== CURRENCY
    ) {
      throw new Error('Payment amount or currency is incorrect.');
    }

    const updatePayment = await client.query(
      `UPDATE payments
       SET
         payment_status = 'verified',
         verified_by = $2,
         verified_at = NOW()
       WHERE id = $1
         AND payment_status = 'pending'
       RETURNING id, customer_id, verified_at`,
      [paymentId, administrator]
    );

    if (updatePayment.rowCount !== 1) {
      throw new Error('Payment verification could not be completed.');
    }

    await client.query(
      `UPDATE customers
       SET
         payment_status = 'verified',
         updated_at = NOW()
       WHERE id = $1`,
      [payment.customer_id]
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor,
         action,
         customer_id,
         details
       )
       VALUES ($1, 'payment_verified', $2, $3::jsonb)`,
      [
        administrator,
        payment.customer_id,
        JSON.stringify({
          paymentId,
          amountMinor: SUBSCRIPTION_PRICE_KOBO,
          currency: CURRENCY
        })
      ]
    );

    await client.query('COMMIT');

    return {
      paymentId,
      customerId: payment.customer_id,
      status: 'verified'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectCustomerPayment({
  paymentId,
  actor
}) {
  const administrator = validateActor(actor);
  const database = getDatabase();
  const client = await database.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT id, customer_id, payment_status
       FROM payments
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    );

    if (
      paymentResult.rowCount !== 1 ||
      paymentResult.rows[0].payment_status !== 'pending'
    ) {
      throw new Error('Pending payment record not found.');
    }

    const payment = paymentResult.rows[0];

    await client.query(
      `UPDATE payments
       SET payment_status = 'rejected'
       WHERE id = $1`,
      [paymentId]
    );

    await client.query(
      `INSERT INTO audit_logs (
         actor,
         action,
         customer_id,
         details
       )
       VALUES ($1, 'payment_rejected', $2, $3::jsonb)`,
      [
        administrator,
        payment.customer_id,
        JSON.stringify({ paymentId })
      ]
    );

    await client.query('COMMIT');

    return {
      paymentId,
      customerId: payment.customer_id,
      status: 'rejected'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
