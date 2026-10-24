import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { fallbackEvidence, fallbackPairFinder } from './fallback-plan';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 40 * 919])('preserves two independently verified next balls versus one narrow route, seed %i', seed => {
  const source = generateScenario(40, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.fallbackPlan!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.narrowId, c.flexibleId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = fallbackPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  expect(pair.narrow.plan.id).toBe(c.narrowId); expect(pair.flexible.plan.id).toBe(c.flexibleId);
  expect(pair.narrow.plan.pocketId).toBe(pair.flexible.plan.pocketId);
  expect(pair.single.available).toHaveLength(1); expect(pair.multiple.available).toHaveLength(2);
  expect(pair.single.available[0].ballId).toBe(2); expect(pair.single.available[0].routes).toHaveLength(1);
  expect(pair.single.available[0].routes[0].cutAngle).toBeGreaterThanOrEqual(source.objective!.maxCutAngle - 8);
  for (const [opening, e] of [[pair.narrow, pair.single], [pair.flexible, pair.multiple]] as const) {
    expect(evaluateShotObjective(p.scenario, opening.plan, opening.simulation).success).toBe(true);
    expect(e.scenario.balls).toEqual(opening.simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position })));
    expect(e.choices.map(c => c.ballId)).toEqual(source.balls.filter(b => b.id > 1).map(b => b.id));
    expect(e.proofs).toHaveLength(e.available.length);
    for (const choice of e.choices) expect(choice.routes).toEqual(directShotRoutes(e.scenario.balls, choice.ballId, source.objective!.maxCutAngle));
    for (const proof of e.proofs) {
      expect(secondShotPotted(proof.ballId, proof.simulation)).toBe(true);
      expect(proof.simulation).toEqual(simulateShot(e.scenario, proof.plan, { record: false, recordPaths: true }));
      expect(proof.route.cutAngle).toBeLessThanOrEqual(source.objective!.maxCutAngle);
    }
  }
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.flexibleId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(shot => shot.successRate > 0)).toBe(true);
    expect(fallbackPairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers and missing or displaced remaining balls', () => {
  const p = prepareRound(generateScenario(40, 0), { regenerate: false });
  const plan = p.balls[0].options.find(o => o.id === p.fallbackPlan!.flexibleId)!.plan;
  const opening = simulateShot(p.scenario, plan);
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) expect(fallbackEvidence(p.scenario, { ...opening, ...flags })).toBeNull();
  expect(fallbackEvidence(p.scenario, { ...opening, finalBalls: opening.finalBalls.filter(b => b.id !== 4) })).toBeNull();
  expect(fallbackEvidence(p.scenario, { ...opening, finalBalls: opening.finalBalls.map(b => b.id === 4 ? { ...b, position: { x: .4, y: .4 } } : b) })).toBeNull();
  expect(fallbackPairFinder({ ...p.scenario, objective: undefined })([{ plan, simulation: opening }])).toBeNull();
});
