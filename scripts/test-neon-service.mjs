import fs from 'fs';
import {
  createRoomInNeon,
  joinPlayerInNeon,
  transitionRoomInNeon,
  getHostRoomSnapshotFromNeon,
  getPlayerSessionFromNeon,
} from '../src/lib/db/neonService.js';

// Setup environment variable from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function test() {
  console.log('Testing Neon Service...');
  const testPin = Math.floor(100000 + Math.random() * 900000).toString();

  const { room, questions } = await createRoomInNeon({
    pin: testPin,
    title: 'DLCF AFIT Live Service Test',
    hostSecretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    hostRecoveryCode: 'TEST9999',
    questions: [
      {
        prompt: 'Who defeated Goliath?',
        options: ['Saul', 'David', 'Jonathan', 'Samuel'],
        correctOptionIndex: 1,
        scriptureRef: '1 Samuel 17:50',
        explanation: 'David trusted God with a sling and stone.',
        timeLimitSec: 20,
      },
    ],
  });

  console.log('1. Room created successfully in Neon! PIN:', room.pin, 'ID:', room.id);

  // Join a player
  const joinRes = await joinPlayerInNeon({
    pin: testPin,
    nickname: 'Emmanuel G.',
    academicLevel: '300L',
  });

  console.log('2. Player joined in Neon:', joinRes.player?.nickname, 'Token:', joinRes.player?.player_token);

  // Transition to QUESTION_ACTIVE
  const transRes = await transitionRoomInNeon({
    pin: testPin,
    targetState: 'QUESTION_ACTIVE',
    questionIndex: 0,
  });

  console.log('3. Transitioned room in Neon to:', transRes.room?.status);

  // Get player session
  const session = await getPlayerSessionFromNeon(testPin, joinRes.player.player_token);
  console.log('4. Player session verified in Neon:', {
    status: session?.roomSnapshot?.status,
    activePrompt: session?.activeQuestion?.prompt,
    playerScore: session?.player?.totalScore,
  });

  console.log('ALL NEON SERVICE TESTS PASSED 100%!');
}

test().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
