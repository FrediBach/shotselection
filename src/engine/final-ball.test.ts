import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { analyzeRound, analyzeShot } from './analysis';
import { evaluateShotObjective } from './objectives';
import { analyzeShotTolerance } from './tolerance';
import { finalBallComparison } from './final-ball';
import { distance } from './math';
import { buildShotFeedback } from '../lib/shot-feedback';

it.each([0, 1, 5, 8, 79 * 919])('offers legal final pots without a position objective, seed %i', seed => {
  const source = generateScenario(79, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.scenario.balls.map(b => b.id)).toEqual([0, 1]); expect(p.scenario.finalBall).toEqual({ ballId: 1 });
  expect(p.scenario.objective).toBeUndefined();
  for (const o of p.balls[0].options) {
    const sim = simulateShot(p.scenario, o.plan), outcome = evaluateShotObjective(p.scenario, o.plan, sim);
    expect(outcome.success).toBe(true); expect(outcome.radius).toBe(0); expect(outcome.error).toBe(0); expect(outcome.zoneRatio).toBe(0);
    expect(evaluateShotObjective(p.scenario, { ...o.plan, target: { x: 100, y: 100 } }, sim)).toEqual(outcome);
    for (const end of [{ x: .1, y: .1 }, { x: 2.4, y: 1.1 }]) expect(evaluateShotObjective(p.scenario, o.plan, { ...sim, cueEnd: end }).success).toBe(true);
    for (const patch of [{ scratch: true }, { stopped: false }, { firstContact: null }, { firstContact: 2 }, { potted: [] }]) expect(evaluateShotObjective(p.scenario, o.plan, { ...sim, ...patch }).success).toBe(false);
    expect(evaluateShotObjective(p.scenario, { ...o.plan, ballId: 2 }, sim).success).toBe(false);
    expect(evaluateShotObjective(p.scenario, { ...o.plan, potBallId: 2 }, sim).success).toBe(false);
  }
});

it('scores only real winning pots and reclassifies the same settled trial positions', () => {
  const p = prepareRound(generateScenario(79, 79 * 919));
  const r = analyzeRound(p, { ballId: 1, optionId: p.balls[0].options[2].id }, { samples: 64 }), before = structuredClone(r);
  const evidence = finalBallComparison(p, r)!;
  expect(evidence.target).toEqual(p.balls[0].options[2].plan.target);
  expect(evidence.shots.map(s => [s.wins, s.restricted, s.outside])).toEqual([[60, 6, 54], [59, 22, 37], [58, 57, 1]]);
  for (const s of r.candidates) {
    expect(s.score).toBe(s.successRate); expect(s.legalPotRate).toBe(s.successRate); expect(s.targetQuality).toBe(s.successRate);
    expect(s.nextShotRate).toBeUndefined();
    const count = evidence.shots.find(c => c.optionId === s.plan.id)!;
    expect(count.restricted).toBe(s.trialSuccesses!.filter((win, i) => win && distance(s.sampleBallEnds[i].find(b => b.id === 0)!.position, evidence.target) <= evidence.radius).length);
    const { plan: ignored, ...original } = analyzeShot(p.scenario, s.plan, 8);
    void ignored;
    const { plan: changed, ...moved } = analyzeShot(p.scenario, { ...s.plan, target: { x: 9, y: 9 } }, 8);
    void changed; expect(moved).toEqual(original);
  }
  expect(r).toEqual(before); expect(r.positionTolerance).toBe(0);
  expect(buildShotFeedback(p.scenario, r).reasons[0].title).toBe('No next ball, no position target');
  const ordinary = analyzeShot({ ...p.scenario, finalBall: undefined }, r.best.plan, 64);
  expect(ordinary.successRate).toBeLessThan(r.best.successRate);
  expect(finalBallComparison({ ...p, scenario: { ...p.scenario, finalBall: undefined } }, r)).toBeNull();
  expect(finalBallComparison(p, { ...r, candidates: r.candidates.map(s => ({ ...s, trialSuccesses: [] })) })).toBeNull();
}, 30000);

it('uses the same legal-pot predicate for final-ball tolerance and rejects conflicting objectives', () => {
  const p = prepareRound(generateScenario(79, 0)), plan = p.balls[0].options[0].plan;
  const t = analyzeShotTolerance(p.scenario, plan);
  expect(t.positionTolerance).toBe(0); expect(t.nominalSuccess).toBe(true);
  expect(t.volume.successCount).toBe(t.volume.potCount);
  for (const axis of Object.values(t.axes)) expect(axis.success).toEqual(axis.pot);
  for (const other of [{ ballId: 0 }, { ballId: 2 }, { ballId: NaN }]) expect(() => prepareRound({ ...p.scenario, finalBall: other }, { regenerate: false })).toThrow(/final-ball/);
  expect(() => prepareRound({ ...p.scenario, balls: [...p.scenario.balls, { id: 2, position: { x: 2, y: .5 } }] }, { regenerate: false })).toThrow(/final-ball/);
  expect(() => prepareRound({ ...p.scenario, objective: { kind: 'position', ballId: 1, nextBallId: 2, radius: .1, maxCutAngle: 45 } }, { regenerate: false })).toThrow(/final-ball/);
  expect(() => prepareRound({ ...p.scenario, bank: { ballId: 1, minCushions: 1 } }, { regenerate: false })).toThrow(/final-ball/);
  const impossible = { ...p.scenario, curriculum: undefined, balls: [{ id: 0, position: { x: 1, y: .6 } }, { id: 1, position: { x: 1, y: .6 } }] };
  expect(() => prepareRound(impossible)).toThrow(/No feasible/); // Never replace a custom final-ball problem with an unrelated layout.
}, 30000);
