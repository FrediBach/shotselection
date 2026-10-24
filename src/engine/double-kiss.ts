import { simulateShot } from './physics';
import { evaluateShotObjective } from './objectives';
import { distance } from './math';
import type { FinishOption, Scenario } from './types';

/** Fixed practice controls, independent of player ensembles and rankings. */
export function doubleKissPreview(source: Scenario, options: FinishOption[]) {
  if (!source.trick?.minObjectCushions || source.bank || !options.length) return null;
  const variants = [0, 1.05].map(topSpin => {
    const plan = { ...options[0].plan, id: `double-kiss-${topSpin}`, label: topSpin ? 'Follow practice' : 'Center practice', speed: 2.5, topSpin, sideSpin: 0 };
    const simulation = simulateShot(source, plan, { recordContacts: true, recordObjectRebounds: true });
    plan.target = { ...simulation.cueEnd };
    const rebound = simulation.objectRebounds?.find(e => e.ballId === 1);
    if (!rebound || simulation.firstContact !== 1 || !simulation.stopped || simulation.scratch) return null;
    const kiss = simulation.contactEvents?.find(e => e.time > rebound.time && e.ballIds.includes(0) && e.ballIds.includes(1));
    const frames = simulation.frames.filter(f => f.time > rebound.time && f.balls.every(b => !b.pocketed));
    const closest = frames.map(frame => ({ ...frame, separation: distance(frame.balls.find(b => b.id === 0)!.position, frame.balls.find(b => b.id === 1)!.position) })).sort((a,b) => a.separation-b.separation)[0];
    return closest ? { plan, simulation, rebound, kiss, closest, success: evaluateShotObjective(source, plan, simulation).success } : null;
  });
  const [clear, collision] = variants;
  if (!clear || !collision || !clear.success || clear.kiss || collision.success || collision.simulation.potted.includes(1) || !collision.kiss?.outgoing) return null;
  const index = collision.kiss.ballIds.indexOf(1), before = collision.kiss.incoming[index], after = collision.kiss.outgoing[index];
  const deflection = Math.abs(Math.atan2(before.x*after.y-before.y*after.x, before.x*after.x+before.y*after.y));
  if (deflection < .1) return null;
  return { variants: [clear, collision], deflection };
}
export type DoubleKissPreview = NonNullable<ReturnType<typeof doubleKissPreview>>;
