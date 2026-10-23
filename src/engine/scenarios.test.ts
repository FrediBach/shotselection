import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE } from './constants';
import { distance } from './math';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { COURSE_CHAPTERS, generateScenario, getCourseProgress, TOTAL_LEVELS } from './scenarios';

describe('authored pool curriculum', () => {
  it('covers every level once with six distinct three-lesson chapters', () => {
    expect(COURSE_CHAPTERS).toHaveLength(6);
    expect(COURSE_CHAPTERS.flatMap(chapter => Array.from({ length: chapter.lastLevel - chapter.firstLevel + 1 }, (_, index) => chapter.firstLevel + index)))
      .toEqual(Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1));
    const scenarios = Array.from({ length: TOTAL_LEVELS }, (_, index) => generateScenario(index + 1));
    expect(new Set(scenarios.map(scenario => scenario.title)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.lesson)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.takeaway)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.briefing?.focus)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.briefing?.gotcha)).size).toBe(TOTAL_LEVELS);
    for (const chapter of COURSE_CHAPTERS) {
      const lessons = scenarios.slice(chapter.firstLevel - 1, chapter.lastLevel);
      expect(lessons.map(scenario => scenario.curriculum!.briefing?.stage)).toEqual(['introduce', 'develop', 'apply']);
      for (const scenario of lessons) {
        const briefing = scenario.curriculum!.briefing!;
        expect(briefing.focus.trim().length).toBeGreaterThan(0);
        expect(briefing.gotcha.trim().length).toBeGreaterThan(0);
      }
    }
    expect(scenarios.slice(0, 3).every(scenario => scenario.balls.length === 2 && !scenario.objective)).toBe(true);
    expect(scenarios.filter(scenario => scenario.objective)).toHaveLength(10);
    expect(scenarios.at(-1)!.objective!.radius).toBeLessThan(scenarios[6].objective!.radius);
    expect(scenarios.at(-1)!.objective!.maxCutAngle).toBeLessThan(scenarios[6].objective!.maxCutAngle);
  });

  it('keeps numbered lessons, chapter position and completion percentage aligned', () => {
    expect(getCourseProgress(0)).toMatchObject({ completedLevels: 0, totalLevels: 18, percentage: 0, complete: false, chapterIndex: 0, lessonIndex: 0 });
    expect(getCourseProgress(3)).toMatchObject({ percentage: 17, chapterIndex: 1, lessonIndex: 0 });
    expect(getCourseProgress(9)).toMatchObject({ percentage: 50, chapterIndex: 3, lessonIndex: 0 });
    expect(getCourseProgress(17)).toMatchObject({ percentage: 94, complete: false, chapterIndex: 5, lessonIndex: 2 });
    expect(getCourseProgress(18)).toMatchObject({ percentage: 100, complete: true, completedLevels: 18 });
    expect(getCourseProgress(99)).toEqual(getCourseProgress(18));
    expect(getCourseProgress(-10)).toEqual(getCourseProgress(0));
    expect(getCourseProgress(Number.NaN)).toEqual(getCourseProgress(0));
    expect(generateScenario(-1).level).toBe(1);
    expect(generateScenario(Number.NaN).level).toBe(1);
    expect(generateScenario(Number.POSITIVE_INFINITY).seed).toBe(72350);
    expect(generateScenario(99).level).toBe(18);
  });

  // These seeds cover all four reflected orientations of every authored table.
  it.each(Array.from({ length: TOTAL_LEVELS }, (_, index) => [0, 1, 5, 8].map(seed => [index + 1, seed])).flat())('prepares authored level %i, seed %i without discarding its layout or learning objective', (level, seed) => {
    const scenario = generateScenario(level, seed);
    expect(generateScenario(level, seed)).toEqual(scenario);
    const chapter = COURSE_CHAPTERS[Math.floor((level - 1) / 3)];
    expect(scenario.curriculum).toMatchObject({ chapterId: chapter.id, chapterTitle: chapter.title, chapterIndex: Math.floor((level - 1) / 3), lessonIndex: (level - 1) % 3, lessonCount: 3 });
    for (const ball of scenario.balls) {
      expect(ball.position.x).toBeGreaterThan(TABLE.ballRadius);
      expect(ball.position.x).toBeLessThan(TABLE.length - TABLE.ballRadius);
      expect(ball.position.y).toBeGreaterThan(TABLE.ballRadius);
      expect(ball.position.y).toBeLessThan(TABLE.width - TABLE.ballRadius);
      for (const other of scenario.balls) if (other.id !== ball.id) expect(distance(ball.position, other.position)).toBeGreaterThan(TABLE.ballDiameter);
    }
    const prepared = prepareRound(scenario);
    expect(prepared.scenario.balls).toEqual(scenario.balls);
    expect(prepared.scenario.seed).toBe(scenario.seed);
    expect(prepared.scenario.curriculum).toEqual(scenario.curriculum);
    expect(prepared.balls.length).toBeGreaterThan(0);
    expect(prepared.balls.flatMap(ball => ball.options).some(option => analyzeShot(prepared.scenario, option.plan, 32).successRate > 0)).toBe(true);
    if (level <= 6) expect(prepared.balls.map(ball => ball.ballId)).toEqual(scenario.balls.filter(ball => ball.id !== 0).map(ball => ball.id));
    if (!scenario.objective) return;
    expect(prepared.scenario.objective).toMatchObject(scenario.objective);
    expect(prepared.scenario.objective!.target).toBeDefined();
    expect(prepared.balls.map(ball => ball.ballId)).toEqual([scenario.objective.ballId]);
    expect(prepared.balls[0].options.some(option => {
      const nominal = simulateShot(prepared.scenario, option.plan, { record: false });
      return evaluateShotObjective(prepared.scenario, option.plan, nominal).success;
    })).toBe(true);
  }, 30000);
});
