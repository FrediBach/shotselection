import { TABLE } from './constants';
import { distance } from './math';
import { kickSequenceEvidence } from './kick-sequence';
import { simulateShot } from './physics';
import type { FinishOption, Scenario, ShotPlan, Simulation } from './types';
export interface KickErrorExperiment { referenceId: string; reference: Simulation; radians: number; minusPlan: ShotPlan; plusPlan: ShotPlan; minus: Simulation; plus: Simulation }
const rail = (p: { x: number; y: number }) => {
  const gaps = [Math.abs(p.x - TABLE.ballRadius), Math.abs(p.x - TABLE.length + TABLE.ballRadius), Math.abs(p.y - TABLE.ballRadius), Math.abs(p.y - TABLE.width + TABLE.ballRadius)];
  return gaps.indexOf(Math.min(...gaps));
};
/** Match physical event positions, not frames at equal elapsed times. */
export function kickErrorCheckpoints(s: Simulation) {
  const rebounds = s.cueRebounds?.filter(r => r.beforeContact), contact = s.firstImpact;
  if (!s.stopped || s.firstContact !== 1 || !contact || contact.ballId !== 1 || rebounds?.length !== 2 || s.cueBanksBeforeContact !== 2
    || rebounds[0].time >= rebounds[1].time || rebounds[1].time >= contact.time) return null;
  const positions = [...rebounds.map(r => r.position), contact.position];
  const indices = positions.map(p => s.cueApproachPath.findIndex(v => distance(p, v) < 1e-9));
  if (indices[0] < 1 || indices[1] <= indices[0] || indices[2] <= indices[1]) return null;
  return { positions, rebounds, contact, path: s.cueApproachPath.slice(0, indices[2] + 1) };
}
export function kickErrorEvidence(source: Scenario, plan: ShotPlan, x: KickErrorExperiment) {
  if (!kickSequenceEvidence(source, x.reference) || !Number.isFinite(x.radians) || x.radians <= 0 || x.radians > Math.PI / 180
    || JSON.stringify(x.minusPlan) !== JSON.stringify({ ...plan, angle: plan.angle - x.radians })
    || JSON.stringify(x.plusPlan) !== JSON.stringify({ ...plan, angle: plan.angle + x.radians })) return null;
  const reference = kickErrorCheckpoints(x.reference), minus = kickErrorCheckpoints(x.minus), plus = kickErrorCheckpoints(x.plus);
  if (!reference || !minus || !plus || [minus, plus].some(v => v.rebounds.some((r, i) => rail(r.position) !== rail(reference.rebounds[i].position)))) return null;
  const spreads = minus.positions.map((p, i) => distance(p, plus.positions[i]));
  const growth = spreads.map((v, i) => v - (i ? spreads[i - 1] : 0));
  const sorted = growth.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  if (spreads.some(v => !Number.isFinite(v)) || sorted[0].v < .002 || sorted[0].v - sorted[1].v < .001) return null;
  return { reference, minus, plus, spreads, growth, largest: sorted[0].i };
}
export function kickErrorExperiment(source: Scenario, options: FinishOption[]): KickErrorExperiment | null {
  for (const option of options) {
    const reference = simulateShot(source, option.plan, { record: false, recordPaths: true });
    if (!kickSequenceEvidence(source, reference)) continue;
    for (const degrees of [.1, .05, .15, .2, .025]) {
      const radians = degrees * Math.PI / 180, minusPlan = { ...option.plan, angle: option.plan.angle - radians }, plusPlan = { ...option.plan, angle: option.plan.angle + radians };
      const minus = simulateShot(source, minusPlan, { record: false, recordPaths: true }), plus = simulateShot(source, plusPlan, { record: false, recordPaths: true });
      const x = { referenceId: option.id, reference, radians, minusPlan, plusPlan, minus, plus };
      if (kickErrorEvidence(source, option.plan, x)) return x;
    }
  }
  return null;
}
