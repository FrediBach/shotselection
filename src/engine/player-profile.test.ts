import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { comparePlayerProfiles, profileWinners, TRAINING_PROFILES } from './player-profile';
import { analyzeRound, analyzeShot } from './analysis';
import { distance, seededRandom } from './math';
import { perturbShot } from './stroke-errors';

it.each([0, 1, 5, 8, 78 * 919])('keeps the authored layout and fixes the controls before profile sampling, seed %i', seed => {
  const source = generateScenario(78, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  const plain = prepareRound({ ...source, curriculum: { ...source.curriculum!, learning: undefined } }, { regenerate: false });
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  const [a, b] = plain.balls[0].options;
  expect(p.balls[0].options[0].plan.speed).toBe(a.plan.speed * 1.02);
  expect(p.scenario.objective!.target).toEqual({ x: a.plan.target.x + (b.plan.target.x - a.plan.target.x) * .65, y: a.plan.target.y + (b.plan.target.y - a.plan.target.y) * .65 });
  expect(p.scenario.objective!.radius).toBe(.125); expect(p.scenario.objective!.maxCutAngle).toBe(42);
  for (const [i, o] of p.balls[0].options.entries()) {
    const original = plain.balls[0].options[i].plan;
    for (const key of ['angle', 'pocketId', 'topSpin', 'sideSpin'] as const) expect(o.plan[key]).toBe(original[key]);
    if (i > 0) expect(o.plan.speed).toBe(original.speed);
    const sim = simulateShot(p.scenario, o.plan);
    expect(sim.cueEnd).toEqual(o.plan.target);
    if (i < 2) expect(evaluateShotObjective(p.scenario, o.plan, sim).success).toBe(true);
    for (const other of p.balls[0].options) if (other !== o) expect(distance(o.plan.target, other.plan.target)).toBeGreaterThanOrEqual(.12);
  }
});

it('verifies the ranking reversal and replays all profile and isolated-axis trials', () => {
  const p = prepareRound(generateScenario(78, 78 * 919), { regenerate: false });
  const plans = p.balls[0].options.map(o => o.plan), before = structuredClone(p);
  const data = comparePlayerProfiles(p.scenario, plans);
  expect(p).toEqual(before); expect(data.switched).toBe(true); expect(data.winners).toEqual([[0], [1]]);
  for (const [index, profile] of data.profiles.entries()) {
    expect(profile.talents).toEqual(TRAINING_PROFILES[index].talents);
    for (const [i, plan] of plans.entries()) {
      const shot = analyzeShot(p.scenario, plan, 128, profile.talents);
      expect(profile.shots[i].successes).toEqual(shot.trialSuccesses);
      expect(profile.shots[i].count / 128).toBe(shot.successRate);
    }
  }
  for (const [index, plan] of plans.entries()) {
    const random = seededRandom(p.scenario.seed ^ 0x3A7B91);
    for (let i = 0; i < 128; i++) {
      const noise = perturbShot(plan, random, { anglePrecision: 0, strengthPrecision: 0, englishPrecision: 100, spinPrecision: 100 });
      for (const axis of ['aim', 'speed'] as const) {
        const changed = axis === 'aim' ? { ...plan, angle: noise.angle } : { ...plan, speed: noise.speed };
        const sim = simulateShot(p.scenario, changed, { record: false });
        expect(data.sensitivity[index][axis][i]).toBe(evaluateShotObjective(p.scenario, changed, sim).success);
      }
    }
  }
}, 60000);

it('keeps player scoring unchanged and reports ties and absent successes honestly', () => {
  const p = prepareRound(generateScenario(78, 78 * 919), { regenerate: false });
  const selection = { ballId: 1, optionId: p.balls[0].options[0].id };
  const withProfiles = analyzeRound(p, selection, { samples: 8 });
  const { playerProfiles, ...ordinary } = withProfiles;
  expect(playerProfiles?.switched).toBe(true);
  expect(ordinary).toEqual(analyzeRound({ ...p, scenario: { ...p.scenario, curriculum: undefined } }, selection, { samples: 8 }));
  expect(profileWinners([])).toEqual([]); expect(profileWinners([0, 0])).toEqual([]);
  expect(profileWinners([3, 3, 1])).toEqual([0, 1]); expect(profileWinners([1, 4, 2])).toEqual([1]);
}, 30000);

it('reflects the fixed training draws and preserves the demonstrated ranking in every orientation', () => {
  for (const seed of [0, 1, 5, 8]) {
    const p = prepareRound(generateScenario(78, seed), { regenerate: false });
    const data = comparePlayerProfiles(p.scenario, p.balls[0].options.map(o => o.plan));
    expect(data.winners).toEqual([[0], [1]]);
    expect(data.profiles.map(p => p.shots.map(s => s.count))).toEqual([[28, 19, 7], [60, 66, 0]]);
    expect(data.sensitivity.map(s => [s.aimCount, s.speedCount])).toEqual([[31, 53], [20, 68], [7, 0]]);
  }
}, 120000);
