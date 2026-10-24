import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantDistanceEvidence, shortenedPlant, targetMouthRay } from './plant-distance';
import { plantLineGeometry } from './plant-line';
import { distance, subtract } from './math';
import { createSandboxScenario, prepareSandboxRound } from './sandbox';
it.each([0, 1, 5, 8, 65 * 919])('isolates longer target travel under the same angular error, seed %i', seed => {
  const source = generateScenario(65, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantDistance!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantDistanceEvidence(source, plan, x)!;
  expect(e).not.toBeNull(); expect(e.short).toEqual(shortenedPlant(source)!.scenario);
  for (const id of [0, 1, 2]) expect(distance(subtract(e.short.balls[id].position, source.balls[id].position), e.shift)).toBeLessThan(1e-9);
  expect(e.short.balls[3]).toEqual(source.balls[3]);
  for (const [a, b] of [[0, 1], [1, 2]]) expect(distance(e.short.balls[a].position, e.short.balls[b].position)).toBeCloseTo(distance(source.balls[a].position, source.balls[b].position), 12);
  expect(distance(plantLineGeometry(e.short)!.hit, e.geometry.hit)).toBeLessThan(1e-9);
  const changed = { ...plan, angle: plan.angle + x.degrees * Math.PI / 180 };
  for (const [layout, stroke, sim] of [[e.short, plan, x.shortNominal], [source, plan, x.longNominal], [e.short, changed, x.shortChanged], [source, changed, x.longChanged]] as const) {
    expect(sim).toEqual(simulateShot(layout, stroke, { record: false, recordPaths: true, recordContacts: true }));
    expect(sim.ballContacts!.slice(0, 2)).toEqual([[0, 1], [1, 2]]);
    expect(sim.contactEvents!.slice(2).every(event => event.ballIds.every(id => id !== 1 && id !== 2))).toBe(true);
  }
  expect(e.longDrift).toBeGreaterThan(e.shortDrift * 1.5); expect(e.longDrift).toBeGreaterThan(.015);
  expect(e.longNominal.travel).toBeGreaterThan(e.shortNominal.travel * 1.5);
  expect(distance(e.shortChanged.direction, e.longChanged.direction)).toBeLessThan(1e-7);
  expect(x.longChanged.objectCushions).toBeGreaterThan(0);
  expect(x.longChanged.objectPath.some(point => distance(point, e.geometry.pocket.mouthCenter) < .12)).toBe(true);
  expect(x.shortChanged.potted).toContain(2); expect(x.longChanged.potted).not.toContain(2);
  expect(plantDistanceEvidence(source, plan, { ...x, shortChanged: { ...x.shortChanged, scratch: true, cueEnd: { x: 0, y: 0 } } })).not.toBeNull();
}, 60000);
it('rejects unmatched directions, missing transfer evidence and unproven outcomes', () => {
  const p = prepareRound(generateScenario(65, 0), { regenerate: false }), x = p.plantDistance!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const original = structuredClone(x);
  for (const invalid of [
    { ...x, degrees: 0 }, { ...x, longChanged: { ...x.longChanged, objectCushions: undefined } }, { ...x, longChanged: { ...x.longChanged, objectCushions: 0 } }, { ...x, shortNominal: { ...x.shortNominal, potted: [] } },
    { ...x, shortChanged: { ...x.shortChanged, potted: [] } }, { ...x, longChanged: { ...x.longChanged, potted: [2] } },
    { ...x, longChanged: { ...x.longChanged, contactEvents: [] } },
    { ...x, longChanged: { ...x.longChanged, objectPath: x.longNominal.objectPath } },
  ]) expect(plantDistanceEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(targetMouthRay(p.scenario, { ...x.longNominal, objectPath: [] })).toBeNull(); expect(x).toEqual(original);
}, 60000);
it('prepares a proven randomized sandbox variation', () => {
  const source = createSandboxScenario(65, 12345), original = structuredClone(source), p = prepareSandboxRound({ scenario: source, placement: 'random' });
  expect(source).toEqual(original); expect(p.scenario.balls).not.toEqual(source.balls);
  const x = p.plantDistance!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  expect(plantDistanceEvidence(p.scenario, plan, x)).not.toBeNull();
}, 60000);
