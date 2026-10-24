import { distance } from './math';
import type { Scenario, Simulation } from './types';

/** Label recorded cue-ball events, never an idealized mirror-table bounce. */
export function kickIntroductionEvidence(source: Scenario, simulation: Simulation) {
  const bank = source.bank, contact = simulation.firstImpact;
  const rebounds = simulation.cueRebounds?.filter(r => r.beforeContact) ?? [];
  if (!bank || !simulation.stopped || simulation.scratch || simulation.firstContact !== bank.ballId
    || !simulation.potted.includes(bank.ballId) || !contact || contact.ballId !== bank.ballId
    || rebounds.length < bank.minCushions || simulation.cueBanksBeforeContact !== rebounds.length
    || rebounds.some(r => r.time >= contact.time)) return null;
  const first = rebounds[0];
  const index = simulation.cueApproachPath.findIndex(p => distance(p, first.position) < 1e-9);
  if (index < 1) return null;
  return { first, contact, rebounds, incoming: simulation.cueApproachPath.slice(0, index + 1),
    outgoing: [...simulation.cueApproachPath.slice(index), contact.position] };
}
