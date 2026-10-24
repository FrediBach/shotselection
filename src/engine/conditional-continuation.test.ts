import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeRound, analyzeShot } from './analysis';
import { analyzeContinuation, continuationRoute, summarizeContinuation } from './conditional-continuation';
import { sequenceLayout } from './sequence-reliability';
import { secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { perturbShot } from './stroke-errors';
import { seededRandom } from './math';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
it.each([0, 1, 5, 8, 72 * 919])('continues from the actual scoring states with paired errors, seed %i', seed => {
  const source = generateScenario(72, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), v = p.continuation!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(v).toBeDefined();
  const plainSource = { ...source, curriculum: { ...source.curriculum!, learning: undefined } }, plain = prepareRound(plainSource, { regenerate: false });
  expect(p.balls[0].options[2].plan.speed).toBe(plain.balls[0].options[2].plan.speed * 1.02);
  expect({ ...p.balls[0].options[0].plan, id: plain.balls[0].options[0].id }).toEqual(plain.balls[0].options[0].plan);
  expect(p.scenario.objective).toEqual(plain.scenario.objective);
  expect({ ...p.balls[0].options[1].plan, id: plain.balls[0].options[2].id, label: plain.balls[0].options[2].plan.label }).toEqual(plain.balls[0].options[2].plan);
  const retained = analyzeShot(p.scenario, p.balls[0].options[1].plan, 32);
  expect(retained.successRate).toBeGreaterThan(0);
  expect(evaluateShotObjective(p.scenario, retained.plan, retained.nominal).success).toBe(true);
  const result = analyzeRound(p, { ballId: 1, optionId: p.balls[0].options[0].id }, { samples: 64 }), a = result.continuation!;
  const first = result.candidates.find(c => c.plan.id === v.referenceId)!;
  expect(v.probes.map(probe => probe.legal)).toEqual([true, true, true]);
  expect(v.probes[0].cut!).toBeGreaterThan(v.probes[1].cut!); expect(v.probes[1].cut!).toBeGreaterThan(v.probes[2].cut!);
  expect(v.probes[2].cut! - v.probes[0].cut!).toBeLessThan(-10);
  for (const probe of v.probes) {
    const sim = simulateShot(p.scenario, { ...first.plan, speed: first.plan.speed * probe.multiplier }, { record: false, recordPaths: true });
    expect(probe.first).toEqual(sim); expect(probe.legal).toBe(evaluateShotObjective(p.scenario, first.plan, sim).legalPot);
    expect(probe.cut).toBe(continuationRoute(p.scenario, sim.finalBalls, v.second)!.cutAngle);
  }
  const nominalLayout = sequenceLayout(p.scenario, first.nominal);
  expect(secondShotPotted(2, simulateShot(nominalLayout, v.second, { record: false }))).toBe(true);
  const firstRandom = seededRandom(seed ^ 0x3A7B91), secondRandom = seededRandom(seed ^ 0x2C71A9);
  for (let i = 0; i < 64; i++) {
    const opener = perturbShot(first.plan, firstRandom, DEFAULT_CHARACTER.talents);
    const sim = simulateShot(p.scenario, opener, { record: false, recordPaths: true });
    expect(first.sampleBallEnds[i]).toEqual(sim.finalBalls);
    const legal = evaluateShotObjective(p.scenario, first.plan, sim).legalPot;
    expect(first.trialLegalPots![i]).toBe(legal);
    const second = perturbShot(v.second, secondRandom, DEFAULT_CHARACTER.talents);
    const route = legal ? continuationRoute(p.scenario, sim.finalBalls, v.second) : undefined;
    const actual = route ? simulateShot(sequenceLayout(p.scenario, sim), { ...second, angle: route.angle + (second.angle - v.second.angle) }, { record: false }) : null;
    expect(a.trials[i]).toEqual({ firstLegal: legal, available: Boolean(route), completed: Boolean(actual && secondShotPotted(2, actual)), nominalCompleted: secondShotPotted(2, simulateShot(nominalLayout, second, { record: false })) });
  }
  expect(a.sequence).toBeCloseTo((a.firstLegal / 64) * a.conditional!, 12);
  expect(a.naive).toBe((a.firstLegal / 64) * (a.nominalCompleted / 64));
  if (seed === 72 * 919) expect(a.sequence! - a.naive!).toBeGreaterThan(.02);
  const { trialLegalPots: _flags, ...rest } = first;
  expect(rest).toEqual(analyzeShot({ ...p.scenario, curriculum: { ...p.scenario.curriculum!, learning: undefined } }, first.plan, 64));
  const { continuation: _preview, ...ordinaryPrepared } = p;
  const { continuation: _extra, ...ordinaryResult } = result;
  expect(ordinaryResult).toEqual(analyzeRound(ordinaryPrepared, { ballId: 1, optionId: p.balls[0].options[0].id }, { samples: 64 }));
}, 60000);
it('uses player talents and handles lost routes, zero openers and missing data', () => {
  const p = prepareRound(generateScenario(72, 0), { regenerate: false }), v = p.continuation!, plan = p.balls[0].options.find(o => o.id === v.referenceId)!.plan;
  for (const player of PREMADE_CHARACTERS) {
    const first = analyzeShot(p.scenario, plan, 16, player.talents), a = analyzeContinuation(p.scenario, v, first, player.talents)!;
    expect(a.count).toBe(16); expect(a.firstLegal).toBe(first.trialLegalPots!.filter(Boolean).length);
    const none = analyzeContinuation(p.scenario, v, { ...first, trialLegalPots: Array(16).fill(false) }, player.talents)!;
    expect(none.conditional).toBeNull(); expect(none.sequence).toBe(0); expect(none.trials.map(t => t.nominalCompleted)).toEqual(a.trials.map(t => t.nominalCompleted));
    const lost = analyzeContinuation(p.scenario, v, { ...first, sampleBallEnds: first.sampleBallEnds.map(balls => balls.filter(b => b.id !== 2)) }, player.talents)!;
    expect(lost.firstLegal).toBe(a.firstLegal); expect(lost.available).toBe(0); expect(lost.completed).toBe(0);
    expect(analyzeContinuation(p.scenario, v, { ...first, trialLegalPots: undefined })).toBeNull();
  }
  expect(summarizeContinuation([])).toMatchObject({ conditional: null, naive: null, sequence: null });
});
