import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { pocketChangePairFinder } from './pocket-change';
import { simulateShot } from './physics';
import { directShotRoutes, evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { TABLE } from './constants';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance, segmentDistance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 44 * 919])('requires a pocket change and an adapted finish, seed %i', seed => {
  const source = generateScenario(44, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.pocketChange!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.originalId, c.adaptedId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = pocketChangePairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull();
  expect(pair.original.plan.id).toBe(c.originalId); expect(pair.adapted.plan.id).toBe(c.adaptedId);
  expect(pair.preferred.pocketId).toBe(c.preferredPocketId); expect(pair.alternate.pocketId).toBe(c.alternatePocketId);
  expect(c.preferredPocketId).not.toBe(c.alternatePocketId); expect(c.blockerId).toBe(3);
  expect(pair.original.plan.pocketId).toBe(pair.adapted.plan.pocketId);
  for (const entry of entries) {
    const outcome = evaluateShotObjective(p.scenario, entry.plan, entry.simulation);
    expect(outcome.legalPot).toBe(true); expect(outcome.positioned).toBe(true);
    for (const ball of source.balls.filter(b => b.id > 1)) expect(distance(ball.position, entry.simulation.finalBalls.find(b => b.id === ball.id)!.position)).toBeLessThan(.001);
  }
  expect(pair.old.routes).toHaveLength(0);
  expect(pair.next.routes.some(r => r.pocketId === c.alternatePocketId)).toBe(true);
  expect(pair.next.routes.some(r => r.pocketId === c.preferredPocketId)).toBe(false);
  const object = pair.old.scenario.balls.find(b => b.id === 2)!, preferredPocket = POCKET_GEOMETRY.find(p => p.id === c.preferredPocketId)!;
  expect(segmentDistance(pair.blocker.position, object.position, preferredPocket.center)).toBeLessThan(TABLE.ballDiameter);
  expect(segmentDistance(pair.blocker.position, pair.original.simulation.cueEnd, pair.preferred.ghost)).toBeGreaterThanOrEqual(TABLE.ballDiameter * 1.025);
  expect(pair.preferred.cutAngle).toBeLessThanOrEqual(source.objective!.maxCutAngle);
  expect(pair.oldAlternate.cutAngle).toBeGreaterThanOrEqual(source.objective!.maxCutAngle + 5);
  expect(pair.oldAlternate.cutAngle - pair.alternate.cutAngle).toBeGreaterThanOrEqual(8);
  expect(pair.alternate.cutAngle).toBeLessThanOrEqual(source.objective!.maxCutAngle);
  expect(directShotRoutes(pair.old.scenario.balls, 2, 89.9).find(r => r.pocketId === c.alternatePocketId)).toEqual(pair.oldAlternate);
  expect(pair.preferredProof.scenario.balls).toEqual(pair.old.scenario.balls.filter(b => b.id !== c.blockerId));
  expect(pair.alternateProof.scenario.balls).toEqual(pair.next.scenario.balls);
  for (const proof of [pair.preferredProof, pair.alternateProof]) {
    expect(secondShotPotted(2, proof.simulation)).toBe(true);
    expect(simulateShot(proof.scenario, proof.plan, { record: false, recordPaths: true })).toEqual(proof.simulation);
  }
  expect(pair.preferredProof.plan.pocketId).toBe(c.preferredPocketId); expect(pair.alternateProof.plan.pocketId).toBe(c.alternatePocketId);
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.originalId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(pocketChangePairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers and changes to the remaining balls', () => {
  const p = prepareRound(generateScenario(44, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }]) expect(pocketChangePairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, ...flags } })))).toBeNull();
  for (const id of [2, 3, 4]) expect(pocketChangePairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })))).toBeNull();
  expect(pocketChangePairFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
});
