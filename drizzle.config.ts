import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run Drizzle Kit');
}

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? 'require' : false,
  },
  verbose: true,
  strict: true,
});
