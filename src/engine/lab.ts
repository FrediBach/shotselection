import { TALENT_DEFINITIONS } from './characters';
import { POCKETS, TABLE } from './constants';
import { distance, normalize, seededRandom, subtract } from './math';
import { simulateShot } from './physics';
import { validateSandboxLayout } from './sandbox';
import { perturbShot } from './stroke-errors';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Ball, CharacterTalents, ObjectBallTrial, Scenario, ShotAnalysis, ShotPlan, SimulationBall, Vec2 } from './types';

export const MAX_LAB_BALLS = 15;
export const MAX_LAB_VARIANTS = 16;
export const LAB_SHOT_LIMITS = {
  speed: { min: 0.1, max: 4 },
  topSpin: { min: -2, max: 2 },
  sideSpin: { min: -100, max: 100 },
  aimOffset: { min: -180, max: 180 },
} as const;

export interface LabShotSettings {
  ballId: number;
  pocketId: number;
  /** Cue speed in metres/second. */
  speed: number;
  /** Fraction of natural rolling spin, matching the simulator. */
  topSpin: number;
  /** English in radians/second. */
  sideSpin: number;
  /** Degrees from the geometric direct-pot aim, positive clockwise on the table. */
  aimOffset: number;
}

export type LabVariationAmounts = Pick<LabShotSettings, 'speed' | 'topSpin' | 'sideSpin' | 'aimOffset'>;

export const DEFAULT_LAB_VARIATION_AMOUNTS: LabVariationAmounts = {
  speed: 0.2, topSpin: 0.25, sideSpin: 5, aimOffset: 1,
};

export const DEFAULT_LAB_SHOT_SETTINGS: LabShotSettings = {
  ballId: 1, pocketId: 1, speed: 1.3, topSpin: 0, sideSpin: 0, aimOffset: 0,
};

export interface LabVariant { id: string; label: string; settings: LabShotSettings }
export interface LabRequest { scenario: Scenario; variants: LabVariant[]; samples: number; talents: CharacterTalents }
/** Failure counts overlap: a trial can miss and scratch, for example. */
export interface LabFailures {
  /** Nominated object ball never entered any pocket. */
  misses: number;
  /** First contact was another ball, or no object ball was contacted. */
  wrongContact: number;
  /** Nominated ball dropped, but into a different pocket. */
  wrongPocket: number;
  scratch: number;
  unsettled: number;
}
export interface LabShotAnalysis extends ShotAnalysis { failures: LabFailures }
export interface LabResult { scenario: Scenario; shots: LabShotAnalysis[]; samples: number }

/** A neutral table with no course objectives or automatically selected strokes. */
export function createLabScenario(seed = 71431): Scenario {
  if (!Number.isFinite(seed)) throw new Error('Choose a finite lab seed.');
  return {
    level: 1, seed, title: 'Lab mode',
    description: 'Place the balls, define your strokes, and compare repeated trials.',
    balls: [{ id: 0, position: { x: 1.27, y: 0.95 } }, { id: 1, position: { x: 1.27, y: 0.38 } }],
  };
}

/** Retain the cue and IDs 1..count; new balls occupy the first available grid spaces. */
export function resizeLabBalls(scenario: Scenario, count: number): Scenario {
  if (!Number.isInteger(count) || count < 1 || count > MAX_LAB_BALLS) {
    throw new Error(`Choose between 1 and ${MAX_LAB_BALLS} object balls.`);
  }
  const balls: Ball[] = scenario.balls.filter(ball => ball.id <= count)
    .map(ball => ({ id: ball.id, position: { ...ball.position } }));
  for (let id = 1; id <= count; id++) {
    if (balls.some(ball => ball.id === id)) continue;
    let position: Vec2 | undefined;
    for (let row = 0; row < 8 && !position; row++) {
      for (let column = 0; column < 17; column++) {
        const candidate = { x: 0.16 + column * 0.135, y: 0.16 + row * 0.135 };
        if (balls.every(ball => distance(ball.position, candidate) >= TABLE.ballDiameter + 0.01)) {
          position = candidate;
          break;
        }
      }
    }
    if (!position) throw new Error('Make room on the table before adding another ball.');
    balls.push({ id, position });
  }
  const resized = { ...scenario, balls: balls.sort((a, b) => a.id - b.id) };
  const error = validateSandboxLayout(resized);
  if (error) throw new Error(error);
  return resized;
}

function validateSettings(settings: LabShotSettings) {
  if (!Number.isInteger(settings.ballId) || settings.ballId < 1 || settings.ballId > MAX_LAB_BALLS) {
    throw new Error('Choose an object ball from 1 to 15.');
  }
  if (!POCKETS.some(pocket => pocket.id === settings.pocketId)) throw new Error('Choose one of the six pockets.');
  for (const key of Object.keys(LAB_SHOT_LIMITS) as (keyof typeof LAB_SHOT_LIMITS)[]) {
    const { min, max } = LAB_SHOT_LIMITS[key];
    if (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max) {
      throw new Error(`${key} must be between ${min} and ${max}.`);
    }
  }
}

/** Invalid layouts are rejected; blocked routes, poor cuts and misses are valid experiments. */
export function createLabShot(scenario: Scenario, settings: LabShotSettings, id: string, label: string): ShotPlan {
  const error = validateSandboxLayout(scenario);
  if (error) throw new Error(error);
  validateSettings(settings);
  const cue = scenario.balls.find(ball => ball.id === 0)!;
  const object = scenario.balls.find(ball => ball.id === settings.ballId);
  if (!object) throw new Error(`Place ball ${settings.ballId} on the table or choose another ball.`);
  const pocket = POCKET_GEOMETRY.find(candidate => candidate.id === settings.pocketId)!;
  const direction = normalize(subtract(pocket.center, object.position));
  const ghost = { x: object.position.x - direction.x * TABLE.ballDiameter, y: object.position.y - direction.y * TABLE.ballDiameter };
  return {
    id, label, ballId: settings.ballId, pocketId: settings.pocketId,
    target: { ...cue.position },
    angle: Math.atan2(ghost.y - cue.position.y, ghost.x - cue.position.x) + settings.aimOffset * Math.PI / 180,
    speed: settings.speed, topSpin: settings.topSpin, sideSpin: settings.sideSpin,
  };
}

/** `steps` counts all variants, including the unchanged start and end settings. */
export function generateLabVariants(start: LabShotSettings, end: LabShotSettings, steps: number): LabVariant[] {
  validateSettings(start);
  validateSettings(end);
  if (start.ballId !== end.ballId || start.pocketId !== end.pocketId) {
    throw new Error('A morph needs the same ball and pocket at both ends. Add separate options to compare different routes.');
  }
  if (!Number.isInteger(steps) || steps < 2 || steps > MAX_LAB_VARIANTS) {
    throw new Error(`Choose 2 to ${MAX_LAB_VARIANTS} steps, including both endpoints.`);
  }
  return Array.from({ length: steps }, (_, index) => {
    const fraction = index / (steps - 1);
    const settings = { ...start };
    for (const key of Object.keys(LAB_SHOT_LIMITS) as (keyof typeof LAB_SHOT_LIMITS)[]) {
      // Preserve exact endpoints rather than introducing floating-point drift.
      settings[key] = index === steps - 1 ? end[key] : start[key] + (end[key] - start[key]) * fraction;
    }
    return { id: `lab-step-${index + 1}`, label: `Step ${index + 1}`, settings };
  });
}

/** Compare the base stroke with independent decreases and increases of each enabled control. */
export function generateLabVariations(base: LabShotSettings, amounts: LabVariationAmounts): LabVariant[] {
  validateSettings(base);
  const controls = [
    { key: 'speed', label: 'Strength' },
    { key: 'topSpin', label: 'Draw / follow' },
    { key: 'sideSpin', label: 'Sidespin' },
    { key: 'aimOffset', label: 'Aim offset' },
  ] as const;
  for (const { key, label } of controls) {
    const { min, max } = LAB_SHOT_LIMITS[key];
    if (!Number.isFinite(amounts[key]) || amounts[key] < 0 || amounts[key] > max - min) {
      throw new Error(`${label} variation must be between 0 and ${max - min}.`);
    }
  }
  if (!controls.some(({ key }) => amounts[key] > 0)) {
    throw new Error('Set at least one variation amount above zero.');
  }
  const variants: LabVariant[] = [{ id: 'lab-variation-base', label: 'Base stroke', settings: { ...base } }];
  for (const { key, label } of controls) {
    const { min, max } = LAB_SHOT_LIMITS[key];
    for (const direction of [-1, 1]) {
      const boundary = direction < 0 ? min : max;
      const value = amounts[key] >= Math.abs(boundary - base[key])
        ? boundary : base[key] + direction * amounts[key];
      // Each variant changes only its own control, so unchanged values are the only possible duplicates.
      if (value === base[key]) continue;
      variants.push({
        id: `lab-variation-${key}-${direction < 0 ? 'minus' : 'plus'}`,
        label: `${label} ${direction < 0 ? '−' : '+'}`,
        settings: { ...base, [key]: value },
      });
    }
  }
  return variants;
}

function analyzeVariant(scenario: Scenario, plan: ShotPlan, samples: number, talents: CharacterTalents): LabShotAnalysis {
  const nominal = simulateShot(scenario, plan);
  // The same sequence of stroke errors is applied to every option. Changing a
  // label or option order therefore never changes its comparison probabilities.
  const random = seededRandom(scenario.seed ^ 0x3A7B91);
  const failures: LabFailures = { misses: 0, wrongContact: 0, wrongPocket: 0, scratch: 0, unsettled: 0 };
  const samplePaths: Vec2[][] = [];
  const sampleObjectPaths: ObjectBallTrial[] = [];
  const sampleEnds: Vec2[] = [];
  const sampleBallEnds: SimulationBall[][] = [];
  const trialSuccesses: boolean[] = [];
  let pots = 0;
  let successes = 0;
  for (let index = 0; index < samples; index++) {
    const simulation = simulateShot(scenario, perturbShot(plan, random, talents), { record: false, recordPaths: true });
    const capture = simulation.pocketEvents?.find(event => event.ballId === plan.ballId);
    const dropped = capture !== undefined;
    const nominatedPocket = capture?.pocketId === plan.pocketId;
    const correctContact = simulation.firstContact === plan.ballId;
    const pot = nominatedPocket && correctContact;
    const success = pot && !simulation.scratch && simulation.stopped;
    if (!dropped) failures.misses++;
    if (!correctContact) failures.wrongContact++;
    if (dropped && !nominatedPocket) failures.wrongPocket++;
    if (simulation.scratch) failures.scratch++;
    if (!simulation.stopped) failures.unsettled++;
    if (pot) pots++;
    if (success) successes++;
    trialSuccesses.push(success);
    sampleObjectPaths.push({ path: simulation.objectPath, outcome: success ? 'pot' : dropped ? 'foul' : 'miss' });
    sampleBallEnds.push(simulation.finalBalls);
    if (!simulation.scratch && simulation.stopped) sampleEnds.push(simulation.cueEnd);
    if (index < 24) samplePaths.push(simulation.cuePath);
  }
  const meanEnd = sampleEnds.length ? {
    x: sampleEnds.reduce((sum, point) => sum + point.x, 0) / sampleEnds.length,
    y: sampleEnds.reduce((sum, point) => sum + point.y, 0) / sampleEnds.length,
  } : nominal.cueEnd;
  const spread = sampleEnds.length
    ? Math.sqrt(sampleEnds.reduce((sum, point) => sum + distance(point, meanEnd) ** 2, 0) / sampleEnds.length)
    : Math.hypot(TABLE.length, TABLE.width);
  const successRate = successes / samples;
  return {
    plan, nominal, samples, failures, successRate, potRate: pots / samples, legalPotRate: successRate,
    targetQuality: successRate, scratchRate: failures.scratch / samples, positionRate: successRate,
    meanEnd, spread, samplePaths, sampleObjectPaths, sampleEnds, sampleBallEnds, trialSuccesses,
    trialLegalPots: [...trialSuccesses], score: successRate,
    explanation: `Success means ball ${plan.ballId} enters the ${POCKETS[plan.pocketId].name} pocket after correct first contact, without a scratch, and all balls settle. Failure counts can overlap.`,
  };
}

/** No preparation or feasibility filter: failures are the point of the lab. */
export function analyzeLab(request: LabRequest): LabResult {
  const { scenario, variants, samples, talents } = request;
  if (!Number.isFinite(scenario.seed)) throw new Error('Choose a finite lab seed.');
  if (!Number.isInteger(samples) || samples < 8 || samples > 128) throw new Error('Choose 8 to 128 trials per option.');
  if (variants.length < 1 || variants.length > MAX_LAB_VARIANTS) throw new Error(`Compare 1 to ${MAX_LAB_VARIANTS} options at a time.`);
  if (new Set(variants.map(variant => variant.id)).size !== variants.length || variants.some(variant => !variant.id.trim())) {
    throw new Error('Give every lab option a unique ID.');
  }
  for (const { key } of TALENT_DEFINITIONS) {
    if (!Number.isFinite(talents[key]) || talents[key] < 0 || talents[key] > 100) {
      throw new Error('Player precision must be between 0 and 100.');
    }
  }
  // Validate the whole comparison before starting any expensive simulations.
  const plans = variants.map(variant => createLabShot(scenario, variant.settings, variant.id, variant.label));
  return { scenario, shots: plans.map(plan => analyzeVariant(scenario, plan, samples, talents)), samples };
}
