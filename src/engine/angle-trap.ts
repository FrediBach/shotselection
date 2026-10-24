import { directNextShotRoutes } from './objectives';
import { distance, dot, normalize, subtract } from './math';
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


/** A farther finish along the same post-contact direction, without a rebound. */
export function isOvershootPair(long: Simulation, short: Simulation) {
  if (long.cueRebounds?.length || short.cueRebounds?.length || !long.firstImpact || !short.firstImpact) return false;
  const longLeg=subtract(long.cueEnd,long.firstImpact.position),shortLeg=subtract(short.cueEnd,short.firstImpact.position);
  return dot(normalize(longLeg),normalize(shortLeg)) >= .95
    && distance(long.cueEnd,long.firstImpact.position) >= distance(short.cueEnd,short.firstImpact.position)+.12;
}

/** Polyline length of recorded cue samples; not an exact continuous integral. */
export function sampledCueTravel(sim: Simulation) {
  return sim.cuePath.reduce((sum,p,i)=>sum+(i?distance(p,sim.cuePath[i-1]):0),0);
}
