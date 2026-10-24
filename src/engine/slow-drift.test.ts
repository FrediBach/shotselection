import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { slowDriftReplay } from './slow-drift';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { distance } from './math';

it.each([0, 1, 5, 8, 92 * 919])('identifies a measured slow cue tail, seed %i', seed => {
  const source = generateScenario(92, seed), saved = structuredClone(source);
  const prepared = prepareRound(source, { regenerate: false });
  expect(prepared.scenario).toEqual(source);
  for (const ball of prepared.balls) for (const option of ball.options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, before = structuredClone(sim);
    const data = slowDriftReplay(source, sim)!;
    expect(data).not.toBeNull();
    expect(data.intervals.length).toBeGreaterThanOrEqual(3);
    expect(data.elapsed).toBe(data.finish.time - data.start.time);
    expect(data.elapsed).toBeGreaterThan(.08);
    const impacts = [...sim.contactEvents!.filter(e => e.ballIds.includes(0)), ...sim.cueRebounds!];
    expect(data.start.time).toBeGreaterThan(Math.max(...impacts.map(e => e.time)));
    for (const interval of data.intervals) {
      expect(interval.speed).toBeGreaterThan(.005); expect(interval.speed).toBeLessThanOrEqual(.35);
      expect(interval.speed).toBe(distance(interval.start.ball!.position, interval.end.ball!.position) / (interval.end.time - interval.start.time));
      expect(sim.frames.find(f => f.time === interval.end.time)!.balls.find(b => b.id === 0)).toEqual(interval.end.ball);
    }
    expect(data.points).toEqual([data.start.ball!.position, ...data.intervals.map(i => i.end.ball!.position)]);
    expect(Math.abs(data.sideways)).toBeCloseTo(distance(data.points.at(-1)!, data.reference), 10);
    expect(Math.abs(data.sideways)).toBeGreaterThan(.00001);
    expect(data.nap).toEqual(source.conditions!.nap);
    expect(sim).toEqual(before);
    const { nominal: recorded, ...score } = analysis;
    const { nominal: normal, ...normalScore } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(score).toEqual(normalScore); expect(sim.frames).toEqual(normal.frames); expect(sim.finalBalls).toEqual(normal.finalBalls);
    expect(slowDriftReplay(source, { ...sim, frames: [] })).toBeNull();
    expect(slowDriftReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(slowDriftReplay(source, { ...sim, scratch: true })).toBeNull();
    expect(slowDriftReplay({ ...source, conditions: undefined }, sim)).toBeNull();
  }
  expect(source).toEqual(saved);
}, 30000);
