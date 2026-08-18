import 'dotenv/config';

export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Load the PostgreSQL connection settings used by the standalone deployment.
 *
 * DATABASE_SSL should normally be false when PostgreSQL runs on the same
 * Ubuntu server and true only when the database provider requires TLS.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must use the postgresql:// or postgres:// scheme');
  }

  return {
    connectionString,
    ssl: parseBoolean(process.env.DATABASE_SSL, false),
  };
}
