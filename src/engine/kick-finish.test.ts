import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { kickFinishEvidence } from './kick-finish';
import { simulateShot } from './physics';
it.each([0, 1, 5, 8, 56 * 919])('compares actual safe and scratching kick departures, seed %i', seed => {
  const source = generateScenario(56, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), x = p.kickFinish!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls[0].options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const e = kickFinishEvidence(source, plan, x)!; expect(e).not.toBeNull();
  for (const [stroke, simulation, evidence] of [[plan, x.reference, e.reference], [x.scratchPlan, x.scratched, e.scratched]] as const) {
    expect(simulation).toEqual(simulateShot(source, stroke, { record: false, recordPaths: true, recordContacts: true }));
    expect(simulation.potted).toContain(1); expect(simulation.firstContact).toBe(1); expect(simulation.objectCushions).toBe(0);
    expect(simulation.cueContacts).toHaveLength(1); expect(evidence.contact.time).toBeGreaterThan(evidence.rebound.time);
    expect(evidence.approach[0]).toEqual(evidence.rebound.position);
    expect(evidence.departure[0]).toEqual(evidence.contact.position);
    expect(evidence.departure.at(-1)).toEqual(simulation.cuePath.at(-1));
  }
  expect(x.reference.scratch).toBe(false); expect(x.scratched.scratch).toBe(true);
  expect(e.approachAngle).toBeGreaterThanOrEqual(10); expect(e.launchAngle).toBeGreaterThanOrEqual(90);
  expect(x.scratchPlan.pocketId).toBe(plan.pocketId);
});
it('rejects wrong pockets, missing contacts, missing rebounds and non-scratch outcomes', () => {
  const p = prepareRound(generateScenario(56, 0), { regenerate: false }), x = p.kickFinish!;
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const invalid of [
    { ...x, scratchPlan: { ...x.scratchPlan, pocketId: -1 } },
    { ...x, scratched: { ...x.scratched, scratch: false } },
    { ...x, scratched: { ...x.scratched, cueContacts: [] } },
    { ...x, scratched: { ...x.scratched, cueRebounds: [] } },
    { ...x, scratched: { ...x.scratched, firstContact: 2 } },
    { ...x, scratched: { ...x.scratched, potted: [] } },
    { ...x, reference: { ...x.reference, scratch: true } },
  ]) expect(kickFinishEvidence(p.scenario, plan, invalid)).toBeNull();
});
