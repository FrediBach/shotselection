import { expect, it } from 'vitest';
import { compareEquipmentRepairs, repairWinners } from './equipment-repair';
import { analyzeRound, analyzeShot } from './analysis';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { DEFAULT_CHARACTER } from './characters';
import type { ShotAnalysis } from './types';

it.each([0, 1, 5, 8, 99 * 919])('ranks single repairs using fixed offers and matched player trials, seed %i', seed => {
  const source = generateScenario(99, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  const option = prepared.balls[0].options[0], talents = seed === 5 ? { anglePrecision: 95, strengthPrecision: 15, englishPrecision: 40, spinPrecision: 70 } : DEFAULT_CHARACTER.talents;
  const result = analyzeRound(prepared, { ballId: option.plan.ballId, optionId: option.id }, { samples: 8, talents });
  const data = result.equipmentRepairs!;
  expect(data).toBeDefined(); expect(data.samples).toBe(8); expect(data.variants).toHaveLength(4);
  expect(data.variants[0].shots).toBe(result.candidates);
  const original = analyzeRound({ ...prepared, scenario: { ...source, curriculum: undefined } }, { ballId: option.plan.ballId, optionId: option.id }, { samples: 8, talents });
  const { equipmentRepairs, ...scored } = result; void equipmentRepairs;
  expect(scored).toEqual(original);
  const changes = [{ cue: undefined }, { dirt: 0 }, { cushions: undefined }];
  for (const [i, variant] of data.variants.entries()) {
    expect(variant.scenario).toEqual(i ? { ...source, conditions: { ...source.conditions!, ...changes[i - 1] } } : source);
    expect(variant.winners).toEqual(repairWinners(variant.shots));
    expect(variant.changed).toBe(variant.winners.join('|') !== data.variants[0].winners.join('|'));
    for (const shot of variant.shots) {
      const plan = result.candidates.find(s => s.plan.id === shot.plan.id)!.plan;
      expect(shot.plan).toEqual(plan);
      if (i) expect(shot).toEqual(analyzeShot(variant.scenario, plan, 8, talents));
    }
  }
  expect(data.variants.slice(1).some(v => v.changed)).toBe(true);
  expect(compareEquipmentRepairs({ ...source, conditions: undefined }, result.candidates, 8, talents, analyzeShot)).toBeUndefined();
  expect(source).toEqual(saved);
}, 60000);
it('preserves tied winners and avoids preferring zero-score offers', () => {
  const shot = (id: string, score: number) => ({ plan: { id }, score } as ShotAnalysis);
  expect(repairWinners([shot('b', .5), shot('a', .5), shot('c', .4)])).toEqual(['a', 'b']);
  expect(repairWinners([shot('a', 0), shot('b', 0)])).toEqual([]);
});
