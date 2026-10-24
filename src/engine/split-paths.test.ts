import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { splitPathsReplay } from './split-paths';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';
import { POCKET_GEOMETRY } from './table-geometry';
import { distance } from './math';
it.each([0, 1, 5, 8, 82 * 919])('traces both real outgoing split paths, seed %i', seed => {
  const source = generateScenario(82, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, saved = structuredClone(sim), replay = splitPathsReplay(source, sim)!;
    expect(replay).not.toBeNull(); expect(replay.transfer.ballIds).toEqual([1, 2]);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true);
    const pockets: number[] = [];
    for (const path of replay.paths) {
      expect(path.potted).toBe(true);
      const start = replay.transfer.balls!.find(b => b.id === path.ballId)!.position;
      const expected = [{ ...start }];
      for (const frame of sim.frames.filter(f => f.time > replay.transfer.time)) {
        const ball = frame.balls.find(b => b.id === path.ballId)!;
        if (JSON.stringify(expected.at(-1)) !== JSON.stringify(ball.position)) expected.push(ball.position);
        if (ball.pocketed) break;
      }
      expect(path.points).toEqual(expected);
      expect(path.points.at(-1)).toEqual(sim.finalBalls.find(b => b.id === path.ballId)!.position);
      const pocket = POCKET_GEOMETRY.find(pocket => distance(path.points.at(-1)!, pocket.center) < pocket.radius)!;
      expect(pocket).toBeDefined(); pockets.push(pocket.id);
    }
    expect(new Set(pockets).size).toBe(2);
    expect(sim).toEqual(saved);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(scored).toEqual(ordinary);
    expect(sim.frames).toEqual(ordinarySim.frames); expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(splitPathsReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(splitPathsReplay(source, { ...sim, frames: [] })).toBeNull();
    expect(splitPathsReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => e.ballIds.includes(0)) })).toBeNull();
    expect(splitPathsReplay(source, { ...sim, frames: sim.frames.map(f => ({ ...f, balls: f.balls.filter(b => b.id !== 1) })) })).toBeNull();
  }
  expect(source).toEqual(before);
}, 30000);
