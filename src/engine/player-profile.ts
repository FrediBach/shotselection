import { seededRandom } from './math';
import { simulateShot } from './physics';
import { perturbShot } from './stroke-errors';
import { evaluateShotObjective } from './objectives';
import type { CharacterTalents, Scenario, ShotPlan } from './types';

/** Deliberately contrasting training profiles, not changes to the saved player.
 * Draw/follow and English precision are identical in both profiles. */
export const TRAINING_PROFILES: { name: string; talents: CharacterTalents }[] = [
  { name: 'Precise pace', talents: { anglePrecision: 0, strengthPrecision: 100, englishPrecision: 100, spinPrecision: 100 } },
  { name: 'Precise aim', talents: { anglePrecision: 100, strengthPrecision: 0, englishPrecision: 100, spinPrecision: 100 } },
];
export function profileWinners(counts: number[]): number[] {
  if (!counts.length || Math.max(...counts) === 0) return [];
  return counts.flatMap((n, i) => n === Math.max(...counts) ? [i] : []);
}
export function comparePlayerProfiles(source: Scenario, plans: ShotPlan[]) {
  const samples = 128;
  // Fixed training draws travel with authored table reflections. This isolates
  // player precision from both the round seed and orientation of the layout.
  const cue = source.balls.find(b => b.id === 0)!;
  const object = source.balls.find(b => b.id === source.objective!.ballId)!;
  const handedness = Math.sign((object.position.x - cue.position.x) * (cue.position.y - object.position.y)) || 1;
  const perturb = (plan: ShotPlan, random: () => number, talents: CharacterTalents) => {
    const changed = perturbShot(plan, random, talents);
    return { ...changed, angle: plan.angle + handedness * (changed.angle - plan.angle), sideSpin: plan.sideSpin + handedness * (changed.sideSpin - plan.sideSpin) };
  };
  const profiles = TRAINING_PROFILES.map(profile => ({ name: profile.name, talents: { ...profile.talents }, shots: plans.map(plan => {
    const random = seededRandom((78 * 919) ^ 0x3A7B91);
    const successes: boolean[] = [];
    for (let i = 0; i < samples; i++) {
      const changed = perturb(plan, random, profile.talents);
      successes.push(evaluateShotObjective(source, changed, simulateShot(source, changed, { record: false })).success);
    }
    return { optionId: plan.id, successes, count: successes.filter(Boolean).length };
  }) }));
  // Separate probes isolate one error axis at the same low precision. They
  // explain sensitivity, not a decomposition of the all-error failure rate.
  const sensitivity = plans.map(plan => {
    const random = seededRandom((78 * 919) ^ 0x3A7B91);
    const aim: boolean[] = [], speed: boolean[] = [];
    for (let i = 0; i < samples; i++) {
      const noise = perturb(plan, random, { anglePrecision: 0, strengthPrecision: 0, englishPrecision: 100, spinPrecision: 100 });
      for (const [changed, outcomes] of [[{ ...plan, angle: noise.angle }, aim], [{ ...plan, speed: noise.speed }, speed]] as const) {
        outcomes.push(evaluateShotObjective(source, changed, simulateShot(source, changed, { record: false })).success);
      }
    }
    return { optionId: plan.id, aim, speed, aimCount: aim.filter(Boolean).length, speedCount: speed.filter(Boolean).length };
  });
  const winners = profiles.map(p => profileWinners(p.shots.map(s => s.count)));
  return { samples, profiles, winners, sensitivity, switched: winners.every(w => w.length === 1) && winners[0][0] !== winners[1][0] };
}
export type PlayerProfileComparison = ReturnType<typeof comparePlayerProfiles>;
