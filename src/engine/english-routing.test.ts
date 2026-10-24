import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { englishRoutingEvidence } from './english-routing';
import { simulateShot } from './physics';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 49 * 919])('changes only English and passes opposite sides while keeping position, seed %i', seed => {
  const source = generateScenario(49, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.englishRouting!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const option = p.balls[0].options.find(o => o.id === c.referenceId)!;
  const opening = { plan: option.plan, simulation: simulateShot(p.scenario, option.plan) }, before = structuredClone(opening);
  const e = englishRoutingEvidence(p.scenario, opening)!;
  expect(e).not.toBeNull(); expect(e.withEnglish.plan.sideSpin).not.toBe(0);
  expect(e.withoutEnglish.plan).toEqual({ ...e.withEnglish.plan, sideSpin: 0 });
  expect(e.withEnglish.side * e.withoutEnglish.side).toBeLessThan(0);
  expect(e.reboundSeparation).toBeLessThanOrEqual(1e-6); expect(e.incomingDifference).toBeLessThanOrEqual(.001);
  expect(e.outgoingDifference).toBeGreaterThanOrEqual(4);
  expect(e.withEnglish.before).toHaveLength(e.withoutEnglish.before.length);
  e.withEnglish.before.forEach((point, i) => expect(distance(point, e.withoutEnglish.before[i])).toBeLessThan(1e-9));
  expect(e.withEnglish.rebound.time).toBe(e.withoutEnglish.rebound.time);
  for (const x of [e.withEnglish, e.withoutEnglish]) {
    expect(evaluateShotObjective(p.scenario, x.plan, x.simulation).success).toBe(true);
    expect(hasProvenNextShot(p.scenario, x.simulation)).toBe(true);
    expect(x.simulation.ballContacts).toEqual([[0, 1]]); expect(x.simulation.potted).toEqual([1]);
    expect(x.clearance).toBeGreaterThanOrEqual(.012);
    expect(x.simulation.cueRebounds).toHaveLength(1); expect(x.rebound.beforeContact).toBe(false);
    expect(x.before.at(-1)).toEqual(x.rebound.position); expect(x.after[0]).toEqual(x.rebound.position);
    expect([...x.before.slice(0, -1), ...x.after]).toEqual(x.simulation.cuePath);
    expect(distance(x.nearest.point, x.rebound.position)).toBeGreaterThanOrEqual(.08);
    expect(distance(x.nearest.point, x.simulation.cueEnd)).toBeGreaterThanOrEqual(.06);
    for (const b of source.balls.filter(b => b.id > 1)) expect(distance(b.position, x.simulation.finalBalls.find(c => c.id === b.id)!.position)).toBeLessThan(.001);
    expect(simulateShot(p.scenario, x.plan, { record: false, recordPaths: true })).toEqual(x.simulation);
  }
  expect(opening).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.referenceId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    const reference = result.candidates.find(s => s.plan.id === c.referenceId)!;
    expect(englishRoutingEvidence(p.scenario, { plan: reference.plan, simulation: reference.nominal })).not.toBeNull();
  }
}, 30000);

it('rejects absent English, invalid results and missing or displaced blockers', () => {
  const p = prepareRound(generateScenario(49, 0), { regenerate: false });
  const plan = p.balls[0].options.find(o => o.id === p.englishRouting!.referenceId)!.plan;
  const opening = { plan, simulation: simulateShot(p.scenario, plan) };
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { ballContacts: [[0, 1], [0, 3]] as [number, number][] }, { cueEnd: { x: .1, y: .1 } }]) expect(englishRoutingEvidence(p.scenario, { ...opening, simulation: { ...opening.simulation, ...flags } })).toBeNull();
  expect(englishRoutingEvidence(p.scenario, { ...opening, plan: { ...plan, sideSpin: 0 } })).toBeNull();
  expect(englishRoutingEvidence({ ...p.scenario, objective: undefined }, opening)).toBeNull();
  expect(englishRoutingEvidence({ ...p.scenario, balls: p.scenario.balls.filter(b => b.id !== 3) }, opening)).toBeNull();
  expect(englishRoutingEvidence({ ...p.scenario, balls: p.scenario.balls.map(b => b.id === 3 ? { ...b, position: { x: 1.2, y: 1.1 } } : b) }, opening)).toBeNull();
});
