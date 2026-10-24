import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { corridorEvidence, corridorPairFinder } from './corridor-diagnosis';
import { directShotRoutes, evaluateShotObjective, hasProvenNextShot } from './objectives';
import { segmentDistance } from './math';
import { TABLE } from './constants';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 37 * 919])('isolates both blocked corridors, seed %i', seed => {
  const source = generateScenario(37, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const original = structuredClone(entries), pair = corridorPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  expect(pair.map(e => e.evidence.corridor)).toEqual(['approach', 'pocket']);
  expect(pair[0].opening.plan.id).not.toBe(pair[1].opening.plan.id);
  expect(pair[0].evidence.blocker.id).not.toBe(pair[1].evidence.blocker.id);
  for (const { opening, evidence: e } of pair) {
    expect(evaluateShotObjective(p.scenario, opening.plan, opening.simulation).legalPot).toBe(true);
    expect(e.balls).toEqual(opening.simulation.finalBalls.filter(b => !b.pocketed));
    expect(directShotRoutes(e.balls, 2, source.objective!.maxCutAngle).some(r => r.pocketId === e.pocket.id)).toBe(false);
    const restored = e.balls.filter(b => b.id !== e.blocker.id);
    expect(directShotRoutes(restored, 2, source.objective!.maxCutAngle)).toContainEqual(e.route);
    expect(segmentDistance(e.blocker.position, e.cue.position, e.route.ghost) < TABLE.ballDiameter * 1.025).toBe(e.corridor === 'approach');
    expect(segmentDistance(e.blocker.position, e.object.position, e.pocket.center) < TABLE.ballDiameter * 1.025).toBe(e.corridor === 'pocket');
    expect(e.route.cutAngle).toBeLessThanOrEqual(source.objective!.maxCutAngle);
  }
  const successful = entries.find(e => evaluateShotObjective(p.scenario, e.plan, e.simulation).success)!;
  expect(successful).toBeDefined(); expect(hasProvenNextShot(p.scenario, successful.simulation)).toBe(true);
  expect(entries).toEqual(original);
  for (const character of PREMADE_CHARACTERS) {
    const analysis = analyzeRound(p, { ballId: 1, optionId: pair[0].opening.plan.id }, { samples: 32, talents: character.talents });
    expect(analysis.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(corridorPairFinder(p.scenario)(analysis.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects failed openers and diagnoses only a blocker that restores the route alone', () => {
  const p = prepareRound(generateScenario(37, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const pair = corridorPairFinder(p.scenario)(entries)!;
  for (const { opening, evidence: e } of pair) {
    for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) expect(corridorEvidence(p.scenario, { ...opening.simulation, ...flags })).toEqual([]);
    const without = { ...opening.simulation, finalBalls: opening.simulation.finalBalls.filter(b => b.id !== e.blocker.id) };
    expect(corridorEvidence(p.scenario, without).some(c => c.route.pocketId === e.route.pocketId)).toBe(false);
    const doubled = { ...opening.simulation, finalBalls: [...opening.simulation.finalBalls, { ...e.blocker, id: 9 }] };
    expect(corridorEvidence(p.scenario, doubled).some(c => c.route.pocketId === e.route.pocketId)).toBe(false);
  }
});
