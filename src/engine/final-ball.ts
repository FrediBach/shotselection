import { distance } from './math';
import type { PreparedRound, RoundAnalysis } from './types';

/** Reclassify the existing trials under an explicitly hypothetical extra target.
 * No resimulation, respotting, scoring changes or selection by sampled ranking. */
export function finalBallComparison(prepared: PreparedRound, result: RoundAnalysis) {
  if (!prepared.scenario.finalBall) return null;
  const options = prepared.balls[0]?.options;
  if (!options || options.length !== 3) return null;
  const target = { ...options[2].plan.target }, radius = .123;
  const shots = options.map(option => {
    const shot = result.candidates.find(s => s.plan.id === option.id);
    if (!shot?.trialSuccesses || shot.trialSuccesses.length !== shot.samples || shot.sampleBallEnds.length !== shot.samples
      || shot.sampleBallEnds.some(balls => !balls.some(b => b.id === 0))) return null;
    const wins = shot.trialSuccesses.filter(Boolean).length;
    const restricted = shot.trialSuccesses.filter((win, i) => win && distance(shot.sampleBallEnds[i].find(b => b.id === 0)!.position, target) <= radius).length;
    return { optionId: option.id, label: option.label, wins, restricted, outside: wins - restricted, samples: shot.samples };
  });
  if (shots.some(s => s === null)) return null;
  return { target, radius, shots: shots.filter(s => s !== null) };
}
