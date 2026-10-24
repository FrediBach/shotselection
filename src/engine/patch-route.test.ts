import { expect, it } from 'vitest';
import { clipPatchPath, patchRouteReplay } from './patch-route';
import { analyzeShot } from './analysis';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';

it('clips crossings even when both samples are outside, and excludes tangencies and stationary points', () => {
  const center = { x: 0, y: 0 };
  expect(clipPatchPath([{ x: -2, y: 0 }, { x: 2, y: 0 }], center, 1)).toEqual([[{ x: -1, y: 0 }, { x: 1, y: 0 }]]);
  expect(clipPatchPath([{ x: 0, y: 0 }, { x: 2, y: 0 }], center, 1)).toEqual([[center, { x: 1, y: 0 }]]);
  expect(clipPatchPath([{ x: -2, y: 1 }, { x: 2, y: 1 }], center, 1)).toEqual([]);
  expect(clipPatchPath([center, center], center, 1)).toEqual([]);
  expect(clipPatchPath([{ x: -2, y: 2 }, { x: 2, y: 2 }], center, 1)).toEqual([]);
  expect(clipPatchPath([{ x: -.5, y: 0 }, { x: .5, y: 0 }], center, 1)).toEqual([[{ x: -.5, y: 0 }, { x: .5, y: 0 }]]);
  expect(clipPatchPath([center, { x: 2, y: 0 }], center, 0)).toEqual([]);
});
it.each([0, 1, 5, 8, 93 * 919])('identifies cue and object patch crossings, seed %i', seed => {
  const source = generateScenario(93, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  let crossings = 0, clear = 0;
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, before = structuredClone(sim);
    const data = patchRouteReplay(source, option.plan, sim)!;
    expect(data).not.toBeNull(); expect(data.routes).toHaveLength(3);
    expect(data.routes[0].path.at(-1)).toEqual(data.routes[1].path[0]);
    expect(data.routes[1].path[0]).toEqual(data.contact.balls!.find(b => b.id === 0)!.position);
    expect(data.routes[2].path[0]).toEqual(data.contact.balls!.find(b => b.id === ball.ballId)!.position);
    expect(data.routes[1].path.at(-1)).toEqual(sim.finalBalls.find(b => b.id === 0)!.position);
    const capture = sim.frames.find(f => f.balls.find(b => b.id === ball.ballId)!.pocketed)!;
    expect(data.routes[2].path.at(-1)).toEqual(capture.balls.find(b => b.id === ball.ballId)!.position);
    for (const route of data.routes) for (const crossing of route.crossings) {
      const patch = data.patches.find(p => p.id === crossing.patchId)!;
      expect(crossing.segments).toEqual(clipPatchPath(route.path, patch.center, patch.radius));
      expect(crossing.length).toBe(crossing.segments.reduce((sum, [a, b]) => sum + distance(a, b), 0));
      for (const [a, b] of crossing.segments) {
        expect(distance(a, patch.center)).toBeLessThanOrEqual(patch.radius + 1e-9);
        expect(distance(b, patch.center)).toBeLessThanOrEqual(patch.radius + 1e-9);
        expect(distance(a, b)).toBeGreaterThan(0);
      }
      if (crossing.length > 0) crossings++; else clear++;
    }
    const { nominal: recorded, ...score } = analysis;
    const { nominal: normal, ...normalScore } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(score).toEqual(normalScore); expect(sim.frames).toEqual(normal.frames); expect(sim.finalBalls).toEqual(normal.finalBalls);
    expect(patchRouteReplay(source, option.plan, { ...sim, frames: [] })).toBeNull();
    expect(patchRouteReplay(source, option.plan, { ...sim, contactEvents: undefined })).toBeNull();
    expect(patchRouteReplay({ ...source, conditions: undefined }, option.plan, sim)).toBeNull();
    expect(sim).toEqual(before);
  }
  expect(crossings).toBeGreaterThan(0); expect(clear).toBeGreaterThan(0);
  expect(source).toEqual(saved);
}, 30000);
