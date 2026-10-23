import { describe, expect, it } from 'vitest';
import { analyzeShot } from './analysis';
import { TABLE, positionToleranceForLevel } from './constants';
import { clamp, distance, dot, normalize, subtract } from './math';
import { evaluateShotObjective } from './objectives';
import { simulateShot } from './physics';
import { prepareRound } from './preparation';
import { POCKET_GEOMETRY } from './table-geometry';
import { COURSE_CHAPTERS, generateScenario, getCourseProgress, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from './scenarios';

describe('authored pool curriculum', () => {
  it('covers every level once with eight distinct ten-lesson chapters', () => {
    expect(COURSE_CHAPTERS).toHaveLength(8);
    expect(LEVELS_PER_CHAPTER).toBe(10);
    expect(TOTAL_LEVELS).toBe(80);
    expect(COURSE_CHAPTERS.flatMap(chapter => Array.from({ length: chapter.lastLevel - chapter.firstLevel + 1 }, (_, index) => chapter.firstLevel + index)))
      .toEqual(Array.from({ length: TOTAL_LEVELS }, (_, index) => index + 1));
    const scenarios = Array.from({ length: TOTAL_LEVELS }, (_, index) => generateScenario(index + 1, 0));
    expect(new Set(scenarios.map(scenario => scenario.title)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => JSON.stringify([scenario.balls, scenario.objective]))).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.lesson)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.takeaway)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.briefing?.focus)).size).toBe(TOTAL_LEVELS);
    expect(new Set(scenarios.map(scenario => scenario.curriculum!.briefing?.gotcha)).size).toBe(TOTAL_LEVELS);
    for (const chapter of COURSE_CHAPTERS) {
      const lessons = scenarios.slice(chapter.firstLevel - 1, chapter.lastLevel);
      expect(lessons).toHaveLength(LEVELS_PER_CHAPTER);
      expect(lessons.map(scenario => scenario.curriculum!.briefing?.stage)).toEqual(['introduce', ...Array(5).fill('develop'), ...Array(4).fill('apply')]);
      for (const scenario of lessons) {
        const briefing = scenario.curriculum!.briefing!;
        expect(briefing.focus.trim().length).toBeGreaterThan(0);
        expect(briefing.gotcha.trim().length).toBeGreaterThan(0);
      }
    }
    expect(scenarios.slice(0, 10).every(scenario => scenario.balls.length === 2 && !scenario.objective)).toBe(true);
    expect(scenarios.slice(10, 20).every(scenario => scenario.balls.length >= 3 && !scenario.objective)).toBe(true);
    expect(scenarios.slice(20, 30).every(scenario => scenario.objective)).toBe(true);
    expect(scenarios.slice(50, 60).every(scenario => scenario.bank && !scenario.objective)).toBe(true);
    expect(scenarios.slice(60, 70).every(scenario => scenario.plant && !scenario.objective && !scenario.bank)).toBe(true);
    expect(scenarios.slice(70, 80).every(scenario => scenario.objective)).toBe(true);
  });

  it('tightens finishing precision throughout each scenario and next-shot requirements across position lessons', () => {
    for (const chapter of COURSE_CHAPTERS) {
      for (let level = chapter.firstLevel + 1; level <= chapter.lastLevel; level++) {
        expect(positionToleranceForLevel(level)).toBeLessThan(positionToleranceForLevel(level - 1));
      }
    }
    expect(positionToleranceForLevel(1)).toBe(0.19);
    expect(positionToleranceForLevel(TOTAL_LEVELS)).toBeCloseTo(0.08, 12);
    const objectives = Array.from({ length: TOTAL_LEVELS }, (_, index) => generateScenario(index + 1).objective).filter(objective => objective !== undefined);
    expect(objectives).toHaveLength(38);
    expect(objectives[0]).toMatchObject({ radius: 0.20, maxCutAngle: 65 });
    expect(objectives.at(-1)).toMatchObject({ radius: 0.12, maxCutAngle: 40 });
    for (let index = 1; index < objectives.length; index++) {
      expect(objectives[index].radius).toBeLessThan(objectives[index - 1].radius);
      expect(objectives[index].maxCutAngle).toBeLessThanOrEqual(objectives[index - 1].maxCutAngle);
    }
  });

  it('keeps numbered lessons, chapter position and completion percentage aligned', () => {
    expect(getCourseProgress(0)).toMatchObject({ completedLevels: 0, totalLevels: 80, percentage: 0, complete: false, chapterIndex: 0, lessonIndex: 0, lessonCount: 10 });
    expect(getCourseProgress(9)).toMatchObject({ percentage: 11, chapterIndex: 0, lessonIndex: 9 });
    expect(getCourseProgress(10)).toMatchObject({ percentage: 13, chapterIndex: 1, lessonIndex: 0 });
    expect(getCourseProgress(30)).toMatchObject({ percentage: 38, chapterIndex: 3, lessonIndex: 0 });
    expect(getCourseProgress(50)).toMatchObject({ percentage: 63, chapterIndex: 5, lessonIndex: 0, chapter: { id: 'banks' } });
    expect(getCourseProgress(59)).toMatchObject({ percentage: 74, complete: false, chapterIndex: 5, lessonIndex: 9 });
    expect(getCourseProgress(60)).toMatchObject({ percentage: 75, complete: false, chapterIndex: 6, lessonIndex: 0, chapter: { id: 'plants' } });
    expect(getCourseProgress(69)).toMatchObject({ percentage: 86, complete: false, chapterIndex: 6, lessonIndex: 9 });
    expect(getCourseProgress(70)).toMatchObject({ percentage: 88, complete: false, chapterIndex: 7, lessonIndex: 0, chapter: { id: 'tournament' } });
    expect(getCourseProgress(80)).toMatchObject({ percentage: 100, complete: true, completedLevels: 80 });
    expect(getCourseProgress(99)).toEqual(getCourseProgress(80));
    expect(getCourseProgress(-10)).toEqual(getCourseProgress(0));
    expect(getCourseProgress(Number.NaN)).toEqual(getCourseProgress(0));
    expect(generateScenario(-1).level).toBe(1);
    expect(generateScenario(Number.NaN).level).toBe(1);
    expect(generateScenario(Number.POSITIVE_INFINITY).seed).toBe(72350);
    expect(generateScenario(99).level).toBe(80);
  });

  // These seeds cover all four reflected orientations of every authored table.
  it.each(Array.from({ length: TOTAL_LEVELS }, (_, index) => [0, 1, 5, 8].map(seed => [index + 1, seed])).flat())('prepares authored level %i, seed %i without discarding its layout or learning objective', (level, seed) => {
    const scenario = generateScenario(level, seed);
    expect(generateScenario(level, seed)).toEqual(scenario);
    const chapter = COURSE_CHAPTERS[Math.floor((level - 1) / LEVELS_PER_CHAPTER)];
    expect(scenario.curriculum).toMatchObject({ chapterId: chapter.id, chapterTitle: chapter.title, chapterIndex: Math.floor((level - 1) / LEVELS_PER_CHAPTER), lessonIndex: (level - 1) % LEVELS_PER_CHAPTER, lessonCount: LEVELS_PER_CHAPTER });
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
    if (level <= 20) expect(prepared.balls.map(ball => ball.ballId)).toEqual(scenario.balls.filter(ball => ball.id !== 0).map(ball => ball.id));
    if (scenario.bank) {
      expect(prepared.scenario.bank).toEqual(scenario.bank);
      expect(prepared.balls.map(ball => ball.ballId)).toEqual([scenario.bank.ballId]);
      for (const option of prepared.balls[0].options) {
        const nominal = simulateShot(prepared.scenario, option.plan, { record: false });
        expect(nominal.cueBanksBeforeContact).toBeGreaterThanOrEqual(scenario.bank.minCushions);
        expect(evaluateShotObjective(prepared.scenario, option.plan, nominal).success).toBe(true);
      }
    }
    if (scenario.plant) {
      expect(prepared.scenario.plant).toEqual(scenario.plant);
      expect(prepared.balls.map(ball => ball.ballId)).toEqual([1, 3]);
      for (const option of prepared.balls[0].options) expect(option.plan.potBallId).toBe(2);
      for (const option of prepared.balls[1].options) {
        const nominal = simulateShot(prepared.scenario, option.plan, { record: false });
        expect(evaluateShotObjective(prepared.scenario, option.plan, nominal).success).toBe(true);
        const cue = scenario.balls[0].position;
        const free = scenario.balls[3].position;
        const pocket = POCKET_GEOMETRY[option.plan.pocketId].center;
        const direction = normalize(subtract(pocket, free));
        const cut = Math.acos(clamp(dot(direction, { x: Math.cos(option.plan.angle), y: Math.sin(option.plan.angle) }), -1, 1)) * 180 / Math.PI;
        // Every offered free-ball pot is either a substantial cut or a long
        // approach plus a long object-ball journey; never an easy nearby pot.
        expect(cut >= 30 || (distance(cue, free) + distance(free, pocket) >= 1.8 && distance(free, pocket) >= 0.9)).toBe(true);
      }
    }
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
