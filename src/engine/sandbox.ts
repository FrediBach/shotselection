import { TABLE } from './constants';
import { COURSE_CHAPTERS, TOTAL_LEVELS } from './course';
import { distance, normalize, seededRandom, segmentDistance, subtract } from './math';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { isPocketed, RAILS } from './table-geometry';
import type { PreparedRound, Scenario } from './types';

/** Scenario choice is independent of course progress; every variation is open. */
export const SANDBOX_SCENARIOS = COURSE_CHAPTERS.map(chapter => ({
  id: chapter.id,
  title: chapter.title,
  description: chapter.description,
  lessons: Array.from({ length: chapter.lastLevel - chapter.firstLevel + 1 }, (_, index) => {
    const level = chapter.firstLevel + index;
    return { level, title: generateScenario(level, 0).title };
  }),
}));

export interface SandboxRequest {
  scenario: Scenario;
  placement: 'random' | 'manual';
}

/** Start with the selected teaching problem, keeping its scoring parameters. */
export function createSandboxScenario(level: number, seed = 71431 + level * 919): Scenario {
  if (!Number.isInteger(level) || level < 1 || level > TOTAL_LEVELS) {
    throw new Error('Choose one of the available sandbox scenarios.');
  }
  return generateScenario(level, seed);
}

/** Cheap geometry checks run before the worker spends time finding shots. */
export function validateSandboxLayout(scenario: Scenario): string | null {
  if (!scenario.balls.some(ball => ball.id === 0)) return 'Place the white cue ball on the table.';
  if (scenario.balls.length < 2) return 'Place at least one object ball on the table.';
  const ids = new Set<number>();
  for (const ball of scenario.balls) {
    if (!Number.isInteger(ball.id) || ball.id < 0 || ball.id > 15 || ids.has(ball.id)) {
      return 'Every ball needs a unique number from 0 (the cue ball) to 15.';
    }
    ids.add(ball.id);
    const { x, y } = ball.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < TABLE.ballRadius || x > TABLE.length - TABLE.ballRadius
      || y < TABLE.ballRadius || y > TABLE.width - TABLE.ballRadius) {
      return `${ball.id === 0 ? 'The cue ball' : `Ball ${ball.id}`} must fit fully inside the playing surface.`;
    }
    if (isPocketed(ball.position) || RAILS.some(rail => segmentDistance(ball.position, rail.a, rail.b) < TABLE.ballRadius - 1e-8)) {
      return `Move ${ball.id === 0 ? 'the cue ball' : `ball ${ball.id}`} clear of the pocket or cushion.`;
    }
  }
  for (let first = 0; first < scenario.balls.length - 1; first++) {
    for (let second = first + 1; second < scenario.balls.length; second++) {
      const a = scenario.balls[first];
      const b = scenario.balls[second];
      if (distance(a.position, b.position) < TABLE.ballDiameter - 1e-8) {
        const name = (id: number) => id === 0 ? 'the cue ball' : `ball ${id}`;
        return `Separate ${name(a.id)} and ${name(b.id)} so they do not overlap.`;
      }
    }
  }
  return null;
}

function clearLandingZone(scenario: Scenario): Scenario {
  // The zone is a result of preparation. Editing balls must establish a new
  // reachable zone, while preserving the objective's ball roles and difficulty.
  if (!scenario.objective) return scenario;
  const objective = { ...scenario.objective };
  delete objective.target;
  delete objective.regions;
  return { ...scenario, objective };
}

/** A failed manual search never falls back to a different table. Random mode
 * tests new tables before trying variations of the selected problem. */
export function prepareSandboxRound(request: SandboxRequest): PreparedRound {
  if (request.placement === 'manual') {
    const error = validateSandboxLayout(request.scenario);
    if (error) throw new Error(error);
    try {
      return prepareRound(clearLandingZone(request.scenario), { regenerate: false, expandDirectSearch: true });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('No feasible')) {
        throw new Error('The engine could not find three playable finishes for this setup. Move the balls and try again.');
      }
      throw error;
    }
  }
  if (request.placement !== 'random') throw new Error('Choose random or manual ball placement.');
  const base = createSandboxScenario(request.scenario.level, request.scenario.seed);
  const random = seededRandom((base.seed ^ 0x6D2B79F5) >>> 0);
  // Set-up tricks depend on the authored object-ball alignment. Vary the cue's
  // approach distance instead, preserving the line and complete trick contract.
  // Cushion-first tricks use the bank search, which derives its own aim line.
  // Angled plant delivery also preserves the aligned object pair while varying
  // the cue's approach; the lesson evidence still verifies the resulting cut.
  const plantDelivery = ['plant-delivery', 'plant-throw'].includes(base.curriculum?.learning?.comparison ?? '');
  const approachTarget = plantDelivery ? base.balls.find(ball => ball.id === base.plant!.ballId)!.position : base.trick?.aim;
  const approach = ((base.trick && !base.bank) || plantDelivery) && approachTarget
    ? normalize(subtract(approachTarget, base.balls.find(ball => ball.id === 0)!.position)) : null;
  // Other lessons try a full-table arrangement and a substantial shift first,
  // narrowing around the teaching layout when precise bank/plant lines need it.
  const spread = base.bank ? 0.008 : base.plant ? 0.025 : 0.085;
  // The symmetry lesson varies cue depth while preserving its symmetric
  // object pair and lateral cue offset, just as tricks preserve their chain.
  const symmetricCue = base.curriculum?.learning?.comparison === 'off-center-cue';
  const shifts = approach || symmetricCue ? [0.12, 0.08, 0.04, 0.02, 0.005]
    : [null, base.bank ? 0.12 : 0.35, ...[1, 0.65, 0.35, 0.15, 0.05, 0.01].map(scale => spread * scale)];
  // Matched contact states, displaced blockers and route boundaries can require a finer
  // variation after the broader random layouts have exhausted their search.
  if (base.curriculum?.learning?.comparison === 'player-profile' || base.curriculum?.learning?.comparison === 'angle-travel' || base.curriculum?.learning?.comparison === 'moving-traffic' || base.curriculum?.learning?.comparison === 'corridor-center' || base.curriculum?.learning?.comparison === 'english-routing' || base.curriculum?.learning?.comparison === 'elongated-position' || base.curriculum?.learning?.comparison === 'two-object-bank') shifts.push(0.000085, 0.0000085);
  for (const shift of shifts) {
    const margin = TABLE.ballDiameter * 1.5;
    const cueShift = (approach || symmetricCue) && shift !== null ? (random() < 0.5 ? -1 : 1) * shift * (0.5 + random() * 0.5) : 0;
    const scenario: Scenario = {
      ...base,
      balls: base.balls.map(ball => ({
        ...ball,
        position: symmetricCue
          ? ball.id === 0 ? { x: ball.position.x, y: ball.position.y + cueShift } : { ...ball.position }
          : approach
          ? ball.id === 0
            ? { x: ball.position.x + approach.x * cueShift, y: ball.position.y + approach.y * cueShift }
            : { ...ball.position }
          : shift === null
          ? { x: margin + random() * (TABLE.length - margin * 2), y: margin + random() * (TABLE.width - margin * 2) }
          : { x: ball.position.x + (random() * 2 - 1) * shift, y: ball.position.y + (random() * 2 - 1) * shift },
      })),
    };
    if (validateSandboxLayout(scenario)) continue;
    try {
      return prepareRound(scenario, { regenerate: false });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('No feasible')) throw error;
    }
  }
  throw new Error('The engine could not prepare a playable variation. Try another random layout or adjust the balls yourself.');
}
