import { distance } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import { postContactRebounds } from './lesson-evidence';
import { simulateShot } from './physics';
import { directShotGeometry } from './shot-geometry';
import type { LessonExperiment, PreparedRound, ShotPlan, Simulation } from './types';

const run = (round: PreparedRound, plan: ShotPlan) => simulateShot(round.scenario, plan, { record: false, recordPaths: true });
const pots = (plan: ShotPlan, sim: Simulation) => {
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId)!;
  const object = sim.finalBalls.find(ball => ball.id === plan.ballId);
  return sim.stopped && sim.firstContact === plan.ballId && sim.potted.includes(plan.ballId)
    && Boolean(object && distance(object.position, pocket.center) < pocket.radius);
};
const singleContact = (plan: ShotPlan, sim: Simulation) => sim.ballContacts?.length === 1
  && sim.ballContacts[0].includes(0) && sim.ballContacts[0].includes(plan.ballId);
const safePot = (plan: ShotPlan, sim: Simulation) => pots(plan, sim) && !sim.scratch;
const speedTrials = (round: PreparedRound, plan: ShotPlan) => [.94, .97, 1, 1.03, 1.06].map(multiplier => ({ multiplier, simulation: run(round, { ...plan, speed: plan.speed * multiplier }) }));

/** Diagnostic strokes never enter the scored options. Every advertised effect
 * must occur on this actual layout; unavailable contrasts reject preparation. */
export function buildEverydayExperiment(round: PreparedRound): LessonExperiment | null {
  const comparison = round.scenario.curriculum?.learning?.comparison;
  if (round.balls.length !== round.scenario.balls.length - 1) return null;
  const options = round.balls.flatMap(ball => ball.options);
  if (comparison === 'scratch-line') {
    for (const option of options) {
      const baseline = run(round, option.plan);
      if (!safePot(option.plan, baseline)) continue;
      for (const multiplier of [1.1, 1.2, 1.35, 1.5, 1.7, 2, 2.3, 2.6, 3]) {
        const plan = { ...option.plan, speed: option.plan.speed * multiplier };
        if (plan.speed > 3.6) continue;
        const simulation = run(round, plan);
        if (pots(plan, simulation) && simulation.scratch && postContactRebounds(simulation).length === 0) {
          return { kind: comparison, variants: [
            { label: `Offered ball ${option.plan.ballId} · ${option.label}`, plan: option.plan, simulation: baseline },
            { label: 'Same aim and spin, more pace', plan, simulation },
          ] };
        }
      }
    }
    return null;
  }
  if (comparison === 'avoidable-cushion') {
    for (const option of round.balls.find(ball => ball.ballId === 1)?.options ?? []) {
      if (!postContactRebounds(run(round, option.plan)).length) continue;
      for (let multiplier = .6; multiplier <= 1.1; multiplier += .025) {
        const edge = { ...option.plan, speed: option.plan.speed * multiplier };
        const simulation = run(round, edge);
        if (!safePot(edge, simulation) || !postContactRebounds(simulation).length) continue;
        const edgeTrials = speedTrials(round, edge);
        if (!edgeTrials.some(t => postContactRebounds(t.simulation).length === 0) || !edgeTrials.some(t => postContactRebounds(t.simulation).length > 0)) continue;
        const calm = { ...edge, speed: edge.speed * .85 };
        const calmSimulation = run(round, calm), calmTrials = speedTrials(round, calm);
        if (!safePot(calm, calmSimulation) || calmTrials.some(t => postContactRebounds(t.simulation).length > 0 || !safePot(calm, t.simulation))) continue;
        return { kind: comparison, variants: [
          { label: 'Stop before the cushion', plan: calm, simulation: calmSimulation, speedTrials: calmTrials },
          { label: 'At the cushion boundary', plan: edge, simulation, speedTrials: edgeTrials },
        ] };
      }
    }
    return null;
  }
  if (comparison === 'cut-transfer') {
    const pair = round.balls.filter(ball => ball.ballId <= 2).map(ball => ball.options[0].plan)
      .sort((a, b) => directShotGeometry(round.scenario, a).cutDegrees - directShotGeometry(round.scenario, b).cutDegrees);
    if (pair.length !== 2) return null;
    const [a, b] = pair.map(plan => directShotGeometry(round.scenario, plan));
    if (Math.abs(a.cueDistance - b.cueDistance) > .04 || Math.abs(a.objectDistance - b.objectDistance) > .12 || b.cutDegrees - a.cutDegrees < 20) return null;
    // Calibrate the thin demonstration's supplied aim once; preserve it when
    // adding pace. This avoids attributing a jaw miss to insufficient transfer.
    for (const correction of [0, ...Array.from({ length: 20 }, (_, i) => [(i + 1) * .001, -(i + 1) * .001]).flat()])
    for (const speed of [1.1, 1.15, 1.2, 1.25, 1.3, 1.4]) {
      const plans = pair.map((plan, index) => ({ ...plan, angle: plan.angle + (index === 1 ? correction : 0), speed, topSpin: 0, sideSpin: 0 }));
      const [full, thin] = plans.map(plan => run(round, plan));
      if (!safePot(plans[0], full) || full.objectCushions || thin.objectCushions || thin.scratch || thin.potted.includes(plans[1].ballId) || thin.firstContact !== plans[1].ballId || !thin.stopped) continue;
      if (!singleContact(plans[0], full) || !singleContact(plans[1], thin)) continue;
      const thinEnd = thin.finalBalls.find(ball => ball.id === plans[1].ballId)!;
      if (distance(b.object, thinEnd.position) >= b.objectDistance - .08) continue;
      if (!full.firstImpact || !thin.firstImpact || Math.abs(full.firstImpact.cueSpeedBefore - thin.firstImpact.cueSpeedBefore) > .04
        || full.firstImpact.objectSpeedAfter - thin.firstImpact.objectSpeedAfter < .08
        || thin.firstImpact.cueSpeedAfter <= full.firstImpact.cueSpeedAfter) continue;
      for (const extra of [1.1, 1.2, 1.35, 1.5, 1.7]) {
        const recovery = { ...plans[1], speed: speed * extra };
        if (recovery.speed > 3.6) continue;
        const recovered = run(round, recovery);
        if (!safePot(recovery, recovered) || recovered.objectCushions || !singleContact(recovery, recovered)) continue;
        return { kind: comparison, variants: [
          { label: `Fuller cut · ball ${plans[0].ballId}`, plan: plans[0], simulation: full },
          { label: `Thinner cut · ball ${plans[1].ballId}`, plan: plans[1], simulation: thin },
          { label: 'Thinner cut with more pace', plan: recovery, simulation: recovered },
        ] };
      }
    }
  }
  return null;
}

export function needsEverydayExperiment(round: PreparedRound) {
  return ['scratch-line', 'avoidable-cushion', 'cut-transfer'].includes(round.scenario.curriculum?.learning?.comparison ?? '');
}

export function speedProbeSummary(variant: LessonExperiment['variants'][number]) {
  const trials = variant.speedTrials ?? [];
  const safe = trials.filter(t => !t.simulation.scratch && t.simulation.stopped);
  const maxShift = safe.length ? Math.max(...safe.map(t => distance(t.simulation.cueEnd, variant.simulation.cueEnd))) : null;
  return { railHits: trials.filter(t => postContactRebounds(t.simulation).length > 0).length, samples: trials.length, safeSamples: safe.length, maxShift };
}
