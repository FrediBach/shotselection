import type { Scenario, Simulation } from './types';

/** Match the required ordered contacts without inventing missing transfers.
 * Snapshots are captured at collision dispatch, before the solver step. */
export function contactChainReplay(source: Scenario, simulation: Simulation) {
  const required = source.trick?.requiredContacts ?? [];
  const events = simulation.contactEvents ?? [];
  const steps: { pair: [number, number]; event: typeof events[number] }[] = [];
  let cursor = 0;
  for (const pair of required) {
    const index = events.findIndex((event, i) => i >= cursor && pair.every(id => event.ballIds.includes(id)));
    if (index < 0 || !events[index].balls) break;
    steps.push({ pair, event: events[index] });
    cursor = index + 1;
  }
  return { steps, complete: required.length > 0 && steps.length === required.length };
}
