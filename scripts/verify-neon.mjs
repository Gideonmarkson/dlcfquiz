import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_6mAfs7hyYDwr@ep-super-union-b9po4gnc-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const sql = neon(url);
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log('Neon Tables:', tables.map(t => t.tablename));
  
  const roomCount = await sql`SELECT COUNT(*) FROM public.rooms`;
  console.log('Room count in Neon:', roomCount[0].count);
}

main().catch(err => {
  console.error('Error connecting to Neon:', err);
  process.exit(1);
});
