import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { followContactReplay } from './follow-contact';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';
it.each([0, 1, 5, 8, 85 * 919])('separates the first impact and follow catch-up, seed %i', seed => {
  const source = generateScenario(85, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, saved = structuredClone(sim), replay = followContactReplay(source, sim)!;
    expect(replay).not.toBeNull(); expect(option.plan.topSpin).toBeGreaterThan(0);
    expect(replay.first.ballIds).toEqual([0, 1]); expect(replay.transfer.ballIds).toEqual([1, 2]); expect(replay.repeat.ballIds).toEqual([0, 1]);
    expect(replay.repeat).not.toBe(replay.first); expect(replay.repeat.time).toBeGreaterThan(replay.transfer.time);
    expect(replay.transfer.time).toBeGreaterThan(replay.first.time);
    expect(replay.elapsed).toBe(replay.repeat.time-replay.first.time);
    expect(replay.repeat.positions).not.toEqual(replay.first.positions);
    expect(replay.closingSpeed).toBeGreaterThan(0);
    const [cue, object] = replay.repeat.positions, [v, w] = replay.repeat.incoming;
    expect(replay.closingSpeed).toBeCloseTo(((v.x-w.x)*(object.x-cue.x)+(v.y-w.y)*(object.y-cue.y))/Math.hypot(object.x-cue.x,object.y-cue.y), 12);
    expect(replay.repeat.pottedBefore).not.toContain(1);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true); expect(sim.potted).toEqual(expect.arrayContaining([1, 2]));
    expect(evaluateShotObjective(source, option.plan, { ...sim, ballContacts: [[0,1],[1,2]] }).success).toBe(false);
    expect(sim).toEqual(saved);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(scored).toEqual(ordinary); expect(sim.frames).toEqual(ordinarySim.frames); expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(followContactReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(followContactReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => e !== replay.repeat) })).toBeNull();
    expect(followContactReplay(source, { ...sim, contactEvents: [replay.first, replay.repeat, replay.transfer] })).toBeNull();
    expect(followContactReplay(source, { ...sim, contactEvents: [replay.first, replay.transfer, { ...replay.repeat, time: replay.first.time }] })).toBeNull();
    expect(followContactReplay({ ...source, trick: undefined }, sim)).toBeNull();
  }
  expect(source).toEqual(before);
}, 30000);
