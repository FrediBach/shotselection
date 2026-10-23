import { TABLE } from './constants';
import { seededRandom } from './math';
import type { Ball, Scenario } from './types';

export interface CourseChapter {
  id: string;
  title: string;
  description: string;
  firstLevel: number;
  lastLevel: number;
}

export const COURSE_CHAPTERS: readonly CourseChapter[] = [
  { id: 'fundamentals', title: 'First strokes', description: 'Learn the pot, the angle and the cue-ball finish.', firstLevel: 1, lastLevel: 3 },
  { id: 'open-table', title: 'Everyday pool', description: 'Choose a reliable shot on an open table.', firstLevel: 4, lastLevel: 6 },
  { id: 'position', title: 'Play for position', description: 'Pot one ball and leave a usable shot on the next.', firstLevel: 7, lastLevel: 9 },
  { id: 'patterns', title: 'Build a pattern', description: 'Read a sequence before committing to its first shot.', firstLevel: 10, lastLevel: 12 },
  { id: 'traffic', title: 'Navigate traffic', description: 'Protect the next shot when other balls crowd the table.', firstLevel: 13, lastLevel: 15 },
  { id: 'tournament', title: 'Tournament table', description: 'Bring potting, position and small margins together.', firstLevel: 16, lastLevel: 18 },
];

export const TOTAL_LEVELS = 18;

interface Lesson {
  title: string;
  description: string;
  lesson: string;
  takeaway: string;
  /** Cue ball first, then object balls in numbered order. */
  layout: readonly (readonly [number, number])[];
  position?: { radius: number; maxCutAngle: number };
}

/** Authored layouts keep the teaching problem intact. Seeded reflections vary
 * its orientation without adding random blockers or changing the lesson. */
const LESSONS: readonly Lesson[] = [
  {
    title: 'Your first pot',
    description: 'One object ball, an open side pocket. Compare three ways to leave the cue ball.',
    lesson: 'Read the object-ball line first. Then compare how draw, center and follow change the cue-ball finish.',
    takeaway: 'A successful shot includes both the pot and a controlled cue-ball finish.',
    layout: [[1.12, 0.82], [1.27, 0.32]],
  },
  {
    title: 'Find the corner line',
    description: 'Move from the side pocket to a simple corner pot.',
    lesson: 'Trace the object ball toward the pocket and picture the contact point on its opposite side.',
    takeaway: 'Aim through the contact line; aiming at the center of an angled object ball changes its path.',
    layout: [[1.12, 0.82], [0.53, 0.36]],
  },
  {
    title: 'Let the cue ball travel',
    description: 'A gentle cut introduces sideways cue-ball movement.',
    lesson: 'On a cut shot, the cue ball keeps moving across the potting line. Compare the whole route, including cushions.',
    takeaway: 'An easy pot can still send the cue ball a long way. Read its route before choosing the finish.',
    layout: [[0.72, 0.90], [1.13, 0.36]],
  },
  {
    title: 'Two balls, one decision',
    description: 'Choose between two open pots and their cue-ball finishes.',
    lesson: 'Compare the cut angle and cue-ball travel for both balls before committing to the nearer one.',
    takeaway: 'The closest ball is not always the most forgiving shot.',
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39]],
  },
  {
    title: 'Distance or angle?',
    description: 'A shorter angled shot competes with a longer route.',
    lesson: 'Balance distance against cut angle. Look for a stroke that tolerates small errors in aim and speed.',
    takeaway: 'Shot difficulty comes from the whole route, not distance alone.',
    layout: [[0.65, 0.88], [1.18, 0.32], [1.94, 0.95]],
  },
  {
    title: 'Choose the comfortable stroke',
    description: 'Read three open balls and choose a dependable pot and finish.',
    lesson: 'Compare the available strokes as well as the balls. Extra speed or a large cue-ball journey can reduce your margin.',
    takeaway: 'Choose the finish you can reproduce, then judge it against the other available strokes.',
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]],
  },
  {
    title: 'Leave a shot on the 2',
    description: 'Pot the 1 and stop in the marked zone with a clear shot on the 2.',
    lesson: 'Inspect the 2 and the marked zone. Use each stroke\'s speed and backspin or topspin to predict where the cue ball will stop; the outcomes appear after you commit.',
    takeaway: 'Position is useful only when the next ball is still on the table and its shot is open.',
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39]],
    position: { radius: 0.20, maxCutAngle: 65 },
  },
  {
    title: 'Control the length',
    description: 'Finish inside a smaller zone after potting the 1.',
    lesson: 'Predict how far each stroke will send the cue ball. Compare speed and backspin or topspin, then check your predicted stopping point after committing.',
    takeaway: 'Too short and too long can both spoil position. Plan a stopping area before the shot.',
    layout: [[0.61, 0.88], [1.09, 0.35], [1.94, 0.85]],
    position: { radius: 0.19, maxCutAngle: 62 },
  },
  {
    title: 'Leave the useful angle',
    description: 'Pot the 1 and leave a manageable cut on the 2.',
    lesson: 'Picture the next shot from the marked zone, including its cut angle. Choose the speed and spin you expect to leave that useful line on the 2.',
    takeaway: 'Good position combines a controlled stopping point with a comfortable next-ball angle.',
    layout: [[1.86, 0.91], [1.39, 0.35], [0.48, 0.40]],
    position: { radius: 0.18, maxCutAngle: 58 },
  },
  {
    title: 'Read the whole table',
    description: 'Look beyond the first pot on a four-ball layout.',
    lesson: 'Inspect the remaining balls before picking an opening shot. Compare finishes for open space and access to the table.',
    takeaway: 'A pattern starts with reading every ball before taking the first one.',
    layout: [[0.68, 0.81], [1.12, 0.31], [1.91, 0.42], [2.12, 0.98], [0.40, 0.34]],
  },
  {
    title: 'Connect the first two',
    description: 'Play the 1 to the 2 while keeping the remaining balls in view.',
    lesson: 'Work backward from a playable shot on the 2. Predict which stroke on the 1 will carry the cue ball into its marked setup zone.',
    takeaway: 'Planning backward turns two separate pots into a deliberate sequence.',
    layout: [[0.76, 0.87], [1.14, 0.32], [1.86, 0.43], [2.10, 1.00]],
    position: { radius: 0.17, maxCutAngle: 55 },
  },
  {
    title: 'Keep the next lane open',
    description: 'A nearby ball makes the route to the 2 part of the decision.',
    lesson: 'Picture both the zone-to-2 line and the 2-to-pocket line. Predict a stroke that reaches the zone while leaving room for the next ball to pass.',
    takeaway: 'A visible target can still be blocked at the contact point or on its way to the pocket.',
    layout: [[0.66, 0.91], [1.10, 0.34], [1.95, 0.42], [1.57, 0.74]],
    position: { radius: 0.16, maxCutAngle: 52 },
  },
  {
    title: 'Find the open corridor',
    description: 'More balls create competing routes and crowded finishes.',
    lesson: 'Check the cue-ball route as well as the object-ball route. Prefer a finish that is less sensitive to nearby traffic.',
    takeaway: 'Traffic adds uncertainty even when the first pot looks open.',
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95], [0.41, 0.38], [1.43, 0.91]],
  },
  {
    title: 'Position through traffic',
    description: 'Pot the 1 and keep the 2 playable among four object balls.',
    lesson: 'Use the cut angle, speed and spin to predict the cue-ball route around traffic. A small change in stopping point can open or close the next line.',
    takeaway: 'Protect access to the next ball instead of accepting any successful pot.',
    layout: [[0.74, 0.83], [1.15, 0.34], [1.85, 0.40], [1.52, 0.88], [0.40, 0.39]],
    position: { radius: 0.15, maxCutAngle: 50 },
  },
  {
    title: 'A smaller window',
    description: 'Find a precise finish that leaves the 2 clear of surrounding balls.',
    lesson: 'Predict which speed and spin will stop the cue ball inside the narrow zone. After committing, inspect the spread to see how well the stroke tolerates small errors.',
    takeaway: 'Reliable position means landing inside a useful window despite small stroke errors.',
    layout: [[1.12, 0.82], [0.53, 0.36], [1.91, 0.85], [0.40, 0.93], [1.92, 0.39]],
    position: { radius: 0.14, maxCutAngle: 48 },
  },
  {
    title: 'The pressure pot',
    description: 'A longer opening shot must also leave shape on the 2.',
    lesson: 'Judge the pot and the position as one task. Predict the cue-ball travel from each stroke profile before committing, then check both outcomes in the result.',
    takeaway: 'Under pressure, evaluate the probability of completing the whole assignment.',
    layout: [[0.45, 0.97], [1.16, 0.33], [1.86, 0.40], [1.51, 0.91], [2.10, 1.02]],
    position: { radius: 0.14, maxCutAngle: 46 },
  },
  {
    title: 'Stay on the right side',
    description: 'Tight position and a stricter next-ball angle test your route choice.',
    lesson: 'Predict the finish from each stroke\'s speed and spin, then picture the angle it would leave on the 2. Aim for a clean line within the stricter cut limit.',
    takeaway: 'The right side of a ball is the side that preserves a usable next shot.',
    layout: [[0.62, 0.94], [1.11, 0.31], [1.97, 0.42], [1.51, 0.77], [0.35, 0.35], [2.16, 1.00]],
    position: { radius: 0.13, maxCutAngle: 43 },
  },
  {
    title: 'The tournament finish',
    description: 'Pot the 1, land in the tight zone and leave the 2 ready for the finish.',
    lesson: 'Read the pot and next-ball lane, then infer the cue-ball route and stopping point from each stroke profile. Commit to your prediction before inspecting the outcomes.',
    takeaway: 'A complete player plans the next shot, chooses a forgiving stroke and checks the result against that plan.',
    layout: [[0.54, 0.96], [1.12, 0.32], [1.92, 0.41], [1.51, 0.79], [0.35, 0.38], [2.14, 1.01], [0.92, 1.05]],
    position: { radius: 0.12, maxCutAngle: 40 },
  },
];

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
  const random = seededRandom(safeSeed);
  const lesson = LESSONS[safeLevel - 1];
  const { chapter, chapterIndex, lessonIndex, lessonCount } = getCourseProgress(safeLevel - 1);
  const mirrorX = safeLevel > 1 && random() > 0.5;
  const mirrorY = safeLevel > 1 && random() > 0.5;
  const balls: Ball[] = lesson.layout.map(([x, y], id) => ({
    id,
    position: { x: mirrorX ? TABLE.length - x : x, y: mirrorY ? TABLE.width - y : y },
  }));
  return {
    level: safeLevel,
    seed: safeSeed,
    title: lesson.title,
    description: lesson.description,
    balls,
    curriculum: { chapterId: chapter.id, chapterTitle: chapter.title, chapterIndex, lessonIndex, lessonCount, lesson: lesson.lesson, takeaway: lesson.takeaway },
    ...(lesson.position ? { objective: { kind: 'position' as const, ballId: 1, nextBallId: 2, ...lesson.position } } : {}),
  };
}
