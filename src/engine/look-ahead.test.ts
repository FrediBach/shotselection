import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { lookAheadPairFinder, lookAheadTrials, LOOK_AHEAD_CUT } from './look-ahead';
import { secondShotPotted } from './second-shot';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 34 * 919])('isolates the next position with matched second shots, seed %i', seed => {
  const source = generateScenario(34, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original);
  expect(p.scenario.balls).toEqual(source.balls);
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries);
  const pair = lookAheadPairFinder(p.scenario)(entries.filter(e => p.lookAheadOptionIds?.includes(e.plan.id)))!;
  expect(pair).not.toBeNull();
  expect(p.lookAheadOptionIds).toHaveLength(2);
  expect(new Set(p.lookAheadOptionIds)).toEqual(new Set([pair.kept.opening.plan.id, pair.lost.opening.plan.id]));
  expect(entries).toEqual(before);
  expect(pair.kept.opening.plan.pocketId).toBe(pair.lost.opening.plan.pocketId);
  expect(distance(pair.kept.opening.simulation.cueEnd, pair.lost.opening.simulation.cueEnd)).toBeGreaterThanOrEqual(.12);
  expect(pair.kept.plan.pocketId).toBe(pair.lost.plan.pocketId);
  expect(pair.kept.plan.speed).toBe(pair.lost.plan.speed);
  expect(pair.kept.plan.topSpin).toBe(pair.lost.plan.topSpin);
  expect(pair.kept.plan.sideSpin).toBe(pair.lost.plan.sideSpin);
  for (const branch of [pair.kept, pair.lost]) {
    expect(evaluateShotObjective(p.scenario, branch.opening.plan, branch.opening.simulation).success).toBe(true);
    expect(secondShotPotted(2, branch.simulation)).toBe(true);
    expect(branch.scenario.balls).toEqual(branch.opening.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
    expect(branch.thirdScenario.balls).toEqual(branch.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
    for (const ball of source.balls.filter(b => b.id > 1)) {
      expect(distance(ball.position, branch.scenario.balls.find(b => b.id === ball.id)!.position)).toBeLessThan(.001);
    }
    expect(branch.thirdScenario.balls.some(b => b.id === 3)).toBe(true);
    expect(branch.thirdScenario.balls.some(b => b.id === 4)).toBe(true);
    expect(branch.scenario.objective).toBeUndefined();
  }
  expect(directShotRoutes(pair.lost.thirdScenario.balls, 3, LOOK_AHEAD_CUT)).toHaveLength(0);
  expect(pair.kept.routes.length).toBeGreaterThan(0);
  expect(secondShotPotted(3, pair.third)).toBe(true);
  expect(pair.thirdCut).toBeLessThanOrEqual(LOOK_AHEAD_CUT);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: pair.lost.opening.plan.id }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(c => c.successRate > 0)).toBe(true);
    expect(lookAheadPairFinder(p.scenario)(result.candidates.filter(c => p.lookAheadOptionIds?.includes(c.plan.id)).map(c => ({ plan: c.plan, simulation: c.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects failed openers and movement of spare balls in the matched starting layouts', () => {
  const p = prepareRound(generateScenario(34, 0), { regenerate: false });
  const plan = p.balls[0].options[0].plan, simulation = simulateShot(p.scenario, plan);
  for (const invalid of [{ ...simulation, scratch: true }, { ...simulation, stopped: false }, { ...simulation, firstContact: 2 }, { ...simulation, potted: [] }, {
    ...simulation, finalBalls: simulation.finalBalls.map(b => b.id === 4 ? { ...b, position: { x: b.position.x + .1, y: b.position.y } } : b),
  }]) expect(lookAheadTrials(p.scenario, { plan, simulation: invalid })).toHaveLength(0);
});
