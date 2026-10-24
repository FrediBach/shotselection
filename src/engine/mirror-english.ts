import { TABLE } from './constants';
import { clamp, distance, dot, normalize } from './math';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import { evaluateShotObjective } from './objectives';
import { reflectTableConditions } from './table-conditions';
import type { FinishOption, Scenario, Vec2 } from './types';
export const mirrorPoint = (p: Vec2): Vec2 => ({ x: TABLE.length - p.x, y: p.y });
const mirrorVector = (p: Vec2): Vec2 => ({ x: -p.x, y: p.y });
export const englishName = (spin: number) => spin > 0 ? 'Left English' : 'Right English';
/** Reflect a direct position lesson and test the handedness of its offered cushion stroke. */
export function mirrorEnglishPreview(source: Scenario, options: FinishOption[]) {
  if (!source.objective?.target || source.bank || source.plant || source.trick || source.objective.ellipse) return null;
  const reference = options.find(o => o.plan.sideSpin !== 0);
  if (!reference) return null;
  const scenario: Scenario = { ...source, balls: source.balls.map(b => ({ ...b, position: mirrorPoint(b.position) })), objective: { ...source.objective, target: mirrorPoint(source.objective.target) }, conditions: source.conditions ? reflectTableConditions(source.conditions, true, false) : undefined };
  const plan = { ...reference.plan, angle: Math.atan2(Math.sin(reference.plan.angle), -Math.cos(reference.plan.angle)), pocketId: [2, 1, 0, 5, 4, 3][reference.plan.pocketId], target: mirrorPoint(reference.plan.target), sideSpin: -reference.plan.sideSpin };
  const run = (s: Scenario, p: typeof plan) => { const simulation = simulateShot(s, p, { record: false, recordPaths: true }); return { plan: p, simulation, outcome: evaluateShotObjective(s, p, simulation) }; };
  const original = run(source, reference.plan), reversed = run(scenario, plan), copied = run(scenario, { ...plan, sideSpin: reference.plan.sideSpin });
  if ([original, reversed, copied].some(x => !secondShotPotted(plan.ballId, x.simulation) || x.simulation.cueRebounds?.length !== 1 || x.simulation.cueRebounds[0].beforeContact)) return null;
  const a = original.simulation, b = reversed.simulation, c = copied.simulation;
  const matches = (first: Vec2[], second: Vec2[]) => first.length === second.length && first.every((p, i) => distance(mirrorPoint(p), second[i]) < 1e-6);
  if (!matches(a.cuePath, b.cuePath) || !matches(a.objectPath, b.objectPath) || distance(mirrorPoint(a.cueEnd), b.cueEnd) > 1e-6) return null;
  const r = b.cueRebounds![0], wrong = c.cueRebounds![0], before = a.cueRebounds![0];
  if (Math.abs(before.time - r.time) > 1e-6 || distance(mirrorVector(before.outgoing), r.outgoing) > 1e-6 || Math.abs(r.time - wrong.time) > 1e-6 || distance(r.position, wrong.position) > 1e-6 || distance(r.incoming, wrong.incoming) > 1e-6) return null;
  const outgoingDifference = Math.acos(clamp(dot(normalize(r.outgoing), normalize(wrong.outgoing)), -1, 1)) * 180 / Math.PI;
  const endpointDifference = distance(b.cueEnd, c.cueEnd);
  if (outgoingDifference < 4 || endpointDifference < .02) return null;
  return { referenceId: reference.id, scenario, original, reversed, copied, outgoingDifference, endpointDifference };
}
export type MirrorEnglishPreview = NonNullable<ReturnType<typeof mirrorEnglishPreview>>;
