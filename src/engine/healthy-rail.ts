import { TABLE } from './constants';
import { distance } from './math';
import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import type { Scenario, ShotPlan, Simulation, Vec2 } from './types';

export function compareHealthyRail(source: Scenario, plan: ShotPlan, weak: Simulation) {
  const fault = source.conditions?.cushions?.[0];
  if (!fault || source.conditions!.cushions!.length !== 1 || fault.restitution >= TABLE.cushionRestitution) return null;
  const healthy: Scenario = { ...source, conditions: { ...source.conditions!, cushions: [{ ...fault, restitution: TABLE.cushionRestitution }] } };
  const normal = simulateShot(healthy, plan);
  const atRail = (p: Vec2) => Math.abs(fault.rail === 'top' ? p.y - TABLE.ballRadius : fault.rail === 'bottom' ? p.y - (TABLE.width - TABLE.ballRadius) : fault.rail === 'left' ? p.x - TABLE.ballRadius : p.x - (TABLE.length - TABLE.ballRadius)) < .002;
  const first = weak.cueRebounds?.find(e => atRail(e.position));
  const second = first ? normal.cueRebounds?.find(e => Math.abs(e.time - first.time) < 1e-8 && distance(e.position, first.position) < 1e-7 && distance(e.incoming, first.incoming) < 1e-7) : undefined;
  const matched = Boolean(first && second);
  return { fault, matched, finishShift: distance(weak.cueEnd, normal.cueEnd), variants: [
    { label: 'Weak cushion', scenario: source, simulation: weak, event: matched ? first : undefined },
    { label: 'Healthy cushion', scenario: healthy, simulation: normal, event: matched ? second : undefined },
  ].map(v => {
    const returnPath: Vec2[] = v.event ? [v.event.position] : [];
    if (v.event) for (const frame of v.simulation.frames) {
      if (frame.time <= v.event.time) continue;
      const cue = frame.balls.find(b => b.id === 0);
      if (!cue) break;
      returnPath.push(cue.position);
      if (cue.pocketed) break;
    }
    return { ...v, returnPath, returnLength: returnPath.reduce((sum, p, i) => sum + (i ? distance(returnPath[i - 1], p) : 0), 0),
      outgoingSpeed: v.event ? Math.hypot(v.event.outgoing.x, v.event.outgoing.y) : null,
      outcome: evaluateShotObjective(v.scenario, plan, v.simulation) };
  }) };
}
