import { distance, dot, normalize, subtract, clamp } from './math';
import { positionRegionRatio } from './position-region';
import { simulateShot } from './physics';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { secondShotPotted } from './second-shot';
import type { Opening } from './look-ahead';
import type { Scenario, PositionObjective, Simulation } from './types';

export function positionArrival(source: Scenario, opening: Opening) {
  if (!secondShotPotted(1, opening.simulation) || opening.simulation.potted.length !== 1 || opening.simulation.ballContacts?.length !== 1) return null;
  if (source.balls.filter(b => b.id > 1).some(b => {
    const end = opening.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
    return !end || distance(b.position, end.position) > .001;
  })) return null;
  const traced = simulateShot(source, opening.plan, { record: false, recordPaths: true });
  const from = [...traced.cuePath].reverse().find(p => distance(p, traced.cueEnd) >= .12);
  if (!from) return null;
  const direction = normalize(subtract(traced.cueEnd, from));
  return { opening, traced, from, direction };
}

/** Last entry into the region, using the actual sampled cue path. */
export function regionEntry(simulation: Simulation, region: PositionObjective) {
  const path = simulation.cuePath;
  let outside = -1;
  for (let i = 0; i < path.length; i++) if (positionRegionRatio(region, path[i]) > 1) outside = i;
  if (outside < 0 || outside >= path.length - 1 || !simulation.firstImpact
    || positionRegionRatio(region, simulation.firstImpact.position) <= 1.001) return null;
  const start = path[outside], end = path[outside + 1], direction = normalize(subtract(end, start));
  let low = 0, high = 1;
  for (let i = 0; i < 30; i++) {
    const t = (low + high) / 2;
    const p = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
    if (positionRegionRatio(region, p) > 1) low = t; else high = t;
  }
  const point = { x: start.x + (end.x - start.x) * high, y: start.y + (end.y - start.y) * high };
  if (distance(point, simulation.cueEnd) < .1) return null;
  return { point, direction };
}

/** Deterministic speed-only probes, not an error ensemble or a probability. */
export function positionSpeedSweep(source: Scenario, opening: Opening) {
  const trials = Array.from({ length: 21 }, (_, i) => {
    const percent = (i - 10) * 2, plan = { ...opening.plan, speed: opening.plan.speed * (1 + percent / 100) };
    const simulation = simulateShot(source, plan, { record: false });
    return { percent, plan, simulation, ...evaluateShotObjective(source, plan, simulation) };
  });
  let low = 10, high = 10;
  if (!trials[10].success) return { trials, low: 0, high: 0, span: 0 };
  while (low > 0 && trials[low - 1].success) low--;
  while (high < 20 && trials[high + 1].success) high++;
  return { trials, low: trials[low].percent, high: trials[high].percent, span: trials[high].percent - trials[low].percent };
}

export function elongatedPositionFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof positionArrival>>();
  const evidence = (e: Opening) => { if (!cache.has(e)) cache.set(e, positionArrival(source, e)); return cache.get(e)!; };
  const proofs = new Map<Opening, boolean>();
  const proven = (e: Opening) => { if (!proofs.has(e)) proofs.set(e, hasProvenNextShot(source, e.simulation)); return proofs.get(e)!; };
  const sweeps = new Map<Opening, Map<Opening, { alongSweep: ReturnType<typeof positionSpeedSweep>; acrossSweep: ReturnType<typeof positionSpeedSweep> }>>();
  return (entries: Opening[]) => {
    const objective = source.objective;
    if (!objective?.ellipse) return null;
    const axis = { x: Math.cos(objective.ellipse.angle), y: Math.sin(objective.ellipse.angle) };
    for (const along of entries) {
      const a = evidence(along);
      if (!a || Math.abs(dot(a.direction, axis)) < Math.cos(20 * Math.PI / 180)) continue;
      for (const across of entries) {
        const b = evidence(across);
        if (!b || along === across || along.plan.pocketId !== across.plan.pocketId
          || Math.abs(dot(b.direction, axis)) > Math.cos(65 * Math.PI / 180)) continue;
        const target = objective.target ?? { x: (along.simulation.cueEnd.x + across.simulation.cueEnd.x) / 2, y: (along.simulation.cueEnd.y + across.simulation.cueEnd.y) / 2 };
        const region = { ...objective, target };
        if ([along, across].some(e => positionRegionRatio(region, e.simulation.cueEnd) > .8)) continue;
        // Keep the whole authored ellipse on the playing surface.
        const xExtent = Math.hypot(axis.x * objective.ellipse.longRadius, axis.y * objective.radius);
        const yExtent = Math.hypot(axis.y * objective.ellipse.longRadius, axis.x * objective.radius);
        if (target.x - xExtent < .03 || target.x + xExtent > 2.51 || target.y - yExtent < .03 || target.y + yExtent > 1.24) continue;
        const alongEntry = regionEntry(a.traced, region), acrossEntry = regionEntry(b.traced, region);
        if (!alongEntry || !acrossEntry || Math.abs(dot(alongEntry.direction, axis)) < Math.cos(20 * Math.PI / 180)
          || Math.abs(dot(acrossEntry.direction, axis)) > Math.cos(65 * Math.PI / 180) || !proven(along) || !proven(across)) continue;
        if (!sweeps.has(along)) sweeps.set(along, new Map());
        const saved = sweeps.get(along)!;
        if (!saved.has(across)) {
          const prepared = { ...source, objective: region };
          saved.set(across, { alongSweep: positionSpeedSweep(prepared, along), acrossSweep: positionSpeedSweep(prepared, across) });
        }
        const sweep = saved.get(across)!;
        if (sweep.alongSweep.span < 10 || sweep.alongSweep.span < sweep.acrossSweep.span + 6) continue;
        return { along, across, a, b, target, alongEntry, acrossEntry, ...sweep, alongAngle: Math.acos(clamp(Math.abs(dot(alongEntry.direction, axis)),0,1)) * 180 / Math.PI, acrossAngle: Math.acos(clamp(Math.abs(dot(acrossEntry.direction, axis)),0,1)) * 180 / Math.PI };
      }
    }
    return null;
  };
}
