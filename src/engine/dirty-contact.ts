import { simulateShot } from './physics';
import { clamp, distance } from './math';
import type { Scenario, ShotPlan, Simulation } from './types';

/** Remove contact dirt while preserving the original global cloth drag. */
export function compareDirtyContact(source: Scenario, plan: ShotPlan, dirty: Simulation) {
  const dirt = clamp(source.conditions?.dirt ?? 0, 0, 1);
  // This lesson isolates a global dirt effect, without local/clamped friction.
  if (!dirt || source.conditions?.patches?.length || (source.conditions?.cloth ?? 1) * (1 + .15 * dirt) > 6 || (source.conditions?.cloth ?? 1) < .2) return null;
  const clean: Scenario = { ...source, conditions: { ...source.conditions!, dirt: 0, cloth: (source.conditions?.cloth ?? 1) * (1 + .15 * dirt) } };
  const comparison = simulateShot(clean, plan, { recordContacts: true });
  const contact = (sim: Simulation) => sim.contactEvents?.find(e => e.ballIds.includes(0) && e.ballIds.includes(plan.ballId));
  const first = contact(dirty), second = contact(comparison);
  if (!first?.balls || !second?.balls || !first.outgoing || !second.outgoing || Math.abs(first.time - second.time) > 1e-8) return null;
  for (const id of [0, plan.ballId]) {
    const a = first.ballIds.indexOf(id), b = second.ballIds.indexOf(id);
    if (distance(first.positions[a], second.positions[b]) > 1e-8 || distance(first.incoming[a], second.incoming[b]) > 1e-8) return null;
  }
  const variants = [
    { label: 'Dirty contact', scenario: source, simulation: dirty, contact: first },
    { label: 'Clean contact', scenario: clean, simulation: comparison, contact: second },
  ].map(v => {
    const outgoing = v.contact.outgoing![v.contact.ballIds.indexOf(plan.ballId)];
    return { ...v, outgoing, speed: Math.hypot(outgoing.x, outgoing.y), direction: Math.atan2(outgoing.y, outgoing.x) };
  });
  if (variants.some(v => !Number.isFinite(v.speed) || v.speed <= 0)) return null;
  const angle = variants[0].direction - variants[1].direction;
  return { variants, angleDifference: Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) * 180 / Math.PI,
    speedDifference: variants[1].speed - variants[0].speed };
}
