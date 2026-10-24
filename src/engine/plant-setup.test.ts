import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { analyzeRound, analyzeShot } from './analysis';
import { shiftedPlantSetup, setupComparison, setupRoute } from './plant-setup';
import { distance, dot, normalize, subtract } from './math';
import { PREMADE_CHARACTERS } from './characters';
it.each([0, 1, 5, 8, 70 * 919])('isolates setup and reproduces paired scores, seed %i', seed => {
  const source = generateScenario(70, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false });
  const shifted = shiftedPlantSetup(source), option = p.balls[0].options[0];
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  expect(shifted.seed).toBe(source.seed);
  expect(shifted.balls.filter(b => b.id !== 1)).toEqual(source.balls.filter(b => b.id !== 1));
  const delta = subtract(shifted.balls[1].position, source.balls[1].position);
  expect(distance(shifted.balls[1].position, source.balls[1].position)).toBeCloseTo(.002, 12);
  expect(dot(delta, normalize(subtract(source.balls[2].position, source.balls[1].position)))).toBeCloseTo(0, 12);
  const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 64 });
  expect(result.plantSetup).toHaveLength(6);
  for (const shot of result.plantSetup!) {
    const actual = analyzeShot(shifted, shot.plan, 64);
    expect(shot).toEqual({ plan: actual.plan, score: actual.score, successRate: actual.successRate, samples: actual.samples });
    const base = result.candidates.find(s => s.plan.id === shot.plan.id)!;
    expect(shot.plan).toEqual(base.plan);
    if (shot.plan.ballId === 3) { expect(shot.score).toBe(base.score); expect(shot.successRate).toBe(base.successRate); }
  }
  const comparison = setupComparison(result.candidates, result.plantSetup!, 1)!;
  expect(comparison).not.toBeNull();
  if (seed === 70 * 919) expect(comparison).toEqual({ before: 'Plant', after: 'Free ball', outcome: 'flip' });
  if (seed === 0) expect(comparison.outcome).toBe('same');
  const { plantSetup: _diagnostic, ...rest } = result;
  const plain = { ...p, scenario: { ...p.scenario, curriculum: { ...p.scenario.curriculum!, learning: undefined } } };
  expect(rest).toEqual(analyzeRound(plain, { ballId: 1, optionId: option.id }, { samples: 64 }));
}, 60000);
it('uses the requested player and sample count; handles ties and missing routes', () => {
  const p = prepareRound(generateScenario(70, 70 * 919), { regenerate: false });
  for (const player of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 3, optionId: p.balls[1].options[0].id }, { samples: 16, talents: player.talents });
    for (const shot of result.plantSetup!) {
      expect(shot.samples).toBe(16);
      expect(shot.score).toBe(analyzeShot(shiftedPlantSetup(p.scenario), shot.plan, 16, player.talents).score);
    }
    const tie = result.plantSetup!.map(s => ({ ...s, score: .25 }));
    expect(setupRoute(tie, 1)).toBe('Tie');
    expect(setupComparison(tie, tie, 1)!.outcome).toBe('tie');
    expect(setupRoute([], 1)).toBeNull();
    expect(setupComparison(tie, [], 1)).toBeNull();
    expect(setupRoute(tie.map(s => ({ ...s, score: NaN })), 1)).toBeNull();
  }
}, 60000);
