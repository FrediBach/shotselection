import { TABLE } from './constants';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import { distance, segmentDistance } from './math';
import { hasProvenNextShot } from './objectives';
import type { Opening } from './look-ahead';
import type { Scenario, ShotAnalysis } from './types';

function assistanceEvidence(source: Scenario, opening: Opening) {
  if (!source.objective || !secondShotPotted(1, opening.simulation)) return null;
  const contacts = opening.simulation.ballContacts ?? [];
  if (contacts[0]?.[0] !== 0 || contacts[0]?.[1] !== 1) return null;
  const clean = contacts.length === 1;
  if (!clean && !(contacts.length === 2 && contacts[1][0] === 0 && contacts[1][1] === 3)) return null;
  const blocker = source.balls.find(b => b.id === 3);
  if (!blocker || !opening.simulation.finalBalls.some(b => b.id === 3 && !b.pocketed)) return null;
  const traced = simulateShot(source, opening.plan, { record: false, recordPaths: true });
  if (clean) {
    const clearance = Math.min(...traced.cuePath.slice(1).map((end, i) => segmentDistance(blocker.position, traced.cuePath[i], end))) - TABLE.ballDiameter;
    if (clearance < .06) return null;
    return { kind: 'clear' as const, traced, clearance };
  }
  const without: Scenario = { ...source, balls: source.balls.filter(b => b.id !== 3) };
  const counterfactual = simulateShot(without, opening.plan, { record: false, recordPaths: true });
  if (!secondShotPotted(1, counterfactual)) return null;
  return { kind: 'graze' as const, traced, without, counterfactual };
}

/** Nominal evidence only: sample outcomes never choose the offered strokes. */
export function collisionAssistancePairFinder(source: Scenario) {
  const cache = new Map<Opening, ReturnType<typeof assistanceEvidence>>();
  const evidence = (opening: Opening) => {
    if (!cache.has(opening)) {
      const unchanged = source.balls.filter(b => b.id > 1 && b.id !== 3).every(b => {
        const end = opening.simulation.finalBalls.find(c => c.id === b.id && !c.pocketed);
        return end && distance(b.position, end.position) < .001;
      });
      cache.set(opening, unchanged && opening.simulation.potted.length === 1 ? assistanceEvidence(source, opening) : null);
    }
    return cache.get(opening)!;
  };
  const proven = new Map<Opening, boolean>();
  const provesNext = (opening: Opening) => {
    if (!proven.has(opening)) proven.set(opening, hasProvenNextShot(source, opening.simulation));
    return proven.get(opening)!;
  };
  return (entries: Opening[]) => {
    if (!source.objective) return null;
    for (const assisted of entries) {
      const graze = evidence(assisted);
      if (graze?.kind !== 'graze') continue;
      for (const clear of entries) {
        if (assisted.plan.pocketId !== clear.plan.pocketId || Math.max(assisted.plan.speed, clear.plan.speed) / Math.min(assisted.plan.speed, clear.plan.speed) > 1.7) continue;
        const clean = evidence(clear);
        if (clean?.kind !== 'clear') continue;
        const target = source.objective.target ?? { x: (assisted.simulation.cueEnd.x + clear.simulation.cueEnd.x) / 2, y: (assisted.simulation.cueEnd.y + clear.simulation.cueEnd.y) / 2 };
        if ([assisted, clear].some(e => distance(e.simulation.cueEnd, target) > source.objective!.radius * .95)
          || distance(graze.counterfactual.cueEnd, target) < source.objective.radius + .03
          || !provesNext(assisted) || !provesNext(clear)) continue;
        return { assisted, clear, graze, clean, target };
      }
    }
    return null;
  };
}

/** Denominators include misses, scratches and failures to settle, just like scoring. */
export function collisionTrialSummary(shot: ShotAnalysis) {
  const contacts = shot.spareContactTrials, successes = shot.trialSuccesses;
  if (!contacts || !successes || contacts.length !== shot.samples || successes.length !== shot.samples) return null;
  const withContact = contacts.filter(Boolean).length;
  const successfulContacts = contacts.filter((contact, i) => contact && successes[i]).length;
  const successfulClear = contacts.filter((contact, i) => !contact && successes[i]).length;
  return { trials: shot.samples, withContact, withoutContact: shot.samples - withContact, successfulContacts, successfulClear, successes: successfulContacts + successfulClear };
}
