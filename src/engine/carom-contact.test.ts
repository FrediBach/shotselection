import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { caromContactReplay } from './carom-contact';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';
import { distance } from './math';
it.each([0, 1, 5, 8, 84 * 919])('follows the cue through both carom contacts, seed %i', seed => {
  const source = generateScenario(84, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, saved = structuredClone(sim), replay = caromContactReplay(source, sim)!;
    expect(replay).not.toBeNull(); expect(replay.first.ballIds).toEqual([0, 1]); expect(replay.second.ballIds).toEqual([0, 2]);
    expect(replay.second.time).toBeGreaterThan(replay.first.time);
    expect(replay.points[0]).toEqual(replay.first.positions[0]); expect(replay.points.at(-1)).toEqual(replay.second.positions[0]);
    const expected = [replay.first.positions[0]];
    for (const frame of sim.frames.filter(f => f.time > replay.first.time && f.time < replay.second.time)) {
      const cue = frame.balls.find(b => b.id === 0)!;
      if (distance(cue.position, expected.at(-1)!) > 0) expected.push(cue.position);
    }
    if (distance(replay.second.positions[0], expected.at(-1)!) > 0) expected.push(replay.second.positions[0]);
    expect(replay.points).toEqual(expected);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true); expect(sim.potted).toContain(2);
    expect(replay.second.pottedBefore).not.toContain(2);
    const substituted = sim.ballContacts!.map(pair => pair[0] === 0 && pair[1] === 2 ? [1, 2] as [number, number] : pair);
    expect(evaluateShotObjective(source, option.plan, { ...sim, ballContacts: substituted }).success).toBe(false);
    expect(sim).toEqual(saved);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; expect(scored).toEqual(ordinary); expect(sim.frames).toEqual(ordinarySim.frames); expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(caromContactReplay(source, { ...sim, frames: [] })).toBeNull();
    expect(caromContactReplay(source, { ...sim, contactEvents: undefined })).toBeNull();
    expect(caromContactReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => !e.ballIds.includes(2)) })).toBeNull();
    expect(caromContactReplay(source, { ...sim, contactEvents: [...sim.contactEvents!].reverse() })).toBeNull();
    expect(caromContactReplay({ ...source, trick: { ...source.trick!, requiredContacts: [[0, 1], [1, 2]] } }, sim)).toBeNull();
  }
  expect(source).toEqual(before);
}, 30000);
