import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { steppingStoneEvidence } from './stepping-stone';
import { secondShotPotted } from './second-shot';
import { evaluateShotObjective } from './objectives';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 38 * 919])('proves both orders and the stepping-stone geometry benefit, seed %i', seed => {
  const source = generateScenario(38, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  const option = p.balls[0].options.find(o => o.id === p.steppingStoneOptionId)!;
  expect(option).toBeDefined();
  const opening = simulateShot(p.scenario, option.plan), before = structuredClone(opening);
  expect(evaluateShotObjective(p.scenario, option.plan, opening).success).toBe(true);
  const e = steppingStoneEvidence(p.scenario, opening)!;
  expect(e).not.toBeNull();
  expect(e.farDistance).toBeGreaterThanOrEqual(1);
  expect(e.farDistance - e.nearDistance).toBeGreaterThanOrEqual(.3);
  expect(e.directApproach - e.viaApproach).toBeGreaterThanOrEqual(.3);
  expect(e.direct.first.route.cutAngle - e.via.final.route.cutAngle).toBeGreaterThanOrEqual(8);
  expect(e.direct.first.plan.pocketId).toBe(e.via.final.plan.pocketId);
  expect(e.direct.first.plan.ballId).toBe(2); expect(e.direct.final.plan.ballId).toBe(3);
  expect(e.via.first.plan.ballId).toBe(3); expect(e.via.final.plan.ballId).toBe(2);
  const remaining = (sim: typeof opening) => sim.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position }));
  expect(e.scenario.balls).toEqual(remaining(opening));
  for (const branch of [e.direct, e.via]) {
    expect(branch.first.scenario.balls).toEqual(e.scenario.balls);
    expect(branch.final.scenario.balls).toEqual(remaining(branch.first.simulation));
    for (const shot of [branch.first, branch.final]) {
      expect(secondShotPotted(shot.plan.ballId, shot.simulation)).toBe(true);
      expect(shot.scenario.objective).toBeUndefined();
      expect(shot.scenario.conditions).toEqual(source.conditions);
      expect(shot.after.balls).toEqual(remaining(shot.simulation));
      expect(shot.plan.sideSpin).toBe(0);
      expect(shot.route.cutAngle).toBeLessThanOrEqual(source.objective!.maxCutAngle);
    }
    expect(branch.final.after.balls.some(b => b.id === 2 || b.id === 3)).toBe(false);
  }
  const targetBefore = e.scenario.balls.find(b => b.id === 2)!;
  const targetAfter = e.via.final.scenario.balls.find(b => b.id === 2)!;
  expect(distance(targetBefore.position, targetAfter.position)).toBeLessThan(.001);
  expect(opening).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(c => c.successRate > 0)).toBe(true);
    expect(steppingStoneEvidence(p.scenario, result.selected.nominal)).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers and displaced or missing remaining balls', () => {
  const p = prepareRound(generateScenario(38, 0), { regenerate: false });
  const o = p.balls[0].options.find(o => o.id === p.steppingStoneOptionId)!;
  const sim = simulateShot(p.scenario, o.plan);
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) expect(steppingStoneEvidence(p.scenario, { ...sim, ...flags })).toBeNull();
  expect(steppingStoneEvidence(p.scenario, { ...sim, finalBalls: sim.finalBalls.filter(b => b.id !== 3) })).toBeNull();
  const displaced = { ...sim, finalBalls: sim.finalBalls.map(b => b.id === 4 ? { ...b, position: { x: b.position.x + .1, y: b.position.y } } : b) };
  expect(steppingStoneEvidence(p.scenario, displaced)).toBeNull();
});
