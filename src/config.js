
import 'dotenv/config';
import path from 'node:path';

const NODE_ENV = process.env.NODE_ENV || 'development';

function boundedInteger(name, fallback, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number(raw);

  if (
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}.`
    );
  }

  return value;
}

function requiredSecret(name, minimumLength = 32) {
  const value = process.env[name];

  if (!value || value.length < minimumLength) {
    throw new Error(
      `${name} must be configured with at least ${minimumLength} characters.`
    );
  }

  return value;
}

function validateEncryptionKey() {
  const value = process.env.SESSION_ENCRYPTION_KEY;

  if (!value) {
    throw new Error(
      'SESSION_ENCRYPTION_KEY is required in production.'
    );
  }

  const decoded = Buffer.from(value, 'base64');

  if (decoded.length !== 32) {
    throw new Error(
      'SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'
    );
  }

  return value;
}

function validateDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error('DATABASE_URL is required in production.');
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  if (
    parsed.protocol !== 'postgres:' &&
    parsed.protocol !== 'postgresql:'
  ) {
    throw new Error(
      'DATABASE_URL must use PostgreSQL.'
    );
  }

  return value;
}

const allowedLogLevels = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent'
];

const logLevel = process.env.LOG_LEVEL || 'info';

if (!allowedLogLevels.includes(logLevel)) {
  throw new Error(
    `LOG_LEVEL must be one of: ${allowedLogLevels.join(', ')}.`
  );
}

const commandPrefix = process.env.COMMAND_PREFIX || '$';

if (
  commandPrefix.length > 3 ||
  /\s/.test(commandPrefix)
) {
  throw new Error(
    'COMMAND_PREFIX must be 1–3 characters with no spaces.'
  );
}

const isProduction = NODE_ENV === 'production';

const config = Object.freeze({
  nodeEnv: NODE_ENV,
  isProduction,

  port: boundedInteger('PORT', 3000, 1, 65535),

  // V2 starts with a strict global limit of five sessions.
  maxSessions: 5,

  // Each customer may have only one active pairing flow.
  maxPairingFlowsPerCustomer: 1,

  commandPrefix,

  logLevel,

  databaseUrl: isProduction
    ? validateDatabaseUrl()
    : process.env.DATABASE_URL || null,

  sessionEncryptionKey: isProduction
    ? validateEncryptionKey()
    : process.env.SESSION_ENCRYPTION_KEY || null,

  ownerAdminSecret: isProduction
    ? requiredSecret('OWNER_ADMIN_SECRET')
    : process.env.OWNER_ADMIN_SECRET || null,

  adminSessionSecret: isProduction
    ? requiredSecret('ADMIN_SESSION_SECRET')
    : process.env.ADMIN_SESSION_SECRET || null,

  sessionStorageDir: path.resolve(
    process.env.SESSION_STORAGE_DIR || './sessions'
  ),

  pairingCodeWaitMs: boundedInteger(
    'PAIRING_CODE_WAIT_MS',
    5000,
    1000,
    30000
  ),

  pairingTimeoutMs: boundedInteger(
    'PAIRING_TIMEOUT_MS',
    120000,
    30000,
    300000
  ),

  maxReconnects: 3
});

export { config };
                        
