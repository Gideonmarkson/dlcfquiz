/**
 * DLCF AFIT Speed + Accuracy Scoring Formula
 * 
 * Correct answers award 500 base points + up to 500 speed points,
 * linearly scaled from timeRemainingMs / totalQuestionTimeMs.
 * Wrong or unanswered questions award 0 points.
 */
export function calculateQuestionScore(
  isCorrect: boolean,
  timeRemainingMs: number,
  totalQuestionTimeMs: number
): number {
  if (!isCorrect) return 0;
  if (totalQuestionTimeMs <= 0) return 500;
  const clampedRemaining = Math.max(0, Math.min(totalQuestionTimeMs, timeRemainingMs));
  return 500 + Math.round(500 * (clampedRemaining / totalQuestionTimeMs));
}

/**
 * Deterministic leaderboard sorting:
 * 1. Higher total_score DESC
 * 2. Lower total_correct_response_ms ASC (faster cumulative correct answers)
 * 3. Earlier joined_at ASC
 */
export function compareLeaderboardEntries(
  a: { totalScore: number; totalCorrectResponseMs: number; joinedAt: string },
  b: { totalScore: number; totalCorrectResponseMs: number; joinedAt: string }
): number {
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }
  if (a.totalCorrectResponseMs !== b.totalCorrectResponseMs) {
    return a.totalCorrectResponseMs - b.totalCorrectResponseMs;
  }
  return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
}
