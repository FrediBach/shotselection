import { directShotRoutes } from './objectives';
import { simulateShot } from './physics';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { distance } from './math';
import type { DirectShotRoute } from './objectives';
import type { Scenario, Simulation } from './types';

function settled(source: Scenario, simulation: Simulation): Scenario {
  return { level: source.level, seed: source.seed, title: 'Compare the next two balls', description: '', conditions: source.conditions,
    balls: simulation.finalBalls.filter(b => !b.pocketed).map(({ id, position }) => ({ id, position: { ...position } })) };
}
function* pots(scenario: Scenario, ballId: number, route: DirectShotRoute) {
  for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
    const plan = secondShotPlan(scenario, ballId, route, pace, spin);
    const simulation = simulateShot(scenario, plan, { record: false, recordPaths: true });
    if (secondShotPotted(ballId, simulation)) yield { scenario, plan, simulation, route, after: settled(scenario, simulation) };
  }
}

/** Compare complete 2→3 and 3→2 witnesses from ONE actual opening finish.
 * No exhaustive ranking or combined success probability is implied. */
export function steppingStoneEvidence(source: Scenario, opening: Simulation) {
  if (!source.objective || !secondShotPotted(1, opening)) return null;
  const scenario = settled(source, opening), cutLimit = source.objective.maxCutAngle;
  const cue = scenario.balls.find(b => b.id === 0), far = scenario.balls.find(b => b.id === 2), near = scenario.balls.find(b => b.id === 3);
  if (!cue || !far || !near) return null;
  // Preserve the starting geometry of the remaining balls, including spare 4.
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = scenario.balls.find(e => e.id === b.id);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const farDistance = distance(cue.position, far.position), nearDistance = distance(cue.position, near.position);
  if (farDistance < 1 || nearDistance > farDistance - .3) return null;
  const directRoutes = directShotRoutes(scenario.balls, 2, cutLimit);
  for (const nearRoute of directShotRoutes(scenario.balls, 3, cutLimit)) for (const first of pots(scenario, 3, nearRoute)) {
    const farAfter = first.after.balls.find(b => b.id === 2);
    if (!farAfter || distance(farAfter.position, far.position) > .001) continue;
    for (const finalRoute of directShotRoutes(first.after.balls, 2, cutLimit)) {
      const directRoute = directRoutes.find(r => r.pocketId === finalRoute.pocketId && r.cutAngle >= finalRoute.cutAngle + 8);
      if (!directRoute) continue;
      const directApproach = distance(cue.position, directRoute.ghost), viaApproach = distance(first.simulation.cueEnd, finalRoute.ghost);
      if (viaApproach > directApproach - .3) continue;
      const final = pots(first.after, 2, finalRoute).next().value;
      if (!final) continue;
      for (const directFirst of pots(scenario, 2, directRoute)) {
        if (!directFirst.after.balls.some(b => b.id === 3)) continue;
        for (const lastRoute of directShotRoutes(directFirst.after.balls, 3, cutLimit)) {
          const directFinal = pots(directFirst.after, 3, lastRoute).next().value;
          if (directFinal) return { scenario, farDistance, nearDistance, directApproach, viaApproach,
            direct: { first: directFirst, final: directFinal }, via: { first, final } };
        }
      }
    }
  }
  return null;
}
