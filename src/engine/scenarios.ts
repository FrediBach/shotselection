import { TABLE } from './constants';
import { seededRandom } from './math';
import type { Ball, LessonBriefing, Scenario } from './types';

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
  briefing: Omit<LessonBriefing, 'stage'>;
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
    lesson: 'Potting sends the object ball into a pocket. Select the ball, then compare the three cue-ball finishes and their speed and spin before choosing one.',
    takeaway: 'A successful shot includes both the pot and a controlled cue-ball finish.',
    briefing: {
      focus: 'Plan where both balls go',
      gotcha: 'Pocketing the white cue ball is a scratch. Even if the object ball drops, that shot fails.',
    },
    layout: [[1.12, 0.82], [1.27, 0.32]],
  },
  {
    title: 'Find the corner line',
    description: 'Move from the side pocket to a simple corner pot.',
    lesson: 'Use the same pot-and-finish check at a corner pocket. Trace the object ball toward the pocket and picture the contact point on its opposite side.',
    takeaway: 'Aim through the contact line; aiming at the center of an angled object ball changes its path.',
    briefing: {
      focus: 'Read the contact line',
      gotcha: 'On an angled shot, the cue ball needs to meet the object ball off-center to send it toward the pocket.',
    },
    layout: [[1.12, 0.82], [0.53, 0.36]],
  },
  {
    title: 'Let the cue ball travel',
    description: 'A gentle cut introduces sideways cue-ball movement.',
    lesson: 'Put the potting line and cue-ball finish together. On this cut shot, picture the cue ball moving across the potting line, including any cushion rebounds.',
    takeaway: 'An easy pot can still send the cue ball a long way. Read its route before choosing the finish.',
    briefing: {
      focus: 'Follow the whole route',
      gotcha: 'Backspin does not always bring the cue ball straight back. The cut angle also shapes its route.',
    },
    layout: [[0.72, 0.90], [1.13, 0.36]],
  },
  {
    title: 'Two balls, one decision',
    description: 'Choose between two open pots and their cue-ball finishes.',
    lesson: 'You now choose the opening ball as well as its finish. Compare both pots: their cut angles, distances and the cue-ball travel each one needs.',
    takeaway: 'The closest ball is not always the most forgiving shot.',
    briefing: {
      focus: 'Compare before choosing',
      gotcha: 'The nearest ball can demand the thinner cut. Check the route to the pocket before favoring a short shot.',
    },
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39]],
  },
  {
    title: 'Distance or angle?',
    description: 'A shorter angled shot competes with a longer route.',
    lesson: 'Build on your two-ball comparison by weighing distance against cut angle. Decide which pot and finish are more likely to survive a small aim or speed error.',
    takeaway: 'Shot difficulty comes from the whole route, not distance alone.',
    briefing: {
      focus: 'Trade distance for a better angle',
      gotcha: 'A small aiming error grows over a longer journey. Judge both the cue-ball approach and the object-ball route.',
    },
    layout: [[0.65, 0.88], [1.18, 0.32], [1.94, 0.95]],
  },
  {
    title: 'Choose the comfortable stroke',
    description: 'Read three open balls and choose a dependable pot and finish.',
    lesson: 'Apply your comparison to three balls. Shortlist a comfortable pot, then compare its finishes against the other balls before locking in your shot.',
    takeaway: 'Choose the finish you can reproduce, then judge it against the other available strokes.',
    briefing: {
      focus: 'Choose a repeatable finish',
      gotcha: 'An easy pot can hide a demanding finish. Extra cue-ball travel gives speed errors more room to matter.',
    },
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]],
  },
  {
    title: 'Leave a shot on the 2',
    description: 'Pot the 1 and stop in the marked zone with a clear shot on the 2.',
    lesson: 'Position play adds a second job: pot the 1, stop in the cyan zone and leave the 2 playable. Predict the finish from each stroke\'s speed and spin; outcomes appear after you commit.',
    takeaway: 'Position is useful only when the next ball is still on the table and its shot is open.',
    briefing: {
      focus: 'Plan the next shot now',
      gotcha: 'All three strokes can pot the 1. That alone does not mean they reach the zone or leave a shot on the 2.',
    },
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39]],
    position: { radius: 0.20, maxCutAngle: 65 },
  },
  {
    title: 'Control the length',
    description: 'Finish inside a smaller zone after potting the 1.',
    lesson: 'Keep the same pot-zone-next-shot routine, now with less room to stop. Predict which stroke finishes short, near the middle or long, then check your prediction after committing.',
    takeaway: 'Too short and too long can both spoil position. Plan a stopping area before the shot.',
    briefing: {
      focus: 'Calibrate your stopping distance',
      gotcha: 'Speed alone does not tell you the finish. Backspin and topspin change the cue ball\'s motion after contact.',
    },
    layout: [[0.61, 0.88], [1.09, 0.35], [1.94, 0.85]],
    position: { radius: 0.19, maxCutAngle: 62 },
  },
  {
    title: 'Leave the useful angle',
    description: 'Pot the 1 and leave a manageable cut on the 2.',
    lesson: 'Add the next-ball angle to your stopping-distance judgment. Picture the shot on the 2 from your predicted finish and choose a stroke that leaves a manageable cut.',
    takeaway: 'Good position combines a controlled stopping point with a comfortable next-ball angle.',
    briefing: {
      focus: 'Leave an angle you can use',
      gotcha: 'Getting close to the 2 is not the goal. You need the zone and an open shot within the stated cut limit.',
    },
    layout: [[1.86, 0.91], [1.39, 0.35], [0.48, 0.40]],
    position: { radius: 0.18, maxCutAngle: 58 },
  },
  {
    title: 'Read the whole table',
    description: 'Look beyond the first pot on a four-ball layout.',
    lesson: 'A pattern connects one shot to the next. Scan all four balls before choosing your opener, then compare finishes for open space and access to another ball.',
    takeaway: 'A pattern starts with reading every ball before taking the first one.',
    briefing: {
      focus: 'See more than the opening pot',
      gotcha: 'A tidy first pot can leave the cue ball behind another ball. Check what each finish lets you see.',
    },
    layout: [[0.68, 0.81], [1.12, 0.31], [1.91, 0.42], [2.12, 0.98], [0.40, 0.34]],
  },
  {
    title: 'Connect the first two',
    description: 'Play the 1 to the 2 while keeping the remaining balls in view.',
    lesson: 'Turn your whole-table scan into a two-ball plan. Work backward from a playable shot on the 2, then predict which stroke on the 1 reaches its setup zone.',
    takeaway: 'Planning backward turns two separate pots into a deliberate sequence.',
    briefing: {
      focus: 'Work backward from the 2',
      gotcha: 'Keep the 2 on the table. Accidentally potting it while playing the 1 removes the next shot this lesson requires.',
    },
    layout: [[0.76, 0.87], [1.14, 0.32], [1.86, 0.43], [2.10, 1.00]],
    position: { radius: 0.17, maxCutAngle: 55 },
  },
  {
    title: 'Keep the next lane open',
    description: 'A nearby ball makes the route to the 2 part of the decision.',
    lesson: 'Test your two-ball plan against the nearby blocker. Picture both the cue-ball approach to the 2 and the 2-to-pocket route before predicting your finish.',
    takeaway: 'A visible target can still be blocked at the contact point or on its way to the pocket.',
    briefing: {
      focus: 'Check both halves of the next shot',
      gotcha: 'Seeing the center of the 2 is not enough. The cue ball must reach the right contact point with room to pass.',
    },
    layout: [[0.66, 0.91], [1.10, 0.34], [1.95, 0.42], [1.57, 0.74]],
    position: { radius: 0.16, maxCutAngle: 52 },
  },
  {
    title: 'Find the open corridor',
    description: 'More balls create competing routes and crowded finishes.',
    lesson: 'Traffic means other balls crowd the pot or the cue-ball route. Read both paths and choose an opening shot with room around nearby balls.',
    takeaway: 'Traffic adds uncertainty even when the first pot looks open.',
    briefing: {
      focus: 'Find room for the whole ball',
      gotcha: 'A visible gap may still be too narrow. Picture the full width of the moving ball, not just its center line.',
    },
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95], [0.41, 0.38], [1.43, 0.91]],
  },
  {
    title: 'Position through traffic',
    description: 'Pot the 1 and keep the 2 playable among four object balls.',
    lesson: 'Add position to your traffic check. Use the cut angle, speed and spin to predict a route into the zone that keeps access to the 2 open.',
    takeaway: 'Protect access to the next ball instead of accepting any successful pot.',
    briefing: {
      focus: 'Protect the next-ball lane',
      gotcha: 'Brushing a traffic ball can change your finish even when the 1 drops. Include possible contacts in your prediction.',
    },
    layout: [[0.74, 0.83], [1.15, 0.34], [1.85, 0.40], [1.52, 0.88], [0.40, 0.39]],
    position: { radius: 0.15, maxCutAngle: 50 },
  },
  {
    title: 'A smaller window',
    description: 'Find a precise finish that leaves the 2 clear of surrounding balls.',
    lesson: 'Apply your route and stopping-distance checks to a smaller window. Predict the best stroke, then inspect the finish spread after committing to see how often it holds position.',
    takeaway: 'Reliable position means landing inside a useful window despite small stroke errors.',
    briefing: {
      focus: 'Leave room for a small error',
      gotcha: 'A finish near the edge of the zone has little spare room. One good replay does not show the whole spread.',
    },
    layout: [[1.12, 0.82], [0.53, 0.36], [1.91, 0.85], [0.40, 0.93], [1.92, 0.39]],
    position: { radius: 0.14, maxCutAngle: 48 },
  },
  {
    title: 'The pressure pot',
    description: 'A longer opening shot must also leave shape on the 2.',
    lesson: 'Tournament layouts combine longer pots, traffic and tighter position. Use your full routine: read the pot, predict the cue-ball route and check the next shot before committing.',
    takeaway: 'Under pressure, evaluate the probability of completing the whole assignment.',
    briefing: {
      focus: 'Bring the whole routine together',
      gotcha: 'A high pot rate can hide poor position. After committing, compare full-success rates as well as pots.',
    },
    layout: [[0.45, 0.97], [1.16, 0.33], [1.86, 0.40], [1.51, 0.91], [2.10, 1.02]],
    position: { radius: 0.14, maxCutAngle: 46 },
  },
  {
    title: 'Stay on the right side',
    description: 'Tight position and a stricter next-ball angle test your route choice.',
    lesson: 'Keep your full routine and sharpen the next-shot check. Predict each finish from speed and spin, then picture its angle on the 2 under the stricter cut limit.',
    takeaway: 'The right side of a ball is the side that preserves a usable next shot.',
    briefing: {
      focus: 'Choose the useful side of the 2',
      gotcha: 'An unobstructed line can still be too thin. Being inside the zone does not waive the next-shot angle limit.',
    },
    layout: [[0.62, 0.94], [1.11, 0.31], [1.97, 0.42], [1.51, 0.77], [0.35, 0.35], [2.16, 1.00]],
    position: { radius: 0.13, maxCutAngle: 43 },
  },
  {
    title: 'The tournament finish',
    description: 'Pot the 1, land in the tight zone and leave the 2 ready for the finish.',
    lesson: 'Make your final plan independently: pot, route, stopping point and next-ball angle. Predict the most forgiving stroke, commit, then compare the result with the plan you made.',
    takeaway: 'A complete player plans the next shot, chooses a forgiving stroke and checks the result against that plan.',
    briefing: {
      focus: 'Trust a complete, testable plan',
      gotcha: 'The prettiest route may not be the most reliable. Use the trial results to learn which part of your plan needs work.',
    },
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
    curriculum: {
      chapterId: chapter.id, chapterTitle: chapter.title, chapterIndex, lessonIndex, lessonCount,
      lesson: lesson.lesson, takeaway: lesson.takeaway,
      briefing: { ...lesson.briefing, stage: lessonIndex === 0 ? 'introduce' : lessonIndex === 1 ? 'develop' : 'apply' },
    },
    ...(lesson.position ? { objective: { kind: 'position' as const, ballId: 1, nextBallId: 2, ...lesson.position } } : {}),
  };
}
