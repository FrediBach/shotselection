import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickSpinEvidence, kickExitSegment } from './kick-spin';
import { distance } from './math';
import { analyzeRound } from './analysis';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 54 * 919])('isolates spin, then corrects aim on the same rail, seed %i', seed => {
  const source = generateScenario(54, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), x = p.kickSpin!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(x).toBeDefined(); expect(p.balls[0].options).toHaveLength(3);
  const option = p.balls[0].options.find(o => o.id === x.referenceId)!;
  const before = structuredClone(x), e = kickSpinEvidence(source, option.plan, x)!;
  expect(e).not.toBeNull(); expect(x).toEqual(before);
  expect({ ...x.spinPlan, topSpin: option.plan.topSpin }).toEqual(option.plan);
  expect({ ...x.correctedPlan, angle: x.spinPlan.angle }).toEqual(x.spinPlan);
  expect(option.plan.topSpin * x.spinPlan.topSpin).toBeLessThan(0);
  for (const [plan, simulation] of [[option.plan, x.reference], [x.spinPlan, x.spinOnly], [x.correctedPlan, x.corrected]] as const) {
    expect(simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true }));
    const exit = kickExitSegment(simulation)!;
    const length = exit.path.slice(1).reduce((total, point, i) => total + distance(exit.path[i], point), 0);
    expect(length).toBeCloseTo(.2, 10);
    expect(exit.path[0]).toEqual(simulation.cueRebounds![0].position);
  }
  for (const simulation of [x.reference, x.corrected]) {
    expect(simulation.firstContact).toBe(1); expect(simulation.potted).toContain(1);
    expect(simulation.scratch).toBe(false); expect(simulation.stopped).toBe(true);
    expect(simulation.objectCushions).toBe(0);
  }
  expect(x.spinOnly.potted).toEqual([]); expect(x.spinOnly.stopped).toBe(true); expect(x.spinOnly.scratch).toBe(false);
  expect(distance(e.reference.rebound.position, e.spinOnly.rebound.position)).toBeLessThanOrEqual(.003);
  expect(e.immediateAngle).toBeLessThanOrEqual(.1); expect(e.exitAngle).toBeGreaterThanOrEqual(3);
  expect(e.shift).toBeGreaterThanOrEqual(.02); expect(e.aimChange).toBeGreaterThanOrEqual(1);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 32, talents: character.talents });
    expect(kickSpinEvidence(source, option.plan, { ...x, reference: result.selected.nominal })).not.toBeNull();
  }
});

it('rejects confounded controls, unsuitable outcomes and unverified exit paths', () => {
  const p = prepareRound(generateScenario(54, 0), { regenerate: false }), x = p.kickSpin!;
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const invalid of [
    { ...x, spinPlan: { ...x.spinPlan, speed: x.spinPlan.speed + .1 } },
    { ...x, spinPlan: { ...x.spinPlan, sideSpin: 1 } },
    { ...x, correctedPlan: { ...x.correctedPlan, topSpin: 0 } },
    { ...x, spinOnly: { ...x.spinOnly, potted: [1] } },
    { ...x, spinOnly: { ...x.spinOnly, firstContact: 2 } },
    { ...x, corrected: { ...x.corrected, scratch: true } },
    { ...x, corrected: { ...x.corrected, objectCushions: 1 } },
    { ...x, reference: { ...x.reference, cueApproachPath: [] } },
  ]) expect(kickSpinEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(kickExitSegment({ ...x.reference, cueRebounds: [] })).toBeNull();
  expect(kickExitSegment({ ...x.reference, cueApproachPath: x.reference.cueApproachPath.slice(0, 2) })).toBeNull();
});
