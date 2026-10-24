import { createSandboxScenario, prepareSandboxRound } from './sandbox';
import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantDeliveryEvidence } from './plant-delivery';
import { TABLE } from './constants';
import { distance, dot, normalize, subtract } from './math';
it.each([0, 1, 5, 8, 64 * 919])('distinguishes angled delivery from the aligned pair, seed %i', seed => {
  const source = generateScenario(64, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantDelivery!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantDeliveryEvidence(source, plan, x.simulation)!;
  expect(e).not.toBeNull(); expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true }));
  expect(distance(e.ghost, e.geometry.first)).toBeCloseTo(TABLE.ballDiameter, 12);
  expect(dot(normalize(subtract(e.geometry.first, e.ghost)), e.geometry.direction)).toBeCloseTo(1, 12);
  expect(distance(e.geometry.hit, e.pocket.mouthCenter)).toBeLessThan(1e-9);
  expect(e.deliveryAngle).toBeGreaterThan(30); expect(e.deliveryAngle).toBeLessThan(80);
  expect(e.incoming).toEqual(normalize(e.first.incoming[0]));
  expect(distance(e.first.positions[0], e.ghost)).toBeLessThan(.005);
  expect(x.simulation.cueApproachPath.at(-1)).toEqual(e.first.positions[0]);
  expect(x.simulation.ballContacts).toEqual([[0, 1], [1, 2]]);
  expect(x.simulation.potted).toContain(2); expect(x.simulation.scratch).toBe(false);
}, 60000);
it('rejects lost approach, misalignment, an unproven pot and indistinguishable directions', () => {
  const p = prepareRound(generateScenario(64, 0), { regenerate: false }), x = p.plantDelivery!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, s = x.simulation;
  const e = plantDeliveryEvidence(p.scenario, plan, s)!, [a, b] = s.contactEvents!, original = structuredClone(s);
  for (const invalid of [
    { ...s, cueApproachPath: [] }, { ...s, cueApproachPath: [s.cueApproachPath[0], { x: 0, y: 0 }] },
    { ...s, contactEvents: [a, b, b] }, { ...s, potted: [] }, { ...s, scratch: true },
    { ...s, contactEvents: [{ ...a, incoming: [e.geometry.direction, a.incoming[1]] as typeof a.incoming }, b] },
  ]) expect(plantDeliveryEvidence(p.scenario, plan, invalid)).toBeNull();
  const moved = { ...p.scenario, balls: p.scenario.balls.map(ball => ball.id === 2 ? { ...ball, position: { ...ball.position, x: ball.position.x + .01 } } : ball) };
  expect(plantDeliveryEvidence(moved, plan, s)).toBeNull(); expect(s).toEqual(original);
}, 60000);

it('varies sandbox delivery while preserving the aligned pair and verified pot', () => {
  const source = createSandboxScenario(64, 12345), original = structuredClone(source);
  const p = prepareSandboxRound({ scenario: source, placement: 'random' });
  expect(source).toEqual(original);
  expect(p.scenario.balls.filter(b => b.id !== 0)).toEqual(source.balls.filter(b => b.id !== 0));
  expect(distance(p.scenario.balls[0].position, source.balls[0].position)).toBeGreaterThan(.01);
  const x = p.plantDelivery!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  expect(plantDeliveryEvidence(p.scenario, plan, x.simulation)).not.toBeNull();
  expect(prepareSandboxRound({ scenario: source, placement: 'random' })).toEqual(p);
}, 60000);
