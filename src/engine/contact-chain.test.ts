import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { contactChainReplay } from './contact-chain';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';

it.each([0, 1, 5, 8, 81 * 919])('records the actual three transfers without changing the stroke, seed %i', seed => {
  const source = generateScenario(81, seed), before = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(p.scenario).toEqual(before);
  for (const option of p.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal, replay = contactChainReplay(source, sim);
    expect(replay.complete).toBe(true); expect(replay.steps.map(s => s.pair)).toEqual([[0, 1], [1, 2], [2, 3]]);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true);
    let time = -1;
    for (const { event } of replay.steps) {
      expect(event.time).toBeGreaterThanOrEqual(time); time = event.time;
      expect(event.balls!.map(b => b.id)).toEqual(source.balls.map(b => b.id));
      expect(event.pottedBefore).not.toContain(3);
      event.ballIds.forEach((id, index) => expect(event.balls!.find(b => b.id === id)!.position).toEqual(event.positions[index]));
      expect(event.balls!.every(b => !b.pocketed)).toBe(true);
    }
    const original = simulateShot(source, option.plan);
    for (const key of ['frames', 'finalBalls', 'potted', 'ballContacts', 'cueEnd', 'stopped', 'scratch', 'duration'] as const) expect(sim[key]).toEqual(original[key]);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: unrecorded, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded; void unrecorded; expect(scored).toEqual(ordinary);
    expect(contactChainReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => !e.ballIds.includes(0)) }).steps).toHaveLength(0);
    expect(contactChainReplay(source, { ...sim, contactEvents: sim.contactEvents!.slice(0, 2) }).complete).toBe(false);
    expect(contactChainReplay(source, { ...sim, contactEvents: [...sim.contactEvents!].reverse() }).complete).toBe(false);
    expect(contactChainReplay(source, { ...sim, contactEvents: undefined }).steps).toHaveLength(0);
    expect(contactChainReplay(source, { ...sim, contactEvents: sim.contactEvents!.map(e => ({ ...e, balls: undefined })) }).complete).toBe(false);
    expect(contactChainReplay({ ...source, trick: undefined }, sim).complete).toBe(false);
  }
  expect(source).toEqual(before);
}, 30000);
