import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeRound } from './analysis';
import { protectedDirection, strengthMargins } from './strength-asymmetry';
import { analyzeShotTolerance, scanToleranceBound } from './tolerance';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
it.each([0, 1, 5, 8, 73 * 919])('verifies both physical boundaries and opposing asymmetry, seed %i', seed => {
  const source = generateScenario(73, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.strengthAsymmetry!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  const plain = prepareRound({ ...source, curriculum: { ...source.curriculum!, learning: undefined } }, { regenerate: false });
  expect(p.scenario.objective).toEqual(plain.scenario.objective);
  for (const [i, o] of p.balls[0].options.entries()) expect({ ...o, id: plain.balls[0].options[i].id, plan: { ...o.plan, id: plain.balls[0].options[i].id } }).toEqual(plain.balls[0].options[i]);
  const reference = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const [index, v] of x.variants.entries()) {
    expect(v.nominalSuccess).toBe(true);
    expect({ ...v.plan, speed: reference.speed }).toEqual(reference);
    expect(protectedDirection(v.sides[0].value, v.sides[1].value)).toBe(index ? 'hard' : 'soft');
    const ordinary = analyzeShotTolerance(p.scenario, v.plan).axes.speed.success;
    for (const [i, s] of v.sides.entries()) {
      expect({ value: s.value, limited: s.limited }).toEqual(i ? ordinary.positive : ordinary.negative);
      expect(s.limited).toBe(false); expect(s.passing.outcome.success).toBe(true); expect(s.failing!.outcome.success).toBe(false);
      expect(Math.abs(s.failing!.offset - s.passing.offset)).toBeLessThanOrEqual(1 / 64 + 1e-12);
      for (const probe of [s.passing, s.failing!]) {
        const plan = { ...v.plan, speed: probe.speed };
        expect(probe.speed).toBeCloseTo(v.plan.speed * (1 + probe.offset / 100), 12);
        const simulation = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
        expect(probe.simulation).toEqual(simulation); expect(probe.outcome).toEqual(evaluateShotObjective(p.scenario, plan, simulation));
      }
    }
  }
  const selected = { ballId: 1, optionId: p.balls[0].options[0].id };
  const { strengthAsymmetry: _preview, ...ordinaryPrepared } = p;
  expect(analyzeRound(p, selected, { samples: 8 })).toEqual(analyzeRound(ordinaryPrepared, selected, { samples: 8 }));
}, 60000);
it('retains first-failure brackets, limits, failed nominals and resolution ties', () => {
  const bound = scanToleranceBound(true, 30, 1, value => value < 2.3 || value > 4);
  expect(bound.limited).toBe(false); expect(bound.value).toBeLessThan(2.3); expect(bound.failing!).toBeGreaterThanOrEqual(2.3);
  expect(scanToleranceBound(true, 2.5, 1, () => true)).toEqual({ value: 2.5, limited: true, failing: null });
  expect(scanToleranceBound(false, 30, 1, () => true)).toEqual({ value: 0, limited: false, failing: 0 });
  expect(protectedDirection(1, 1.01)).toBe('equal'); expect(protectedDirection(.1, 1)).toBe('soft'); expect(protectedDirection(1, .1)).toBe('hard');
  const p = prepareRound(generateScenario(73, 0), { regenerate: false });
  const failed = strengthMargins(p.scenario, p.balls[0].options[1].plan);
  expect(failed.nominalSuccess).toBe(false); expect(failed.sides.every(s => s.value === 0 && !s.failing!.outcome.success)).toBe(true);
});
