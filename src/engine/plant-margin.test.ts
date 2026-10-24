import { expect, it } from 'vitest';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { simulateShot } from './physics';
import { centeredPlant, plantMarginEvidence, plantTargetPotted, MARGIN_STEP, MARGIN_STEPS } from './plant-margin';
import { distance, subtract } from './math';
it.each([0, 1, 5, 8, 63 * 919])('isolates pair offset and reduces symmetric target-pot aim tolerance, seed %i', seed => {
  const source = generateScenario(63, seed), original = structuredClone(source), p = prepareRound(source, { regenerate: false }), x = p.plantMargin!;
  expect(x).toBeDefined(); expect(source).toEqual(original); expect(p.scenario.balls).toEqual(source.balls); expect(p.balls.map(b => b.ballId)).toEqual([1, 3]);
  for (const b of p.balls) expect(b.options).toHaveLength(3);
  const plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan, e = plantMarginEvidence(source, plan, x)!;
  expect(e).not.toBeNull(); expect(centeredPlant(source)!.scenario).toEqual(e.centered);
  for (let id = 0; id <= 2; id++) {
    const a = source.balls.find(b => b.id === id)!, b = e.centered.balls.find(b => b.id === id)!;
    expect(subtract(b.position, a.position).x).toBeCloseTo(x.shift.x, 12); expect(subtract(b.position, a.position).y).toBeCloseTo(x.shift.y, 12);
  }
  expect(e.centered.balls.find(b => b.id === 3)).toEqual(source.balls.find(b => b.id === 3));
  for (const ids of [[0, 1], [1, 2]]) expect(distance(e.centered.balls[ids[0]].position, e.centered.balls[ids[1]].position)).toBeCloseTo(distance(source.balls[ids[0]].position, source.balls[ids[1]].position), 12);
  expect(distance(e.centeredGeometry.hit, e.centeredGeometry.pocket.mouthCenter)).toBeLessThan(1e-9);
  expect(e.offsetMargin).toBeGreaterThanOrEqual(MARGIN_STEP); expect(e.centeredMargin - e.offsetMargin).toBeGreaterThanOrEqual(.05 - 1e-9);
  expect(x.samples).toHaveLength(MARGIN_STEPS * 2 + 1);
  for (const row of x.samples) {
    const stroke = { ...plan, angle: plan.angle + row.degrees * Math.PI / 180 };
    for (const [layout, expected] of [[source, row.offsetPot], [e.centered, row.centeredPot]] as const) {
      const sim = simulateShot(layout, stroke, { record: false });
      expect(sim.ballContacts).toEqual([[0, 1], [1, 2]]); expect(plantTargetPotted(layout, sim)).toBe(expected);
    }
  }
  const witness = { ...plan, angle: plan.angle + x.witnessDegrees * Math.PI / 180 };
  for (const [layout, stroke, sim] of [[source, plan, x.offsetNominal], [e.centered, plan, x.centeredNominal], [source, witness, x.offsetWitness], [e.centered, witness, x.centeredWitness]] as const)
    expect(sim).toEqual(simulateShot(layout, stroke, { record: false, recordPaths: true, recordContacts: true }));
  expect(plantTargetPotted(source, { ...x.offsetNominal, scratch: true, cueEnd: { x: 0, y: 0 } })).toBe(true);
  expect(x.offsetWitness.potted).not.toContain(2); expect(x.centeredWitness.potted).toContain(2);
}, 60000);
it('rejects lost control, unproven nominal pots and missing paired outcomes', () => {
  const p = prepareRound(generateScenario(63, 0), { regenerate: false }), x = p.plantMargin!, plan = p.balls[0].options.find(o => o.id === x.referenceId)!.plan;
  const original = structuredClone(x);
  for (const invalid of [
    { ...x, shift: { x: 0, y: 0 } }, { ...x, samples: [] }, { ...x, witnessDegrees: 0 },
    { ...x, samples: x.samples.map(s => ({ ...s, offsetPot: s.centeredPot })) },
    { ...x, offsetNominal: { ...x.offsetNominal, potted: [] } }, { ...x, centeredWitness: { ...x.centeredWitness, potted: [] } },
    { ...x, offsetWitness: x.centeredWitness }, { ...x, centeredNominal: { ...x.centeredNominal, contactEvents: [] } },
  ]) expect(plantMarginEvidence(p.scenario, plan, invalid)).toBeNull();
  expect(x).toEqual(original);
}, 60000);
