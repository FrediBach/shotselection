import { expect, it } from 'vitest';
import { generateScenario } from './scenarios';
import { prepareRound } from './preparation';
import { analyzeRound } from './analysis';
import { simulateShot } from './physics';
import { directShotGeometry } from './shot-geometry';
import { secondShotPotted } from './second-shot';
import { evaluateShotObjective } from './objectives';
import { analyzeSequences, sequenceLayout, sequenceTrial } from './sequence-reliability';
import { PREMADE_CHARACTERS } from './characters';
import { distance } from './math';

function setup(seed = 0) {
  const source = generateScenario(39, seed);
  const prepared = prepareRound(source, { regenerate: false });
  const comparison = prepared.sequenceComparison!;
  const option = prepared.balls[0].options.find(o => o.id === comparison.referenceId)!;
  const opening = simulateShot(prepared.scenario, option.plan);
  return { source, prepared, comparison, option, opening, scenario: sequenceLayout(source, opening) };
}

it.each([0, 1, 5, 8, 39 * 919])('compares complete sequences across reflection seed %i', seed => {
  const { source, prepared: p, comparison: c, option, opening, scenario } = setup(seed);
  expect(p.scenario.balls).toEqual(source.balls);
  expect(evaluateShotObjective(p.scenario, option.plan, opening).success).toBe(true);
  const original = structuredClone({ scenario, c });
  const analysis = analyzeSequences(scenario, c.orders, source.objective!.maxCutAngle);
  const sorted = [...analysis.orders].sort((a, b) => b.firstRate - a.firstRate);
  const [easy, hard] = sorted;
  expect(Math.abs(directShotGeometry(scenario, hard.order.first).cutDegrees - directShotGeometry(scenario, easy.order.first).cutDegrees)).toBeGreaterThanOrEqual(8);
  const easySecond = directShotGeometry(easy.secondScenario, easy.order.second), hardSecond = directShotGeometry(hard.secondScenario, hard.order.second);
  expect(Math.abs(easySecond.cutDegrees - hardSecond.cutDegrees) >= 15 || Math.abs(easySecond.cueDistance - hardSecond.cueDistance) >= .4).toBe(true);
  expect(easy.firstRate).toBeGreaterThan(hard.firstRate);
  expect(hard.continuationRate! - easy.continuationRate!).toBeGreaterThanOrEqual(.15);
  expect(hard.completionRate - easy.completionRate).toBeGreaterThanOrEqual(.05);
  for (const branch of analysis.orders) {
    expect(secondShotPotted(branch.order.first.ballId, branch.firstNominal)).toBe(true);
    expect(secondShotPotted(branch.order.second.ballId, branch.secondNominal)).toBe(true);
    expect(branch.secondScenario).toEqual(sequenceLayout(scenario, branch.firstNominal));
    expect(branch.secondScenario.objective).toBeUndefined();
    expect(branch.firstLegal).toBe(branch.trials.filter(t => t.firstLegal).length);
    expect(branch.secondAvailable).toBe(branch.trials.filter(t => t.secondAvailable).length);
    expect(branch.completed).toBe(branch.trials.filter(t => t.completed).length);
    expect(branch.completionRate).toBe(branch.completed / analysis.samples);
    expect(branch.continuationRate).toBe(branch.completed / branch.firstLegal);
    expect(branch.trials.every(t => !t.completed || (t.firstLegal && t.secondAvailable))).toBe(true);
  }
  expect({ scenario, c }).toEqual(original);
}, 60000);

it.each(PREMADE_CHARACTERS)('uses $name’s errors and keeps the sequence decision separate from the opening score', character => {
  const { prepared: p, comparison: c, option } = setup(39 * 919);
  const result = analyzeRound(p, { ballId: 1, optionId: option.id }, { samples: 8, talents: character.talents });
  const evidence = result.sequenceComparison!;
  expect(evidence.samples).toBe(128);
  const sorted = [...evidence.orders].sort((a, b) => b.firstRate - a.firstRate);
  expect(sorted[0].firstRate).toBeGreaterThan(sorted[1].firstRate);
  expect(sorted[1].completionRate - sorted[0].completionRate).toBeGreaterThanOrEqual(.05);
  expect(sorted[1].continuationRate! - sorted[0].continuationRate!).toBeGreaterThanOrEqual(.15);
  expect(evidence).toEqual({ ...analyzeSequences(evidence.scenario, c.orders, evidence.cutLimit, 128, character.talents), referenceId: c.referenceId });
  const plain = analyzeRound({ ...p, sequenceComparison: undefined }, { ballId: 1, optionId: option.id }, { samples: 8, talents: character.talents });
  expect({ ...result, sequenceComparison: undefined }).toEqual(plain);
}, 60000);

it('carries perturbed first finishes forward and fails trials when either link fails', () => {
  const { scenario, comparison, source } = setup();
  const order = comparison.orders[0], cut = source.objective!.maxCutAngle;
  const nominal = sequenceTrial(scenario, order, cut);
  expect(nominal.completed).toBe(true);
  const varied = [.98, 1.02, .95, 1.05].map(scale => sequenceTrial(scenario, order, cut, { ...order.first, speed: order.first.speed * scale })).find(t => t.firstLegal && t.secondAvailable && distance(t.first.cueEnd, nominal.first.cueEnd) > .001)!;
  expect(varied).toBeDefined();
  expect(varied.after).toEqual(sequenceLayout(scenario, varied.first));
  expect(varied.after.balls.find(b => b.id === 0)!.position).toEqual(varied.first.cueEnd);
  expect(varied.after.balls.some(b => b.id === order.first.ballId)).toBe(false);
  expect(varied.secondPlan!.speed).toBe(order.second.speed);
  expect(varied.secondPlan!.topSpin).toBe(order.second.topSpin);
  expect(varied.secondPlan!.pocketId).toBe(order.second.pocketId);
  expect(varied.secondPlan!.angle).not.toBe(nominal.secondPlan!.angle);
  expect(varied.second).toEqual(simulateShot(varied.after, varied.secondPlan!, { record: false }));
  const blocked = sequenceTrial(scenario, order, 0);
  expect(blocked.firstLegal).toBe(true); expect(blocked.secondAvailable).toBe(false); expect(blocked.second).toBeUndefined(); expect(blocked.completed).toBe(false);
  const failed = [Math.PI, Math.PI / 2, -Math.PI / 2].map(delta => sequenceTrial(scenario, order, cut, { ...order.first, angle: order.first.angle + delta })).find(t => !t.firstLegal)!;
  expect(failed).toBeDefined(); expect(failed.second).toBeUndefined(); expect(failed.completed).toBe(false);
  const reverse = analyzeSequences(scenario, [...comparison.orders].reverse(), cut, 16);
  expect(reverse.orders.reverse()).toEqual(analyzeSequences(scenario, comparison.orders, cut, 16).orders);
}, 60000);
