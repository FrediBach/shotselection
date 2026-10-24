import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { contactChainReplay } from './contact-chain';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { evaluateShotObjective } from './objectives';

it.each([0, 1, 5, 8, 90 * 919])('records the carom-to-plant handoff, seed %i', seed => {
  const source = generateScenario(90, seed), before = structuredClone(source);
  const prepared = prepareRound(source, { regenerate: false });
  expect(prepared.scenario).toEqual(before);
  for (const option of prepared.balls[0].options) {
    const analysis = analyzeShot(source, option.plan, 8), sim = analysis.nominal;
    const saved = structuredClone(sim), replay = contactChainReplay(source, sim);
    expect(replay.complete).toBe(true);
    expect(replay.steps.map(s => s.pair)).toEqual([[0, 1], [0, 2], [2, 3]]);
    for (const [i, step] of replay.steps.entries()) {
      expect(step.event.ballIds).toEqual(step.pair);
      expect(step.event.balls).toHaveLength(4);
      expect(step.event.pottedBefore).not.toContain(3);
      for (const id of step.pair) {
        expect(step.event.balls!.find(b => b.id === id)!.position).toEqual(step.event.positions[step.event.ballIds.indexOf(id)]);
      }
      if (i > 0) expect(step.event.time).toBeGreaterThan(replay.steps[i - 1].event.time);
    }
    expect(sim.potted).toContain(3);
    expect(evaluateShotObjective(source, option.plan, sim).success).toBe(true);
    const substituted = sim.ballContacts!.map(pair => pair.includes(2) && pair.includes(3) ? [0, 3] as [number, number] : pair);
    expect(evaluateShotObjective(source, option.plan, { ...sim, ballContacts: substituted }).success).toBe(false);
    const { nominal: recorded, ...scored } = analysis;
    const { nominal: ordinarySim, ...ordinary } = analyzeShot({ ...source, curriculum: undefined }, option.plan, 8);
    void recorded;
    expect(scored).toEqual(ordinary);
    expect(sim.frames).toEqual(ordinarySim.frames);
    expect(sim.finalBalls).toEqual(ordinarySim.finalBalls);
    expect(contactChainReplay(source, { ...sim, contactEvents: undefined }).complete).toBe(false);
    const incomplete = contactChainReplay(source, { ...sim, contactEvents: sim.contactEvents!.filter(e => !e.ballIds.includes(3)) });
    expect(incomplete.complete).toBe(false); expect(incomplete.steps).toHaveLength(2);
    expect(contactChainReplay(source, { ...sim, contactEvents: [...sim.contactEvents!].reverse() }).complete).toBe(false);
    expect(sim).toEqual(saved);
  }
  expect(source).toEqual(before);
}, 30000);
