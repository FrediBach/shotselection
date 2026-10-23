import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { POCKETS, TABLE } from './constants';
import { distance, normalRandom, seededRandom } from './math';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import { isPocketed } from './table-geometry';
import type { Scenario, ShotPlan } from './types';

const straight: Scenario = {
  level: 1, seed: 42, title: 'Straight pot', description: 'Trajectory fixture',
  balls: [{ id: 0, position: { x: 1.27, y: 0.85 } }, { id: 1, position: { x: 1.27, y: 0.3 } }],
};
const stroke: ShotPlan = { id: 'straight', ballId: 1, pocketId: 1, target: { x: 1.27, y: 0.38 }, angle: -Math.PI / 2, speed: 1.35, topSpin: 0, sideSpin: 0, label: 'Straight pot' };

describe('cue-ball approach preview', () => {
  it.each([1.27, 1.0])('stops a direct route from x=%s at the actual first contact', cueX => {
    const scenario = { ...straight, balls: straight.balls.map(ball => ball.id === 0
      ? { ...ball, position: { ...ball.position, x: cueX } } : ball) };
    const cue = scenario.balls[0].position;
    const object = scenario.balls[1].position;
    const plan = { ...stroke, angle: Math.atan2(object.y + TABLE.ballDiameter - cue.y, object.x - cue.x) };
    const result = simulateShot(scenario, plan);
    const path = result.cueApproachPath;
    const contact = path.at(-1)!;
    expect(result.firstContact).toBe(1);
    expect(path[0]).toEqual(cue);
    expect(distance(contact, object)).toBeLessThanOrEqual(TABLE.ballDiameter);
    expect(distance(contact, object)).toBeGreaterThan(TABLE.ballDiameter - plan.speed * TABLE.step);
    expect(contact).not.toEqual(result.cueEnd);
    expect(path.length).toBeLessThan(result.cuePath.length);
    // The first impact is reported before the solver advances the cue ball;
    // independently stopping on the preceding step recovers that exact point.
    const contactTime = result.soundEvents.find(event => event.type === 'ball')!.time;
    const beforeContact = simulateShot(scenario, plan, { maxTime: contactTime - TABLE.step - 1e-10 });
    expect(beforeContact.firstContact).toBeNull();
    expect(contact).toEqual(beforeContact.cueEnd);
    for (const point of path) {
      const acrossLine = (point.x - cue.x) * Math.sin(plan.angle) - (point.y - cue.y) * Math.cos(plan.angle);
      expect(Math.abs(acrossLine)).toBeLessThan(1e-10);
    }
  });

  it('ends at the first-contact ball rather than the second ball in a plant', () => {
    const scenario = { ...straight, balls: [
      { id: 0, position: { x: 1.27, y: 0.9 } },
      { id: 1, position: { x: 1.27, y: 0.55 } },
      { id: 2, position: { x: 1.27, y: 0.3 } },
    ] };
    const result = simulateShot(scenario, { ...stroke, potBallId: 2, speed: 1.5 });
    const contact = result.cueApproachPath.at(-1)!;
    expect(result.firstContact).toBe(1);
    expect(distance(contact, scenario.balls[1].position)).toBeLessThanOrEqual(TABLE.ballDiameter);
    expect(distance(contact, scenario.balls[2].position)).toBeGreaterThan(0.25);
  });
});

describe('object-ball ensemble trajectories', () => {
  it('exports every exact trial and makes the pot count agree with potRate', () => {
    // Keep the mix of pots and misses independent of curriculum layout changes.
    const prepared = prepareRound({
      level: 6, seed: 72350, title: 'Three-ball trajectories', description: 'Trajectory fixture',
      balls: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]].map(([x, y], id) => ({ id, position: { x: TABLE.length - x, y } })),
    });
    const option = prepared.balls.find(ball => ball.ballId === 3)!.options[0];
    const result = analyzeShot(prepared.scenario, option.plan, 64);
    expect(result.sampleObjectPaths).toHaveLength(64);
    expect(result.samplePaths).toHaveLength(24);
    expect(result.sampleObjectPaths.filter(trial => trial.outcome === 'pot')).toHaveLength(result.potRate * 64);
    expect(result.sampleObjectPaths.some(trial => trial.outcome === 'pot')).toBe(true);
    expect(result.sampleObjectPaths.some(trial => trial.outcome === 'miss')).toBe(true);
    const potEnds = result.sampleObjectPaths.filter(trial => trial.outcome === 'pot').map(trial => trial.path.at(-1)!);
    expect(potEnds.some(point => distance(point, potEnds[0]) > 0.001)).toBe(true);
    const random = seededRandom(prepared.scenario.seed ^ 0x3A7B91);
    // Reconstruct the first physical trial to prove cue/object paths are paired,
    // rather than a second ensemble or a nominal line copied into the result.
    const plan: ShotPlan = {
      ...option.plan,
      angle: option.plan.angle + normalRandom(random) * (0.0044 + Math.abs(option.plan.sideSpin) * 0.000025),
      speed: option.plan.speed * (1 + normalRandom(random) * 0.035),
      topSpin: option.plan.topSpin + normalRandom(random) * 0.085,
      sideSpin: option.plan.sideSpin + normalRandom(random) * 3,
    };
    const exactTrial = simulateShot(prepared.scenario, plan, { record: false, recordPaths: true });
    expect(result.sampleObjectPaths[0].path).toEqual(exactTrial.objectPath);
    expect(result.samplePaths[0]).toEqual(exactTrial.cuePath);
    expect(analyzeShot(prepared.scenario, option.plan, 64).sampleObjectPaths).toEqual(result.sampleObjectPaths);
  });

  it('ends successful seeded trials inside the actual pocket wells', () => {
    const prepared = prepareRound(generateScenario(1, 72350));
    const result = analyzeShot(prepared.scenario, prepared.balls[0].options[0].plan, 64);
    const pots = result.sampleObjectPaths.filter(trial => trial.outcome === 'pot');
    expect(pots.length).toBeGreaterThan(0);
    for (const trial of pots) {
      expect(isPocketed(trial.path.at(-1)!)).toBe(true);
      expect(trial.path.slice(0, -1).every(point => !isPocketed(point))).toBe(true);
    }
    expect(analyzeShot(prepared.scenario, result.plan, 64)).toEqual(result);
  });

  it('records paths without frames or changes to the physical outcome', () => {
    const full = simulateShot(straight, stroke);
    const paths = simulateShot(straight, stroke, { record: false, recordPaths: true });
    const neither = simulateShot(straight, stroke, { record: false });
    expect(paths.frames).toEqual([]);
    expect(paths.cuePath).toEqual(full.cuePath);
    expect(paths.cueApproachPath).toEqual(full.cueApproachPath);
    expect(paths.objectPath).toEqual(full.objectPath);
    expect(neither.cuePath).toEqual([]);
    expect(neither.cueApproachPath).toEqual([]);
    expect(neither.objectPath).toEqual([]);
    for (const result of [paths, neither]) {
      expect(result.potted).toEqual(full.potted);
      expect(result.cueEnd).toEqual(full.cueEnd);
      expect(result.firstContact).toBe(full.firstContact);
      expect(result.scratch).toBe(full.scratch);
      expect(result.duration).toBe(full.duration);
      expect(result.stopped).toBe(full.stopped);
    }
  });

  it('ends a potted trajectory at its actual capture point exactly once', () => {
    const result = simulateShot(straight, stroke);
    const dropFrame = result.frames.find(frame => frame.balls.find(ball => ball.id === 1)?.pocketed)!;
    const capture = dropFrame.balls.find(ball => ball.id === 1)!.position;
    expect(result.objectPath.at(-1)).toEqual(capture);
    expect(result.objectPath.filter(point => distance(point, capture) < 1e-12)).toHaveLength(1);
    expect(POCKETS.every(pocket => distance(capture, pocket.position) > 0.00001)).toBe(true);
    for (let index = 1; index < result.objectPath.length; index++) expect(result.objectPath[index]).not.toEqual(result.objectPath[index - 1]);
  });

  it('preserves multiple cushion/collision changes in an object-ball path', () => {
    const scenario = { ...straight, balls: [{ id: 0, position: { x: 1, y: 0.85 } }, { id: 1, position: { x: 1, y: 0.3 } }] };
    const result = simulateShot(scenario, { ...stroke, speed: 2.4, topSpin: 0.8 }, { record: false, recordPaths: true });
    const directions = result.objectPath.slice(1).map((point, index) => point.y - result.objectPath[index].y).filter(delta => Math.abs(delta) > 0.00001).map(Math.sign);
    const reversals = directions.filter((direction, index) => index > 0 && direction !== directions[index - 1]);
    expect(reversals.length).toBeGreaterThanOrEqual(2);
    expect(result.objectPath.length).toBeGreaterThan(10);
  });

  it('classifies wrong-first-contact drops as fouls, independent of missed pots', () => {
    const scenario = { ...straight, balls: [
      { id: 0, position: { x: 1.27, y: 0.9 } },
      { id: 1, position: { x: 1.27, y: 0.55 } },
      { id: 2, position: { x: 1.27, y: 0.3 } },
    ] };
    const result = analyzeShot(scenario, { ...stroke, ballId: 2, speed: 1.5 }, 8);
    expect(result.sampleObjectPaths.some(trial => trial.outcome === 'foul')).toBe(true);
    expect(result.sampleObjectPaths.some(trial => trial.outcome === 'pot')).toBe(false);
    expect(result.potRate).toBe(0);
  });

  it('keeps object pots and cue scratches separate and records the scratch endpoint', () => {
    const result = analyzeShot(straight, { ...stroke, speed: 2, topSpin: 1 }, 8);
    expect(result.potRate).toBeGreaterThan(0);
    expect(result.scratchRate).toBeGreaterThan(0);
    expect(result.sampleObjectPaths.filter(trial => trial.outcome === 'pot')).toHaveLength(result.potRate * 8);
    expect(result.nominal.cuePath.at(-1)).toEqual(result.nominal.cueEnd);
  });
});
