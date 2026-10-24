import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { mirrorEnglishPreview, mirrorPoint } from './mirror-english';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { analyzeRound } from './analysis';
import { distance } from './math';
it.each([0, 1, 5, 8, 74 * 919])('reverses handedness with fixed controls and physical cushion evidence, seed %i', seed => {
  const source = generateScenario(74, seed), snapshot = structuredClone(source), p = prepareRound(source, { regenerate: false }), e = p.mirrorEnglish!;
  expect(source).toEqual(snapshot); expect(p.scenario.balls).toEqual(source.balls); expect(e).toBeTruthy();
  expect(p.balls[0].options.filter(o => o.plan.sideSpin)).toHaveLength(1);
  const ref = p.balls[0].options.find(o => o.id === e.referenceId)!;
  expect(e.original.plan).toEqual(ref.plan);
  expect(e.scenario.balls).toEqual(source.balls.map(b => ({ ...b, position: mirrorPoint(b.position) })));
  expect(e.scenario.objective!.target).toEqual(mirrorPoint(p.scenario.objective!.target!));
  expect(e.reversed.plan.sideSpin).toBe(-ref.plan.sideSpin);
  expect({ ...e.copied.plan, sideSpin: e.reversed.plan.sideSpin }).toEqual(e.reversed.plan);
  expect(e.reversed.plan.speed).toBe(ref.plan.speed); expect(e.reversed.plan.topSpin).toBe(ref.plan.topSpin);
  expect(e.reversed.plan.pocketId).toBe([2, 1, 0, 5, 4, 3][ref.plan.pocketId]);
  for (const [i, run] of [e.original, e.reversed, e.copied].entries()) {
    const s = i ? e.scenario : p.scenario;
    expect(run.simulation).toEqual(simulateShot(s, run.plan, { record: false, recordPaths: true }));
    expect(run.outcome).toEqual(evaluateShotObjective(s, run.plan, run.simulation));
    expect(run.outcome.legalPot).toBe(true);
  }
  const a = e.original.simulation, b = e.reversed.simulation, c = e.copied.simulation;
  for (const key of ['cuePath', 'objectPath'] as const) {
    expect(a[key]).toHaveLength(b[key].length);
    a[key].forEach((point, i) => expect(distance(mirrorPoint(point), b[key][i])).toBeLessThan(1e-6));
  }
  for (const ball of a.finalBalls) {
    const reflected = b.finalBalls.find(x => x.id === ball.id)!;
    expect(reflected.pocketed).toBe(ball.pocketed);
    expect(distance(mirrorPoint(ball.position), reflected.position)).toBeLessThan(1e-6);
  }
  for (const key of ['legalPot', 'positioned', 'nextShotAvailable', 'success'] as const) expect(e.original.outcome[key]).toBe(e.reversed.outcome[key]);
  expect(e.original.outcome.error).toBeCloseTo(e.reversed.outcome.error, 6);
  const rebound = b.cueRebounds![0], copied = c.cueRebounds![0];
  expect(distance(rebound.position, copied.position)).toBeLessThan(1e-6);
  expect(distance(rebound.incoming, copied.incoming)).toBeLessThan(1e-6);
  expect(rebound.time).toBeCloseTo(copied.time, 6);
  expect(e.outgoingDifference).toBeGreaterThan(4); expect(e.endpointDifference).toBeGreaterThan(.02);
  const { mirrorEnglish: _preview, ...ordinary } = p, selected = { ballId: 1, optionId: ref.id };
  expect(analyzeRound(p, selected, { samples: 8 })).toEqual(analyzeRound(ordinary, selected, { samples: 8 }));
}, 60000);
it('declines missing English and unsupported objectives', () => {
  const p = prepareRound(generateScenario(74, 0), { regenerate: false });
  expect(mirrorEnglishPreview(p.scenario, p.balls[0].options.filter(o => !o.plan.sideSpin))).toBeNull();
  expect(mirrorEnglishPreview({ ...p.scenario, objective: undefined }, p.balls[0].options)).toBeNull();
  expect(mirrorEnglishPreview({ ...p.scenario, bank: { ballId: 1, minCushions: 1 } }, p.balls[0].options)).toBeNull();
});
