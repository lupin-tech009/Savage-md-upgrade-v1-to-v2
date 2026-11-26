
import pino from 'pino';
import { config } from './config.js';

const sensitivePaths = [
  'password',
  'secret',
  'accessKey',
  'access_key',
  'authorization',
  'token',
  'sessionToken',
  'session_token',
  'ownerAdminSecret',
  'adminSessionSecret',
  'sessionEncryptionKey',
  'pairingCode',
  'pairing_code',
  'phoneNumber',
  'phone_number',
  'auth',
  'authState',
  'creds',
  'privateKey'
];

const logger = pino({
  level: config.logLevel,

  base: {
    service: 'SAVAGE-MD-V2',
    owner: 'Lupin Tech'
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: sensitivePaths.flatMap((field) => [
      field,
      `*.${field}`,
      `*.*.${field}`,
      `*[*].${field}`
    ]),
    censor: '[REDACTED]'
  }
});

const baileysLogger = pino({
  level: 'silent'
});

export {
  logger,
  baileysLogger
};
  
