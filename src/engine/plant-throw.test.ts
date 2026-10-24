import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantThrowEvidence } from './plant-throw';
import { distance, dot, subtract } from './math';
import { createSandboxScenario, prepareSandboxRound } from './sandbox';
it.each([0, 1, 5, 8, 66 * 919])('isolates throw from delivery at an oblique plant transfer, seed %i', seed => {
  const source = generateScenario(66, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantThrow!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantThrowEvidence(source, plan, x)!;
  expect(e).not.toBeNull(); expect(distance(e.geometry.hit, e.geometry.pocket.mouthCenter)).toBeLessThan(1e-9);
  expect(x.actual).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true }));
  expect(x.frictionless).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true, disablePlantTransferFriction: true }));
  expect(e.oblique).toBeGreaterThan(5); expect(e.throwAngle).toBeGreaterThan(.25); expect(e.controlAngle).toBeLessThan(.01);
  expect(e.deliveryAngle).toBeGreaterThan(.1); expect(e.mouthShift).toBeGreaterThan(.002);
  // Tangential target velocity is present with friction and absent in the control.
  const tangent = { x: -e.normal.y, y: e.normal.x };
  expect(Math.abs(dot(e.transfer.outgoing![1], tangent))).toBeGreaterThan(.001);
  expect(Math.abs(dot(x.frictionless.contactEvents![1].outgoing![1], tangent))).toBeLessThan(1e-8);
  expect(x.actual.potted).toContain(2); expect(x.frictionless.potted).toContain(2);
  const { contactEvents: _events, cueContacts: _cue, cuePath: _path, ...recorded } = x.actual;
  const { cuePath: _plainPath, ...plain } = simulateShot(source, plan, { record: false, recordPaths: true });
  expect(recorded).toEqual(plain);
  expect(simulateShot(source, plan, { record: false }).contactEvents).toBeUndefined();
  // A zero tangent impulse removes direction change, without changing the normal impulse.
  expect(dot(e.transfer.outgoing![1], e.normal)).toBeCloseTo(dot(x.frictionless.contactEvents![1].outgoing![1], e.normal), 6);
  expect(subtract(x.actual.contactEvents![1].positions[1], x.frictionless.contactEvents![1].positions[1])).toEqual({ x: 0, y: 0 });
}, 60000);
it('rejects lost alignment, changed delivery, absent throw and missing solver evidence', () => {
  const p = prepareRound(generateScenario(66, 0), { regenerate: false }), x = p.plantThrow!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const original = structuredClone(x), [first, transfer] = x.frictionless.contactEvents!;
  for (const invalid of [
    { ...x, actual: x.frictionless }, { ...x, frictionless: x.actual },
    { ...x, actual: { ...x.actual, potted: [] } },
    { ...x, frictionless: { ...x.frictionless, contactEvents: [first, { ...transfer, outgoing: undefined }] } },
    { ...x, frictionless: { ...x.frictionless, contactEvents: [first, { ...transfer, time: transfer.time + .01 }] } },
    { ...x, frictionless: { ...x.frictionless, contactEvents: [first, { ...transfer, incoming: [{ x: 0, y: 0 }, transfer.incoming[1]] as typeof transfer.incoming }] } },
  ]) expect(plantThrowEvidence(p.scenario, plan, invalid)).toBeNull();
  const moved = { ...p.scenario, balls: p.scenario.balls.map(b => b.id === 1 ? { ...b, position: { ...b.position, x: b.position.x + .01 } } : b) };
  expect(plantThrowEvidence(moved, plan, x)).toBeNull(); expect(x).toEqual(original);
}, 60000);
it('preserves alignment while varying sandbox delivery', () => {
  const source = createSandboxScenario(66, 12345), original = structuredClone(source), p = prepareSandboxRound({ scenario: source, placement: 'random' });
  expect(source).toEqual(original); expect(p.scenario.balls[0]).not.toEqual(source.balls[0]);
  expect(p.scenario.balls.slice(1)).toEqual(source.balls.slice(1));
  const x = p.plantThrow!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  expect(plantThrowEvidence(p.scenario, plan, x)).not.toBeNull();
}, 60000);
