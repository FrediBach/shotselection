import { it, expect } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { lookAheadPairFinder, LOOK_AHEAD_CUT } from './look-ahead';
import { angleTravelEvidence, isAngleTravelContrast } from './angle-travel';
import { secondShotPotted } from './second-shot';
import { evaluateShotObjective } from './objectives';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 36 * 919])('compares angle magnitude on the same useful side, seed %i', seed => {
  const source = generateScenario(36, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.lookAheadOptionIds).toHaveLength(2);
  const entries = p.balls[0].options.filter(o => p.lookAheadOptionIds!.includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = lookAheadPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  const full = angleTravelEvidence(p.scenario, pair.lost.opening.simulation, pair.lost.simulation, pair.lost.plan.pocketId)!;
  const thin = angleTravelEvidence(p.scenario, pair.kept.opening.simulation, pair.kept.simulation, pair.kept.plan.pocketId)!;
  expect(full.angle * thin.angle).toBeGreaterThan(0);
  expect(Math.abs(thin.angle) - Math.abs(full.angle)).toBeGreaterThanOrEqual(8);
  expect(thin.travel - full.travel).toBeGreaterThanOrEqual(.12);
  expect(Math.max(full.incomingSpeed, thin.incomingSpeed) / Math.min(full.incomingSpeed, thin.incomingSpeed)).toBeLessThanOrEqual(1.1);
  expect(Math.abs(full.rollRatio! - thin.rollRatio!)).toBeLessThanOrEqual(.15);
  expect(isAngleTravelContrast(p.scenario, pair.lost.opening.simulation, pair.kept.opening.simulation, pair.lost.simulation, pair.kept.simulation, pair.kept.plan.pocketId)).toBe(true);
  expect(isAngleTravelContrast(p.scenario, pair.kept.opening.simulation, pair.lost.opening.simulation, pair.kept.simulation, pair.lost.simulation, pair.kept.plan.pocketId)).toBe(false);
  expect(pair.lost.plan.pocketId).toBe(pair.kept.plan.pocketId);
  expect(pair.lost.plan.speed).toBe(pair.kept.plan.speed);
  expect(pair.lost.plan.topSpin).toBe(pair.kept.plan.topSpin);
  expect(pair.lost.plan.sideSpin).toBe(0); expect(pair.kept.plan.sideSpin).toBe(0);
  for (const branch of [pair.lost, pair.kept]) {
    expect(evaluateShotObjective(p.scenario, branch.opening.plan, branch.opening.simulation).success).toBe(true);
    expect(secondShotPotted(2, branch.simulation)).toBe(true);
    expect(branch.simulation.cueRebounds).toHaveLength(0);
    expect(branch.simulation.ballContacts).toHaveLength(1);
    expect(branch.scenario.balls).toEqual(branch.opening.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
    expect(branch.thirdScenario.balls).toEqual(branch.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
  }
  expect(pair.lost.routes).toHaveLength(0); expect(pair.kept.routes.length).toBeGreaterThan(0);
  expect(secondShotPotted(3, pair.third)).toBe(true); expect(pair.thirdCut).toBeLessThanOrEqual(LOOK_AHEAD_CUT);
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: pair.lost.opening.plan.id }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(c => c.successRate > 0)).toBe(true);
  }
}, 30000);
