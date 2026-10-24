import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { elongatedPositionFinder, positionArrival, positionSpeedSweep } from './elongated-position';
import { positionRegionRatio } from './position-region';
import { simulateShot } from './physics';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 50 * 919])('compares actual ellipse entries and fixed-spin speed tolerance, seed %i', seed => {
  const source = generateScenario(50, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.elongatedPosition!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.alongId, c.acrossId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = elongatedPositionFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull(); expect(pair.along.plan.id).toBe(c.alongId); expect(pair.across.plan.id).toBe(c.acrossId);
  expect(pair.along.plan.pocketId).toBe(pair.across.plan.pocketId);
  expect(pair.alongAngle).toBeLessThanOrEqual(20); expect(pair.acrossAngle).toBeGreaterThanOrEqual(65);
  expect(pair.alongSweep.span).toBeGreaterThanOrEqual(10); expect(pair.alongSweep.span - pair.acrossSweep.span).toBeGreaterThanOrEqual(6);
  for (const entry of [pair.alongEntry, pair.acrossEntry]) expect(positionRegionRatio(p.scenario.objective!, entry.point)).toBeCloseTo(1, 8);
  for (const e of [pair.a, pair.b]) {
    expect(evaluateShotObjective(p.scenario, e.opening.plan, e.traced).success).toBe(true);
    expect(positionRegionRatio(p.scenario.objective!, e.traced.cueEnd)).toBeLessThanOrEqual(.8);
    expect(hasProvenNextShot(p.scenario, e.traced)).toBe(true);
    expect(e.traced.potted).toEqual([1]); expect(e.traced.ballContacts).toEqual([[0, 1]]);
    for (const b of source.balls.filter(b => b.id > 1)) expect(distance(b.position, e.traced.finalBalls.find(c => c.id === b.id)!.position)).toBeLessThan(.001);
  }
  for (const [opening, sweep] of [[pair.along, pair.alongSweep], [pair.across, pair.acrossSweep]] as const) {
    expect(sweep).toEqual(positionSpeedSweep(p.scenario, opening)); expect(sweep.trials).toHaveLength(21);
    expect(sweep.trials[10].success).toBe(true);
    for (const t of sweep.trials) {
      expect(t.plan).toEqual({ ...opening.plan, speed: opening.plan.speed * (1 + t.percent / 100) });
      expect(t.simulation).toEqual(simulateShot(p.scenario, t.plan, { record: false }));
      expect(t.success).toBe(t.legalPot && t.positioned && t.nextShotAvailable);
      expect(t.positioned).toBe(t.simulation.stopped && !t.simulation.scratch && positionRegionRatio(p.scenario.objective!, t.simulation.cueEnd) <= 1);
      if (t.percent >= sweep.low && t.percent <= sweep.high) expect(t.success).toBe(true);
    }
    if (sweep.low > -20) expect(sweep.trials.find(t => t.percent === sweep.low - 2)!.success).toBe(false);
    if (sweep.high < 20) expect(sweep.trials.find(t => t.percent === sweep.high + 2)!.success).toBe(false);
  }
  expect(entries).toEqual(before);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.alongId }, { samples: 32, talents: character.talents });
    expect(result.candidates.some(s => s.successRate > 0)).toBe(true);
    expect(elongatedPositionFinder(p.scenario)(result.candidates.map(s => ({ plan: s.plan, simulation: s.nominal })))).not.toBeNull();
  }
}, 30000);

it('uses the rotated ellipse in the shared scoring predicate and validates its axes', () => {
  const p = prepareRound(generateScenario(50, 0), { regenerate: false });
  const objective = p.scenario.objective!, plan = p.balls[0].options[0].plan, simulation = simulateShot(p.scenario, plan);
  const { angle, longRadius } = objective.ellipse!, target = objective.target!;
  const point = (along: number, across: number) => ({ x: target.x + along * Math.cos(angle) - across * Math.sin(angle), y: target.y + along * Math.sin(angle) + across * Math.cos(angle) });
  for (const [end, inside] of [[point(.25, 0), true], [point(0, .15), false], [point(longRadius * 1.01, 0), false], [point(0, .14), true]] as const) {
    expect(positionRegionRatio(objective, end) <= 1).toBe(inside);
    expect(evaluateShotObjective(p.scenario, plan, { ...simulation, scratch: false, stopped: true, cueEnd: end }).positioned).toBe(inside);
  }
  const circle = { ...objective, ellipse: undefined };
  expect(positionRegionRatio(circle, point(.25, 0))).toBeCloseTo(.25 / objective.radius, 10);
  for (const ellipse of [{ longRadius: objective.radius, angle: 0 }, { longRadius: NaN, angle: 0 }, { longRadius, angle: Infinity }]) expect(() => prepareRound({ ...p.scenario, objective: { ...objective, ellipse } }, { regenerate: false })).toThrow('position lesson');
});

it('rejects invalid opening and displaced traffic evidence', () => {
  const p = prepareRound(generateScenario(50, 0), { regenerate: false });
  const plan = p.balls[0].options.find(o => o.id === p.elongatedPosition!.alongId)!.plan;
  const e = { plan, simulation: simulateShot(p.scenario, plan) };
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { potted: [1, 3] }, { ballContacts: [[0, 1], [0, 3]] as [number, number][] }]) expect(positionArrival(p.scenario, { ...e, simulation: { ...e.simulation, ...flags } })).toBeNull();
  for (const id of [2, 3, 4, 5]) expect(positionArrival(p.scenario, { ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })).toBeNull();
  expect(elongatedPositionFinder({ ...p.scenario, objective: undefined })([e])).toBeNull();
});
