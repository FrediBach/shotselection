import { directNextShotRoutes } from './objectives';
import type { Scenario, Simulation } from './types';

/** Counterfactual changes only the spare balls in the settled layout. It does
 * not replay the opening shot or claim the geometric routes prove a pot. */
export function nextShotBlockerEvidence(scenario: Scenario, simulation: Simulation) {
  const objective = scenario.objective;
  const routes = directNextShotRoutes(scenario, simulation);
  const withoutSpareBalls = objective ? directNextShotRoutes(scenario, {
    ...simulation,
    finalBalls: simulation.finalBalls.filter(ball => ball.id === 0 || ball.id === objective.nextBallId || ball.id === objective.ballId),
  }) : [];
  const blockedRoutes = withoutSpareBalls.filter(route => !routes.some(actual => actual.pocketId === route.pocketId));
  return { routes, withoutSpareBalls, blockedRoutes };
}

export function postContactRebounds(simulation: Simulation) {
  return simulation.cueRebounds?.filter(event => !event.beforeContact) ?? [];
}
