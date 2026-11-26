
import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'node:crypto';

import { config } from '../config.js';
import { logger } from '../logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const encoded = config.sessionEncryptionKey;

  if (!encoded) {
    throw new Error('SESSION_ENCRYPTION_KEY is not configured.');
  }

  const key = Buffer.from(encoded, 'base64');

  if (key.length !== 32) {
    throw new Error(
      'SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes.'
    );
  }

  return key;
}

function encrypt(data) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    iv,
    authTag,
    encrypted
  ]).toString('base64');
}

function decrypt(payload) {
  const buffer = Buffer.from(payload, 'base64');

  if (buffer.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted session payload.');
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(
    IV_LENGTH,
    IV_LENGTH + TAG_LENGTH
  );
  const encrypted = buffer.subarray(
    IV_LENGTH + TAG_LENGTH
  );

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

export class SessionStore {
  constructor(adapter) {
    if (
      !adapter ||
      typeof adapter.get !== 'function' ||
      typeof adapter.put !== 'function' ||
      typeof adapter.delete !== 'function'
    ) {
      throw new Error(
        'SessionStore requires a persistent storage adapter.'
      );
    }

    this.adapter = adapter;
  }

  createKey(customerId) {
    if (
      typeof customerId !== 'string' ||
      !customerId.trim()
    ) {
      throw new Error('A valid customer ID is required.');
    }

    return `whatsapp-sessions/${customerId}`;
  }

  async save(customerId, credentials) {
    if (
      !credentials ||
      typeof credentials !== 'object'
    ) {
      throw new Error('Invalid session credentials.');
    }

    const key = this.createKey(customerId);
    const encryptedPayload = encrypt(credentials);

    await this.adapter.put(key, encryptedPayload);

    logger.info(
      { customerId },
      'Encrypted WhatsApp session saved.'
    );

    return true;
  }

  async load(customerId) {
    const key = this.createKey(customerId);
    const encryptedPayload = await this.adapter.get(key);

    if (!encryptedPayload) {
      return null;
    }

    try {
      return decrypt(encryptedPayload);
    } catch {
      logger.error(
        { customerId },
        'Unable to decrypt stored WhatsApp session.'
      );

      throw new Error('Session storage integrity check failed.');
    }
  }

  async delete(customerId) {
    const key = this.createKey(customerId);

    await this.adapter.delete(key);

    logger.info(
      { customerId },
      'WhatsApp session deleted from persistent storage.'
    );

    return true;
  }

  async exists(customerId) {
    const key = this.createKey(customerId);

    const payload = await this.adapter.get(key);

    return Boolean(payload);
  }
}
  
