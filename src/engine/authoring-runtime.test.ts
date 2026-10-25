import { describe, expect, it } from 'vitest';
import { assignmentPotProblem } from './assignment-failure';
import { createLabScenario, createLabShot } from './lab';
import { positionToleranceForScenario, scoresPosition } from './objectives';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { prepareSandboxRound } from './sandbox';
import { generateScenario } from './scenarios';
import type { Scenario } from './types';

const fixed = { id: 'authored-test', kind: 'level' as const, imported: true, variation: { mirrorX: false, mirrorY: false } };

describe('JSON authoring runtime', () => {
  it('uses explicit scoring independently of a level number', () => {
    const scenario = { ...createLabScenario(), level: 100, scoring: { position: false, tolerance: .24 } };
    expect(scoresPosition(scenario)).toBe(false);
    expect(positionToleranceForScenario(scenario)).toBe(0);
    const position = { ...scenario, level: 1, scoring: { position: true, tolerance: .24 } };
    expect(scoresPosition(position)).toBe(true);
    expect(positionToleranceForScenario(position)).toBe(.24);
  });

  it('replays authored controls and targets exactly, including a deliberate miss', () => {
    const scenario: Scenario = { ...createLabScenario(), authoring: fixed, authoredShots: [
      { id: 'soft', label: 'Soft', target: { x: 1.1, y: .7 }, settings: { ballId: 1, pocketId: 1, speed: .91, topSpin: -.17, sideSpin: 3.4, aimOffset: .43 } },
      { id: 'miss', label: 'Miss', settings: { ballId: 1, pocketId: 1, speed: 1.2, topSpin: 0, sideSpin: 0, aimOffset: 80 } },
      { id: 'firm', label: 'Firm', settings: { ballId: 1, pocketId: 1, speed: 2.17, topSpin: 1.31, sideSpin: -1.2, aimOffset: -.15 } },
    ] };
    const saved = structuredClone(scenario);
    const prepared = prepareRound(scenario);
    expect(prepared.scenario.balls).toEqual(scenario.balls);
    expect(prepared.balls[0].options.map(option => option.id)).toEqual(['soft', 'miss', 'firm']);
    for (const [index, option] of prepared.balls[0].options.entries()) {
      const variant = scenario.authoredShots![index];
      const original = createLabShot(scenario, variant.settings, variant.id, variant.label, variant);
      const simulated = simulateShot(scenario, original, { record: false, recordPaths: true });
      expect(option.plan).toEqual({ ...original, target: variant.target ?? simulated.cueEnd });
      expect(option.cueApproachPath).toEqual(simulated.cueApproachPath);
    }
    expect(simulateShot(scenario, prepared.balls[0].options[1].plan).potted).not.toContain(1);
    expect(scenario).toEqual(saved);
  });

  it('keeps incomplete lab drafts and unsupported teaching comparisons out of course play', () => {
    const scenario = { ...createLabScenario(), authoring: fixed, authoredShots: [] };
    expect(() => prepareRound(scenario)).toThrow(/exactly three choices/);
    expect(() => prepareRound({ ...generateScenario(12, 0), authoredShots: [] })).toThrow(/teaching comparison/);
  });

  it('does not replace a fixed imported table with a built-in lesson', () => {
    const scenario = { ...generateScenario(6, 55), authoring: fixed, balls: [{ id: 0, position: { x: 1, y: .6 } }] };
    expect(() => prepareRound(scenario)).toThrow(/No feasible/);
    expect(() => prepareRound({ ...scenario, authoring: { ...fixed, imported: false } })).toThrow(/No feasible/);
  });

  it('keeps a saved landing target when preparing an imported sandbox layout', () => {
    const original = prepareRound(generateScenario(21, 0), { regenerate: false });
    const scenario = { ...original.scenario, authoring: fixed };
    const prepared = prepareSandboxRound({ scenario, placement: 'manual' });
    expect(prepared.scenario.objective?.target).toEqual(scenario.objective?.target);
    expect(prepared.scenario.balls).toEqual(scenario.balls);
  });

  it('recalculates generated zones after repeated edits while keeping an imported layout fixed', () => {
    const scenario = { ...generateScenario(21, 0), authoring: { ...fixed, fixedObjective: false } };
    const first = prepareSandboxRound({ scenario, placement: 'manual' });
    const edited = { ...first.scenario, objective: { ...first.scenario.objective!, target: { x: .1, y: .1 } } };
    const prepared = prepareSandboxRound({ scenario: edited, placement: 'manual' });
    expect(prepared.scenario.objective?.target).toEqual(first.scenario.objective?.target);
    expect(prepared.scenario.balls).toEqual(edited.balls);
  });

  it('uses the supplied direct spin grid instead of silently restoring course defaults', () => {
    const scenario = generateScenario(1, 0);
    expect(prepareRound(scenario, { regenerate: false }).balls.length).toBeGreaterThan(0);
    expect(() => prepareRound({ ...scenario, shotGeneration: { speedMultipliers: [.95, 1.2, 1.5, 1.85, 2.3], topSpins: [0] } }, { regenerate: false })).toThrow(/No feasible/);
  });

  it('uses authored demonstration adjustments in the physical stroke', () => {
    const prepared = prepareRound(generateScenario(71, 0), { regenerate: false });
    const source = { ...prepared.scenario, lessonTuning: { assignmentSpeedMultiplier: 1.13, assignmentAngleOffset: .023 } };
    const [, middle, last] = prepared.balls[0].options;
    const changed = assignmentPotProblem(source, middle, last);
    expect(changed.plan.speed).toBe(middle.plan.speed * 1.13);
    expect(Math.abs(changed.plan.angle - middle.plan.angle)).toBeCloseTo(.023, 12);
    expect(changed.plan.target).toEqual(simulateShot(source, changed.plan, { record: false }).cueEnd);
  });

  it('randomizes the supplied JSON settings without restoring the numbered course definition', () => {
    const scenario = { ...generateScenario(1, 101), title: 'Adjusted lesson', scoring: { position: false, tolerance: .333 }, authoring: fixed };
    const prepared = prepareSandboxRound({ scenario, placement: 'random' });
    expect(prepared.scenario.title).toBe('Adjusted lesson');
    expect(prepared.scenario.scoring).toEqual(scenario.scoring);
    expect(prepared.scenario.authoring).toEqual(scenario.authoring);
    expect(prepared.scenario.balls).not.toEqual(scenario.balls);
  });
});
