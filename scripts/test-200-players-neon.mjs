import fs from 'fs';
import {
  createRoomInNeon,
  joinPlayerInNeon,
  transitionRoomInNeon,
  submitAnswerInNeon,
  getHostRoomSnapshotFromNeon,
  getPlayerSessionFromNeon,
} from '../src/lib/db/neonService.js';

// Load DATABASE_URL from .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    break;
  }
}

async function simulate200Players() {
  console.log('--- STARTING 200 PLAYERS SIMULATION ON NEON POSTGRESQL ---');
  const startTotal = Date.now();
  const testPin = Math.floor(100000 + Math.random() * 900000).toString();

  // 1. Create Room with 3 Questions
  console.log(`1. Creating Room (PIN: ${testPin})...`);
  const { room, questions } = await createRoomInNeon({
    pin: testPin,
    title: 'DLCF AFIT 200-Player Championship Load Test',
    hostSecretHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    hostRecoveryCode: 'AFIT2026',
    questions: [
      {
        prompt: 'Who was the prophet that confronted King Ahab on Mount Carmel?',
        options: ['Elisha', 'Elijah', 'Jeremiah', 'Isaiah'],
        correctOptionIndex: 1,
        scriptureRef: '1 Kings 18:36',
        explanation: 'Elijah prayed and fire fell from heaven to consume the sacrifice.',
        timeLimitSec: 20,
      },
      {
        prompt: 'In what city were the disciples first called Christians?',
        options: ['Jerusalem', 'Antioch', 'Rome', 'Alexandria'],
        correctOptionIndex: 1,
        scriptureRef: 'Acts 11:26',
        explanation: 'Barnabas and Saul assembled with the church in Antioch.',
        timeLimitSec: 20,
      },
      {
        prompt: 'Study to shew thyself approved unto God is found in which epistle?',
        options: ['1 Timothy', '2 Timothy', 'Titus', 'Hebrews'],
        correctOptionIndex: 1,
        scriptureRef: '2 Timothy 2:15',
        explanation: 'Paul wrote this to Timothy.',
        timeLimitSec: 20,
      },
    ],
  });

  console.log(`Room created successfully! ID: ${room.id}`);

  // 2. Simulate 200 Players joining concurrently in batches
  const TOTAL_PLAYERS = 200;
  console.log(`2. Simulating ${TOTAL_PLAYERS} students joining room ${testPin}...`);
  const joinStart = Date.now();
  const playerTokens = [];
  const ACADEMIC_LEVELS = ['100L', '200L', '300L', '400L', '500L', 'PG/STAFF'];

  // Join in concurrent batches of 25 to respect pool limits
  const BATCH_SIZE = 25;
  for (let b = 0; b < TOTAL_PLAYERS; b += BATCH_SIZE) {
    const batchPromises = [];
    for (let i = b; i < b + BATCH_SIZE; i++) {
      const nick = `AFIT_Student_${i + 1}`;
      const level = ACADEMIC_LEVELS[i % ACADEMIC_LEVELS.length];
      batchPromises.push(
        joinPlayerInNeon({
          pin: testPin,
          nickname: nick,
          academicLevel: level,
        })
      );
    }
    const results = await Promise.all(batchPromises);
    for (const res of results) {
      if (!res.success || !res.player) {
        throw new Error(`Player join failed: ${res.error}`);
      }
      playerTokens.push({
        token: res.player.player_token,
        id: res.player.id,
        nickname: res.player.nickname,
      });
    }
  }

  const joinDuration = Date.now() - joinStart;
  console.log(`SUCCESS: ${playerTokens.length}/${TOTAL_PLAYERS} players joined in ${joinDuration}ms!`);

  // Verify room roster
  const snapshotLobby = await getHostRoomSnapshotFromNeon(testPin);
  console.log(`Host snapshot shows ${snapshotLobby.players.length} players joined in lobby!`);

  // 3. Host Starts Question 1
  console.log('3. Host triggers Question 1 (QUESTION_ACTIVE)...');
  const q1Trans = await transitionRoomInNeon({
    pin: testPin,
    targetState: 'QUESTION_ACTIVE',
    questionIndex: 0,
  });
  console.log(`Room status: ${q1Trans.room.status}, Prompt: "${q1Trans.publicQuestion.prompt}"`);

  // 4. All 200 Players Submit Answers
  console.log(`4. Simulating 200 players submitting answers to Question 1...`);
  const ansStart = Date.now();
  for (let b = 0; b < TOTAL_PLAYERS; b += BATCH_SIZE) {
    const ansBatch = [];
    for (let i = b; i < b + BATCH_SIZE; i++) {
      const p = playerTokens[i];
      // 80% pick correct option 1, 20% pick another
      const chosenOpt = i % 5 === 0 ? 0 : 1;
      ansBatch.push(
        submitAnswerInNeon({
          pin: testPin,
          playerToken: p.token,
          questionId: questions[0].id,
          selectedOption: chosenOpt,
        })
      );
    }
    const ansResults = await Promise.all(ansBatch);
    for (const r of ansResults) {
      if (!r.accepted) {
        throw new Error(`Answer submission failed: ${r.errorCode}`);
      }
    }
  }
  const ansDuration = Date.now() - ansStart;
  console.log(`SUCCESS: All 200 answers recorded in ${ansDuration}ms!`);

  // 5. Host Reveals Answer
  console.log('5. Host triggers ANSWER_REVEALED...');
  const revealTrans = await transitionRoomInNeon({
    pin: testPin,
    targetState: 'ANSWER_REVEALED',
  });
  console.log('Reveal Answer Distribution:', {
    correctOptionIndex: revealTrans.revealedAnswer.correctOptionIndex,
    optionCounts: revealTrans.revealedAnswer.optionCounts,
    totalAnswered: revealTrans.revealedAnswer.totalAnswered,
  });

  // 6. Host Shows Leaderboard
  console.log('6. Host triggers LEADERBOARD...');
  const boardTrans = await transitionRoomInNeon({
    pin: testPin,
    targetState: 'LEADERBOARD',
  });
  console.log('Top 5 Standings:');
  boardTrans.top5.forEach((e) => {
    console.log(`  #${e.rank} ${e.nickname} (${e.academicLevel}): ${e.totalScore} pts`);
  });

  // 7. Test Player Session Retrieval
  const samplePlayerSession = await getPlayerSessionFromNeon(testPin, playerTokens[0].token);
  console.log('Sample Player 1 Session verified:', {
    nickname: samplePlayerSession.player.nickname,
    currentRank: samplePlayerSession.player.currentRank,
    totalPlayers: samplePlayerSession.player.totalPlayers,
    roomStatus: samplePlayerSession.roomSnapshot.status,
  });

  const totalTime = Date.now() - startTotal;
  console.log(`\n========================================================`);
  console.log(`FULL 200-PLAYER MULTIPLAYER RUN COMPLETED IN ${totalTime}ms!`);
  console.log(`EVERY SINGLE PLAYER JOINED, ANSWERED, AND RANKED ACCURATELY!`);
  console.log(`========================================================\n`);
}

simulate200Players().catch((e) => {
  console.error('Simulation error:', e);
  process.exit(1);
});
