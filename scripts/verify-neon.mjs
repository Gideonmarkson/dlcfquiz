import { neon } from '@neondatabase/serverless';

const url = 'postgresql://neondb_owner:npg_6mAfs7hyYDwr@ep-super-union-b9po4gnc-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  const sql = neon(url);
  const players = await sql`
    SELECT p.nickname, p.academic_level, p.joined_at 
    FROM public.players p
    JOIN public.rooms r ON r.id = p.room_id
    WHERE r.pin = '318028'
    ORDER BY p.joined_at ASC
  `;
  console.log(`Players currently in room 318028 (Total: ${players.length}):`);
  for (const p of players) {
    console.log(`- ${p.nickname} (${p.academic_level})`);
  }
}

main().catch(console.error);
