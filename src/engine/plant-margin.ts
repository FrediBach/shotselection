import { distance } from './math';
import { plantLineGeometry } from './plant-line';
import { simulateShot } from './physics';
import { POCKET_GEOMETRY } from './table-geometry';
import type { FinishOption, Scenario, ShotPlan, Simulation, Vec2 } from './types';
export const MARGIN_STEP = .025;
export const MARGIN_STEPS = 16;
export interface PlantMarginExperiment {
  referenceId: string; shift: Vec2;
  samples: { degrees: number; centeredPot: boolean; offsetPot: boolean }[];
  witnessDegrees: number;
  centeredNominal: Simulation; offsetNominal: Simulation; centeredWitness: Simulation; offsetWitness: Simulation;
}
export function centeredPlant(source: Scenario) {
  const geometry = plantLineGeometry(source);
  if (!geometry || !source.plant) return null;
  const shift = { x: geometry.pocket.mouthCenter.x - geometry.hit.x, y: geometry.pocket.mouthCenter.y - geometry.hit.y };
  const ids = [0, source.plant.ballId, source.plant.targetBallId];
  return { shift, scenario: { ...source, balls: source.balls.map(b => ids.includes(b.id) ? { ...b, position: { x: b.position.x + shift.x, y: b.position.y + shift.y } } : b) } };
}
/** Target-pot acceptance only: deliberately independent of cue-ball finish and scratch. */
export function plantTargetPotted(source: Scenario, s: Simulation) {
  const plant = source.plant, pocket = POCKET_GEOMETRY.find(p => p.id === plant?.pocketId);
  const target = s.finalBalls.find(b => b.id === plant?.targetBallId);
  return Boolean(plant && pocket && target && s.stopped && s.firstContact === plant.ballId
    && s.ballContacts?.[0]?.[0] === 0 && s.ballContacts[0][1] === plant.ballId
    && s.ballContacts[1]?.[0] === Math.min(plant.ballId, plant.targetBallId) && s.ballContacts[1]?.[1] === Math.max(plant.ballId, plant.targetBallId)
    && s.potted.includes(plant.targetBallId) && distance(target.position, pocket.center) < .08);
}
export function symmetricMargin(samples: PlantMarginExperiment['samples'], key: 'centeredPot' | 'offsetPot') {
  const middle = samples.findIndex(s => s.degrees === 0);
  if (middle < 0 || !samples[middle][key]) return -1;
  let steps = 0;
  for (let k = 1; k <= Math.min(middle, samples.length - middle - 1); k++) {
    if (!samples[middle - k][key] || !samples[middle + k][key]) break;
    steps = k;
  }
  return steps * MARGIN_STEP;
}
export function plantMarginEvidence(source: Scenario, plan: ShotPlan, x: PlantMarginExperiment) {
  const centered = centeredPlant(source), geometry = plantLineGeometry(source);
  if (!centered || !geometry || !source.plant || plan.ballId !== source.plant.ballId || plan.potBallId !== source.plant.targetBallId || plan.pocketId !== source.plant.pocketId
    || distance(centered.shift, x.shift) > 1e-9 || Math.hypot(x.shift.x, x.shift.y) < .01 || geometry.outside > 0
    || x.samples.length !== MARGIN_STEPS * 2 + 1 || x.samples.some((s, i) => Math.abs(s.degrees - (i - MARGIN_STEPS) * MARGIN_STEP) > 1e-12)) return null;
  const centeredMargin = symmetricMargin(x.samples, 'centeredPot'), offsetMargin = symmetricMargin(x.samples, 'offsetPot');
  const witness = x.samples.find(s => s.degrees === x.witnessDegrees);
  if (offsetMargin < MARGIN_STEP || centeredMargin - offsetMargin < .05 - 1e-9 || !witness?.centeredPot || witness.offsetPot
    || Math.abs(x.witnessDegrees) > centeredMargin + 1e-9 || Math.abs(x.witnessDegrees) <= offsetMargin
    || !plantTargetPotted(source, x.offsetNominal) || !plantTargetPotted(centered.scenario, x.centeredNominal)
    || !plantTargetPotted(centered.scenario, x.centeredWitness) || plantTargetPotted(source, x.offsetWitness)
    || x.offsetWitness.potted.includes(source.plant.targetBallId)) return null;
  for (const s of [x.centeredNominal, x.offsetNominal, x.centeredWitness, x.offsetWitness]) {
    const events = s.contactEvents;
    if (!s.stopped || !events || events.length !== 2 || events[0].ballIds.join(',') !== '0,1' || events[1].ballIds.join(',') !== '1,2'
      || events[0].time >= events[1].time || !s.objectPath.length) return null;
  }
  return { centered: centered.scenario, geometry, centeredGeometry: plantLineGeometry(centered.scenario)!, centeredMargin, offsetMargin, witness };
}
export function plantMarginExperiment(source: Scenario, options: FinishOption[]): PlantMarginExperiment | null {
  const centered = centeredPlant(source); if (!centered) return null;
  for (const option of options) {
    let consistent = true;
    const samples = Array.from({ length: MARGIN_STEPS * 2 + 1 }, (_, i) => {
      const degrees = (i - MARGIN_STEPS) * MARGIN_STEP, plan = { ...option.plan, angle: option.plan.angle + degrees * Math.PI / 180 };
      const a = simulateShot(centered.scenario, plan, { record: false }), b = simulateShot(source, plan, { record: false });
      if ([a, b].some(s => JSON.stringify(s.ballContacts) !== '[[0,1],[1,2]]')) consistent = false;
      return { degrees, centeredPot: plantTargetPotted(centered.scenario, a), offsetPot: plantTargetPotted(source, b) };
    });
    if (!consistent) continue;
    const centeredMargin = symmetricMargin(samples, 'centeredPot'), offsetMargin = symmetricMargin(samples, 'offsetPot');
    if (offsetMargin < MARGIN_STEP || centeredMargin - offsetMargin < .05 - 1e-9) continue;
    const witness = samples.filter(s => s.centeredPot && !s.offsetPot && Math.abs(s.degrees) <= centeredMargin + 1e-9).sort((a, b) => Math.abs(a.degrees) - Math.abs(b.degrees))[0];
    if (!witness) continue;
    const witnessPlan = { ...option.plan, angle: option.plan.angle + witness.degrees * Math.PI / 180 }, flags = { record: false, recordPaths: true, recordContacts: true };
    const x = { referenceId: option.id, shift: centered.shift, samples, witnessDegrees: witness.degrees,
      centeredNominal: simulateShot(centered.scenario, option.plan, flags), offsetNominal: simulateShot(source, option.plan, flags),
      centeredWitness: simulateShot(centered.scenario, witnessPlan, flags), offsetWitness: simulateShot(source, witnessPlan, flags) };
    if (plantMarginEvidence(source, option.plan, x)) return x;
  }
  return null;
}
