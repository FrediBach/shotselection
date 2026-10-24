import { analyzeRound } from './analysis';
import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { kickContactEvidence } from './kick-contact';
import { TABLE } from './constants';
import { distance, dot, normalize, subtract } from './math';
import { PREMADE_CHARACTERS } from './characters';

it.each([0, 1, 5, 8, 52 * 919])('contrasts center-directed and potting-side geometry at seed %i', seed => {
  const source = generateScenario(52, seed), before = structuredClone(source);
  const p = prepareRound(source, { regenerate: false }), e = p.kickContact!;
  expect(source).toEqual(before); expect(p.scenario.balls).toEqual(source.balls);
  expect(e).toBeDefined(); expect(p.balls[0].options).toHaveLength(3);
  const reference = p.balls[0].options.find(o => o.id === e.referenceId)!;
  const simulation = simulateShot(p.scenario, reference.plan), original = structuredClone(simulation);
  expect(kickContactEvidence(p.scenario, reference.plan, simulation)).toEqual(e);
  expect(simulation).toEqual(original);
  expect(simulation.potted).toEqual([1]); expect(simulation.firstContact).toBe(1);
  expect(simulation.scratch).toBe(false); expect(simulation.stopped).toBe(true);
  expect(simulation.objectCushions).toBe(0);
  expect(e.rebound).toEqual(simulation.cueRebounds!.find(r => r.beforeContact)!.position);
  expect(e.approach.at(-1)).toEqual(e.rebound);
  expect(distance(e.object, e.ghost)).toBeCloseTo(TABLE.ballDiameter, 10);
  expect(distance(e.object, e.centerHit)).toBeCloseTo(TABLE.ballDiameter, 10);
  expect(distance(e.object, e.contactPoint)).toBeCloseTo(TABLE.ballRadius, 10);
  expect(distance(e.ghost, simulation.firstImpact!.position)).toBeLessThan(.008);
  expect(dot(normalize(subtract(e.object, e.ghost)), normalize(subtract(e.pocket, e.object)))).toBeCloseTo(1, 10);
  expect(dot(normalize(subtract(e.object, e.centerHit)), normalize(subtract(e.object, e.rebound)))).toBeCloseTo(1, 10);
  expect(e.angle).toBeGreaterThanOrEqual(10);
  expect(e.angle).toBeLessThanOrEqual(65);
  expect(distance(simulation.objectPath.at(-1)!, e.pocket)).toBeLessThan(.08);
  for (const character of PREMADE_CHARACTERS) {
    const result = analyzeRound(p, { ballId: 1, optionId: e.referenceId }, { samples: 32, talents: character.talents });
    expect(kickContactEvidence(p.scenario, result.selected.plan, result.selected.nominal)).toEqual(e);
  }
});

it('rejects absent evidence and contacts that cannot teach the claimed geometry', () => {
  const p = prepareRound(generateScenario(52, 0), { regenerate: false });
  const o = p.balls[0].options.find(o => o.id === p.kickContact!.referenceId)!;
  const s = simulateShot(p.scenario, o.plan);
  for (const invalid of [
    { ...s, scratch: true }, { ...s, potted: [] }, { ...s, firstImpact: undefined },
    { ...s, cueRebounds: [] }, { ...s, objectCushions: 1 },
    { ...s, firstImpact: { ...s.firstImpact!, objectSpeedBefore: .1 } },
    { ...s, firstImpact: { ...s.firstImpact!, position: p.kickContact!.object } },
  ]) expect(kickContactEvidence(p.scenario, o.plan, invalid)).toBeNull();
  expect(kickContactEvidence(p.scenario, { ...o.plan, pocketId: -1 }, s)).toBeNull();
  expect(kickContactEvidence(p.scenario, { ...o.plan, ballId: 2 }, s)).toBeNull();
});
