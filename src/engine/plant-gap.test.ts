import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantGapEvidence } from './plant-gap';
import { TABLE } from './constants';
import { distance } from './math';
import { createSandboxScenario, prepareSandboxRound } from './sandbox';
it.each([0, 1, 5, 8, 67 * 919])('records first-object travel through the gap, seed %i', seed => {
  const source = generateScenario(67, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantGap!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantGapEvidence(source, plan, x.simulation)!;
  expect(e).not.toBeNull(); expect(e.spacing).toBeCloseTo(.13, 12); expect(e.gap).toBeCloseTo(.13 - TABLE.ballDiameter, 12);
  expect(e.path.length).toBeGreaterThan(4); expect(e.travel).toBeGreaterThan(.06); expect(e.duration).toBeGreaterThan(0);
  expect(e.path[0]).toEqual(e.first.positions[1]); expect(e.path.at(-1)).toEqual(e.transfer.positions[0]);
  expect(distance(e.transfer.positions[0], e.transfer.positions[1])).toBeCloseTo(TABLE.ballDiameter, 2);
  const { plantTransferPath: _trace, ...recorded } = x.simulation;
  const ordinary = simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true });
  expect(recorded).toEqual(ordinary); expect(ordinary.plantTransferPath).toBeUndefined();
  expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true, recordPlantTransfer: true }));
  // Per-step recording preserves the trace even without the other diagnostics.
  expect(simulateShot(source, plan, { record: false, recordPlantTransfer: true }).plantTransferPath).toEqual(e.path);
  const pots = p.balls[0].options.map(o => simulateShot(source, o.plan, { record: false }).potted.includes(2));
  expect(pots.filter(Boolean)).toHaveLength(1); // Keep the two nominally failing offers.
}, 60000);
it('rejects invented endpoint lines, missing transfer, changed target and unproven pot', () => {
  const p = prepareRound(generateScenario(67, 0), { regenerate: false }), x = p.plantGap!, s = x.simulation, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const original = structuredClone(s), [first, transfer] = s.contactEvents!;
  for (const invalid of [
    { ...s, plantTransferPath: undefined }, { ...s, plantTransferPath: [s.plantTransferPath![0], s.plantTransferPath!.at(-1)!] },
    { ...s, plantTransferPath: [...s.plantTransferPath!, { x: 0, y: 0 }] }, { ...s, potted: [] },
    { ...s, contactEvents: [first, { ...transfer, time: first.time }] },
    { ...s, contactEvents: [first, { ...transfer, incoming: [transfer.incoming[0], { x: .1, y: 0 }] as typeof transfer.incoming }] },
  ]) expect(plantGapEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(s).toEqual(original);
}, 60000);
it('retains a verified gap in sandbox variations', () => {
  const source = createSandboxScenario(67, 12345), original = structuredClone(source), p = prepareSandboxRound({ scenario: source, placement: 'random' });
  expect(source).toEqual(original); expect(p.scenario.balls).not.toEqual(source.balls);
  const x = p.plantGap!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  expect(plantGapEvidence(p.scenario, plan, x.simulation)).not.toBeNull();
}, 60000);
