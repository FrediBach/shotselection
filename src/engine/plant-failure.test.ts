import { expect, it } from 'vitest';
import { plantFailureSummary, plantTrialStage } from './plant-failure';
import { analyzeShot } from './analysis';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { perturbShot } from './stroke-errors';
import { seededRandom } from './math';
import { DEFAULT_CHARACTER } from './characters';
it.each([0, 1, 5, 8, 68 * 919])('classifies the actual scoring trials without changing outcomes, seed %i', seed => {
  const source = generateScenario(68, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.ballId)).toEqual([1, 3]); for (const b of p.balls) expect(b.options).toHaveLength(3);
  for (const option of p.balls[0].options) {
    const shot = analyzeShot(p.scenario, option.plan, 16), summary = plantFailureSummary(shot)!;
    expect(summary).not.toBeNull(); expect(Object.values(summary.counts).reduce((a, b) => a + b, 0)).toBe(16);
    const random = seededRandom(p.scenario.seed ^ 0x3A7B91);
    for (let i = 0; i < 16; i++) {
      const plan = perturbShot(option.plan, random, DEFAULT_CHARACTER.talents), sim = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
      const success = evaluateShotObjective(p.scenario, plan, sim).success;
      expect(shot.plantTrialStages![i]).toBe(plantTrialStage(p.scenario, plan, sim, success));
      expect(shot.trialSuccesses![i]).toBe(success);
    }
    const plainSource = { ...p.scenario, curriculum: { ...p.scenario.curriculum!, learning: undefined } };
    const plain = analyzeShot(plainSource, option.plan, 16), { plantTrialStages: _stages, ...rest } = shot;
    expect(rest).toEqual(plain); expect(plain.plantTrialStages).toBeUndefined();
  }
  expect(analyzeShot(p.scenario, p.balls[1].options[0].plan, 8).plantTrialStages).toBeUndefined();
}, 60000);
it('assigns mutually exclusive first failures and keeps incomplete trials separate', () => {
  const source = generateScenario(68, 0), p = prepareRound(source, { regenerate: false }), plan = p.balls[0].options[0].plan;
  const base = simulateShot(p.scenario, plan, { record: false });
  const linked = { ...base, stopped: true, firstContact: 1, ballContacts: [[0, 1], [1, 2]] as [number, number][], potted: [2] };
  expect(plantTrialStage(source, plan, { ...linked, stopped: false }, false)).toBe('unsettled');
  expect(plantTrialStage(source, plan, { ...linked, firstContact: 3, scratch: true }, false)).toBe('delivery');
  expect(plantTrialStage(source, plan, { ...linked, ballContacts: [[1, 2], [0, 1]] }, false)).toBe('transfer');
  expect(plantTrialStage(source, plan, { ...linked, ballContacts: [[0, 1]] }, false)).toBe('transfer');
  expect(plantTrialStage(source, plan, { ...linked, potted: [], scratch: true }, false)).toBe('pot');
  expect(plantTrialStage(source, plan, { ...linked, scratch: true }, false)).toBe('finish');
  expect(plantTrialStage(source, plan, linked, false)).toBe('finish');
  expect(plantTrialStage(source, plan, linked, true)).toBe('success');
  expect(plantTrialStage(source, { ...plan, ballId: 3, potBallId: 3 }, linked, false)).toBeNull();
});
it('handles ties, no failures, unsettled outcomes and inconsistent metadata', () => {
  const p = prepareRound(generateScenario(68, 0), { regenerate: false }), base = analyzeShot(p.scenario, p.balls[0].options[0].plan, 8);
  const tie = { ...base, samples: 4, successRate: 0, trialSuccesses: [false, false, false, false], plantTrialStages: ['delivery', 'transfer', 'pot', 'finish'] as const };
  const shot = { ...tie, plantTrialStages: [...tie.plantTrialStages] };
  expect(plantFailureSummary(shot)!.limiting).toEqual(['delivery', 'transfer', 'pot', 'finish']);
  expect(plantFailureSummary({ ...shot, plantTrialStages: ['success', 'success', 'success', 'success'], trialSuccesses: [true, true, true, true], successRate: 1 })!.limiting).toEqual([]);
  expect(plantFailureSummary({ ...shot, plantTrialStages: ['unsettled', 'unsettled', 'unsettled', 'unsettled'] })!.limiting).toEqual([]);
  expect(plantFailureSummary({ ...shot, plantTrialStages: [] })).toBeNull();
  expect(plantFailureSummary({ ...shot, trialSuccesses: [true, false, false, false] })).toBeNull();
  expect(plantFailureSummary({ ...shot, successRate: .5 })).toBeNull();
});
