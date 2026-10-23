import { expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { prepareRound } from './preparation';
import { generateScenario } from './scenarios';
import type { ShotAnalysis } from './types';

it('teaches working, failing and low-probability plants against difficult free balls, ending with close decisions', () => {
  // The same seeded stroke errors judge both routes. These bounds guard the
  // authored teaching problems; the game never stores or uses these rates.
  const lessons = Array.from({ length: 10 }, (_, index) => {
    const prepared = prepareRound(generateScenario(61 + index, 0));
    const analyses = prepared.balls.map(group => group.options.map(option => analyzeShot(prepared.scenario, option.plan, 64)));
    const best = (shots: ShotAnalysis[]) => shots.reduce((a, b) => a.score > b.score ? a : b);
    return { plant: best(analyses[0]), free: best(analyses[1]),
      maxPlantPot: Math.max(...analyses[0].map(shot => shot.potRate)),
      maxFreePot: Math.max(...analyses[1].map(shot => shot.potRate)) };
  });
  for (const lesson of lessons) {
    expect(lesson.maxFreePot).toBeLessThan(0.8);
    expect(lesson.free.successRate).toBeGreaterThan(0);
  }
  expect(lessons[0].maxPlantPot).toBeGreaterThan(0.9);
  expect(lessons[0].plant.score - lessons[0].free.score).toBeGreaterThan(0.2);
  for (const index of [1, 5]) {
    expect(lessons[index].maxPlantPot).toBe(0);
    expect(lessons[index].free.score).toBeGreaterThan(lessons[index].plant.score);
  }
  expect(lessons[6].maxPlantPot).toBeGreaterThan(0.1);
  expect(lessons[6].maxPlantPot).toBeLessThan(0.5);
  expect(lessons[6].free.score).toBeGreaterThan(lessons[6].plant.score);
  // A working corner plant can lose on the complete pot-and-finish decision.
  expect(lessons[4].maxPlantPot).toBeGreaterThan(0.9);
  expect(lessons[4].free.score).toBeGreaterThan(lessons[4].plant.score);
  for (const lesson of lessons.slice(-3)) {
    expect(lesson.plant.successRate).toBeGreaterThan(0.1);
    expect(lesson.free.successRate).toBeGreaterThan(0.1);
    expect(Math.abs(lesson.plant.score - lesson.free.score)).toBeLessThan(0.1);
  }
  expect(lessons[8].plant.score).toBeGreaterThan(lessons[8].free.score);
  expect(lessons[9].free.score).toBeGreaterThan(lessons[9].plant.score);
}, 60000);
