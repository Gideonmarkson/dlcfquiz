import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runNeonMigration() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL or POSTGRES_URL environment variable is missing.');
    process.exit(1);
  }

  console.log('🚀 Connecting to Neon PostgreSQL...');
  const client = new Client(dbUrl);
  await client.connect();

  const migration1Path = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  const migration2Path = path.join(__dirname, '../supabase/migrations/002_rpc_functions.sql');

  try {
    console.log('📦 Applying 001_initial_schema.sql...');
    const schemaSql = fs.readFileSync(migration1Path, 'utf8');
    await client.query(schemaSql);
    console.log('✅ Schema migration applied successfully.');

    console.log('📦 Applying 002_rpc_functions.sql...');
    const rpcSql = fs.readFileSync(migration2Path, 'utf8');
    await client.query(rpcSql);
    console.log('✅ RPC functions applied successfully.');

    console.log('🎉 Neon database is fully initialized and ready for DLCF AFIT Bible Quiz!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runNeonMigration();
