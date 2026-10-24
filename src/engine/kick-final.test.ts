import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickFinalEvidence } from './kick-final';
it.each([0, 1, 5, 8, 60 * 919])('records three ordered rebounds and the actual incoming direction, seed %i', seed => {
  const source = generateScenario(60, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.kickFinal!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(p.balls[0].options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = kickFinalEvidence(source, plan, x.simulation)!;
  expect(e).not.toBeNull(); expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true }));
  expect(e.rebounds).toHaveLength(3); expect(e.legs).toHaveLength(4);
  expect(e.angle).toBeGreaterThanOrEqual(45); expect(e.launch).toEqual({ x: Math.cos(plan.angle), y: Math.sin(plan.angle) });
  expect(e.contact).toEqual(x.simulation.cueContacts![0]);
  for (let i = 0; i < 3; i++) {
    expect(e.legs[i].at(-1)).toEqual(e.rebounds[i].position); expect(e.legs[i + 1][0]).toEqual(e.rebounds[i].position);
    expect(e.rebounds[i].time).toBeLessThan(i < 2 ? e.rebounds[i + 1].time : e.contact.time);
  }
  expect(e.legs[3].at(-1)).toEqual(e.contact.position);
  expect(e.legs.flatMap((l, i) => i ? l.slice(1) : l)).toEqual(x.simulation.cueApproachPath);
  expect(x.simulation.potted).toContain(1); expect(x.simulation.scratch).toBe(false);
}, 60000);
it('rejects wrong, missing or reversed events and an indistinguishable launch direction', () => {
  const p = prepareRound(generateScenario(60, 0), { regenerate: false }), x = p.kickFinal!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, s = x.simulation;
  const original = structuredClone(s);
  for (const invalid of [
    { ...s, cueContacts: [] }, { ...s, cueApproachPath: [] }, { ...s, cueBanksBeforeContact: 2 },
    { ...s, cueRebounds: [...s.cueRebounds!].reverse() }, { ...s, firstContact: 2 }, { ...s, scratch: true },
    { ...s, cueContacts: [{ ...s.cueContacts![0], incoming: { x: 0, y: 0 } }] },
    { ...s, cueContacts: [{ ...s.cueContacts![0], time: 0 }] },
  ]) expect(kickFinalEvidence(p.scenario, plan, invalid)).toBeNull();
  const incoming = s.cueContacts![0].incoming;
  expect(kickFinalEvidence(p.scenario, { ...plan, angle: Math.atan2(incoming.y, incoming.x) }, s)).toBeNull();
  expect(s).toEqual(original);
}, 60000);
