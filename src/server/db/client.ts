import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabaseConfig } from './config';
import * as schema from './schema';

const dbConfig = getDatabaseConfig();

const poolConnection = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(poolConnection, { schema });

export async function testConnection(): Promise<boolean> {
  try {
    const client = await poolConnection.connect();
    await client.query('select 1');
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await poolConnection.end();
}
