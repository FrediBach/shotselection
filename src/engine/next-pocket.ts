import { directNextShotRoutes, evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Verify the declared pocket against the settled layout, independently of the
 * ordinary objective's any-permitted-pocket rule. Never changes the simulation. */
export function nextPocketEvidence(scenario: Scenario, plan: ShotPlan, sim: Simulation, pocketId: number) {
 const routes=directNextShotRoutes(scenario,sim);
 const intended=routes.find(route=>route.pocketId===pocketId)??null;
 const objective=evaluateShotObjective(scenario,plan,sim);
 return {intended,routes,objective,planMet:objective.legalPot&&objective.positioned&&Boolean(intended)};
}
