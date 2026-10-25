import { LEVEL_DEFINITIONS } from '../levels';
import { COURSE_CHAPTERS, TOTAL_LEVELS } from './course';
import { scenarioFromLevel, validateLevelDefinition } from './level-config';
import type { Scenario } from './types';

export { COURSE_CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from './course';
export type { CourseChapter } from './course';

/** Level JSON is the source of truth; validate the complete course at startup. */
export const COURSE_LEVELS = LEVEL_DEFINITIONS.map(validateLevelDefinition);
if (COURSE_LEVELS.length !== TOTAL_LEVELS || COURSE_LEVELS.some((definition, index) => definition.scenario.level !== index + 1)
  || new Set(COURSE_LEVELS.map(definition => definition.id)).size !== TOTAL_LEVELS) {
  throw new Error('Level files must provide each course number exactly once with unique IDs.');
}

export function getCourseProgress(completedLevels: number) {
  const completed = Number.isFinite(completedLevels) ? Math.max(0, Math.min(TOTAL_LEVELS, Math.floor(completedLevels))) : 0;
  const currentLevel = Math.min(TOTAL_LEVELS, completed + 1);
  const chapterIndex = COURSE_CHAPTERS.findIndex(chapter => currentLevel <= chapter.lastLevel);
  const chapter = COURSE_CHAPTERS[chapterIndex];
  return {
    completedLevels: completed,
    totalLevels: TOTAL_LEVELS,
    percentage: Math.round(completed / TOTAL_LEVELS * 100),
    complete: completed === TOTAL_LEVELS,
    chapter,
    chapterIndex,
    lessonIndex: currentLevel - chapter.firstLevel,
    lessonCount: chapter.lastLevel - chapter.firstLevel + 1,
  };
}

export function generateScenario(level: number, seed = 71431 + level * 919): Scenario {
  const safeLevel = Number.isFinite(level) ? Math.max(1, Math.min(TOTAL_LEVELS, Math.floor(level))) : 1;
  const safeSeed = Number.isFinite(seed) ? seed : 71431 + safeLevel * 919;
  return scenarioFromLevel(COURSE_LEVELS[safeLevel - 1], { seed: safeSeed, applyVariation: true });
}
