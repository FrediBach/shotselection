import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { collisionAssistancePairFinder, collisionTrialSummary } from './collision-assistance';
import { simulateShot } from './physics';
import { evaluateShotObjective, hasProvenNextShot } from './objectives';
import { secondShotPotted } from './second-shot';
import { distance, seededRandom } from './math';
import { analyzeRound, analyzeShot } from './analysis';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
import { perturbShot } from './stroke-errors';

it.each([0, 1, 5, 8, 46 * 919])('requires assisted and clean nominal successes in the same zone, seed %i', seed => {
  const source = generateScenario(46, seed), original = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), c = p.collisionAssistance!;
  expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(c).toBeDefined();
  const entries = p.balls[0].options.filter(o => [c.assistedId, c.clearId].includes(o.id)).map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  const before = structuredClone(entries), pair = collisionAssistancePairFinder(p.scenario)(entries)!;
  expect(pair).not.toBeNull(); expect(pair.assisted.plan.id).toBe(c.assistedId); expect(pair.clear.plan.id).toBe(c.clearId);
  expect(pair.assisted.plan.pocketId).toBe(pair.clear.plan.pocketId);
  for (const e of entries) {
    expect(evaluateShotObjective(p.scenario, e.plan, e.simulation).success).toBe(true);
    expect(hasProvenNextShot(p.scenario, e.simulation)).toBe(true);
    expect(e.simulation.potted).toEqual([1]);
    for (const ball of source.balls.filter(b => b.id > 1 && b.id !== 3)) expect(distance(ball.position, e.simulation.finalBalls.find(b => b.id === ball.id)!.position)).toBeLessThan(.001);
  }
  expect(pair.assisted.simulation.ballContacts).toEqual([[0, 1], [0, 3]]);
  expect(pair.clear.simulation.ballContacts).toEqual([[0, 1]]);
  expect(pair.clean.clearance).toBeGreaterThanOrEqual(.06);
  expect(pair.graze.without).toEqual({ ...p.scenario, balls: p.scenario.balls.filter(b => b.id !== 3) });
  const counter = simulateShot(pair.graze.without, pair.assisted.plan, { record: false, recordPaths: true });
  expect(counter).toEqual(pair.graze.counterfactual); expect(secondShotPotted(1, counter)).toBe(true);
  expect(evaluateShotObjective(pair.graze.without, pair.assisted.plan, counter).positioned).toBe(false);
  expect(distance(counter.cueEnd, pair.target)).toBeGreaterThanOrEqual(p.scenario.objective!.radius + .03);
  expect(entries).toEqual(before);
}, 30000);

it('reports actual scoring-trial collisions and successes for every preset player', () => {
  const p = prepareRound(generateScenario(46, 46 * 919), { regenerate: false }), c = p.collisionAssistance!;
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: c.assistedId }, { samples: 32, talents: character.talents });
    for (const shot of result.candidates) {
      const counts = collisionTrialSummary(shot)!;
      expect(counts.trials).toBe(32);
      expect(counts.withContact + counts.withoutContact).toBe(32);
      expect(counts.successes / 32).toBe(shot.successRate);
      const random = seededRandom(p.scenario.seed ^ 0x3A7B91);
      for (let i = 0; i < 32; i++) {
        const plan = perturbShot(shot.plan, random, character.talents), sim = simulateShot(p.scenario, plan, { record: false, recordPaths: true });
        expect(shot.spareContactTrials![i]).toBe(Boolean(sim.ballContacts?.some(([a, b]) => (a === 0 && b === 3) || (a === 3 && b === 0))));
        expect(shot.trialSuccesses![i]).toBe(evaluateShotObjective(p.scenario, plan, sim).success);
      }
    }
  }
}, 30000);

it('demonstrates reduced repeatability of the assisted reference for the default player', () => {
  const p = prepareRound(generateScenario(46, 46 * 919), { regenerate: false }), c = p.collisionAssistance!;
  const result = analyzeRound(p, { ballId: 1, optionId: c.assistedId }, { samples: 64, talents: DEFAULT_CHARACTER.talents });
  const assisted = collisionTrialSummary(result.candidates.find(s => s.plan.id === c.assistedId)!)!, clean = collisionTrialSummary(result.candidates.find(s => s.plan.id === c.clearId)!)!;
  expect(assisted.withContact).toBeGreaterThan(0);
  expect(assisted.withContact, JSON.stringify({assisted, clean})).toBeGreaterThan(clean.withContact);
  expect(assisted.successfulContacts).toBeLessThan(assisted.withContact);
  expect(clean.successes - assisted.successes).toBeGreaterThanOrEqual(4);
  expect(collisionTrialSummary({ ...result.selected, spareContactTrials: undefined })).toBeNull();
  expect(collisionTrialSummary({ ...result.selected, spareContactTrials: [] })).toBeNull();
  const ordinary = { ...p.scenario, curriculum: undefined };
  const withEvidence = analyzeShot(p.scenario, result.selected.plan, 8), withoutEvidence = analyzeShot(ordinary, result.selected.plan, 8);
  const { spareContactTrials, ...rest } = withEvidence;
  expect(spareContactTrials).toHaveLength(8); expect(rest).toEqual(withoutEvidence);
}, 30000);

it('rejects invalid openers, extra contacts and changes to reserved balls', () => {
  const p = prepareRound(generateScenario(46, 0), { regenerate: false });
  const entries = p.balls[0].options.map(o => ({ plan: o.plan, simulation: simulateShot(p.scenario, o.plan) }));
  for (const flags of [{ scratch: true }, { stopped: false }, { firstContact: 2 }, { potted: [] }, { potted: [1, 3] }, { ballContacts: [[0, 1], [0, 3], [0, 4]] as [number, number][] }]) expect(collisionAssistancePairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, ...flags } })))).toBeNull();
  for (const id of [2, 4, 5]) expect(collisionAssistancePairFinder(p.scenario)(entries.map(e => ({ ...e, simulation: { ...e.simulation, finalBalls: e.simulation.finalBalls.map(b => b.id === id ? { ...b, position: { x: .1, y: .1 } } : b) } })))).toBeNull();
  expect(collisionAssistancePairFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
});
