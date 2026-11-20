import fs from 'fs';
import { neon } from '@neondatabase/serverless';

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  let dbUrl = '';
  for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
      break;
    }
  }

  const sql = neon(dbUrl);
  const start = Date.now();
  const res = await sql`SELECT NOW() as server_time, (1 + 1) as two`;
  console.log('HTTP Query Result in', Date.now() - start, 'ms:', res);

  // Test 20 parallel queries over HTTP
  console.log('Testing 20 parallel HTTP queries to Neon...');
  const pStart = Date.now();
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(sql`SELECT ${i} as num`);
  }
  const results = await Promise.all(promises);
  console.log('20 parallel HTTP queries completed in', Date.now() - pStart, 'ms!');
  console.log('Result sample:', results.map(r => r[0].num).join(', '));
}

main().catch((e) => {
  console.error('HTTP Test failed:', e);
  process.exit(1);
});
