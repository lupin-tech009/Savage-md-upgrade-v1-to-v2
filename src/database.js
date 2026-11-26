
import pg from 'pg';

import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

let pool = null;

if (config.databaseUrl) {
  pool = new Pool({
    connectionString: config.databaseUrl,

    // Keep database connections controlled on the initial server.
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,

    application_name: 'savage-md-v2'
  });

  pool.on('error', () => {
    // Avoid logging connection details or credentials.
    logger.error('Unexpected PostgreSQL pool error.');
  });
}

export function getDatabase() {
  if (!pool) {
    throw new Error(
      'Database is not configured. Set DATABASE_URL.'
    );
  }

  return pool;
}

export async function checkDatabase() {
  const database = getDatabase();

  const result = await database.query(
    'SELECT NOW() AS database_time'
  );

  return {
    connected: true,
    databaseTime: result.rows[0].database_time
  };
}

export async function closeDatabase() {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;

  await activePool.end();

  logger.info('PostgreSQL connection pool closed.');
}
