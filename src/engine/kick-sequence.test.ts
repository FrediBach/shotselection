import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickSequenceEvidence } from './kick-sequence';
it.each([0, 1, 5, 8, 57 * 919])('preserves and splits two real rebounds in order, seed %i', seed => {
  const source = generateScenario(57, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), x = p.kickSequence!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(source.balls).toHaveLength(10); expect(p.balls[0].options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true }));
  for (const option of p.balls[0].options) {
    const s = simulateShot(source, option.plan, { record: false, recordPaths: true }), before = structuredClone(s);
    const e = kickSequenceEvidence(source, s)!;
    expect(e).not.toBeNull(); expect(s).toEqual(before);
    expect(e.first.time).toBeLessThan(e.second.time); expect(e.second.time).toBeLessThan(e.contact.time);
    expect(e.legs[0][0]).toEqual(source.balls[0].position);
    expect(e.legs[0].at(-1)).toEqual(e.first.position); expect(e.legs[1][0]).toEqual(e.first.position);
    expect(e.legs[1].at(-1)).toEqual(e.second.position); expect(e.legs[2][0]).toEqual(e.second.position);
    expect(e.legs[2].at(-1)).toEqual(e.contact.position);
    expect([...e.legs[0], ...e.legs[1].slice(1), ...e.legs[2].slice(1, -1)]).toEqual(s.cueApproachPath);
    expect([e.firstLabel, e.secondLabel].join(' → ')).toBe(e.order);
    expect(new Set([e.firstLabel, e.secondLabel])).toEqual(new Set(['A', 'B']));
  }
}, 30000);
it('rejects absent, reversed, late or extra rebounds and invalid outcomes', () => {
  const p = prepareRound(generateScenario(57, 0), { regenerate: false }), s = p.kickSequence!.simulation;
  const [a, b] = s.cueRebounds!.filter(r => r.beforeContact);
  for (const invalid of [
    { ...s, cueRebounds: [] }, { ...s, cueRebounds: [a] },
    { ...s, cueRebounds: [b, a] }, { ...s, cueRebounds: [a, b, b], cueBanksBeforeContact: 3 },
    { ...s, cueRebounds: [a, { ...b, time: s.firstImpact!.time }] },
    { ...s, cueApproachPath: [] }, { ...s, cueBanksBeforeContact: 1 },
    { ...s, scratch: true }, { ...s, potted: [] }, { ...s, firstContact: 2 },
  ]) expect(kickSequenceEvidence(p.scenario, invalid)).toBeNull();
  expect(kickSequenceEvidence({ ...p.scenario, bank: { ballId: 1, minCushions: 1 } }, s)).toBeNull();
}, 30000);
