import { describe, expect, it } from 'vitest';
import { DEFAULT_CHARACTER } from './characters';
import { TABLE } from './constants';
import {
  analyzeLab, createLabScenario, createLabShot, DEFAULT_LAB_SHOT_SETTINGS,
  generateLabVariants, LAB_SHOT_LIMITS, MAX_LAB_VARIANTS, resizeLabBalls,
} from './lab';
import type { LabRequest, LabShotSettings, LabVariant } from './lab';
import { simulateShot } from './physics';
import { validateSandboxLayout } from './sandbox';

const settings = (patch: Partial<LabShotSettings> = {}): LabShotSettings => ({ ...DEFAULT_LAB_SHOT_SETTINGS, ...patch });
const variant = (id: string, patch: Partial<LabShotSettings> = {}): LabVariant => ({ id, label: id, settings: settings(patch) });
const request = (variants: LabVariant[]): LabRequest => ({
  scenario: createLabScenario(123), variants, samples: 8, talents: DEFAULT_CHARACTER.talents,
});

describe('lab layouts and shot controls', () => {
  it('creates a clean editable table and preserves existing positions when changing ball count', () => {
    const original = createLabScenario(123);
    expect(original).toMatchObject({ level: 1, seed: 123 });
    expect(original.curriculum).toBeUndefined();
    expect(original.objective).toBeUndefined();
    const source = structuredClone(original);
    const full = resizeLabBalls(original, 15);
    expect(full.balls.map(ball => ball.id)).toEqual(Array.from({ length: 16 }, (_, id) => id));
    expect(full.balls.slice(0, 2)).toEqual(original.balls);
    expect(validateSandboxLayout(full)).toBeNull();
    expect(resizeLabBalls(full, 1)).toEqual(original);
    expect(original).toEqual(source);
    expect(() => resizeLabBalls(original, 16)).toThrow(/1 and 15/);
    expect(() => resizeLabBalls(original, 0)).toThrow(/1 and 15/);
    expect(() => resizeLabBalls(original, 2.5)).toThrow(/1 and 15/);
  });

  it('finds free positions for newly added balls even when a player occupies grid positions', () => {
    const scenario = createLabScenario();
    scenario.balls = [
      { id: 0, position: { x: 0.16, y: 0.16 } },
      { id: 1, position: { x: 0.295, y: 0.16 } },
    ];
    const resized = resizeLabBalls(scenario, 15);
    expect(resized.balls.slice(0, 2)).toEqual(scenario.balls);
    expect(validateSandboxLayout(resized)).toBeNull();
  });

  it('interpolates numeric controls with exact endpoints and independent settings', () => {
    const start = settings({ speed: 0.3, topSpin: -2, sideSpin: -60, aimOffset: -12 });
    const end = settings({ speed: 3.7, topSpin: 2, sideSpin: 60, aimOffset: 12 });
    const variants = generateLabVariants(start, end, 5);
    expect(variants).toHaveLength(5);
    expect(variants[0].settings).toEqual(start);
    expect(variants[4].settings).toEqual(end);
    expect(variants[2].settings).toEqual(settings({ speed: 2, topSpin: 0, sideSpin: 0, aimOffset: 0 }));
    expect(new Set(variants.map(option => option.id)).size).toBe(5);
    variants[0].settings.speed = 1;
    expect(start.speed).toBe(0.3);
    expect(variants[1].settings.speed).toBeCloseTo(1.15);
    expect(() => generateLabVariants(start, { ...end, ballId: 2 }, 5)).toThrow(/same ball and pocket/);
    expect(() => generateLabVariants(start, { ...end, pocketId: 4 }, 5)).toThrow(/same ball and pocket/);
    expect(() => generateLabVariants(start, end, 1)).toThrow(/including both endpoints/);
    expect(() => generateLabVariants(start, end, MAX_LAB_VARIANTS + 1)).toThrow(/including both endpoints/);
  });

  it('allows complete aim rotation and blocked routes while rejecting invalid geometry and settings', () => {
    const scenario = createLabScenario();
    const straight = createLabShot(scenario, settings(), 'straight', 'Straight');
    const backwards = createLabShot(scenario, settings({ aimOffset: 180 }), 'backwards', 'Backwards');
    expect(backwards.angle - straight.angle).toBeCloseTo(Math.PI);
    expect(backwards.speed).toBe(DEFAULT_LAB_SHOT_SETTINGS.speed);
    for (const [key, limits] of Object.entries(LAB_SHOT_LIMITS)) {
      expect(() => createLabShot(scenario, settings({ [key]: limits.max + 0.1 }), 'bad', 'Bad')).toThrow(/between/);
      expect(() => createLabShot(scenario, settings({ [key]: Number.NaN }), 'bad', 'Bad')).toThrow(/between/);
    }
    expect(() => createLabShot(scenario, settings({ ballId: 2 }), 'bad', 'Bad')).toThrow(/Place ball 2/);
    expect(() => createLabShot(scenario, settings({ pocketId: 6 }), 'bad', 'Bad')).toThrow(/six pockets/);
    const overlapping = { ...scenario, balls: scenario.balls.map(ball => ({ ...ball, position: { x: 1, y: 0.5 } })) };
    expect(() => createLabShot(overlapping, settings(), 'bad', 'Bad')).toThrow(/overlap/);
    const outside = { ...scenario, balls: [{ id: 0, position: { x: TABLE.length, y: 0.5 } }, scenario.balls[1]] };
    expect(() => createLabShot(outside, settings(), 'bad', 'Bad')).toThrow(/inside/);
  });
});

describe('lab ensemble analysis', () => {
  it('retains failed strokes and their exact manual layout without searching for playable replacements', () => {
    const source = request([variant('too-soft', { speed: 0.1 }), variant('backwards', { speed: 0.1, aimOffset: 180 })]);
    const original = structuredClone(source);
    const result = analyzeLab(source);
    expect(result.scenario).toEqual(source.scenario);
    expect(result.shots.map(shot => shot.plan.id)).toEqual(['too-soft', 'backwards']);
    for (const shot of result.shots) {
      expect(shot.successRate).toBe(0);
      expect(shot.failures.misses).toBe(8);
      expect(shot.failures.wrongContact).toBe(8);
      expect(shot.nominal.firstContact).toBeNull();
      expect(shot.sampleObjectPaths).toHaveLength(8);
      expect(shot.sampleBallEnds).toHaveLength(8);
    }
    expect(source).toEqual(original);
  });

  it('reports a blocker as the wrong first contact instead of filtering the option', () => {
    const source = request([variant('blocked')]);
    source.scenario.balls = [
      { id: 0, position: { x: 1.27, y: 0.95 } },
      { id: 1, position: { x: 1.27, y: 0.3 } },
      { id: 2, position: { x: 1.27, y: 0.6 } },
    ];
    const result = analyzeLab(source);
    expect(result.shots).toHaveLength(1);
    expect(result.scenario.balls).toEqual(source.scenario.balls);
    expect(result.shots[0].nominal.firstContact).toBe(2);
    expect(result.shots[0].failures.wrongContact).toBe(8);
    expect(result.shots[0].successRate).toBe(0);
  });

  it('uses actual captured pockets for every trial, including simulations without replay frames', () => {
    const stroke = settings({ speed: 1.3, topSpin: 0 });
    const source = request([variant('correct', stroke)]);
    source.scenario.balls = [
      { id: 0, position: { x: 1.27, y: 0.95 } },
      { id: 1, position: { x: 1.27, y: 0.38 } },
    ];
    const correct = createLabShot(source.scenario, stroke, 'correct', 'Correct');
    const wrong = createLabShot(source.scenario, { ...stroke, pocketId: 4 }, 'wrong', 'Wrong');
    // Keep the identical physical stroke but nominate the opposite side pocket.
    const aimOffset = (correct.angle - wrong.angle) * 180 / Math.PI;
    source.variants.push(variant('wrong', { ...stroke, pocketId: 4, aimOffset }));
    const actual = simulateShot(source.scenario, correct, { record: false });
    expect(actual.frames).toEqual([]);
    expect(actual.pocketEvents).toContainEqual(expect.objectContaining({ ballId: 1, pocketId: 1 }));
    const [good, bad] = analyzeLab(source).shots;
    expect(good.successRate).toBeGreaterThan(0);
    expect(good.nominal.pocketEvents).toEqual(bad.nominal.pocketEvents);
    expect(bad.successRate).toBe(0);
    expect(bad.potRate).toBe(0);
    expect(bad.failures.wrongPocket).toBeGreaterThan(0);
    expect(bad.failures.wrongContact).toBe(0);
  });

  it('uses shared seeded stroke errors independent of option order and label', () => {
    const source = request([variant('first'), variant('second'), variant('soft', { speed: 0.1 })]);
    const result = analyzeLab(source);
    expect(result.shots[0].sampleBallEnds).toEqual(result.shots[1].sampleBallEnds);
    expect(result.shots[0].trialSuccesses).toEqual(result.shots[1].trialSuccesses);
    const reordered = analyzeLab({ ...source, variants: [...source.variants].reverse() });
    expect(reordered.shots).toEqual([...result.shots].reverse());
    expect(analyzeLab(source)).toEqual(result);
  });

  it('does not count pots with a scratched cue ball as successful trials', () => {
    const shot = analyzeLab(request([variant('follow', { speed: 2, topSpin: 1 })])).shots[0];
    expect(shot.failures.scratch).toBeGreaterThan(0);
    expect(shot.scratchRate).toBe(shot.failures.scratch / shot.samples);
    for (const [index, balls] of shot.sampleBallEnds.entries()) {
      if (balls.find(ball => ball.id === 0)!.pocketed) expect(shot.trialSuccesses![index]).toBe(false);
    }
    expect(shot.successRate).toBeLessThan(shot.potRate);
  });

  it('validates the entire request before running comparisons', () => {
    const source = request([variant('first')]);
    expect(() => analyzeLab({ ...source, variants: [] })).toThrow(/Compare 1 to/);
    expect(() => analyzeLab({ ...source, variants: [variant('same'), variant('same')] })).toThrow(/unique ID/);
    expect(() => analyzeLab({ ...source, samples: Number.NaN })).toThrow(/8 to 128/);
    expect(() => analyzeLab({ ...source, samples: 129 })).toThrow(/8 to 128/);
    expect(() => analyzeLab({ ...source, talents: { ...source.talents, anglePrecision: -1 } })).toThrow(/precision/);
  });
});
