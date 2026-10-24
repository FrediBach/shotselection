import { describe, expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { simulateShot } from './physics';
import { nextShotBlockerEvidence, postContactRebounds } from './lesson-evidence';
import { POCKET_GEOMETRY } from './table-geometry';
import { PREMADE_CHARACTERS } from './characters';
import { analyzeShot } from './analysis';

describe('audit stage one: physical teaching contrasts', () => {
  it.each([0, 1, 5, 8])('keeps the level 4 pocket and contact line fixed, reflection %i', seed => {
    const prepared = prepareRound(generateScenario(4, seed), { regenerate: false });
    const options = prepared.balls[0].options;
    expect(new Set(options.map(o => o.plan.pocketId)).size).toBe(1);
    expect(new Set(options.map(o => o.plan.angle)).size).toBe(1);
    expect(POCKET_GEOMETRY[options[0].plan.pocketId].kind).toBe('side');
    expect(new Set(options.map(o => o.plan.topSpin)).size).toBe(3);
  });

  it.each([0, 1, 5, 8])('offers actual cue rebounds and a route without them, reflection %i', seed => {
    const prepared = prepareRound(generateScenario(7, seed), { regenerate: false });
    const sims = prepared.balls[0].options.map(o => simulateShot(prepared.scenario, o.plan));
    expect(sims.some(sim => postContactRebounds(sim).length > 0)).toBe(true);
    expect(sims.some(sim => postContactRebounds(sim).length === 0)).toBe(true);
    for (const [index, sim] of sims.entries()) {
      const lightweight = simulateShot(prepared.scenario, prepared.balls[0].options[index].plan, { record: false });
      expect(lightweight.cueRebounds).toEqual(sim.cueRebounds);
      for (const event of postContactRebounds(sim)) {
        expect(event.time).toBeGreaterThan(0);
        expect(event.incoming.x * event.outgoing.x < 0 || event.incoming.y * event.outgoing.y < 0).toBe(true);
        expect(sim.cuePath).toContainEqual(event.position);
      }
    }
  });

  it.each([0, 1, 5, 8])('proves settled traffic removes the next shot, reflection %i', seed => {
    const prepared = prepareRound(generateScenario(42, seed), { regenerate: false });
    const evidence = prepared.balls[0].options.map(o => {
      const sim = simulateShot(prepared.scenario, o.plan, { record: false });
      expect(sim.ballContacts?.[0]).toEqual([0, 1]);
      const before = JSON.stringify(sim);
      const evidence = nextShotBlockerEvidence(prepared.scenario, sim);
      expect(JSON.stringify(sim)).toBe(before);
      return evidence;
    });
    expect(evidence.some(e => e.routes.length === 0 && e.blockedRoutes.length > 0)).toBe(true);
    expect(evidence.some(e => e.routes.length > 0)).toBe(true);
  });

  it.each([4, 7, 42])('keeps level %i playable for each preset and reflection without prescribing a winner', level => {
    for (const seed of [0, 1, 5, 8]) {
      const prepared = prepareRound(generateScenario(level, seed), { regenerate: false });
      for (const character of PREMADE_CHARACTERS) {
        const analyses = prepared.balls[0].options.map(o => analyzeShot(prepared.scenario, o.plan, 32, character.talents));
        expect(analyses.some(a => a.successRate > 0)).toBe(true);
      }
    }
  }, 30000);
});
