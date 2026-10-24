import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { corridorCenterEvidence, corridorCenterPairFinder } from './corridor-center';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 48 * 919])('keeps both next pots and comparable cuts while changing corridor margin, seed %i', seed => {
  const source = generateScenario(48, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.corridorCenter!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.centerId, c.edgeId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = corridorCenterPairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull(); expect(pair.center.plan.id).toBe(c.centerId); expect(pair.edge.plan.id).toBe(c.edgeId);
  expect(pair.center.plan.pocketId).toBe(pair.edge.plan.pocketId);
  expect(pair.central.route.pocketId).toBe(pair.marginal.route.pocketId);
  expect(Math.abs(pair.central.route.cutAngle - pair.marginal.route.cutAngle)).toBeLessThanOrEqual(8);
  expect(pair.central.clearance).toBeGreaterThanOrEqual(.025);
  expect(Math.abs(pair.central.sides[0].clearance - pair.central.sides[1].clearance)).toBeLessThanOrEqual(.01);
  expect(pair.marginal.clearance).toBeGreaterThanOrEqual(.003); expect(pair.marginal.clearance).toBeLessThanOrEqual(.012);
  expect(pair.central.clearance - pair.marginal.clearance).toBeGreaterThanOrEqual(.025);
  for (const e of [pair.central, pair.marginal]) {
    expect(evaluateShotObjective(p.scenario, e.opening.plan, e.opening.simulation).success).toBe(true);
    expect(e.opening.simulation.ballContacts).toEqual([[0, 1]]);
    expect(e.sides[0].side * e.sides[1].side).toBeLessThan(0);
    expect(Math.abs(e.sides[0].along - e.sides[1].along)).toBeLessThanOrEqual(.06);
    for (const b of source.balls.filter(b => b.id > 1)) expect(distance(b.position, e.opening.simulation.finalBalls.find(c => c.id === b.id)!.position)).toBeLessThan(.001);
  }
  for (const proof of [pair.centerProof, pair.edgeProof]) {
    expect(proof.scenario.balls.map(b => b.id)).toEqual([0, 2, 3, 4, 5]);
    expect(secondShotPotted(2, proof.simulation)).toBe(true); expect(proof.simulation.ballContacts).toEqual([[0, 2]]);
    expect(simulateShot(proof.scenario, proof.plan, { record: false, recordPaths: true })).toEqual(proof.simulation);
  }
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.centerId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(corridorCenterPairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers, missing gate balls and moved traffic', () => {
  const p = prepareRound(generateScenario(48, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const e of entries) {
    for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { potted: [1, 3] }, { ballContacts: [[0, 1], [0, 3]] as [number, number][] }]) expect(corridorCenterEvidence(p.scenario, { ...e, simulation: { ...e.simulation, ...flags } })).toEqual([]);
    for (const id of [2, 3, 4, 5]) expect(corridorCenterEvidence(p.scenario, { ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })).toEqual([]);
    for (const id of [3, 4]) expect(corridorCenterEvidence({ ...p.scenario, balls: p.scenario.balls.filter(b => b.id !== id) }, e)).toEqual([]);
  }
  expect(corridorCenterPairFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
});
