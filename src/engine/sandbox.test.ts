import { describe, expect, it } from 'vitest';
import { TABLE } from './constants';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { SANDBOX_SCENARIOS, createSandboxScenario, prepareSandboxRound, validateSandboxLayout } from './sandbox';

describe('sandbox preparation', () => {
  it('opens every scenario and variation without requiring course progress', () => {
    expect(SANDBOX_SCENARIOS).toHaveLength(8);
    expect(SANDBOX_SCENARIOS.flatMap(group => group.lessons.map(lesson => lesson.level)))
      .toEqual(Array.from({ length: 80 }, (_, index) => index + 1));
    expect(() => createSandboxScenario(0)).toThrow(/available/);
    expect(() => createSandboxScenario(81)).toThrow(/available/);
  });

  it('rejects off-table, nonfinite, duplicate and overlapping ball placements', () => {
    const scenario = createSandboxScenario(1, 0);
    expect(validateSandboxLayout(scenario)).toBeNull();
    for (const position of [{ x: 0, y: 0.5 }, { x: 1, y: Number.NaN }, { x: TABLE.length, y: 0.4 }]) {
      expect(validateSandboxLayout({ ...scenario, balls: [{ ...scenario.balls[0], position }, scenario.balls[1]] })).toMatch(/fully inside/);
    }
    const overlapping = { ...scenario, balls: scenario.balls.map(ball => ({ ...ball, position: { x: 1, y: 0.5 } })) };
    expect(() => prepareSandboxRound({ scenario: overlapping, placement: 'manual' })).toThrow(/overlap/);
    expect(validateSandboxLayout({ ...scenario, balls: [scenario.balls[0], scenario.balls[0]] })).toMatch(/unique/);
    expect(validateSandboxLayout({ ...scenario, balls: [scenario.balls[1]] })).toMatch(/cue ball/);
    // The visible mouth is not the recessed well: supported cloth just inside
    // a side pocket remains a valid place for a resting ball.
    expect(validateSandboxLayout({ ...scenario, balls: [{ ...scenario.balls[0], position: { x: 1.27, y: 0.03 } }, scenario.balls[1]] })).toBeNull();
  });

  it('prepares manual positions exactly without mutating the source', () => {
    const scenario = createSandboxScenario(1, 0);
    scenario.balls[0].position.x += 0.025;
    const original = structuredClone(scenario);
    const prepared = prepareSandboxRound({ scenario, placement: 'manual' });
    expect(prepared.scenario.balls).toEqual(original.balls);
    expect(scenario).toEqual(original);
    expect(prepared.balls.length).toBeGreaterThan(0);
  });

  it('rejects an unplayable manual layout instead of replacing it with a course layout', () => {
    const scenario = createSandboxScenario(21, 0);
    scenario.balls = [
      { id: 0, position: { x: 0.73, y: 0.83 } },
      { id: 1, position: { x: 2.15, y: 0.94 } },
      { id: 2, position: { x: 1.16, y: 0.33 } },
      ...Array.from({ length: 6 }, (_, index) => ({ id: index + 3, position: {
        x: 2.15 + Math.cos(index * Math.PI / 3) * 0.07,
        y: 0.94 + Math.sin(index * Math.PI / 3) * 0.07,
      } })),
    ];
    const original = structuredClone(scenario);
    expect(validateSandboxLayout(scenario)).toBeNull();
    expect(() => prepareSandboxRound({ scenario, placement: 'manual' })).toThrow(/could not find three playable finishes/);
    expect(scenario).toEqual(original);
  });

  it('recalculates a position zone after ball edits without moving the balls', () => {
    const scenario = createSandboxScenario(21, 0);
    scenario.objective!.target = { x: 0.1, y: 0.1 };
    const original = structuredClone(scenario);
    const prepared = prepareSandboxRound({ scenario, placement: 'manual' });
    expect(prepared.scenario.balls).toEqual(scenario.balls);
    expect(prepared.scenario.objective!.target).not.toEqual(scenario.objective!.target);
    expect(scenario).toEqual(original);
    expect(prepared.balls[0].options.some(option => evaluateShotObjective(prepared.scenario, option.plan,
      simulateShot(prepared.scenario, option.plan, { record: false })).success)).toBe(true);
  });

  it.each(SANDBOX_SCENARIOS.flatMap(group => group.lessons.map(lesson => lesson.level)))('randomizes and proves a playable layout for scenario %i', level => {
    const scenario = createSandboxScenario(level, 12345);
    const original = structuredClone(scenario);
    const prepared = prepareSandboxRound({ scenario, placement: 'random' });
    expect(validateSandboxLayout(prepared.scenario)).toBeNull();
    expect(prepared.scenario.balls).not.toEqual(scenario.balls);
    expect(prepared.scenario.level).toBe(level);
    expect(prepared.scenario.bank).toEqual(scenario.bank);
    expect(prepared.scenario.plant).toEqual(scenario.plant);
    expect(prepared.scenario.curriculum).toEqual(scenario.curriculum);
    expect(scenario).toEqual(original);
    expect(prepared.balls.flatMap(ball => ball.options).some(option => evaluateShotObjective(prepared.scenario, option.plan,
      simulateShot(prepared.scenario, option.plan, { record: false })).success)).toBe(true);
  }, 30000);

  it('uses the seed deterministically and varies positions across seeds', () => {
    const request = { scenario: createSandboxScenario(1, 101), placement: 'random' as const };
    const first = prepareSandboxRound(request);
    expect(prepareSandboxRound(request)).toEqual(first);
    const other = prepareSandboxRound({ scenario: createSandboxScenario(1, 102), placement: 'random' });
    expect(other.scenario.balls).not.toEqual(first.scenario.balls);
    expect(first.scenario.balls.some(ball => distance(ball.position, request.scenario.balls.find(source => source.id === ball.id)!.position) > 0.25)).toBe(true);
  });
});
