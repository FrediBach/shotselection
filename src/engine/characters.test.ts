import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeRound, analyzeShot } from './analysis';
import { DEFAULT_CHARACTER, normalizePlayerCharacter, PREMADE_CHARACTERS, TALENT_DEFINITIONS, talentNoiseMultiplier } from './characters';
import { analyzeRoundAsync } from './client';
import { normalRandom, seededRandom } from './math';
import * as physics from './physics';
import { scoreSelection } from './scoring';
import type { CharacterTalents, PreparedRound, Scenario, ShotPlan } from './types';

const scenario: Scenario = {
  level: 30, seed: 42, title: 'Character fixture', description: 'Straight pot with three cue-ball finishes',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
};
const plan: ShotPlan = {
  id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 },
  angle: -Math.PI / 2, speed: 1.35, topSpin: 0, sideSpin: 0, label: 'Straight pot',
};
const baseline = DEFAULT_CHARACTER.talents;

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('player characters', () => {
  it('offers balanced presets with a distinct strength and an unchanged baseline', () => {
    expect(baseline).toEqual({ anglePrecision: 50, englishPrecision: 50, strengthPrecision: 50, spinPrecision: 50 });
    expect(new Set(PREMADE_CHARACTERS.map(character => character.id)).size).toBe(4);
    for (const character of PREMADE_CHARACTERS) {
      expect(Object.values(character.talents).reduce((total, value) => total + value, 0)).toBe(200);
      expect(normalizePlayerCharacter(character)).toEqual(character);
    }
    expect(PREMADE_CHARACTERS[1].talents.anglePrecision).toBeGreaterThan(50);
    expect(PREMADE_CHARACTERS[2].talents.englishPrecision).toBeGreaterThan(50);
    expect(PREMADE_CHARACTERS[3].talents.strengthPrecision).toBeGreaterThan(50);
  });

  it('normalizes custom slider values without retaining mutable save objects or extra data', () => {
    const saved = { id: 'custom', name: '  Casey  ', talents: { ...baseline, anglePrecision: 72.6, englishPrecision: 0, spinPrecision: 100 }, ignored: true };
    const normalized = normalizePlayerCharacter(saved)!;
    expect(normalized).toEqual({ id: 'custom', name: 'Casey', talents: { ...baseline, anglePrecision: 73, englishPrecision: 0, spinPrecision: 100 } });
    normalized.talents.strengthPrecision = 5;
    expect(saved.talents.strengthPrecision).toBe(50);
  });

  it.each([
    null, {}, { ...DEFAULT_CHARACTER, id: 'unknown' }, { ...DEFAULT_CHARACTER, name: '   ' },
    { ...DEFAULT_CHARACTER, name: 'A'.repeat(41) },
    ...[NaN, Infinity, -1, 101, '50', undefined].map(anglePrecision => ({ ...DEFAULT_CHARACTER, talents: { ...baseline, anglePrecision } })),
  ])('rejects incomplete or invalid persisted characters: %j', saved => {
    expect(normalizePlayerCharacter(saved)).toBeNull();
  });

  it('maps precision to bounded stroke-error standard deviation', () => {
    expect([0, 50, 100].map(talentNoiseMultiplier)).toEqual([1.75, 1, 0.25]);
    expect(talentNoiseMultiplier(-20)).toBe(1.75);
    expect(talentNoiseMultiplier(150)).toBe(0.25);
    expect(talentNoiseMultiplier(NaN)).toBe(1);
  });
});

describe('character-aware physical ensembles', () => {
  it('keeps the original seeded trials exactly when talents are omitted or set to 50', () => {
    const result = analyzeShot(scenario, plan, 8);
    expect(analyzeShot(scenario, plan, 8, baseline)).toEqual(result);
    const random = seededRandom(scenario.seed ^ 0x3A7B91);
    for (const endpoints of result.sampleBallEnds) {
      const originalTrial = {
        ...plan,
        angle: plan.angle + normalRandom(random) * (0.0044 + Math.abs(plan.sideSpin) * 0.000025),
        speed: plan.speed * (1 + normalRandom(random) * 0.035),
        topSpin: plan.topSpin + normalRandom(random) * 0.085,
        sideSpin: plan.sideSpin + normalRandom(random) * 3,
      };
      expect(endpoints).toEqual(physics.simulateShot(scenario, originalTrial, { record: false }).finalBalls);
    }
  });

  it.each([
    ['anglePrecision', 'angle'], ['englishPrecision', 'sideSpin'],
    ['strengthPrecision', 'speed'], ['spinPrecision', 'topSpin'],
  ] as const)('scales only %s errors while preserving draws and nominal plans', (talent, field) => {
    // A cushion route exposes sidespin as well as aim, speed and draw/follow.
    const stroke = { ...plan, angle: 0, speed: 1.8, topSpin: 0.8, sideSpin: 12 };
    const simulate = vi.spyOn(physics, 'simulateShot');
    const ordinary = analyzeShot(scenario, stroke, 8, baseline);
    const ordinaryTrials = simulate.mock.calls.slice(1).map(([, trial]) => trial);
    simulate.mockClear();
    const precise = analyzeShot(scenario, stroke, 8, { ...baseline, [talent]: 100 });
    const preciseTrials = simulate.mock.calls.slice(1).map(([, trial]) => trial);
    expect(simulate.mock.calls[0][1]).toBe(stroke);
    expect(precise.nominal).toEqual(ordinary.nominal);
    expect(precise.sampleBallEnds).not.toEqual(ordinary.sampleBallEnds);
    for (let index = 0; index < ordinaryTrials.length; index++) {
      for (const candidate of ['angle', 'sideSpin', 'speed', 'topSpin'] as const) {
        if (candidate === field) {
          expect(preciseTrials[index][candidate] - stroke[candidate]).toBeCloseTo((ordinaryTrials[index][candidate] - stroke[candidate]) / 4, 12);
        } else {
          expect(preciseTrials[index][candidate]).toBe(ordinaryTrials[index][candidate]);
        }
      }
    }
  });

  it('recomputes ranking and scores from the chosen character for every offered stroke', () => {
    const strokes = [
      { ...plan, id: 'draw', topSpin: -0.7 },
      { ...plan, id: 'stun', topSpin: 0 },
      { ...plan, id: 'follow', topSpin: 0.7 },
    ].map(stroke => ({ ...stroke, target: physics.simulateShot(scenario, stroke).cueEnd }));
    const prepared: PreparedRound = { scenario, balls: [{ ballId: 1, options: [
      { id: strokes[0].id, label: 'A', plan: strokes[0] },
      { id: strokes[1].id, label: 'B', plan: strokes[1] },
      { id: strokes[2].id, label: 'C', plan: strokes[2] },
    ] }] };
    const selection = { ballId: 1, optionId: 'stun' };
    const talents: CharacterTalents = { anglePrecision: 80, englishPrecision: 20, strengthPrecision: 5, spinPrecision: 95 };
    const result = analyzeRound(prepared, selection, { samples: 16, talents });
    const defaultResult = analyzeRound(prepared, selection, { samples: 16 });
    expect(result.positionTolerance).toBe(defaultResult.positionTolerance);
    expect(result.candidates.map(candidate => candidate.score)).not.toEqual(defaultResult.candidates.map(candidate => candidate.score));
    for (const candidate of result.candidates) {
      const direct = analyzeShot(scenario, candidate.plan, 16, talents);
      expect(candidate).toEqual(direct);
      expect(candidate.plan).toBe(strokes.find(stroke => stroke.id === candidate.plan.id));
      expect(candidate.nominal).toEqual(defaultResult.candidates.find(other => other.plan.id === candidate.plan.id)!.nominal);
    }
    expect(result.best.score).toBe(Math.max(...result.candidates.map(candidate => candidate.score)));
    expect(result.selected.plan.id).toBe('stun');
    expect(result.scoring).toEqual(scoreSelection(result.selected, result.candidates));
    expect(analyzeRound(prepared, selection, { samples: 16, talents })).toEqual(result);
  });

  it('forwards the entire talent profile through the analysis worker boundary', async () => {
    class TestWorker {
      static latest: TestWorker;
      onmessage?: (event: { data: unknown }) => void;
      postMessage = vi.fn();
      terminate = vi.fn();
      constructor() { TestWorker.latest = this; }
    }
    vi.stubGlobal('Worker', TestWorker);
    const prepared: PreparedRound = { scenario, balls: [] };
    const selection = { ballId: 1, optionId: plan.id };
    const talents = PREMADE_CHARACTERS[2].talents;
    const pending = analyzeRoundAsync(prepared, selection, { samples: 32, talents });
    expect(TestWorker.latest.postMessage).toHaveBeenCalledWith({ method: 'analyze', prepared, selection, options: { samples: 32, talents } });
    expect(Object.keys(talents).sort()).toEqual(TALENT_DEFINITIONS.map(talent => talent.key).sort());
    TestWorker.latest.onmessage?.({ data: { result: { samples: 32 } } });
    await expect(pending).resolves.toEqual({ samples: 32 });
    expect(TestWorker.latest.terminate).toHaveBeenCalledOnce();
  });
});
