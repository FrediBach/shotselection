import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { spareGrazeEvidence, spareGrazePairFinder } from './spare-graze';
import { evaluateShotObjective } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance, dot, normalize } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 43 * 919])('proves a post-pot graze and a clear pass, seed %i', seed => {
  const source = generateScenario(43, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.spareGraze!;
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.grazedId, c.clearId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const original = structuredClone(entries), pair = spareGrazePairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull(); expect(pair.grazed.plan.id).toBe(c.grazedId); expect(pair.clear.plan.id).toBe(c.clearId);
  expect(pair.grazed.plan.pocketId).toBe(pair.clear.plan.pocketId);
  expect(Math.max(pair.grazed.plan.speed, pair.clear.plan.speed) / Math.min(pair.grazed.plan.speed, pair.clear.plan.speed)).toBeLessThanOrEqual(1.7);
  expect(pair.graze.traced.ballContacts).toEqual([[0, 1], [0, 3]]); expect(pair.clean.traced.ballContacts).toEqual([[0, 1]]);
  expect(pair.graze.contact.pottedBefore).toContain(1); expect(pair.graze.contact.time).toBeGreaterThan(pair.graze.traced.firstImpact!.time);
  expect(pair.graze.normalAngle).toBeGreaterThanOrEqual(40); expect(pair.graze.normalAngle).toBeLessThanOrEqual(80);
  expect(pair.graze.deflection).toBeGreaterThanOrEqual(10); expect(pair.graze.deflection).toBeLessThanOrEqual(70);
  expect(pair.graze.deflection).toBeCloseTo(Math.acos(dot(normalize(pair.graze.contact.incoming), normalize(pair.graze.contact.outgoing))) * 180 / Math.PI, 8);
  expect(pair.clean.clearance).toBeGreaterThanOrEqual(.02);
  expect(evaluateShotObjective(p.scenario, pair.clear.plan, pair.clean.traced).success).toBe(true);
  for (const opening of [pair.grazed, pair.clear]) {
    expect(secondShotPotted(1, opening.simulation)).toBe(true);
    for (const b of source.balls.filter(b => b.id === 2 || b.id === 4)) expect(distance(b.position, opening.simulation.finalBalls.find(e => e.id === b.id)!.position)).toBeLessThan(.001);
  }
  expect(pair.graze.without.balls).toEqual(source.balls.filter(b => b.id !== 3));
  expect(secondShotPotted(1, pair.graze.counterfactual)).toBe(true);
  expect(simulateShot(pair.graze.without, pair.grazed.plan, { record: false, recordPaths: true })).toEqual(pair.graze.counterfactual);
  expect(pair.graze.finishShift).toBeGreaterThanOrEqual(.1);
  expect(pair.graze.finishShift).toBeCloseTo(distance(pair.graze.traced.cueEnd, pair.graze.counterfactual.cueEnd), 9);
  expect(entries).toEqual(original);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.grazedId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(spareGrazePairFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('records collision evidence without changing physical outcomes or ordinary replay data', () => {
  const p = prepareRound(generateScenario(43, 0), { regenerate: false });
  for (const option of p.balls[0].options) {
    const baseline = simulateShot(p.scenario, option.plan), measured = simulateShot(p.scenario, option.plan, { recordContacts: true });
    expect(baseline.cueContacts).toBeUndefined(); expect(measured.cueContacts!.length).toBeGreaterThan(0);
    const { cueContacts: _contacts, cuePath: _measuredPath, ...outcome } = measured;
    const { cuePath: _baselinePath, ...expected } = baseline;
    expect(outcome).toEqual(expected);
    for (const c of measured.cueContacts!) {
      expect(measured.cuePath).toContainEqual(c.position);
      expect(c.time).toBeGreaterThan(0);
      expect(Object.values(c.incoming).every(Number.isFinite)).toBe(true);
      expect(Object.values(c.outgoing).every(Number.isFinite)).toBe(true);
    }
    const light = simulateShot(p.scenario, option.plan, { record: false, recordContacts: true });
    expect(light.cueContacts).toEqual(measured.cueContacts); expect(light.cuePath).toHaveLength(0);
  }
});

it('rejects invalid openings, extra collisions and moved reserved balls', () => {
  const p = prepareRound(generateScenario(43, 0), { regenerate: false });
  const plan = p.balls[0].options.find(o => o.id === p.spareGraze!.grazedId)!.plan, simulation = simulateShot(p.scenario, plan);
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { ballContacts: [[0, 1], [0, 3], [0, 4]] as [number, number][] }]) expect(spareGrazeEvidence(p.scenario, { plan, simulation: { ...simulation, ...flags } })).toBeNull();
  expect(spareGrazeEvidence(p.scenario, { plan, simulation: { ...simulation, finalBalls: simulation.finalBalls.map(b => b.id === 2 ? { ...b, position: { x: .2, y: .2 } } : b) } })).toBeNull();
  expect(spareGrazePairFinder({ ...p.scenario, objective: undefined })([{ plan, simulation }])).toBeNull();
});
