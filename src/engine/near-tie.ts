import type { ShotAnalysis } from './types';

/** Exact two-sided binomial comparison of discordant paired outcomes. All
 * candidates use the same indexed stroke-error draws. This measures evidence
 * in this simulation sample, not equivalence or a player's real-world odds. */
export function pairedSuccessEvidence(a: ShotAnalysis, b: ShotAnalysis) {
  if (!a.trialSuccesses || !b.trialSuccesses || a.trialSuccesses.length !== b.trialSuccesses.length || !a.trialSuccesses.length) return null;
  let aOnly = 0, bOnly = 0;
  a.trialSuccesses.forEach((success, i) => {
    if (success && !b.trialSuccesses![i]) aOnly++;
    if (!success && b.trialSuccesses![i]) bOnly++;
  });
  const discordant = aOnly + bOnly;
  let term = 2 ** -discordant, tail = term;
  for (let k = 1; k <= Math.min(aOnly, bOnly); k++) {
    term *= (discordant - k + 1) / k;
    tail += term;
  }
  const pValue = Math.min(1, 2 * tail);
  return { aOnly, bOnly, same: a.trialSuccesses.length - discordant, samples: a.trialSuccesses.length, pValue,
    gap: Math.abs(aOnly - bOnly) / a.trialSuccesses.length,
    clearDifference: pValue < 0.05 };
}

/** Choose a close pair among viable choices after analysis, never during the
 * hidden candidate search. Score remains the game's full quality objective. */
export function closestSuccessPair(candidates: ShotAnalysis[]) {
  const viable = candidates.filter(shot => shot.successRate >= 0.25);
  let best: { a: ShotAnalysis; b: ShotAnalysis; evidence: NonNullable<ReturnType<typeof pairedSuccessEvidence>> } | null = null;
  for (let i = 0; i < viable.length; i++) for (let j = i + 1; j < viable.length; j++) {
    const a = viable[i], b = viable[j], evidence = pairedSuccessEvidence(a, b);
    if (!evidence) continue;
    if (!best || evidence.gap < best.evidence.gap || (evidence.gap === best.evidence.gap && a.score + b.score > best.a.score + best.b.score)) best = { a, b, evidence };
  }
  return best;
}
