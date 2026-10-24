import { expect, it } from 'vitest';
import { compareHealthyRail } from './healthy-rail';
import { analyzeShot } from './analysis';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';
import { TABLE } from './constants';

it.each([0, 1, 5, 8, 94 * 919])('compares the same rebound with a restored rail, seed %i', seed => {
  const source = generateScenario(94, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let matched = 0, clear = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), before = structuredClone(analysis), plan = structuredClone(option.plan);
    const data = compareHealthyRail(source, option.plan, analysis.nominal)!;
    expect(data).not.toBeNull();
    expect(data.variants[0].simulation).toBe(analysis.nominal);
    expect(data.variants[1].scenario).toEqual({ ...source, conditions: { ...source.conditions!, cushions: [{ ...source.conditions!.cushions![0], restitution: TABLE.cushionRestitution }] } });
    expect(data.variants[1].simulation).toEqual(simulateShot({ ...source, conditions: undefined }, option.plan));
    expect(data.finishShift).toBe(distance(analysis.nominal.cueEnd, data.variants[1].simulation.cueEnd));
    if (data.matched) {
      matched++;
      const [weak, healthy] = data.variants;
      expect(weak.event!.position).toEqual(healthy.event!.position);
      expect(weak.event!.time).toBe(healthy.event!.time);
      expect(weak.event!.incoming).toEqual(healthy.event!.incoming);
      expect(healthy.outgoingSpeed!).toBeGreaterThan(weak.outgoingSpeed!);
      expect(data.finishShift).toBeGreaterThan(.01);
      for (const variant of data.variants) {
        expect(variant.returnPath[0]).toEqual(variant.event!.position);
        expect(variant.outgoingSpeed).toBe(Math.hypot(variant.event!.outgoing.x, variant.event!.outgoing.y));
        const expected = [variant.event!.position];
        for (const frame of variant.simulation.frames.filter(f => f.time > variant.event!.time)) {
          const cue = frame.balls.find(b => b.id === 0)!; expected.push(cue.position); if (cue.pocketed) break;
        }
        expect(variant.returnPath).toEqual(expected);
        expect(variant.returnLength).toBe(expected.reduce((sum, p, i) => sum + (i ? distance(expected[i - 1], p) : 0), 0));
      }
    } else { clear++; expect(data.variants.every(v => v.event === undefined && v.returnPath.length === 0 && v.outgoingSpeed === null)).toBe(true); }
    expect(option.plan).toEqual(plan); expect(analysis).toEqual(before);
    expect(analyzeShot({ ...source, curriculum: undefined }, option.plan, 8)).toEqual(analysis);
    expect(compareHealthyRail({ ...source, conditions: undefined }, option.plan, analysis.nominal)).toBeNull();
  }
  expect(matched).toBeGreaterThan(0); expect(clear).toBeGreaterThan(0);
  expect(source).toEqual(saved);
}, 30000);
