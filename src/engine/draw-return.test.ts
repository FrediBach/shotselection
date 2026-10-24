import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { drawReturnReplay } from './draw-return';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';
it.each([0, 1, 5, 8, 86 * 919])('locates the sampled draw turn and measures return speed, seed %i', seed => {
  const source = generateScenario(86, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, saved = structuredClone(sim), data = drawReturnReplay(source, sim)!;
    expect(data).not.toBeNull(); expect(option.plan.topSpin).toBeLessThan(0);
    expect(data.first.ballIds).toEqual([0,1]); expect(data.second.ballIds).toEqual([0,2]);
    expect(data.samples[0].position).toEqual(data.first.positions[0]); expect(data.samples.at(-1)!.position).toEqual(data.second.positions[0]);
    expect(data.samples.slice(1,-1).map(s => ({ time: s.time, balls: s.balls }))).toEqual(sim.frames.filter(f => f.time > data.first.time && f.time < data.second.time));
    expect(data.turn.progress).toBe(Math.max(...data.samples.map(s => s.progress)));
    expect(data.turn.progress-data.samples.at(-1)!.progress).toBeGreaterThan(.05);
    expect(data.turnIndex).toBeLessThan(data.samples.length-1);
    expect(data.turn.position).toEqual(data.turn.balls.find(b => b.id === 0)!.position);
    expect(data.bracket[0]).toBeLessThanOrEqual(data.turn.time); expect(data.bracket[1]).toBeGreaterThan(data.turn.time);
    expect(data.returnSpeed).toBe(Math.hypot(data.second.incoming[0].x,data.second.incoming[0].y)); expect(data.returnSpeed).toBeGreaterThan(0);
    const a=data.first.incoming[0], b=data.second.incoming[0]; expect(a.x*b.x+a.y*b.y).toBeLessThan(0);
    expect(sim.cueRebounds!.filter(e => e.time > data.first.time && e.time < data.second.time)).toHaveLength(0);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true); expect(sim.potted).toEqual(expect.arrayContaining([1,2]));
    expect(sim).toEqual(saved);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(scored).toEqual(ordinary); expect(sim.frames).toEqual(ordinarySim.frames); expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(drawReturnReplay(source, { ...sim, frames: [] })).toBeNull();
    expect(drawReturnReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(drawReturnReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => !e.ballIds.includes(2)) })).toBeNull();
    expect(drawReturnReplay({ ...source, trick: undefined }, sim)).toBeNull();
    expect(drawReturnReplay(source, { ...sim, contactEvents: [data.first, { ...data.second, incoming: [{ x:0,y:0 }, data.second.incoming[1]] }] })).toBeNull();
  }
  expect(source).toEqual(before);
}, 30000);
