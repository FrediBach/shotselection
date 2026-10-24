import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantIntroductionEvidence } from './plant-introduction';
it.each([0, 1, 5, 8, 61 * 919])('records the cue to 1 to 2 transfer, seed %i', seed => {
  const source = generateScenario(61, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantIntroduction!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantIntroductionEvidence(source, plan, x.simulation)!;
  expect(e).not.toBeNull(); expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true }));
  expect(e.first.ballIds).toEqual([0, 1]); expect(e.transfer.ballIds).toEqual([1, 2]); expect(e.first.time).toBeLessThan(e.transfer.time);
  expect(e.first.positions[0]).toEqual(x.simulation.firstImpact!.position); expect(e.transfer.pottedBefore).not.toContain(2);
  expect(x.simulation.potted).toContain(2); expect(x.simulation.scratch).toBe(false);
  const plain = simulateShot(source, plan, { record: false, recordPaths: true });
  expect(plain.contactEvents).toBeUndefined(); expect(plain.cueContacts).toBeUndefined();
  for (const key of ['finalBalls', 'potted', 'scratch', 'firstImpact', 'ballContacts', 'objectPath', 'cueApproachPath'] as const) expect(x.simulation[key]).toEqual(plain[key]);
}, 60000);
it('rejects reversed, simultaneous or unrelated contacts and an unproven target pot', () => {
  const p = prepareRound(generateScenario(61, 0), { regenerate: false }), x = p.plantIntroduction!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, s = x.simulation;
  const [a, b] = s.contactEvents!, original = structuredClone(s);
  for (const invalid of [
    { ...s, contactEvents: [] }, { ...s, contactEvents: [b, a] }, { ...s, contactEvents: [a, { ...b, time: a.time }] },
    { ...s, contactEvents: [a, { ...b, ballIds: [0, 2] as [number, number] }] },
    { ...s, contactEvents: [a, { ...b, pottedBefore: [2] }] },
    { ...s, potted: [1] }, { ...s, objectCushions: 1 }, { ...s, objectPath: [] }, { ...s, scratch: true },
  ]) expect(plantIntroductionEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(plantIntroductionEvidence(p.scenario, { ...plan, potBallId: 1 }, s)).toBeNull(); expect(s).toEqual(original);
}, 60000);
