// Environment configuration for client and server
import { env } from '$env/dynamic/private';

// Server-side database configuration (private)
export const dbConfig = {
  host: env.ZEICOIN_DB_HOST || 'localhost',
  port: parseInt(env.ZEICOIN_DB_PORT || '5432'),
  database: env.ZEICOIN_DB_NAME || 'zeicoin_testnet',
  user: env.ZEICOIN_DB_USER || 'zeicoin',
  password: env.ZEICOIN_DB_PASSWORD || '',
};

