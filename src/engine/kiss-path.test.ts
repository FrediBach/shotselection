import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { kissPathReplay } from './kiss-path';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance } from './math';
it.each([0, 1, 5, 8, 83 * 919])('shows ball 1 turning at the actual kiss, seed %i', seed => {
  const source = generateScenario(83, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, saved = structuredClone(sim), replay = kissPathReplay(source, sim)!;
    expect(replay).not.toBeNull(); expect(replay.contact.ballIds).toEqual([1, 2]);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true); expect(replay.potted).toBe(true);
    expect(replay.incoming[0]).toEqual(source.balls.find(b => b.id === 1)!.position);
    expect(replay.incoming.at(-1)).toEqual(replay.contact.positions[0]);
    expect(replay.outgoing[0]).toEqual(replay.incoming.at(-1));
    const expectedIncoming = [source.balls.find(b => b.id === 1)!.position];
    for (const frame of sim.frames.filter(f => f.time < replay.contact.time)) {
      const position = frame.balls.find(b => b.id === 1)!.position;
      if (distance(position, expectedIncoming.at(-1)!) > 0) expectedIncoming.push(position);
    }
    if (distance(replay.contact.positions[0], expectedIncoming.at(-1)!) > 0) expectedIncoming.push(replay.contact.positions[0]);
    expect(replay.incoming).toEqual(expectedIncoming);
    const expectedOutgoing = [replay.contact.positions[0]];
    for (const frame of sim.frames.filter(f => f.time > replay.contact.time)) {
      const ball = frame.balls.find(b => b.id === 1)!;
      if (distance(ball.position, expectedOutgoing.at(-1)!) > 0) expectedOutgoing.push(ball.position);
      if (ball.pocketed) break;
    }
    expect(replay.outgoing).toEqual(expectedOutgoing);
    expect(replay.outgoing.at(-1)).toEqual(sim.finalBalls.find(b => b.id === 1)!.position);
    const pocket = POCKET_GEOMETRY[source.trick!.pocketId];
    expect(distance(replay.outgoing.at(-1)!, pocket.center)).toBeLessThan(pocket.radius);
    const incoming = replay.contact.incoming[0], outgoing = replay.contact.outgoing![0];
    expect(Math.abs(Math.atan2(incoming.x*outgoing.y-incoming.y*outgoing.x, incoming.x*outgoing.x+incoming.y*outgoing.y))).toBeGreaterThan(.1);
    expect(sim).toEqual(saved);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(scored).toEqual(ordinary); expect(sim.frames).toEqual(ordinarySim.frames);
    expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(kissPathReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(kissPathReplay(source, { ...sim, frames: [] })).toBeNull();
    expect(kissPathReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => e.ballIds.includes(0)) })).toBeNull();
    expect(kissPathReplay({ ...source, balls: source.balls.filter(b => b.id !== 1) }, sim)).toBeNull();
  }
  expect(source).toEqual(before);
}, 30000);
