import { expect, it } from 'vitest';
import { compareDirtyContact } from './dirty-contact';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { clothFrictionAt } from './table-conditions';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';

it.each([0, 1, 5, 8, 96 * 919])('isolates dirt contact response at matched arrival, seed %i', seed => {
  const source = generateScenario(96, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let changedDirection = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis);
    const data = compareDirtyContact(source, option.plan, analysis.nominal)!;
    expect(data).not.toBeNull();
    const [dirty, clean] = data.variants;
    expect(dirty.simulation).toBe(analysis.nominal);
    expect(clean.scenario.conditions).toEqual({ ...source.conditions, dirt: 0, cloth: 1 + .15 * source.conditions!.dirt! });
    for (const b of source.balls) expect(clothFrictionAt(b.position, clean.scenario.conditions)).toBe(clothFrictionAt(b.position, source.conditions));
    expect(clean.simulation).toEqual(simulateShot(clean.scenario, option.plan, { recordContacts: true }));
    expect(dirty.contact.positions).toEqual(clean.contact.positions);
    expect(dirty.contact.incoming).toEqual(clean.contact.incoming);
    expect(dirty.contact.time).toBe(clean.contact.time);
    for (const v of data.variants) {
      expect(v.outgoing).toEqual(v.contact.outgoing![v.contact.ballIds.indexOf(ball.ballId)]);
      expect(v.speed).toBe(Math.hypot(v.outgoing.x, v.outgoing.y));
      expect(v.direction).toBe(Math.atan2(v.outgoing.y, v.outgoing.x));
    }
    expect(data.speedDifference).toBe(clean.speed - dirty.speed);
    expect(data.speedDifference).toBeGreaterThan(0);
    expect(data.angleDifference).toBeCloseTo(Math.acos(Math.max(-1, Math.min(1, (dirty.outgoing.x * clean.outgoing.x + dirty.outgoing.y * clean.outgoing.y) / (dirty.speed * clean.speed)))) * 180 / Math.PI, 6);
    if (data.angleDifference > .05) changedDirection++;
    const { nominal: recorded, ...score } = analysis;
    const { nominal: ordinary, ...ordinaryScore } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(score).toEqual(ordinaryScore); expect(analysis.nominal.frames).toEqual(ordinary.frames); expect(analysis.nominal.finalBalls).toEqual(ordinary.finalBalls);
    expect(compareDirtyContact(source, option.plan, { ...analysis.nominal, contactEvents: undefined })).toBeNull();
    expect(compareDirtyContact({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
    expect(compareDirtyContact(source, option.plan, { ...analysis.nominal, contactEvents: analysis.nominal.contactEvents!.map(e => ({ ...e, time: e.time + 1 })) })).toBeNull();
    expect(analysis).toEqual(before);
  }
  expect(changedDirection).toBeGreaterThan(0);
  expect(source).toEqual(saved);
}, 30000);
