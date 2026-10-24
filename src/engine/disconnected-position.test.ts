import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { disconnectedPositionFinder, inPositionGap } from './disconnected-position';
import { positionRegionRatio } from './position-region';
import { evaluateShotObjective, directShotRoutes, hasProvenNextShot } from './objectives';
import { simulateShot } from './physics';
import { secondShotPotted } from './second-shot';
import { analyzeRound } from './analysis';
import { distance, seededRandom } from './math';
import { perturbShot } from './stroke-errors';
import { DEFAULT_CHARACTER, PREMADE_CHARACTERS } from './characters';
import { prepareSandboxRound } from './sandbox';
import { analyzeShotTolerance } from './tolerance';
it.each([0, 1, 5, 8, 75 * 919])('proves two real finishes, a blocked midpoint and actual gap trials, seed %i', seed => {
  const source = generateScenario(75, seed), snapshot = structuredClone(source), p = prepareRound(source, { regenerate: false }), e = p.disconnectedPosition!, objective = p.scenario.objective!;
  expect(source).toEqual(snapshot); expect(p.scenario.balls).toEqual(source.balls);
  expect(objective.regions).toEqual(e.centers); expect(distance(...e.centers)).toBeGreaterThan(objective.radius * 2 + .06);
  for (const [i, id] of e.optionIds.entries()) {
    const plan = p.balls[0].options.find(o => o.id === id)!.plan, simulation = simulateShot(p.scenario, plan);
    expect(simulation.cueEnd).toEqual(e.centers[i]); expect(evaluateShotObjective(p.scenario, plan, simulation).success).toBe(true);
    expect(hasProvenNextShot(p.scenario, simulation)).toBe(true); expect(simulation.ballContacts).toEqual([[0, 1]]);
    for (const b of source.balls.filter(b => b.id > 1)) expect(distance(b.position, simulation.finalBalls.find(x => x.id === b.id)!.position)).toBeLessThan(1e-6);
  }
  expect(e.midpoint).toEqual({ x: (e.centers[0].x + e.centers[1].x) / 2, y: (e.centers[0].y + e.centers[1].y) / 2 });
  expect(positionRegionRatio(objective, e.midpoint)).toBeGreaterThan(1); expect(inPositionGap(objective, e.midpoint)).toBe(true);
  expect(directShotRoutes(e.blocked.balls, 2, objective.maxCutAngle)).toHaveLength(0);
  expect(e.removed.balls).toEqual(e.blocked.balls.filter(b => b.id !== e.blockerId));
  expect(e.blockedSimulation).toEqual(simulateShot(e.blocked, e.plan, { record: false, recordPaths: true }));
  expect(e.removalSimulation).toEqual(simulateShot(e.removed, e.plan, { record: false, recordPaths: true }));
  expect(e.blockedSimulation.firstContact).toBe(e.blockerId); expect(secondShotPotted(2, e.blockedSimulation)).toBe(false); expect(secondShotPotted(2, e.removalSimulation)).toBe(true);
  const result = analyzeRound(p, { ballId: 1, optionId: e.optionIds[0] }, { samples: 64 });
  for (const shot of result.candidates) {
    const random = seededRandom(p.scenario.seed ^ 0x3A7B91);
    for (const t of shot.disconnectedTrials!) {
      const plan = perturbShot(shot.plan, random, DEFAULT_CHARACTER.talents), sim = simulateShot(p.scenario, plan, { record: false, recordPaths: true }), out = evaluateShotObjective(p.scenario, plan, sim);
      expect(t).toEqual({ point: sim.cueEnd, region: e.centers.findIndex(c => distance(c, sim.cueEnd) <= objective.radius), gap: inPositionGap(objective, sim.cueEnd), settled: sim.stopped, scratch: sim.scratch, nextShotAvailable: out.nextShotAvailable, legalPot: out.legalPot, success: out.success });
      if (t.gap) expect(t.success).toBe(false);
    }
    expect(shot.successRate).toBe(shot.disconnectedTrials!.filter(t => t.success).length / shot.samples);
    expect(shot.positionRate).toBe(shot.disconnectedTrials!.filter(t => t.settled && !t.scratch && t.region >= 0).length / shot.samples);
  }
  const examples = result.candidates.filter(s => e.optionIds.includes(s.plan.id));
  expect(examples.every(s => s.successRate > 0)).toBe(true);
  expect(examples.some(s => s.disconnectedTrials!.some(t => t.gap && t.settled && !t.scratch))).toBe(true);
  const { disconnectedPosition: _preview, ...ordinary } = p;
  expect(analyzeRound(ordinary, { ballId: 1, optionId: e.optionIds[0] }, { samples: 8 })).toEqual(analyzeRound(p, { ballId: 1, optionId: e.optionIds[0] }, { samples: 8 }));
}, 60000);
it('shares union boundaries with objectives and tolerance, and clears stale sandbox regions', () => {
  const p = prepareRound(generateScenario(75, 0), { regenerate: false }), e = p.disconnectedPosition!, objective = p.scenario.objective!, plan = p.balls[0].options.find(o => o.id === e.optionIds[1])!.plan;
  const sim = simulateShot(p.scenario, plan);
  for (const point of e.centers) {
    expect(positionRegionRatio(objective, point)).toBe(0); expect(inPositionGap(objective, point)).toBe(false);
    expect(evaluateShotObjective(p.scenario, plan, { ...sim, cueEnd: point }).positioned).toBe(true);
  }
  expect(evaluateShotObjective(p.scenario, plan, { ...sim, cueEnd: e.midpoint }).positioned).toBe(false);
  expect(analyzeShotTolerance(p.scenario, plan).nominalSuccess).toBe(true);
  for (const regions of [[e.centers[0], e.centers[0]], [{ x: NaN, y: .5 }, e.centers[1]], [{ x: .01, y: .5 }, e.centers[1]]] as [typeof e.midpoint, typeof e.midpoint][]) expect(() => prepareRound({ ...p.scenario, objective: { ...objective, regions } })).toThrow('position lesson');
  expect(() => prepareRound({ ...p.scenario, objective: { ...objective, ellipse: { longRadius: .3, angle: 0 } } })).toThrow('position lesson');
  const stale = { ...p.scenario, objective: { ...objective, target: { x: .1, y: .1 }, regions: [{ x: .1, y: .1 }, { x: .2, y: .2 }] as typeof e.centers } };
  expect(prepareSandboxRound({ scenario: stale, placement: 'manual' }).scenario.objective).toEqual(objective);
}, 30000);
it('rejects invalid evidence and remains playable for each character', () => {
  const p = prepareRound(generateScenario(75, 75 * 919), { regenerate: false }), e = p.disconnectedPosition!;
  const entries = e.optionIds.map(id => { const plan = p.balls[0].options.find(o => o.id === id)!.plan; return { plan, simulation: simulateShot(p.scenario, plan) }; });
  expect(disconnectedPositionFinder({ ...p.scenario, objective: undefined })(entries)).toBeNull();
  for (const flags of [{ scratch: true }, { stopped: false }, { potted: [] }, { firstContact: 7 }]) expect(disconnectedPositionFinder(p.scenario)(entries.map(x => ({ ...x, simulation: { ...x.simulation, ...flags } })))).toBeNull();
  for (const character of PREMADE_CHARACTERS) expect(analyzeRound(p, { ballId: 1, optionId: e.optionIds[0] }, { samples: 32, talents: character.talents }).candidates.some(s => s.successRate > 0)).toBe(true);
}, 30000);
