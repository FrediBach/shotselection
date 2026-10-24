import { distance, dot, normalize, subtract, clamp } from './math';
import { nearestPoint } from './ball-width';
import { pathClearance } from './return-lane';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import { hasProvenNextShot } from './objectives';
import type { Opening } from './look-ahead';
import type { Scenario, Vec2 } from './types';

const angleBetween = (a: Vec2, b: Vec2) => Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1)) * 180 / Math.PI;

/** A fixed-control experiment: remove only English from one offered stroke. */
export function englishRoutingEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !opening.plan.sideSpin) return null;
  const blocker = source.balls.find(b => b.id === 3);
  if (!blocker) return null;
  const controlPlan = { ...opening.plan, sideSpin: 0 };
  const english = { plan: opening.plan, simulation: simulateShot(source, opening.plan, { record: false, recordPaths: true }) };
  const control = { plan: controlPlan, simulation: simulateShot(source, controlPlan, { record: false, recordPaths: true }) };
  function inspect(e: Opening) {
    const sim = e.simulation;
    if (!secondShotPotted(1, sim) || sim.potted.length !== 1 || sim.ballContacts?.length !== 1
      || sim.cueRebounds?.length !== 1 || sim.cueRebounds[0].beforeContact
      || source.balls.filter(b => b.id > 1).some(b => {
        const end = sim.finalBalls.find(c => c.id === b.id && !c.pocketed);
        return !end || distance(b.position, end.position) > .001;
      })) return null;
    const rebound = sim.cueRebounds[0], index = sim.cuePath.findIndex(p => distance(p, rebound.position) < 1e-9);
    if (index < 1 || index >= sim.cuePath.length - 1) return null;
    const before = sim.cuePath.slice(0, index + 1), after = sim.cuePath.slice(index);
    const nearest = after.slice(1).map((p, i) => ({ point: nearestPoint(blocker!.position, after[i], p), direction: normalize(subtract(p, after[i])) })).sort((a, b) => distance(a.point, blocker!.position) - distance(b.point, blocker!.position))[0];
    const clearance = pathClearance(blocker!.position, after), v = subtract(blocker!.position, nearest.point);
    if (clearance < .012 || pathClearance(blocker!.position, before) < .03
      || distance(nearest.point, rebound.position) < .08 || distance(nearest.point, sim.cueEnd) < .06) return null;
    return { ...e, rebound, before, after, nearest, clearance, side: nearest.direction.x * v.y - nearest.direction.y * v.x };
  }
  // Validate supplied results as well as the freshly traced experiment.
  if (!secondShotPotted(1, opening.simulation) || opening.simulation.potted.length !== 1 || opening.simulation.ballContacts?.length !== 1
    || distance(opening.simulation.cueEnd, english.simulation.cueEnd) > 1e-6) return null;
  const withEnglish = inspect(english), withoutEnglish = inspect(control);
  if (!withEnglish || !withoutEnglish || withEnglish.side * withoutEnglish.side >= 0
    || dot(withEnglish.nearest.direction, withoutEnglish.nearest.direction) < .5) return null;
  if (withEnglish.before.length !== withoutEnglish.before.length
    || withEnglish.before.some((p, i) => distance(p, withoutEnglish.before[i]) > 1e-6)
    || withEnglish.rebound.time !== withoutEnglish.rebound.time
    || distance(withEnglish.rebound.incoming, withoutEnglish.rebound.incoming) > 1e-6) return null;
  const reboundSeparation = distance(withEnglish.rebound.position, withoutEnglish.rebound.position);
  const incomingDifference = angleBetween(withEnglish.rebound.incoming, withoutEnglish.rebound.incoming);
  const outgoingDifference = angleBetween(withEnglish.rebound.outgoing, withoutEnglish.rebound.outgoing);
  if (reboundSeparation > 1e-6 || incomingDifference > .001 || outgoingDifference < 4) return null;
  const a = english.simulation.cueEnd, b = control.simulation.cueEnd;
  if (distance(a, b) > .28) return null;
  const target = source.objective.target ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if ([a, b].some(p => distance(p, target) > source.objective!.radius * .95)
    || !hasProvenNextShot(source, english.simulation) || !hasProvenNextShot(source, control.simulation)) return null;
  return { opening, withEnglish, withoutEnglish, blocker, target, reboundSeparation, incomingDifference, outgoingDifference };
}

export function englishRoutingFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof englishRoutingEvidence>>();
  return (entries: Opening[]) => {
    for (const e of entries) {
      if (!e.plan.sideSpin) continue;
      if (!cache.has(e)) cache.set(e, englishRoutingEvidence(source, e));
      const evidence = cache.get(e);
      if (evidence) return evidence;
    }
    return null;
  };
}
