import { neon, neonConfig } from '@neondatabase/serverless';

/**
 * Neon Serverless PostgreSQL Database Client
 * Works with DATABASE_URL or POSTGRES_URL environment variables.
 */

const getDatabaseUrl = () => {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  );
};

export const isNeonConfigured = (): boolean => {
  const url = getDatabaseUrl();
  return Boolean(url && url.startsWith('postgres') && !url.includes('placeholder'));
};

export const getNeonClient = () => {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL or POSTGRES_URL is not set for Neon Postgres.');
  }
  return neon(url);
};
