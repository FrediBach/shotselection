import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { returnLaneEvidence, returnLanePairFinder, pathClearance } from './return-lane';
import { simulateShot } from './physics';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance } from './math';
import { TABLE } from './constants';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 47 * 919])('contrasts two successful return legs and isolates the narrow gap, seed %i', seed => {
  const source = generateScenario(47, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.returnLane!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.riskyId, c.clearId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = returnLanePairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull(); expect(pair.risky.plan.id).toBe(c.riskyId); expect(pair.clear.plan.id).toBe(c.clearId);
  expect(pair.risky.plan.pocketId).toBe(pair.clear.plan.pocketId);
  for (const e of [pair.narrow, pair.wide]) {
    expect(evaluateShotObjective(p.scenario, e.opening.plan, e.traced).success).toBe(true);
    expect(hasProvenNextShot(p.scenario, e.traced)).toBe(true);
    expect(e.traced.potted).toEqual([1]); expect(e.traced.ballContacts).toEqual([[0, 1]]);
    expect(e.traced.cueRebounds).toHaveLength(1); expect(e.rebound.beforeContact).toBe(false);
    expect(e.outbound.at(-1)).toEqual(e.rebound.position); expect(e.returning[0]).toEqual(e.rebound.position);
    expect([...e.outbound.slice(0, -1), ...e.returning]).toEqual(e.traced.cuePath);
    expect(e.outboundClearance).toBeGreaterThanOrEqual(.03);
    expect(distance(e.blocker.position, e.nearest) - TABLE.ballDiameter).toBeCloseTo(e.clearance, 10);
    for (const b of source.balls.filter(b => b.id > 1)) expect(distance(b.position, e.traced.finalBalls.find(c => c.id === b.id)!.position)).toBeLessThan(.001);
    for (const b of source.balls.filter(b => b.id > 1 && b.id !== 3)) expect(pathClearance(b.position, e.traced.cuePath)).toBeGreaterThanOrEqual(.03);
  }
  expect(pair.narrow.clearance).toBeGreaterThanOrEqual(.002); expect(pair.narrow.clearance).toBeLessThanOrEqual(.01);
  expect(pair.wide.clearance).toBeGreaterThanOrEqual(.04);
  expect(distance(pair.narrow.nearest, pair.narrow.rebound.position)).toBeGreaterThanOrEqual(.08);
  expect(distance(pair.narrow.nearest, pair.risky.simulation.cueEnd)).toBeGreaterThanOrEqual(.08);
  const probe = pair.shifted, blocker = probe.scenario.balls.find(b => b.id === 3)!;
  expect(probe.scenario).toEqual({ ...p.scenario, balls: p.scenario.balls.map(b => b.id === 3 ? blocker : b) });
  expect(distance(blocker.position, pair.narrow.blocker.position)).toBeCloseTo(pair.narrow.clearance + .004, 10);
  expect(pathClearance(blocker.position, pair.narrow.returning)).toBeCloseTo(-.004, 8);
  expect(secondShotPotted(1, probe.simulation)).toBe(true);
  expect(probe.simulation.ballContacts).toEqual([[0, 1], [0, 3]]);
  expect(probe.contact.time).toBeGreaterThan(pair.narrow.rebound.time);
  expect(probe.simulation.cueRebounds![0]).toEqual(pair.narrow.rebound);
  expect(simulateShot(probe.scenario, pair.risky.plan, { record: false, recordPaths: true, recordContacts: true })).toEqual(probe.simulation);
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.riskyId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(returnLanePairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('rejects invalid openers, missing or early rebounds and displaced spare balls', () => {
  const p = prepareRound(generateScenario(47, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const e of entries) {
    for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { potted: [1, 3] }, { cueRebounds: [] }, { cueRebounds: e.simulation.cueRebounds?.map(r => ({ ...r, beforeContact: true })) }, { ballContacts: [[0, 1], [0, 3]] as [number, number][] }]) expect(returnLaneEvidence(p.scenario, { ...e, simulation: { ...e.simulation, ...flags } })).toBeNull();
    for (const id of [2, 3, 4, 5]) expect(returnLaneEvidence(p.scenario, { ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })).toBeNull();
  }
  expect(returnLanePairFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
});
