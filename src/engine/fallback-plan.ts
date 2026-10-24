import { directShotRoutes } from './objectives';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import { distance } from './math';
import type { Opening } from './look-ahead';
import type { Scenario, Simulation } from './types';

/** Count every remaining object ball, using both clear corridors and the lesson cut limit. */
export function fallbackEvidence(source: Scenario, opening: Simulation) {
  if (!source.objective || !secondShotPotted(1, opening)) return null;
  const scenario: Scenario = { level: source.level, seed: source.seed, title: 'Alternative next balls', description: '', conditions: source.conditions,
    balls: opening.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = scenario.balls.find(e => e.id === b.id);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const choices = scenario.balls.filter(b => b.id > 1).map(b => ({ ballId: b.id, routes: directShotRoutes(scenario.balls, b.id, source.objective!.maxCutAngle) }));
  return { scenario, choices, available: choices.filter(c => c.routes.length > 0) };
}
function proofs(evidence: NonNullable<ReturnType<typeof fallbackEvidence>>) {
  const witnesses = evidence.available.map(choice => {
    for (const route of choice.routes) for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = secondShotPlan(evidence.scenario, choice.ballId, route, pace, spin);
      const simulation = simulateShot(evidence.scenario, plan, { record: false, recordPaths: true });
      if (secondShotPotted(choice.ballId, simulation)) return { ballId: choice.ballId, route, plan, simulation };
    }
    return null;
  });
  return witnesses.every(w => w !== null) ? witnesses : null;
}

/** Independent alternative pots from each actual finish, never a sequential 2→3 proof. */
export function fallbackPairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof fallbackEvidence>>();
  const proofCache = new Map<Opening, ReturnType<typeof proofs>>();
  const evidence = (e: Opening) => {
    if (!cache.has(e)) cache.set(e, fallbackEvidence(source, e.simulation));
    return cache.get(e)!;
  };
  const verified = (e: Opening) => {
    if (!proofCache.has(e)) proofCache.set(e, proofs(evidence(e)!));
    return proofCache.get(e)!;
  };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const narrow of entries) {
      const single = evidence(narrow);
      if (!single || single.available.length !== 1 || single.available[0].ballId !== 2 || single.available[0].routes.length !== 1
        || single.available[0].routes[0].cutAngle < source.objective.maxCutAngle - 8) continue;
      for (const flexible of entries) {
        const multiple = evidence(flexible);
        if (!multiple || multiple.available.length !== 2 || !multiple.available.some(c => c.ballId === 2)) continue;
        const gap = distance(narrow.simulation.cueEnd, flexible.simulation.cueEnd);
        if (narrow.plan.pocketId !== flexible.plan.pocketId || gap < .12 || gap > source.objective.radius * 1.9
          || Math.max(narrow.plan.speed, flexible.plan.speed) / Math.min(narrow.plan.speed, flexible.plan.speed) > 1.7) continue;
        const target = source.objective.target ?? { x: (narrow.simulation.cueEnd.x + flexible.simulation.cueEnd.x) / 2, y: (narrow.simulation.cueEnd.y + flexible.simulation.cueEnd.y) / 2 };
        if ([narrow, flexible].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius)) continue;
        const singleProofs = verified(narrow), multipleProofs = verified(flexible);
        if (singleProofs && multipleProofs) return { narrow, flexible, target, single: { ...single, proofs: singleProofs }, multiple: { ...multiple, proofs: multipleProofs } };
      }
    }
    return null;
  };
}
