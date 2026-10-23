import { describe, expect, it } from 'vitest';
import { analyzeRound, analyzeShot } from './analysis';
import { distance } from './math';
import { simulateShot } from './physics';
import { MIN_FINISH_SEPARATION, prepareRound } from './preparation';
import { generateScenario } from './scenarios';

describe('Broken table finale', () => {
  it('authors ten different faults culminating in a combined final boss', () => {
    const scenarios = Array.from({ length: 10 }, (_, index) => generateScenario(91 + index, 0));
    expect(new Set(scenarios.map(scenario => scenario.conditions!.id)).size).toBe(10);
    expect(scenarios.every(scenario => scenario.curriculum?.chapterId === 'broken-table')).toBe(true);
    const boss = scenarios.at(-1)!;
    expect(boss.title).toMatch(/final boss/i);
    expect(boss.conditions).toMatchObject({ cloth: 1.4, dirt: 0.4 });
    for (const fault of ['nap', 'patches', 'cushions', 'cue'] as const) expect(boss.conditions![fault]).toBeDefined();
    expect(generateScenario(90).conditions).toBeUndefined();
  });

  it.each(Array.from({ length: 10 }, (_, index) => 91 + index))('offers genuine alternative pots and physically different results at level %i', level => {
    // Match the normal game seed as well as the four reflections checked by
    // scenarios.test.ts. No regeneration may conceal an unplayable lesson.
    const scenario = generateScenario(level);
    const prepared = prepareRound(scenario, { regenerate: false });
    expect(prepared.scenario).toEqual(scenario);
    expect(prepared.balls.length).toBeGreaterThanOrEqual(2);
    const effects: number[] = [];
    const analyses = [];
    for (const ball of prepared.balls) {
      expect(ball.options.map(option => option.label)).toEqual(['A', 'B', 'C']);
      for (const option of ball.options) {
        const nominal = simulateShot(scenario, option.plan, { record: false });
        expect(nominal.stopped).toBe(true);
        expect(nominal.scratch).toBe(false);
        expect(nominal.firstContact).toBe(ball.ballId);
        expect(nominal.potted).toContain(ball.ballId);
        expect(option.plan.target).toEqual(nominal.cueEnd);
        for (const other of ball.options) if (other !== option) {
          expect(distance(option.plan.target, other.plan.target)).toBeGreaterThanOrEqual(MIN_FINISH_SEPARATION);
        }
        const repaired = simulateShot({ ...scenario, conditions: undefined }, option.plan, { record: false });
        effects.push(distance(nominal.cueEnd, repaired.cueEnd));
        analyses.push(analyzeShot(scenario, option.plan, 24));
      }
    }
    // In particular the dead-cushion lesson must actually reach its bad rail.
    expect(Math.max(...effects)).toBeGreaterThan(0.05);
    expect(Math.max(...analyses.map(analysis => analysis.successRate))).toBeGreaterThan(0);
    expect(Math.max(...analyses.map(analysis => analysis.score)) - Math.min(...analyses.map(analysis => analysis.score))).toBeGreaterThan(0.1);
  }, 30000);

  it('preserves and reflects customized damage when a layout needs regeneration', () => {
    const scenario = generateScenario(93, 0);
    scenario.conditions = { ...scenario.conditions!, cloth: 1.25 };
    scenario.balls = [scenario.balls[0]];
    const prepared = prepareRound(scenario);
    expect(prepared.scenario.seed).not.toBe(scenario.seed);
    expect(prepared.scenario.conditions).toEqual({ ...generateScenario(93, prepared.scenario.seed).conditions!, cloth: 1.25 });
    expect(prepared.balls.length).toBeGreaterThan(0);
  });

  it('rejects a stale finish when table conditions change on the same layout', () => {
    const scenario = generateScenario(91, 0);
    const before = prepareRound(scenario, { regenerate: false });
    const after = prepareRound({ ...scenario, conditions: { ...scenario.conditions!, cloth: 1.8 } }, { regenerate: false });
    const stale = before.balls[0].options[0];
    expect(after.balls.flatMap(ball => ball.options).every(option => option.id !== stale.id)).toBe(true);
    expect(() => analyzeRound(after, { ballId: stale.plan.ballId, optionId: stale.id })).toThrow(/not available/);
  });

  it('returns independent condition data for reflected and repeated scenarios', () => {
    const source = generateScenario(100, 0);
    source.conditions!.patches![0].center.x = -100;
    source.conditions!.nap!.x = 100;
    source.conditions!.cue!.power = 0;
    const next = generateScenario(100, 0);
    expect(next.conditions!.patches![0].center.x).toBeGreaterThan(0);
    expect(Math.abs(next.conditions!.nap!.x)).toBeLessThan(0.1);
    expect(next.conditions!.cue!.power).toBe(0.88);
  });
});
