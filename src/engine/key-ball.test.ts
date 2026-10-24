import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { keyBallEvidence, KEY_BALL_TARGET_CUT } from './key-ball';
import { secondShotPotted } from './second-shot';
import { evaluateShotObjective } from './objectives';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 33 * 919])('preserves a real key-ball contrast and two follow-up pots, seed %i', seed => {
  const source = generateScenario(33, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(before);
  expect(p.scenario.balls).toEqual(source.balls);
  const entries = p.balls[0].options.map(option => {
    const sim = simulateShot(p.scenario, option.plan), original = structuredClone(sim);
    const check = keyBallEvidence(p.scenario, option.plan, sim);
    expect(sim).toEqual(original);
    return { option, sim, check };
  });
  const kept = entries.find(e => e.check.kept)!, lost = entries.find(e => e.check.lost)!;
  expect(kept).toBeDefined(); expect(lost).toBeDefined();
  expect(evaluateShotObjective(p.scenario, kept.option.plan, kept.sim).success).toBe(true);
  expect(evaluateShotObjective(p.scenario, lost.option.plan, lost.sim).legalPot).toBe(true);
  expect(lost.check.moved).toBeGreaterThan(.15);
  expect(kept.check.moved).toBeLessThan(.001);
  expect(lost.check.keyRoutes).toHaveLength(0);
  expect(kept.check.keyRoutes.length).toBeGreaterThan(0);
  for (const entry of [kept, lost]) {
    expect(entry.check.directTargetRoutes).toHaveLength(0);
    expect(entry.sim.finalBalls.filter(b => !b.pocketed).map(b => b.id)).toEqual([0, 2, 3]);
  }
  for (const proof of [kept.check.continuation!, lost.check.restoration!]) {
    expect(secondShotPotted(2, proof.simulation)).toBe(true);
    expect(secondShotPotted(3, proof.thirdSimulation)).toBe(true);
    expect(proof.thirdCut).toBeLessThanOrEqual(KEY_BALL_TARGET_CUT);
    expect(proof.thirdScenario.balls).toEqual(proof.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
    expect(proof.simulation.cuePath.length).toBeGreaterThan(1);
    expect(proof.thirdSimulation.objectPath.length).toBeGreaterThan(1);
  }
  expect(kept.check.continuation!.scenario.balls).toEqual(kept.sim.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
  expect(lost.check.restoration!.scenario.balls).toEqual(lost.sim.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: id === 2 ? source.balls.find(b => b.id === 2)!.position : position })));
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: kept.option.id }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(c => c.successRate > 0)).toBe(true);
    expect(keyBallEvidence(p.scenario, result.selected.plan, result.selected.nominal).kept).toBe(true);
  }
}, 30000);

it('does not describe a scratched or illegal opener as a preserved sequence', () => {
  const p = prepareRound(generateScenario(33, 0), { regenerate: false });
  const plan = p.balls[0].options[0].plan, sim = simulateShot(p.scenario, plan);
  for (const invalid of [{ ...sim, scratch: true }, { ...sim, stopped: false }, { ...sim, firstContact: 2 }, { ...sim, potted: [] }]) {
    const check = keyBallEvidence(p.scenario, plan, invalid);
    expect(check.legalPot).toBe(false);
    expect(check.kept).toBe(false);
    expect(check.lost).toBe(false);
  }
});
