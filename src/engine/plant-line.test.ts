import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { plantLineEvidence, plantLineGeometry } from './plant-line';
import { distance } from './math';
it.each([0, 1, 5, 8, 62 * 919])('shows an outside-mouth pair line and actual target miss, seed %i', seed => {
  const source = generateScenario(62, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantLine!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantLineEvidence(source, plan, x.simulation)!;
  expect(e).not.toBeNull(); expect(x.simulation).toEqual(simulateShot(source, plan, { record: false, recordPaths: true, recordContacts: true }));
  expect(e.outside).toBeGreaterThanOrEqual(.005); expect(e.outside).toBeCloseTo(distance(e.hit, e.edge), 12);
  expect(e.outside).toBeCloseTo(.013642857142857, 10);
  expect((e.hit.x - e.target.x) * e.direction.y - (e.hit.y - e.target.y) * e.direction.x).toBeCloseTo(0, 12);
  expect(e.hit.y).toBeCloseTo(e.pocket.mouthCenter.y, 12);
  expect(e.firstContact.ballIds).toEqual([0, 1]); expect(e.transfer.ballIds).toEqual([1, 2]);
  expect(e.firstContact.time).toBeLessThan(e.transfer.time); expect(x.simulation.potted).not.toContain(2);
  for (const option of p.balls[0].options) expect(simulateShot(source, option.plan, { record: false }).potted).not.toContain(2);
  for (const option of p.balls[1].options) { const s = simulateShot(source, option.plan, { record: false }); expect(s.potted).toContain(3); expect(s.scratch).toBe(false); }
}, 60000);
it('rejects aligned, backward or parallel lines and unverified physical misses', () => {
  const p = prepareRound(generateScenario(62, 0), { regenerate: false }), x = p.plantLine!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, s = x.simulation;
  const original = structuredClone(s);
  for (const invalid of [{ ...s, contactEvents: [] }, { ...s, potted: [2] }, { ...s, firstContact: 2 }, { ...s, objectCushions: 0 }, { ...s, objectPath: [] }, { ...s, scratch: true }]) expect(plantLineEvidence(p.scenario, plan, invalid)).toBeNull();
  const aligned = generateScenario(61, 0);
  expect(plantLineGeometry(aligned)!.outside).toBe(0); expect(plantLineEvidence(aligned, plan, s)).toBeNull();
  const target = p.scenario.balls.find(b => b.id === 2)!.position;
  for (const position of [{ x: target.x - .08, y: target.y }, { x: target.x, y: target.y - .08 }]) {
    const source = { ...p.scenario, balls: p.scenario.balls.map(b => b.id === 1 ? { ...b, position } : b) };
    expect(plantLineGeometry(source)).toBeNull();
  }
  expect(s).toEqual(original);
}, 60000);
