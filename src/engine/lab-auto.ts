import { POCKETS, TABLE } from './constants';
import { createLabShot, DEFAULT_LAB_SHOT_SETTINGS, LAB_SHOT_LIMITS } from './lab';
import type { LabShotSettings, LabVariant } from './lab';
import { clamp, distance, dot, normalize, segmentDistance, subtract } from './math';
import { simulateShot } from './physics';
import { validateSandboxLayout } from './sandbox';
import { POCKET_GEOMETRY } from './table-geometry';
import type { Scenario, Simulation } from './types';

export type LabShotLocks = Partial<Record<keyof LabShotSettings, boolean>>;
export interface LabAutoRequest { scenario: Scenario; variant: LabVariant; locks: LabShotLocks }
export interface LabAutoResult {
  status: 'found' | 'not-found';
  settings: LabShotSettings;
  changed: (keyof LabShotSettings)[];
  attempts: number;
  message: string;
}

/** A deterministic search limit, not a claim of exhaustive feasibility. */
export const MAX_LAB_AUTO_ATTEMPTS = 1600;
const KEYS = ['ballId', 'pocketId', 'speed', 'topSpin', 'sideSpin', 'aimOffset'] as const;
const NUMERIC_KEYS = ['speed', 'topSpin', 'sideSpin', 'aimOffset'] as const;
interface Route { ballId: number; pocketId: number; speed: number; cut: number; approach: number; difficulty: number }

function normalizePreferences(request: LabAutoRequest): LabShotSettings {
  const { scenario, variant, locks } = request;
  const error = validateSandboxLayout(scenario);
  if (error) throw new Error(error);
  const settings = { ...variant.settings };
  if (!locks.ballId && !scenario.balls.some(ball => ball.id > 0 && ball.id === settings.ballId)) {
    settings.ballId = scenario.balls.filter(ball => ball.id > 0).sort((a, b) => a.id - b.id)[0].id;
  }
  if (!locks.pocketId && !POCKETS.some(pocket => pocket.id === settings.pocketId)) settings.pocketId = DEFAULT_LAB_SHOT_SETTINGS.pocketId;
  for (const key of NUMERIC_KEYS) {
    const limits = LAB_SHOT_LIMITS[key];
    if (!locks[key] && (!Number.isFinite(settings[key]) || settings[key] < limits.min || settings[key] > limits.max)) {
      settings[key] = DEFAULT_LAB_SHOT_SETTINGS[key];
    }
  }
  // Invalid locked values are rejected, never silently repaired.
  createLabShot(scenario, settings, variant.id, variant.label);
  return settings;
}

function routesFor(scenario: Scenario, settings: LabShotSettings, locks: LabShotLocks): Route[] {
  const cue = scenario.balls.find(ball => ball.id === 0)!.position;
  const routes: Route[] = [];
  for (const ball of scenario.balls.filter(ball => ball.id > 0 && (!locks.ballId || ball.id === settings.ballId))) {
    for (const pocket of POCKET_GEOMETRY.filter(pocket => !locks.pocketId || pocket.id === settings.pocketId)) {
      const direction = normalize(subtract(pocket.center, ball.position));
      const ghost = { x: ball.position.x - direction.x * TABLE.ballDiameter, y: ball.position.y - direction.y * TABLE.ballDiameter };
      const approach = distance(cue, ghost);
      const cut = dot(direction, normalize(subtract(ghost, cue)));
      const objectDistance = distance(ball.position, pocket.center);
      const blocked = scenario.balls.some(other => other.id !== 0 && other.id !== ball.id
        && (segmentDistance(other.position, cue, ghost) < TABLE.ballDiameter * 1.025
          || segmentDistance(other.position, ball.position, pocket.center) < TABLE.ballDiameter * 1.025));
      routes.push({ ballId: ball.id, pocketId: pocket.id, cut, approach,
        speed: clamp(Math.sqrt(2 * TABLE.rollingFriction * 9.80665 * (objectDistance + 0.13)) / (0.71 * Math.max(0.17, cut)) + approach * 0.2, 0.4, 4),
        // Obstructions only rank the search: they never alter the layout.
        difficulty: approach * 0.15 + objectDistance * 0.18 + (1 - cut) * 0.8 + (blocked ? 8 : 0) + (cut < 0.17 ? 8 : 0),
      });
    }
  }
  return routes.sort((a, b) => a.difficulty - b.difficulty || a.ballId - b.ballId || a.pocketId - b.pocketId);
}

function values(key: 'speed' | 'topSpin' | 'sideSpin', preferred: number, candidates: number[], locks: LabShotLocks): number[] {
  if (locks[key]) return [preferred];
  const { min, max } = LAB_SHOT_LIMITS[key];
  return [...new Set([preferred, ...candidates.map(value => Math.round(clamp(value, min, max) * 10000) / 10000)])]
    .sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
}

function strokesFor(route: Route, preferred: LabShotSettings, locks: LabShotLocks): LabShotSettings[] {
  const speeds = values('speed', preferred.speed, [preferred.speed - 0.15, preferred.speed + 0.15,
    preferred.speed - 0.35, preferred.speed + 0.35, preferred.speed - 0.7, preferred.speed + 0.7,
    route.speed, route.speed * 1.3, 0.4, 0.7, 1, 1.4, 2, 2.8, 3.4, 4], locks);
  const tops = values('topSpin', preferred.topSpin, [0, preferred.topSpin - 0.35, preferred.topSpin + 0.35, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2], locks);
  const sides = values('sideSpin', preferred.sideSpin, [0, preferred.sideSpin - 15, preferred.sideSpin + 15, -20, 20, -40, 40, -70, 70, -100, 100], locks);
  const strokes: { settings: LabShotSettings; cost: number }[] = [];
  for (const speed of speeds) for (const topSpin of tops) for (const sideSpin of sides) {
    const settings = { ...preferred, ballId: route.ballId, pocketId: route.pocketId, speed, topSpin, sideSpin };
    const cost = Math.abs(speed - preferred.speed) + Math.abs(topSpin - preferred.topSpin) * 0.65
      + Math.abs(sideSpin - preferred.sideSpin) / 60;
    strokes.push({ settings, cost });
  }
  return strokes.sort((a, b) => a.cost - b.cost).map(stroke => stroke.settings);
}

function playable(simulation: Simulation, settings: LabShotSettings): boolean {
  return simulation.firstContact === settings.ballId && !simulation.scratch && simulation.stopped
    && simulation.pocketEvents!.some(event => event.ballId === settings.ballId && event.pocketId === settings.pocketId);
}

/** Fit nominal physical strokes while retaining every locked input exactly.
 * Probability comparison remains a separate ensemble calculation. */
export function fitLabShot(request: LabAutoRequest): LabAutoResult {
  const { scenario, variant, locks } = request;
  const preferred = normalizePreferences(request);
  const routes = routesFor(scenario, preferred, locks);
  const current = routes.find(route => route.ballId === preferred.ballId && route.pocketId === preferred.pocketId)!;
  let attempts = 0;
  let found: LabShotSettings | undefined;
  const cache = new Map<string, Simulation>();

  function foundResult(settings: LabShotSettings): LabAutoResult {
    const changed = KEYS.filter(key => settings[key] !== variant.settings[key]);
    return { status: 'found', settings, changed, attempts,
      message: changed.length ? 'Playable shot found. Locked values were kept; compare trials to see its probability.'
        : 'This shot already works in the nominal simulation. Compare trials to see its probability.' };
  }

  function simulate(settings: LabShotSettings): Simulation | undefined {
    const key = KEYS.map(field => settings[field]).join(',');
    const cached = cache.get(key);
    if (cached) return cached;
    if (attempts >= MAX_LAB_AUTO_ATTEMPTS) return;
    const plan = createLabShot(scenario, settings, variant.id, variant.label);
    const simulation = simulateShot(scenario, plan, { record: false, recordContacts: !locks.aimOffset });
    attempts++;
    cache.set(key, simulation);
    if (playable(simulation, settings)) found = { ...settings };
    return simulation;
  }

  function tryStroke(settings: LabShotSettings, route: Route, fine = false) {
    const angles = locks.aimOffset ? [preferred.aimOffset] : [...new Set([preferred.aimOffset, 0])];
    for (const aimOffset of angles) {
      let trial = { ...settings, aimOffset };
      for (let iteration = 0; iteration < (locks.aimOffset ? 1 : 4); iteration++) {
        const simulation = simulate(trial);
        if (!simulation || found) return;
        // Use the actual first collision to compensate throw; do not assume
        // that a geometric ghost-ball aim will pot with arbitrary spin.
        const contact = simulation.contactEvents?.find(event => event.ballIds.includes(0) && event.ballIds.includes(settings.ballId));
        if (simulation.firstContact !== settings.ballId || !contact?.outgoing || simulation.cueBanksBeforeContact) break;
        const index = contact.ballIds.indexOf(settings.ballId);
        const outgoing = contact.outgoing[index];
        if (Math.hypot(outgoing.x, outgoing.y) < 0.03) break;
        const desired = subtract(POCKET_GEOMETRY[settings.pocketId].center, contact.positions[index]);
        const error = Math.atan2(desired.x * outgoing.y - desired.y * outgoing.x, dot(desired, outgoing));
        const correction = clamp(error * TABLE.ballDiameter * Math.max(0.15, route.cut) / Math.max(0.08, route.approach) * 180 / Math.PI, -3, 3);
        if (Math.abs(correction) < 0.0005) break;
        trial = { ...trial, aimOffset: clamp(Math.round((trial.aimOffset + correction) * 100000) / 100000, -180, 180) };
      }
    }
    if (!fine || locks.aimOffset) return;
    // A small fallback sweep covers jaw edges and discrete collision steps
    // where the local throw correction is not smooth.
    for (const aimOffset of [0.04, -0.04, 0.1, -0.1, 0.2, -0.2, 0.4, -0.4, 0.7, -0.7, 1.2, -1.2, 2, -2]) {
      simulate({ ...settings, aimOffset });
      if (found || attempts >= MAX_LAB_AUTO_ATTEMPTS) return;
    }
  }

  // Even a deliberately banked stroke gets checked before direct-route search.
  simulate(preferred);
  if (found) return foundResult(found);
  const currentStrokes = strokesFor(current, preferred, locks);
  // Preserve the player's route when a nearby numeric adjustment suffices.
  let initialCount = 0;
  while (initialCount < Math.min(currentStrokes.length, 64) && !found && attempts < 240) {
    tryStroke(currentStrokes[initialCount], current, initialCount < 3);
    initialCount++;
  }
  if (found) return foundResult(found);
  const alternatives = routes.filter(route => route !== current);
  // Give each other allowed route an inexpensive chance before deepening.
  for (const route of alternatives) {
    if (found || attempts >= MAX_LAB_AUTO_ATTEMPTS) break;
    tryStroke({ ...preferred, ballId: route.ballId, pocketId: route.pocketId }, route);
  }
  if (found) return foundResult(found);
  // Round-robin the useful direct routes so one blocked route cannot consume
  // all remaining attempts. Keep the current route even if geometry is poor.
  const useful = [current, ...alternatives.filter(route => route.difficulty < 8)]
    .map(route => ({ route, strokes: route === current ? currentStrokes : strokesFor(route, preferred, locks) }));
  for (let index = 0; !found && attempts < MAX_LAB_AUTO_ATTEMPTS; index++) {
    let remaining = false;
    for (const { route, strokes } of useful) {
      const strokeIndex = route === current ? initialCount + index : index + 1;
      if (strokeIndex >= strokes.length) continue;
      remaining = true;
      tryStroke(strokes[strokeIndex], route, index % 12 === 0);
      if (found || attempts >= MAX_LAB_AUTO_ATTEMPTS) break;
    }
    if (!remaining) break;
  }
  if (!found) return { status: 'not-found', settings: { ...variant.settings }, changed: [], attempts,
    message: 'No playable shot found with these locks in the bounded search. Try unlocking a value or moving a ball.' };
  return foundResult(found);
}
