import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickMiddleEvidence, withoutMiddleBlocker } from './kick-middle';
it.each([0, 1, 5, 8, 58 * 919])('proves an obstruction only between rebounds, seed %i', seed => {
  const source = generateScenario(58, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.kickMiddle!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(p.balls[0].options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = kickMiddleEvidence(source, plan, x)!;
  expect(e).not.toBeNull(); const open = withoutMiddleBlocker(source);
  expect(open).toEqual({ ...source, balls: source.balls.filter(b => b.id !== 10) });
  for (const [layout, stroke, sim] of [[source, plan, x.reference], [open, plan, x.referenceOpen], [source, x.blockedPlan, x.blocked], [open, x.blockedPlan, x.intended]] as const)
    expect(sim).toEqual(simulateShot(layout, stroke, { record: false, recordPaths: true }));
  expect(e.gaps[0]).toBeGreaterThanOrEqual(.02); expect(e.gaps[1]).toBeLessThanOrEqual(-.008); expect(e.gaps[2]).toBeGreaterThanOrEqual(.02);
  expect(Math.min(...e.clearGaps)).toBeGreaterThanOrEqual(.01);
  expect(x.blocked.firstContact).toBe(10); expect(x.blocked.cueBanksBeforeContact).toBe(1); expect(x.blocked.potted).not.toContain(1);
  expect(e.contact.time).toBeGreaterThan(e.rebound.time); expect(e.contact.time).toBeLessThan(e.intended.second.time);
  expect(e.rebound).toEqual(e.intended.first); expect(e.blockedLegs[0]).toEqual(e.intended.legs[0]); expect(e.blockedLegs[1].at(-1)).toEqual(e.contact.position);
  expect(x.reference.cueApproachPath).toEqual(x.referenceOpen.cueApproachPath);
  for (const sim of [x.reference, x.referenceOpen, x.intended]) { expect(sim.potted).toContain(1); expect(sim.scratch).toBe(false); expect(sim.cueBanksBeforeContact).toBe(2); expect(sim.objectCushions).toBe(0); }
}, 60000);
it('rejects absent obstacles, wrong contact order and unverified continuations', () => {
  const p = prepareRound(generateScenario(58, 0), { regenerate: false }), x = p.kickMiddle!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  for (const invalid of [
    { ...x, blocked: { ...x.blocked, firstContact: 1 } }, { ...x, blocked: { ...x.blocked, cueBanksBeforeContact: 2 } },
    { ...x, blocked: { ...x.blocked, firstImpact: undefined } }, { ...x, intended: { ...x.intended, potted: [] } },
    { ...x, referenceOpen: { ...x.referenceOpen, cueApproachPath: [] } }, { ...x, blockedPlan: { ...x.blockedPlan, pocketId: -1 } },
  ]) expect(kickMiddleEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(kickMiddleEvidence(withoutMiddleBlocker(p.scenario), plan, x)).toBeNull();
}, 60000);
