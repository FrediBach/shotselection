import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickErrorEvidence } from './kick-error';
import { distance } from './math';
it.each([0, 1, 5, 8, 59 * 919])('matches angular perturbations at successive physical events, seed %i', seed => {
  const source = generateScenario(59, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.kickError!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(p.balls[0].options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = kickErrorEvidence(source, plan, x)!;
  expect(e).not.toBeNull(); expect(x.minusPlan).toEqual({ ...plan, angle: plan.angle - x.radians }); expect(x.plusPlan).toEqual({ ...plan, angle: plan.angle + x.radians });
  for (const [stroke, sim, checkpoints] of [[plan, x.reference, e.reference], [x.minusPlan, x.minus, e.minus], [x.plusPlan, x.plus, e.plus]] as const) {
    expect(sim).toEqual(simulateShot(source, stroke, { record: false, recordPaths: true }));
    expect(sim.firstContact).toBe(1); expect(sim.cueBanksBeforeContact).toBe(2);
    expect(checkpoints.positions).toEqual([sim.cueRebounds![0].position, sim.cueRebounds![1].position, sim.firstImpact!.position]);
    expect(checkpoints.path.at(-1)).toEqual(sim.firstImpact!.position);
    expect(checkpoints.rebounds[0].time).toBeLessThan(checkpoints.rebounds[1].time); expect(checkpoints.rebounds[1].time).toBeLessThan(checkpoints.contact.time);
  }
  expect(e.spreads).toEqual(e.minus.positions.map((v, i) => distance(v, e.plus.positions[i])));
  expect(e.growth).toEqual(e.spreads.map((v, i) => v - (i ? e.spreads[i - 1] : 0)));
  expect(e.growth.reduce((a, b) => a + b, 0)).toBeCloseTo(e.spreads[2], 12);
  expect(e.growth[e.largest]).toBe(Math.max(...e.growth));
  expect(x.reference.potted).toContain(1); expect(x.reference.scratch).toBe(false);
}, 60000);
it('rejects confounded controls, unmatched contacts, reordered rebounds and absent spread', () => {
  const p = prepareRound(generateScenario(59, 0), { regenerate: false }), x = p.kickError!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const before = structuredClone(x);
  for (const invalid of [
    { ...x, radians: 0 }, { ...x, radians: NaN }, { ...x, plusPlan: { ...x.plusPlan, speed: x.plusPlan.speed + .1 } },
    { ...x, minusPlan: { ...x.minusPlan, topSpin: 0 } }, { ...x, plus: { ...x.plus, firstContact: 2 } },
    { ...x, plus: { ...x.plus, cueRebounds: [] } }, { ...x, plus: { ...x.plus, cueRebounds: [...x.plus.cueRebounds!].reverse() } },
    { ...x, plus: x.minus }, { ...x, reference: { ...x.reference, scratch: true } },
  ]) expect(kickErrorEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(x).toEqual(before);
}, 60000);
