import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_6mAfs7hyYDwr@ep-super-union-b9po4gnc-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const sql = neon(url);
  const cols = await sql`
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'rooms'
  `;
  console.log('Rooms columns:', cols);
}

main().catch(console.error);
