import { distance } from './math';
import { POCKET_GEOMETRY } from './table-geometry';
import { directShotRoutes } from './objectives';
import { secondShotPlan, secondShotPotted } from './second-shot';
import { simulateShot } from './physics';
import type { Scenario, ShotPlan, Simulation } from './types';
export type DefenseKind = 'pot' | 'ineligible' | 'open' | 'screened' | 'limited' | 'unproven';
export interface DefenseTrial { kind: DefenseKind; cutAngle?: number; blockerId?: number }
export interface DefenseReply { scenario: Scenario; plan: ShotPlan; simulation: Simulation; cutAngle: number }
export interface DefenseExample {
  index: number;
  openingPlan: ShotPlan;
  opening: Simulation;
  reply: DefenseReply;
  blockerId?: number;
  blockedReply?: Simulation;
}

/** Prove the nominated directly aimed pot, excluding object-ball combinations.
 * Pocket-jaw rebounds may occur on a direct attempt; the route search excludes planned banks. */
export function directReplyPotted(plan: ShotPlan, simulation: Simulation) {
  const pocket = POCKET_GEOMETRY.find(p => p.id === plan.pocketId);
  const ball = simulation.finalBalls.find(b => b.id === plan.ballId);
  return secondShotPotted(plan.ballId, simulation) && Boolean(pocket && ball?.pocketed && distance(ball.position, pocket.center) < pocket.radius)
    && !(simulation.ballContacts ?? []).some(pair => pair.includes(plan.ballId) && !pair.includes(0));
}

/** Training opponent: ball 1 from the actual leave, direct pots up to the authored cut limit. */
export function defensiveOutcome(source: Scenario, simulation: Simulation): { trial: DefenseTrial; reply?: DefenseReply; blockedReply?: Simulation } {
  const rule = source.defense;
  if (!rule) throw new Error('The defensive outcome needs an opponent objective.');
  if (secondShotPotted(rule.ballId, simulation)) return { trial: { kind: 'pot' } };
  // A miss earns no defensive credit unless it finishes a valid turn in this exercise.
  if (!simulation.stopped || simulation.scratch || simulation.firstContact !== rule.ballId || simulation.potted.length
    || !((simulation.objectCushions ?? 0) > 0 || simulation.cueRebounds?.some(r => !r.beforeContact))) return { trial: { kind: 'ineligible' } };
  const scenario: Scenario = { level: source.level, seed: source.seed, title: 'Opponent reply', description: '', conditions: source.conditions,
    balls: simulation.finalBalls.filter(b => !b.pocketed).map(b => ({ id: b.id, position: { ...b.position } })) };
  const routes = directShotRoutes(scenario.balls, rule.ballId, rule.maxCutAngle);
  function prove(layout: Scenario, candidates: typeof routes): DefenseReply | undefined {
    for (const route of candidates) for (const pace of [.95, 1.2, 1.5]) for (const spin of [0, -.7, 1]) {
      const plan = { ...secondShotPlan(layout, rule!.ballId, route, pace, spin), label: 'Opponent direct pot' };
      const result = simulateShot(layout, plan, { record: false });
      if (directReplyPotted(plan, result)) return { scenario: layout, plan, simulation: result, cutAngle: route.cutAngle };
    }
  }
  if (routes.length) {
    const reply = prove(scenario, routes);
    return reply ? { trial: { kind: 'open', cutAngle: reply.cutAngle }, reply } : { trial: { kind: 'unproven' } };
  }
  for (const blocker of scenario.balls.filter(b => b.id !== 0 && b.id !== rule.ballId)) {
    const removed = { ...scenario, balls: scenario.balls.filter(b => b.id !== blocker.id) };
    const reply = prove(removed, directShotRoutes(removed.balls, rule.ballId, rule.maxCutAngle));
    if (!reply) continue;
    const blockedReply = simulateShot(scenario, reply.plan, { record: false });
    if (blockedReply.firstContact !== blocker.id || secondShotPotted(rule.ballId, blockedReply)) continue;
    return { trial: { kind: 'screened', blockerId: blocker.id }, reply, blockedReply };
  }
  // No permitted geometric route; this alone does not identify a single blocking ball.
  return { trial: { kind: 'limited' } };
}

export function defenseSummary(trials: DefenseTrial[], successes: boolean[]) {
  const counts = { pot: 0, ineligible: 0, open: 0, screened: 0, limited: 0, unproven: 0 };
  for (const t of trials) counts[t.kind]++;
  const misses = counts.open + counts.screened + counts.limited + counts.unproven;
  const denied = counts.screened + counts.limited;
  const completed = successes.filter(Boolean).length;
  return { counts, misses, denied, completed, twoWay: completed + denied, total: trials.length };
}

export function defenseWinner(a: ReturnType<typeof defenseSummary>, b: ReturnType<typeof defenseSummary>): 'first' | 'second' | 'equal' | null {
  if (!a.misses || !b.misses) return null;
  const difference = a.denied * b.misses - b.denied * a.misses;
  return difference > 0 ? 'first' : difference < 0 ? 'second' : 'equal';
}
