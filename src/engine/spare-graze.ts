import { TABLE } from './constants';
import { distance, dot, normalize, segmentDistance, subtract, clamp } from './math';
import { hasProvenNextShot } from './objectives';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import type { Opening } from './look-ahead';
import type { Scenario } from './types';

export function spareGrazeEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !secondShotPotted(1, opening.simulation)) return null;
  if (source.balls.filter(b => b.id === 2 || b.id === 4).some(b => {
    const end = opening.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
    return !end || distance(end.position, b.position) > .001;
  })) return null;
  const contacts = opening.simulation.ballContacts ?? [];
  const clean = contacts.length === 1 && contacts[0][0] === 0 && contacts[0][1] === 1;
  const grazed = contacts.length === 2 && contacts[0][0] === 0 && contacts[0][1] === 1 && contacts[1][0] === 0 && contacts[1][1] === 3;
  if (!clean && !grazed) return null;
  const blocker = source.balls.find(b => b.id === 3);
  if (!blocker || !opening.simulation.finalBalls.some(b => b.id === 3 && !b.pocketed)) return null;
  const traced = simulateShot(source, opening.plan, { record: false, recordPaths: true, recordContacts: true });
  if (clean) {
    const clearance = Math.min(...traced.cuePath.slice(1).map((end, i) => segmentDistance(blocker.position, traced.cuePath[i], end))) - TABLE.ballDiameter;
    if (clearance < .02 || !hasProvenNextShot(source, traced)) return null;
    return { kind: 'clear' as const, traced, clearance };
  }
  const contact = traced.cueContacts?.find(c => c.ballId === 3);
  if (!contact || !contact.pottedBefore.includes(1) || traced.cueContacts!.filter(c => c.time === contact.time).length !== 1) return null;
  const incomingSpeed = Math.hypot(contact.incoming.x, contact.incoming.y), outgoingSpeed = Math.hypot(contact.outgoing.x, contact.outgoing.y);
  if (incomingSpeed < .15 || outgoingSpeed < .08) return null;
  const normalAngle = Math.acos(clamp(dot(normalize(contact.incoming), normalize(subtract(contact.otherPosition, contact.position))), -1, 1)) * 180 / Math.PI;
  const deflection = Math.acos(clamp(dot(normalize(contact.incoming), normalize(contact.outgoing)), -1, 1)) * 180 / Math.PI;
  if (normalAngle < 40 || normalAngle > 80 || deflection < 10 || deflection > 70) return null;
  const without: Scenario = { ...source, balls: source.balls.filter(b => b.id !== 3) };
  const counterfactual = simulateShot(without, opening.plan, { record: false, recordPaths: true });
  const finishShift = distance(traced.cueEnd, counterfactual.cueEnd);
  if (!secondShotPotted(1, counterfactual) || finishShift < .1) return null;
  return { kind: 'graze' as const, traced, contact, normalAngle, deflection, incomingSpeed, outgoingSpeed, without, counterfactual, finishShift };
}

export function spareGrazePairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof spareGrazeEvidence>>();
  const evidence = (opening: Opening) => {
    if (!cache.has(opening)) cache.set(opening, spareGrazeEvidence(source, opening));
    return cache.get(opening)!;
  };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const grazed of entries) {
      const graze = evidence(grazed);
      if (graze?.kind !== 'graze') continue;
      for (const clear of entries) {
        if (grazed.plan.pocketId !== clear.plan.pocketId || Math.max(grazed.plan.speed, clear.plan.speed) / Math.min(grazed.plan.speed, clear.plan.speed) > 1.7) continue;
        const clean = evidence(clear);
        if (clean?.kind !== 'clear') continue;
        const target = source.objective.target ?? clear.simulation.cueEnd;
        if (distance(clear.simulation.cueEnd, target) > source.objective.radius) continue;
        return { grazed, clear, graze, clean, target };
      }
    }
    return null;
  };
}
