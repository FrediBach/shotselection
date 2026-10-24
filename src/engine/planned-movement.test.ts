import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { plannedMovementEvidence } from './planned-movement';
import { directShotRoutes, evaluateShotObjective, plannedMovementOutcome } from './objectives';
import { analyzeRound } from './analysis';
import { distance, seededRandom } from './math';
import { perturbShot } from './stroke-errors';
import { DEFAULT_CHARACTER } from './characters';
import { directReplyPotted } from './defensive-outcome';

it.each([0, 1, 5, 8, 77 * 919])('proves deliberate movement and identical-stroke restoration, seed %i', seed => {
  const source = generateScenario(77, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false });
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls);
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const e = entries.map(o => plannedMovementEvidence(p.scenario, o)).find(e => e !== null)!;
  expect(e).toBeTruthy(); expect(evaluateShotObjective(p.scenario, e.opening.plan, e.opening.simulation).success).toBe(true);
  expect(e.opening.simulation.ballContacts).toEqual([[0, 1], [0, 3]]);
  expect(e.opening.simulation.potted).toEqual([1]);
  expect(entries.some(o => !plannedMovementOutcome(p.scenario, o.simulation).contact)).toBe(true);
  for (const a of entries) for (const b of entries) if (a !== b) expect(distance(a.simulation.cueEnd, b.simulation.cueEnd)).toBeGreaterThanOrEqual(.12);
  for (const b of source.balls.filter(b => b.id > 1 && b.id !== 3)) expect(e.scenario.balls.find(c => c.id === b.id)).toEqual(b);
  expect(distance(e.scenario.balls.find(b => b.id === 3)!.position, source.balls.find(b => b.id === 3)!.position)).toBeGreaterThanOrEqual(.03);
  expect(e.restored.balls).toEqual(e.scenario.balls.map(b => b.id === 3 ? source.balls.find(c => c.id === 3)! : b));
  expect(directShotRoutes(e.restored.balls, 2, 42)).toEqual([]);
  expect(directReplyPotted(e.plan, e.simulation)).toBe(true);
  expect(e.blocked.firstContact).toBe(3); expect(e.blocked.potted).not.toContain(2);
  expect(simulateShot(e.scenario, e.plan, { record: false, recordPaths: true })).toEqual(e.simulation);
  expect(simulateShot(e.restored, e.plan, { record: false, recordPaths: true })).toEqual(e.blocked);
}, 30000);

it('scores the actual ordered contact and changed corridor on every shared trial', () => {
  const p = prepareRound(generateScenario(77, 77 * 919), { regenerate: false });
  const result = analyzeRound(p, { ballId: 1, optionId: p.balls[0].options[2].id }, { samples: 64 });
  for (const shot of result.candidates) {
    const random = seededRandom(p.scenario.seed ^ 0x3A7B91);
    expect(shot.movementTrials).toHaveLength(64);
    for (let i = 0; i < 64; i++) {
      const plan = perturbShot(shot.plan, random, DEFAULT_CHARACTER.talents), sim = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
      const movement = plannedMovementOutcome(p.scenario, sim), outcome = evaluateShotObjective(p.scenario, plan, sim);
      expect(shot.movementTrials![i]).toEqual(movement);
      expect(shot.trialSuccesses![i]).toBe(outcome.success);
      expect(outcome.success).toBe(outcome.legalPot && outcome.positioned && outcome.nextShotAvailable && movement.opened);
    }
    expect(shot.successRate).toBe(shot.trialSuccesses!.filter(Boolean).length / 64);
  }
  expect(result.candidates.some(s => s.successRate > .2)).toBe(true);
  expect(result.candidates.some(s => s.movementTrials!.every(t => !t.contact) && s.successRate === 0)).toBe(true);
}, 30000);

it('rejects missing, reversed, insufficient and pocketed blocker movement', () => {
  const p = prepareRound(generateScenario(77, 0), { regenerate: false });
  const e = p.balls[0].options.map(o => plannedMovementEvidence(p.scenario, { plan: o.plan, simulation: simulateShot(p.scenario, o.plan) })).find(e => e)!;
  const sim = e.opening.simulation, blocker = p.scenario.balls.find(b => b.id === 3)!;
  for (const patch of [{ scratch: true }, { stopped: false }, { ballContacts: [[0, 3], [0, 1]] as [number, number][] }, { ballContacts: [[0, 1]] as [number, number][] }, { finalBalls: sim.finalBalls.map(b => b.id === 3 ? { ...b, pocketed: true } : b) }, { finalBalls: sim.finalBalls.map(b => b.id === 3 ? { ...b, position: blocker.position } : b) }]) {
    expect(plannedMovementOutcome(p.scenario, { ...sim, ...patch }).opened).toBe(false);
    expect(evaluateShotObjective(p.scenario, e.opening.plan, { ...sim, ...patch }).success).toBe(false);
  }
  expect(plannedMovementEvidence({ ...p.scenario, objective: undefined }, e.opening)).toBeNull();
  for (const blockerId of [0, 1, 2, 99, NaN]) expect(() => prepareRound({ ...p.scenario, plannedMovement: { blockerId } }, { regenerate: false })).toThrow();
});
