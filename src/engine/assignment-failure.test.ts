import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeShot } from './analysis';
import { assignmentFailureMask, assignmentFailureSummary } from './assignment-failure';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { perturbShot } from './stroke-errors';
import { seededRandom } from './math';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
it.each([0, 1, 5, 8, 71 * 919])('reproduces overlapping scoring predicates, seed %i', seed => {
  const source = generateScenario(71, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls[0].options).toHaveLength(3);
  const plainSource = { ...source, curriculum: { ...source.curriculum!, learning: undefined } };
  const plain = prepareRound(plainSource, { regenerate: false });
  expect(p.scenario.objective).toEqual(plain.scenario.objective);
  for (const [index, option] of p.balls[0].options.entries()) {
    if (index < 2) expect({ ...option.plan, id: plain.balls[0].options[index].id }).toEqual(plain.balls[0].options[index].plan);
    if (index === 2) {
      expect(option.plan.speed).toBe(p.balls[0].options[1].plan.speed * 1.04);
      expect(Math.abs(option.plan.angle - p.balls[0].options[1].plan.angle)).toBeCloseTo(.01, 12);
      const nominal = simulateShot(p.scenario, option.plan, { record: false, recordPaths: true });
      expect(option.plan.target).toEqual(nominal.cueEnd); expect(option.cueApproachPath).toEqual(nominal.cueApproachPath);
    }
    const shot = analyzeShot(p.scenario, option.plan, 64), summary = assignmentFailureSummary(shot)!;
    expect(summary).not.toBeNull(); expect(summary.combinations.reduce((a, b) => a + b, 0)).toBe(64);
    expect(summary.sum).toBeGreaterThan(summary.failedTrials);
    const random = seededRandom(source.seed ^ 0x3A7B91);
    for (let i = 0; i < 64; i++) {
      const plan = perturbShot(option.plan, random, DEFAULT_CHARACTER.talents), simulation = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
      const e = evaluateShotObjective(p.scenario, option.plan, simulation);
      expect(shot.assignmentFailures![i]).toBe(assignmentFailureMask(e.legalPot, e.positioned, e.nextShotAvailable));
      expect(shot.trialSuccesses![i]).toBe(e.success);
    }
    if (seed === 0 || seed === 71 * 919) expect(summary.limiting).toEqual([[1], [2], [0]][index]);
    const { assignmentFailures: _masks, ...rest } = shot;
    expect(rest).toEqual(analyzeShot({ ...p.scenario, curriculum: { ...p.scenario.curriculum!, learning: undefined } }, option.plan, 64));
  }
}, 60000);
it('retains ties, success, overlap and invalid-data states across player profiles', () => {
  const p = prepareRound(generateScenario(71, 0), { regenerate: false });
  for (const player of PREMADE_CHARACTERS) for (const option of p.balls[0].options) {
    expect(assignmentFailureSummary(analyzeShot(p.scenario, option.plan, 16, player.talents))).not.toBeNull();
  }
  const base = analyzeShot(p.scenario, p.balls[0].options[0].plan, 8);
  const all = { ...base, samples: 8, assignmentFailures: [0, 1, 2, 3, 4, 5, 6, 7], trialSuccesses: [true, false, false, false, false, false, false, false], successRate: 1 / 8, legalPotRate: .5, positionRate: .5, nextShotRate: .5 };
  expect(assignmentFailureSummary(all)).toMatchObject({ failures: [4, 4, 4], sum: 12, failedTrials: 7, limiting: [0, 1, 2] });
  expect(assignmentFailureSummary({ ...all, assignmentFailures: Array(8).fill(0), trialSuccesses: Array(8).fill(true), successRate: 1, legalPotRate: 1, positionRate: 1, nextShotRate: 1 })!.limiting).toEqual([]);
  expect(assignmentFailureSummary({ ...all, assignmentFailures: undefined })).toBeNull();
  expect(assignmentFailureSummary({ ...all, nextShotRate: undefined })).toBeNull();
  expect(assignmentFailureSummary({ ...all, assignmentFailures: [8, 1, 2, 3, 4, 5, 6, 7] })).toBeNull();
  expect(assignmentFailureSummary({ ...all, successRate: .5 })).toBeNull();
  for (let mask = 0; mask < 8; mask++) expect(assignmentFailureMask(!(mask & 1), !(mask & 2), !(mask & 4))).toBe(mask);
}, 60000);
