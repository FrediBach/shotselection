import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeShot } from './analysis';
import { plantQualitySummary, qualityWinner } from './plant-quality';
import { simulateShot } from './physics';
import { evaluateShotObjective, positionToleranceForScenario } from './objectives';
import { perturbShot } from './stroke-errors';
import { seededRandom } from './math';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
it.each([0, 1, 5, 8, 69 * 919])('preserves physical strokes and reproduces scored credit, seed %i', seed => {
  const source = generateScenario(69, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  const plain = prepareRound({ ...source, curriculum: { ...source.curriculum!, learning: undefined } }, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(p.balls.map(b => b.options.length)).toEqual([3, 3]);
  const shots = p.balls.map((ball, index) => {
    for (const [i, option] of ball.options.entries()) {
      const old = plain.balls[index].options[i];
      expect({ ...option.plan, id: old.plan.id, target: old.plan.target }).toEqual(old.plan);
      expect(option.cueApproachPath).toEqual(old.cueApproachPath);
      if (option.label !== 'C') expect(option.plan.target).toEqual(old.plan.target);
    }
    const plan = ball.options[2].plan;
    expect(plan.target.x).toBeGreaterThan(.03); expect(plan.target.x).toBeLessThan(2.51);
    expect(plan.target.y).toBeGreaterThan(.03); expect(plan.target.y).toBeLessThan(1.24);
    expect(simulateShot(source, plan)).toEqual(simulateShot(source, plain.balls[index].options[2].plan));
    const shot = analyzeShot(source, plan, 64), summary = plantQualitySummary(shot)!;
    expect(summary).not.toBeNull();
    const random = seededRandom(source.seed ^ 0x3A7B91), tolerance = positionToleranceForScenario(source);
    for (let i = 0; i < 64; i++) {
      const perturbed = perturbShot(plan, random, DEFAULT_CHARACTER.talents);
      const sim = simulateShot(source, perturbed, { record: false, recordPaths: true });
      const outcome = evaluateShotObjective(source, plan, sim);
      expect(shot.trialTargetCredits![i]).toBe(outcome.legalPot && outcome.nextShotAvailable ? Math.exp(-(outcome.error ** 2) / (2 * tolerance ** 2)) : 0);
      expect(shot.trialSuccesses![i]).toBe(outcome.success);
    }
    const { trialTargetCredits: _credits, ...rest } = shot;
    expect(rest).toEqual(analyzeShot(plain.scenario, plan, 64));
    return shot;
  });
  if (seed === 0 || seed === 69 * 919) {
    expect(shots[1].successRate).toBeGreaterThan(shots[0].successRate);
    expect(shots[0].score).toBeGreaterThan(shots[1].score);
    expect(plantQualitySummary(shots[0])!.conditional!).toBeGreaterThan(plantQualitySummary(shots[1])!.conditional!);
  }
}, 60000);
it('reports actual results for every preset and handles absent, invalid and empty success data', () => {
  const p = prepareRound(generateScenario(69, 0), { regenerate: false });
  for (const player of PREMADE_CHARACTERS) for (const b of p.balls) {
    const shot = analyzeShot(p.scenario, b.options[2].plan, 16, player.talents);
    expect(plantQualitySummary(shot)).not.toBeNull();
    expect(plantQualitySummary({ ...shot, trialTargetCredits: undefined })).toBeNull();
    expect(plantQualitySummary({ ...shot, trialTargetCredits: [NaN] })).toBeNull();
    expect(plantQualitySummary({ ...shot, score: -1 })).toBeNull();
    expect(plantQualitySummary({ ...shot, successRate: 0, score: 0, targetQuality: 0, legalPotRate: 0, trialSuccesses: Array(16).fill(false), trialTargetCredits: Array(16).fill(0) })!.conditional).toBeNull();
  }
  expect(qualityWinner(.2, .3)).toBe('Free-ball C'); expect(qualityWinner(.3, .2)).toBe('Plant C'); expect(qualityWinner(.2, .2)).toBe('Tie');
}, 60000);
