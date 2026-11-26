
import { getDatabase } from './database.js';
import { logger } from './logger.js';

const schema = `
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  username VARCHAR(32) NOT NULL UNIQUE,

  pairing_number VARCHAR(20),
  designated_number VARCHAR(20),

  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (
      payment_status IN (
        'pending',
        'verified',
        'rejected'
      )
    ),

  subscription_status VARCHAR(20) NOT NULL DEFAULT 'inactive'
    CHECK (
      subscription_status IN (
        'inactive',
        'active',
        'expired',
        'suspended'
      )
    ),

  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    pairing_number IS NULL OR
    pairing_number ~ '^[0-9]{7,20}$'
  ),

  CHECK (
    designated_number IS NULL OR
    designated_number ~ '^[0-9]{7,20}$'
  ),

  CHECK (
    pairing_number IS NULL OR
    designated_number IS NULL OR
    pairing_number <> designated_number
  )
);

CREATE TABLE IF NOT EXISTS access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL UNIQUE
    REFERENCES customers(id) ON DELETE CASCADE,

  key_hash CHAR(64) NOT NULL UNIQUE,

  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,

  created_by VARCHAR(64) NOT NULL,

  CHECK (
    redeemed_at IS NULL OR redeemed_at >= issued_at
  )
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL
    REFERENCES customers(id) ON DELETE RESTRICT,

  amount_minor BIGINT NOT NULL
    CHECK (amount_minor > 0),

  currency CHAR(3) NOT NULL DEFAULT 'NGN',

  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (
      payment_status IN (
        'pending',
        'verified',
        'rejected'
      )
    ),

  payment_reference VARCHAR(128) UNIQUE,

  verified_by VARCHAR(64),
  verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (payment_status = 'verified'
      AND verified_by IS NOT NULL
      AND verified_at IS NOT NULL)
    OR
    (payment_status <> 'verified')
  )
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  actor VARCHAR(64) NOT NULL,
  action VARCHAR(100) NOT NULL,

  customer_id UUID
    REFERENCES customers(id) ON DELETE SET NULL,

  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_subscription_expiry
  ON customers(subscription_expires_at);

CREATE INDEX IF NOT EXISTS idx_customers_subscription_status
  ON customers(subscription_status);

CREATE INDEX IF NOT EXISTS idx_payments_customer
  ON payments(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_customer
  ON audit_logs(customer_id, created_at DESC);
`;

export async function initializeDatabaseSchema() {
  const database = getDatabase();

  try {
    await database.query(schema);

    logger.info('V2 database schema initialized.');
  } catch (error) {
    logger.error(
      { error: error.message },
      'V2 database schema initialization failed.'
    );

    throw error;
  }
}
