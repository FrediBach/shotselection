import { expect, it } from 'vitest';
import { compareConditionRobustness } from './condition-robustness';
import { analyzeRound, analyzeShot } from './analysis';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { DEFAULT_CHARACTER } from './characters';
import type { ShotAnalysis } from './types';

it.each([0, 1, 5, 8, 100 * 919])('compares table uncertainty independently of execution errors, seed %i', seed => {
  const source = generateScenario(100, seed), saved = structuredClone(source), prepared = prepareRound(source, { regenerate: false });
  const option = prepared.balls[0].options[0], talents = seed === 5 ? { anglePrecision: 95, strengthPrecision: 15, englishPrecision: 40, spinPrecision: 70 } : DEFAULT_CHARACTER.talents;
  const selection = { ballId: option.plan.ballId, optionId: option.id };
  const result = analyzeRound(prepared, selection, { samples: 8, talents }), data = result.conditionRobustness!;
  expect(data).toBeDefined(); expect(data.samples).toBe(8); expect(data.variants).toHaveLength(5);
  expect(data.variants[0].shots).toBe(result.candidates);
  const { conditionRobustness, ...scored } = result; void conditionRobustness;
  expect(scored).toEqual(analyzeRound({ ...prepared, scenario: { ...source, curriculum: undefined } }, selection, { samples: 8, talents }));
  const c = source.conditions!, changes = [
    {}, { cloth: c.cloth! * .9 }, { cloth: c.cloth! * 1.1 },
    { nap: { x: c.nap!.x * .8, y: c.nap!.y * .8 } }, { nap: { x: c.nap!.x * 1.2, y: c.nap!.y * 1.2 } },
  ];
  for (const [i, variant] of data.variants.entries()) {
    expect(variant.scenario).toEqual({ ...source, conditions: { ...c, ...changes[i] } });
    for (const shot of variant.shots) {
      const plan = result.candidates.find(s => s.plan.id === shot.plan.id)!.plan;
      expect(shot.plan).toEqual(plan);
      if (i) expect(shot).toEqual(analyzeShot(variant.scenario, plan, 8, talents));
    }
  }
  for (const route of data.routes) {
    const scores = data.variants.map(v => v.shots.find(s => s.plan.id === route.optionId)!.score);
    expect(route.scores).toEqual(scores); expect(route.worst).toBe(Math.min(...scores)); expect(route.best).toBe(Math.max(...scores));
    if (data.robust.includes(route.optionId)) expect(route.worst).toBe(Math.max(...data.routes.map(r => r.worst)));
  }
  expect(data.robust.length).toBeGreaterThan(0);
  expect(data.routes.some(r => r.reported - r.worst > .02)).toBe(true);
  expect(compareConditionRobustness({ ...source, conditions: undefined }, result.candidates, 8, talents, analyzeShot)).toBeUndefined();
  expect(source).toEqual(saved);
}, 60000);
it('prefers a high minimum over a fragile peak or a stable low score, retaining ties', () => {
  const source = generateScenario(100, 0);
  const shot = (id: string, score: number) => ({ plan: { id }, score } as ShotAnalysis);
  const baseline = [shot('fragile', .9), shot('strong', .8), shot('twin', .8), shot('weak', .2)];
  const data = compareConditionRobustness(source, baseline, 8, undefined, (_s, p) => shot(p.id, p.id === 'fragile' ? .1 : p.id === 'weak' ? .2 : .7))!;
  expect(data.reported).toEqual(['fragile']); expect(data.robust).toEqual(['strong', 'twin']);
});
