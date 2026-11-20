import fs from 'fs';
import { Client } from '@neondatabase/serverless';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }

  if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  console.log('Connecting to Neon host...');
  const client = new Client(dbUrl);
  await client.connect();
  console.log('Connected to Neon successfully!');

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('Tables:', tables.rows.map((r) => r.table_name));

  const rpc = await client.query(
    "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'"
  );
  console.log('Routines:', rpc.rows.map((r) => r.routine_name));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
