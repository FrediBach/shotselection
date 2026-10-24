import { kickIntroductionEvidence } from './kick-introduction';
import { distance } from './math';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, Simulation } from './types';

export interface KickSequencePreview { referenceId: string; simulation: Simulation }
/** Split the recorded approach at its two real rebounds, preserving their order. */
export function kickSequenceEvidence(source: Scenario, simulation: Simulation) {
  const base = kickIntroductionEvidence(source, simulation);
  if (!base || source.bank?.minCushions !== 2 || base.rebounds.length !== 2) return null;
  const [first, second] = base.rebounds;
  const i = simulation.cueApproachPath.findIndex(p => distance(p, first.position) < 1e-9);
  const j = simulation.cueApproachPath.findIndex(p => distance(p, second.position) < 1e-9);
  if (j <= i || first.time >= second.time || distance(first.position, second.position) < .2) return null;
  const legs = [simulation.cueApproachPath.slice(0, i + 1), simulation.cueApproachPath.slice(i, j + 1),
    [...simulation.cueApproachPath.slice(j), base.contact.position]];
  // A/B names follow table position, not chronological order, so the prediction asks for a trace.
  const firstIsA = first.position.x < second.position.x || (first.position.x === second.position.x && first.position.y < second.position.y);
  return { first, second, contact: base.contact, legs, order: firstIsA ? 'A → B' : 'B → A',
    firstLabel: firstIsA ? 'A' : 'B', secondLabel: firstIsA ? 'B' : 'A' };
}
export function kickSequencePreview(source: Scenario, options: FinishOption[]): KickSequencePreview | null {
  for (const option of options) {
    const simulation = simulateShot(source, option.plan, { record: false, recordPaths: true });
    if (kickSequenceEvidence(source, simulation)) return { referenceId: option.id, simulation };
  }
  return null;
}
