import { directNextShotRoutes } from './objectives';
import { distance } from './math';
import type { Scenario, Simulation } from './types';

/** Relax only the next-cut limit. A route that reappears was excluded by
 * angle, not by an obstructed pocket line or an unreachable contact point. */
export function angleTrapEvidence(scenario: Scenario, simulation: Simulation) {
  const objective=scenario.objective!;
  const next=simulation.finalBalls.find(ball=>ball.id===objective.nextBallId);
  const permitted=directNextShotRoutes(scenario,simulation);
  const unrestricted=directNextShotRoutes({...scenario,objective:{...objective,maxCutAngle:89.9}},simulation);
  return { permitted, unrestricted, best:unrestricted[0] ?? null,
    distance:next&&!next.pocketed?distance(simulation.cueEnd,next.position):null };
}
