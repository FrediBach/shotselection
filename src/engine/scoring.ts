import { clamp } from './math';
import type { ShotAnalysis } from './types';

type ScoredShot = Pick<ShotAnalysis, 'score' | 'successRate'>;
type RoundPoints = 0 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;

export interface RoundScore {
  points: RoundPoints;
  qualityPoints: number;
  rankPoints: number;
  rank: number;
  candidateCount: number;
  tiedCount: number;
  relativeQuality: number;
  noSuccessfulTrials: boolean;
}

const TIE_TOLERANCE = 0.045;
const ROUNDING_EPSILON = 1e-12;
const roundToTen = (points: number) => Math.round(points / 10) * 10;

export function scoreSelection(selected: ScoredShot, candidates: readonly ScoredShot[]): RoundScore {
  if (!candidates.length) throw new Error('A round needs at least one offered shot to score.');
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selectedIndex = sorted.findIndex(candidate => candidate.score === selected.score);
  if (selectedIndex === -1) throw new Error('The selected shot must be among the offered scores.');

  let groupStart = 0;
  let groupEnd = 0;
  // Anchor each group to its strongest utility, so a chain of close scores
  // cannot turn substantially different shots into a tie. Shared competition
  // ranks soften sampling noise; the tolerance is not a significance test.
  while (groupEnd <= selectedIndex) {
    groupStart = groupEnd;
    groupEnd = groupStart + 1;
    while (groupEnd < sorted.length && sorted[groupStart].score - sorted[groupEnd].score <= TIE_TOLERANCE + ROUNDING_EPSILON) groupEnd++;
  }

  const rank = groupStart + 1;
  const candidateCount = sorted.length;
  const bestUtility = sorted[0].score;
  const relativeQuality = bestUtility > 0 ? clamp(selected.score / bestUtility, 0, 1) : 0;
  const noSuccessfulTrials = selected.successRate === 0;
  const eligible = !noSuccessfulTrials && bestUtility > 0;
  const qualityPoints = eligible ? roundToTen(70 * relativeQuality) : 0;
  const rankPoints = eligible ? roundToTen(30 * (candidateCount === 1 ? 1 : (candidateCount - rank) / (candidateCount - 1))) : 0;

  return {
    points: (qualityPoints + rankPoints) as RoundPoints,
    qualityPoints,
    rankPoints,
    rank,
    candidateCount,
    tiedCount: groupEnd - groupStart,
    relativeQuality,
    noSuccessfulTrials,
  };
}

export function pointsFor(selected: ScoredShot, candidates: readonly ScoredShot[]): RoundPoints {
  return scoreSelection(selected, candidates).points;
}
