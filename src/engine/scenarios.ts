import { TABLE } from './constants';
import { COURSE_CHAPTERS, TOTAL_LEVELS } from './course';
import { seededRandom } from './math';
import { BROKEN_LESSONS } from './broken-lessons';
import { reflectTableConditions } from './table-conditions';
import type { Ball, LessonBriefing, LessonLearning, Scenario, TableConditions, TrickObjective } from './types';

export { COURSE_CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from './course';
export type { CourseChapter } from './course';

export interface Lesson {
  learning?: LessonLearning;
  title: string;
  description: string;
  lesson: string;
  takeaway: string;
  englishPractice?: number;
  briefing: Omit<LessonBriefing, 'stage'>;
  /** Cue ball first, then object balls in numbered order. */
  layout: readonly (readonly [number, number])[];
  position?: { radius: number; maxCutAngle: number };
  bank?: { ballId: number; minCushions: number };
  plant?: { ballId: number; targetBallId: number; pocketId: number };
  trick?: TrickObjective;
  conditions?: TableConditions;
}

/** Authored layouts keep the teaching problem intact. Seeded reflections vary
 * its orientation without adding random blockers or changing the lesson. */
const LESSONS: readonly Lesson[] = [
  // First strokes: introduce one idea, develop it, then combine it with tighter demands.
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
    title: 'A longer direct pot',
    description: 'Keep the contact line steady over a longer approach.',
    lesson: 'With a modest cut and a longer approach, compare how center ball, draw and follow change the finish. The extra distance makes a small aim error easier to see.',
    takeaway: 'A direct pot still needs an exact contact line and a planned stopping point.',
    briefing: {
      focus: 'Hold the line over distance',
      gotcha: 'A straight-looking pot can miss when the cue ball reaches the object ball even slightly off-center.',
    },
    layout: [[1.06, 1.06], [1.27, 0.32]],
  },
  {
    learning: { concept: 'cut-paths', prerequisite: 'contact-line', comparison: 'cut-paths' },
    title: 'Meet the ball off-center',
    description: 'Read a moderate cut into the side pocket.',
    lesson: 'The object ball sits to one side of your approach. Find the contact line behind it, then use the cut to predict which way the cue ball will leave.',
    takeaway: 'On a cut, the cue-ball approach and object-ball path point in different directions.',
    briefing: {
      focus: 'Separate the two ball paths',
      gotcha: 'The line from the cue ball to the pocket is not the line the object ball must follow.',
    },
    layout: [[0.7, 1.03], [1.14, 0.32]],
  },
  {
    title: 'Draw without guessing',
    description: 'Compare backspin with the other finishes on a corner pot.',
    lesson: 'Read the longer corner approach before choosing spin. Predict whether draw will shorten the cue-ball journey or pull it across the table, then inspect the actual finish.',
    takeaway: 'Draw is a route choice whose result depends on the contact angle as well as the spin.',
    briefing: {
      focus: 'Predict the draw finish',
      gotcha: 'Backspin and a soft stroke are different controls; one cannot reliably stand in for the other.',
    },
    layout: [[1.20, 0.94], [0.53, 0.36]],
  },
  {
    title: 'Follow beyond contact',
    description: 'Track the cue ball after a longer pot toward the far corner.',
    lesson: 'Topspin carries the cue ball onward after contact. Compare its whole route with center ball and draw, including the space between the object ball and the cushion.',
    takeaway: 'Follow needs enough room beyond contact for the cue ball to slow safely.',
    briefing: {
      focus: 'Allow room for forward travel',
      gotcha: 'The object ball leaving the table does not stop the cue ball; forward roll continues into the space behind it.',
    },
    layout: [[1.04, 1.07], [1.89, 0.39]],
  },
  {
    learning: { concept: 'post-contact-rebound', prerequisite: 'cut-paths', comparison: 'cue-rebound' },
    title: 'Read the first cushion',
    description: 'A longer diagonal approach makes the rebound worth checking.',
    lesson: 'Trace each predicted finish all the way to rest. When a route reaches a cushion, continue the line after the rebound instead of treating the rail as the endpoint.',
    takeaway: 'A cushion changes the route, but speed and spin still decide where that route ends.',
    briefing: {
      focus: 'Continue the line past the rail',
      gotcha: 'A cue ball can return across its earlier path after a rebound, so the first cushion is not a safe stopping assumption.',
    },
    layout: [[0.4, 1.1], [1.18, 0.31]],
  },
  {
    title: 'Pace the diagonal',
    description: 'Balance potting pace with cue-ball travel on a long diagonal.',
    lesson: 'This approach asks you to carry enough speed to the object ball without losing control afterward. Compare the strength of all three strokes before deciding where each one stops.',
    takeaway: 'Longer approaches need deliberate pace, not an automatic choice of the hardest stroke.',
    briefing: {
      focus: 'Budget speed for the whole shot',
      gotcha: 'Extra strength can rescue a slow object ball while sending the cue ball well beyond the intended finish.',
    },
    layout: [[0.26, 1.10], [1.18, 0.31]],
  },
  {
    englishPractice: 12,
    title: 'Keep the long pot simple',
    description: 'Choose a controlled finish after a demanding cross-table approach.',
    lesson: 'English means side spin, separate from draw and follow. On this longer pot, compare one English option with two strokes without it. Read the contact line, pace and any cushion rebound all the way to the finish.',
    takeaway: 'A reliable long pot starts with a clear contact line and an understandable cue-ball route.',
    briefing: {
      focus: 'Combine line and pace',
      gotcha: 'A long approach magnifies an aiming mistake before spin has any chance to affect the finish.',
    },
    layout: [[0.39, 1.08], [1.55, 0.48]],
  },
  {
    englishPractice: 18,
    title: 'Let the cue ball travel',
    description: 'A long approach brings the contact line, pace and cue-ball route together.',
    lesson: 'Put the potting line, pace and cue-ball finish together. Read the left or right English setting alongside draw and follow, and picture the cue ball crossing the potting line and rebounding before it stops.',
    takeaway: 'An easy pot can still send the cue ball a long way. Read its route before choosing the finish.',
    briefing: {
      focus: 'Follow the whole route',
      gotcha: 'Backspin does not always bring the cue ball straight back. The cut angle also shapes its route.',
    },
    layout: [[0.34, 1.08], [1.55, 0.48]],
  },
  // Everyday pool: introduce one idea, develop it, then combine it with tighter demands.
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
    learning: { concept: 'object-travel-error', prerequisite: 'contact-line', comparison: 'object-travel', pockets: [{ ballId: 1, pocketId: 1 }, { ballId: 2, pocketId: 2 }] },
    title: 'Distance beyond contact',
    description: 'Similar approaches send the object balls different distances to their pockets.',
    lesson: 'The cue-ball approaches and cuts are nearly matched. Compare the distance each object ball travels after contact. Predict which route spreads the same small outgoing direction error farther by the time it reaches the pocket.',
    takeaway: 'The same direction error creates a larger sideways miss over a longer object-ball journey.',
    briefing: {
      focus: 'Separate object-ball travel from cue approach',
      gotcha: 'These approaches are nearly equal; the new difference is beyond contact. The error illustration holds outgoing direction error fixed, not every feature of the whole stroke.',
    },
    layout: [[0.65, 0.85], [0.907, 0.544], [1.036, 0.746]],
  },
  {
    learning: { concept: 'cue-position-asymmetry', prerequisite: 'contact-line', comparison: 'off-center-cue', pockets: [{ ballId: 1, pocketId: 0 }, { ballId: 2, pocketId: 2 }] },
    title: 'Compare the corner pots',
    description: 'Symmetric object balls and corner pockets, with the cue ball slightly off-center.',
    lesson: 'Both object balls sit symmetrically relative to their corner pockets. Only the cue ball is off-center. Predict which pot now needs the fuller contact; after your shot, compare both actual approaches with a centered-cue reference.',
    takeaway: 'Moving only the cue ball changes both approach angles while the object-to-pocket lines stay fixed.',
    briefing: {
      focus: 'Find the asymmetry introduced by the cue ball',
      gotcha: 'Symmetry in the pockets does not guarantee symmetry in the shots when the cue ball starts off-center.',
    },
    layout: [[1.18, 0.90], [0.55, 0.35], [1.99, 0.35]],
  },
  {
    learning: { concept: 'pocket-entry-angle', prerequisite: 'cut-paths', comparison: 'pocket-entry', pockets: [{ ballId: 1, pocketId: 1 }, { ballId: 2, pocketId: 2 }] },
    title: 'Read the pocket opening',
    description: 'An oblique side-pocket entry competes with a straight-on corner entry.',
    lesson: 'Separate the cut at the object ball from its entry into the pocket. Look along each object-ball route and predict which pocket mouth offers more room across that direction of travel. Then compare the whole strokes, including their different cuts and finishes.',
    takeaway: 'An oblique entry reduces the opening seen along the ball’s path; a cleaner pocket entry can still require a harder cut.',
    briefing: {
      focus: 'Read pocket entry separately from cut angle',
      gotcha: 'The side pocket is wider nose to nose, but its opening looks narrower from an oblique approach. Mouth clearance alone does not predict a pot: jaws, shelf, pace and cut still matter.',
    },
    layout: [[0.40, 0.83], [0.98, 0.34], [1.90, 0.64]],
  },
  {
    learning: { concept: 'post-contact-scratch-line', prerequisite: 'cut-paths', comparison: 'scratch-line' },
    title: 'Spot the scratch line',
    description: 'Find a pot whose cue-ball continuation points toward a pocket.',
    lesson: 'An attractive pot can leave a scratch line beyond contact. Compare an offered stroke with a faster demonstration using the same aim and spin. Predict which keeps the cue ball on the table, then inspect the actual route into the pocket before choosing your scored shot.',
    takeaway: 'Read the cue-ball continuation toward pockets; extra pace can turn a legal pot into a scratch.',
    briefing: {
      focus: 'Identify the scratch line after contact',
      gotcha: 'The object ball can drop in both demonstrations. A scratch still loses the shot, and these extra demonstration strokes are not scored choices.',
    },
    layout: [[1.18, 0.90], [1.30, 0.45], [1.90, 0.75]],
  },
  {
    title: 'Three ways to begin',
    description: 'A third ball adds another pot and another family of finishes.',
    lesson: 'Compare all three balls using the same order: contact angle, distance, then cue-ball route. Keep the comparison consistent so an attractive pocket does not decide for you.',
    takeaway: 'A consistent comparison makes a larger choice of open shots easier to manage.',
    briefing: {
      focus: 'Use the same checks on every ball',
      gotcha: 'Changing your judging rule for the last ball can make a risky shot seem better than the others.',
    },
    layout: [[0.67, 0.92], [1.17, 0.32], [1.86, 0.41], [1.91, 0.95]],
  },
  {
    learning: { concept: 'avoidable-cushion-variation', prerequisite: 'post-contact-rebound', comparison: 'avoidable-cushion' },
    title: 'Avoid an unnecessary rail',
    description: 'Compare stopping before a cushion with landing at the rebound boundary.',
    lesson: 'A small pace error can decide whether a route reaches the rail at all. Compare two demonstrations with the same aim and spin, then inspect five speed-only probes around each. Choose a scored stroke after accounting for this extra route change.',
    takeaway: 'Leaving room before the rail avoids a boundary where a small speed change adds a rebound.',
    briefing: {
      focus: 'Protect against an avoidable rebound',
      gotcha: 'A rail can help some shots. Here, count which speed probes rebound and inspect their endpoints rather than assuming every rebound is worse.',
    },
    layout: [[0.70, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]],
  },
  {
    learning: { concept: 'cut-energy-transfer', prerequisite: 'cut-paths', comparison: 'cut-transfer', pockets: [{ ballId: 1, pocketId: 0 }, { ballId: 2, pocketId: 2 }] },
    title: 'Budget pace for the cut',
    description: 'Compare fuller and thinner contacts with similar travel distances.',
    lesson: 'At nearly equal incoming cue speed, a thinner contact sends less speed into the object ball. Compare the measured speeds just before and after contact, then see whether adding pace rescues the thinner pot. The demonstrations keep launch spin fixed at center ball.',
    takeaway: 'Budget pace for the cut: a thinner contact can leave the object ball short while the cue ball retains more motion.',
    briefing: {
      focus: 'Connect cut angle to transferred speed',
      gotcha: 'Equal launch speed does not guarantee equal speed at contact. Check the measured incoming speeds before attributing the outgoing difference to the cut.',
    },
    layout: [[1.33, 1.13], [0.65, 0.55], [1.80, 0.37], [0.35, 0.90]],
  },
  {
    learning: { concept: 'two-ball-shortlist', prerequisite: 'opening-ball-choice', comparison: 'shortlist' },
    title: 'Shortlist four open balls',
    description: 'Record two promising balls, compare their routes and strokes, then pick an opener.',
    lesson: 'Mark exactly two balls for your shortlist. Compare their contact lines and three familiar draw, center and follow strokes side by side. Choose your opener from that pair; you can return and change the shortlist before committing.',
    takeaway: 'A deliberate shortlist keeps a larger table from turning into a rushed guess.',
    briefing: {
      focus: 'Narrow the field deliberately',
      gotcha: 'The first playable ball is only a candidate; another ball may offer a much simpler finish.',
    },
    layout: [[0.73, 0.80], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95], [0.41, 0.38]],
  },
  {
    englishPractice: 18,
    learning: { concept: 'sampling-near-tie', prerequisite: 'two-ball-shortlist', comparison: 'near-tie' },
    title: 'Recognize a near tie',
    description: 'Learn when a small sampled success-rate difference is too weak to trust.',
    lesson: 'Choose a whole stroke using the familiar pace, draw, follow and English controls. After the trials, compare two close options under the same indexed stroke errors. Decide whether their small success-rate gap establishes an advantage or calls for more evidence.',
    takeaway: 'A tiny sampled edge is not proof of a safer stroke, and a near tie does not prove identical chances.',
    briefing: {
      focus: 'Recognize uncertainty in a near tie',
      gotcha: 'The game score also rewards finish quality. This comparison asks only about complete success rates; it does not erase differences in cue-ball control.',
    },
    layout: [[0.73, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95], [0.41, 0.38]],
  },
  // Play for position: introduce one idea, develop it, then combine it with tighter demands.
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
    position: { radius: 0.200, maxCutAngle: 65 },
  },
  {
    learning: { concept: 'contact-roll-state', prerequisite: 'position-zone', comparison: 'contact-roll', pockets: [{ ballId: 1, pocketId: 1 }] },
    title: 'Calibrate a stop shot',
    description: 'Distinguish sliding from forward roll at a nearly full contact.',
    lesson: 'A stop shot needs almost no forward or backward rotation at contact, not necessarily a center-ball hit at launch. Compare the measured roll state at this nearly full contact. Predict which stroke stops close to contact and which carries forward, then check the actual paths.',
    takeaway: 'Calibrate the rotation that arrives at the object ball: sliding with little rotation can stop at a full contact, while forward roll carries on.',
    briefing: {
      focus: 'Read spin at contact, not just at launch',
      gotcha: 'Sliding is not the same as rolling. Cloth changes rotation during the approach; these complete strokes vary pace and launch spin together.',
    },
    layout: [[1.27, 1.05], [1.27, 0.40], [1.94, 0.85]],
    position: { radius: 0.198, maxCutAngle: 64 },
  },
  {
    learning: { concept: 'zone-boundary-margin', prerequisite: 'position-zone', comparison: 'zone-margin' },
    title: 'Compare center and edge',
    description: 'Compare two legal finishes inside the same zone, with different boundary margins.',
    lesson: 'Both the central and near-edge finishes pot the 1 and preserve a shot on the 2. Predict which has more geometric room before leaving the common zone, then compare how many matched error trials remain inside. The counts test whole strokes, not position alone.',
    takeaway: 'A central finish leaves more geometric margin. Check whether the complete stroke keeps that advantage under error.',
    briefing: {
      focus: 'Use the whole landing area',
      gotcha: 'Reaching the edge once gives little evidence that the same stroke will hold the zone repeatedly.',
    },
    layout: [[0.82, 0.9], [1.15, 0.33], [1.91, 0.9]],
    position: { radius: 0.196, maxCutAngle: 64 },
  },
  {
    learning: { concept: 'backward-contact-planning', prerequisite: 'position-zone', comparison: 'backward-plan' },
    title: 'Plan backward from the 2',
    description: 'Find the next contact point before choosing the opening stroke.',
    lesson: 'Start with the highlighted pocket for ball 2. Choose which side its cue-ball contact center belongs on, then reveal sampled landing points that can reach that contact. Finally choose the opening stroke. Afterward, check the planned route from each actual finish.',
    takeaway: 'Work backward: pocket, contact point, compatible landing area, then the opening stroke.',
    briefing: {
      focus: 'Rebuild the plan from the next ball',
      gotcha: 'The dots are geometric checks, not guaranteed pots. The scored objective still accepts any permitted next pocket; this planning route is practice.',
    },
    layout: [[1.81, 0.94], [1.4, 0.33], [0.52, 0.85]],
    position: { radius: 0.194, maxCutAngle: 63 },
  },
  {
    learning: { concept: 'next-angle-trap', prerequisite: 'backward-contact-planning', comparison: 'next-angle-trap' },
    title: 'Choose angle over closeness',
    description: 'Pot the 1 and leave a manageable cut on the 2.',
    lesson: 'Two offered finishes reach the same zone. The nearer finish leaves no next route within the cut limit, while a farther finish preserves a playable angle. Predict which in-zone stroke falls into that trap, then compare the actual next-shot angles.',
    takeaway: 'Closer is not always better: a finish can reach the zone but leave only excessive next-shot cuts.',
    briefing: {
      focus: 'Leave an angle you can use',
      gotcha: 'Getting close to the 2 is not the goal. You need the zone and an open shot within the stated cut limit.',
    },
    layout: [[1.86, 0.91], [1.39, 0.35], [0.9, 0.15]],
    position: { radius: 0.192, maxCutAngle: 62 },
  },
  {
    learning: { concept: 'contact-point-access', prerequisite: 'next-angle-trap', comparison: 'contact-access' },
    title: 'Leave room for the contact',
    description: 'Seeing the next ball does not guarantee access to its contact point.',
    lesson: 'Compare two finishes inside the same zone. From the close finish, the cue can see ball 2 but hits it before reaching the contact center required for the highlighted pocket. A more distant finish reaches that contact from the correct side. Inspect the enlarged clearance diagram before judging closeness as an advantage.',
    takeaway: 'Useful position leaves access to the next contact point, not just a view of the ball.',
    briefing: {
      focus: 'Allow room before the next contact',
      gotcha: 'Finishing almost on top of the 2 can make an otherwise visible pot awkward or unavailable.',
    },
    layout: [[1.86, 0.91], [1.39, 0.35], [0.3, 0.1]],
    position: { radius: 0.190, maxCutAngle: 62 },
  },
  {
    learning: { concept: 'draw-decay', prerequisite: 'contact-point-access', comparison: 'draw-decay' },
    title: 'Keep draw through the approach',
    description: 'Backspin at launch can disappear before contact.',
    lesson: 'Compare matched short and long approaches at the same launch speed and backspin. Inspect the spin remaining at contact, then see how stronger initial backspin restores draw on the longer approach. Apply that distinction when judging your scored finish.',
    takeaway: 'Judge draw by the backspin remaining at contact, not just the spin applied at launch.',
    briefing: {
      focus: 'Retain backspin until contact',
      gotcha: 'Cloth friction can remove the initial backspin during a longer approach.',
    },
    layout: [[1.98, 0.96], [1.4, 0.33], [0.48, 0.43]],
    position: { radius: 0.188, maxCutAngle: 61 },
  },
  {
    title: 'Control the deeper approach',
    description: 'Extra distance to the 1 tests speed control before a precise finish.',
    lesson: 'Account for the longer cue-ball approach when judging stroke strength. Keep the final zone and the angle on the 2 in the same plan instead of treating them as separate problems.',
    takeaway: 'The approach uses speed before contact; the remaining motion still has to serve position.',
    briefing: {
      focus: 'Connect approach speed to position',
      gotcha: 'A familiar strength can finish differently when the cue ball travels farther before it reaches the 1.',
    },
    layout: [[0.48, 1.0], [1.13, 0.32], [1.92, 0.86]],
    position: { radius: 0.186, maxCutAngle: 60 },
  },
  {
    englishPractice: 18,
    title: 'Hold a useful side',
    description: 'The next ball requires a more deliberate angle from the zone.',
    lesson: 'Picture the shot on the 2 from both sides of your predicted finish. One option adds English: read its route alongside pace and draw or follow, then check whether it leaves a cut inside the tighter limit.',
    takeaway: 'Good position respects the next shot even when the cue ball is already inside the landing area.',
    briefing: {
      focus: 'Check the angle from the finish',
      gotcha: 'A clear line to the 2 may still exceed the permitted cut angle.',
    },
    layout: [[1.99, 1.04], [1.38, 0.32], [0.45, 0.83]],
    position: { radius: 0.184, maxCutAngle: 60 },
  },
  {
    englishPractice: 18,
    title: 'Complete the two-ball plan',
    description: 'Combine a longer first pot, a smaller zone and the next-ball check.',
    lesson: 'Make the full two-ball plan before committing: contact on the 1, cue-ball route, stopping point, then a playable 2. Include English alongside pace and draw or follow; a different rebound still has to deliver the shared zone and next shot.',
    takeaway: 'A two-ball plan succeeds only when potting, stopping and next-shot access all work together.',
    briefing: {
      focus: 'Make all three checks agree',
      gotcha: 'A successful first pot cannot compensate for missing the zone or losing the next shot.',
    },
    layout: [[0.42, 1.01], [1.15, 0.32], [1.97, 0.43]],
    position: { radius: 0.182, maxCutAngle: 59 },
  },
  // Build a pattern: introduce one idea, develop it, then combine it with tighter demands.
  {
    title: 'Read the whole table',
    description: 'Look beyond the first pot on a four-ball layout.',
    lesson: 'Practice scanning all four balls before choosing your opener. Compare the first pot and cue-ball finish; this opening exercise does not score access to a particular next ball.',
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
    position: { radius: 0.180, maxCutAngle: 58 },
  },
  {
    title: 'Reserve the second ball',
    description: 'Plan the 1-to-2 link while a third object ball shares the table.',
    lesson: 'Identify the 2 before reading your opening stroke. Keep it available during the cue-ball route, and compare the finish with the route you would use to pot it next.',
    takeaway: 'A sequence depends on preserving the ball you intend to play second.',
    briefing: {
      focus: 'Keep the planned second shot intact',
      gotcha: 'An unintended contact can move the 2 away from the position your plan assumed.',
    },
    layout: [[0.69, 0.91], [1.12, 0.33], [1.91, 0.83], [2.11, 0.37]],
    position: { radius: 0.178, maxCutAngle: 57 },
  },
  {
    title: 'Leave the layout readable',
    description: 'A fourth object ball adds another route to inspect.',
    lesson: 'Scan the spare balls before committing to the 1. Reach the zone for the 2 while noting which balls could interfere with the cue-ball approach or the next pot.',
    takeaway: 'Reading spare balls early helps protect a simple first-to-second-ball connection.',
    briefing: {
      focus: 'Include the remaining balls in the scan',
      gotcha: 'A spare ball away from the opening pot can still sit beside the next shot.',
    },
    layout: [[0.72, 0.92], [1.15, 0.32], [1.88, 0.42], [2.13, 1.0], [0.39, 0.36]],
    position: { radius: 0.176, maxCutAngle: 57 },
  },
  {
    title: 'Keep an exit from the zone',
    description: 'The zone is smaller and the next-ball lane deserves a second look.',
    lesson: 'Work backward from the pocket available to the 2. Check that the landing area gives the cue ball a clear approach, then trace the chosen opening stroke into it.',
    takeaway: 'A landing zone needs an exit toward the next contact point.',
    briefing: {
      focus: 'Read out of the zone as well as into it',
      gotcha: 'A clear route into position says nothing about the route needed for the next shot.',
    },
    layout: [[0.63, 0.94], [1.11, 0.33], [1.96, 0.43], [1.59, 0.79]],
    position: { radius: 0.174, maxCutAngle: 56 },
  },
  {
    title: 'Plan from the other end',
    description: 'The opening pair changes direction among the remaining balls.',
    lesson: 'Rebuild the sequence from the 2 after the table changes sides. Compare stopping points by the next contact line rather than reusing the shape of a previous route.',
    takeaway: 'A pattern is a relationship between shots, not a memorized drawing on the table.',
    briefing: {
      focus: 'Reconstruct the connection',
      gotcha: 'A familiar-looking cluster can reverse which side of the 2 leaves a useful angle.',
    },
    layout: [[1.94, 0.96], [1.39, 0.33], [0.49, 0.42], [0.4, 0.97], [2.14, 0.37]],
    position: { radius: 0.172, maxCutAngle: 55 },
  },
  {
    title: 'Protect the crossing lane',
    description: 'A spare ball sits near the space between the opening pair.',
    lesson: 'Check the spare ball against both halves of the shot on the 2. Predict whether your finish preserves room for the cue ball to reach its contact point without brushing traffic.',
    takeaway: 'The lane between shots matters as much as the lane from the object ball to the pocket.',
    briefing: {
      focus: 'Protect the cue-ball approach to the 2',
      gotcha: 'A ball that misses the pocket line may still crowd the cue-ball approach.',
    },
    layout: [[0.57, 0.98], [1.12, 0.33], [1.95, 0.42], [1.57, 0.77], [2.14, 1.02]],
    position: { radius: 0.170, maxCutAngle: 54 },
  },
  {
    title: 'Keep the far ball available',
    description: 'The longer opening approach must preserve a distant second shot.',
    lesson: 'Read the 2-to-pocket line first, then compare how each finish reaches that line. The extra distance to the 1 makes the opening pace part of your sequence decision.',
    takeaway: 'A distant next ball rewards a deliberate angle more than an accidental close finish.',
    briefing: {
      focus: 'Plan for the far contact line',
      gotcha: 'Chasing distance toward the 2 can turn a manageable next pot into a much thinner cut.',
    },
    layout: [[0.49, 1.02], [1.13, 0.32], [2.0, 0.43], [1.55, 0.82], [0.36, 0.36]],
    position: { radius: 0.168, maxCutAngle: 54 },
  },
  {
    englishPractice: 18,
    title: 'Choose a connection with margin',
    description: 'A tighter zone asks you to evaluate the reliability of the connection.',
    lesson: 'Compare the English stroke with the no-English alternatives, tracing each full route through the layout. Choose the first-to-second-ball connection that leaves room for error in the landing zone and a clear approach to the next ball.',
    takeaway: 'A good connection remains usable across a range of small stroke errors.',
    briefing: {
      focus: 'Leave margin in the connection',
      gotcha: 'A single perfect finish can hide a spread that frequently loses the next shot.',
    },
    layout: [[1.99, 1.02], [1.39, 0.32], [0.48, 0.43], [0.97, 0.81], [2.15, 0.35]],
    position: { radius: 0.166, maxCutAngle: 53 },
  },
  {
    englishPractice: 18,
    title: 'Keep the next lane open',
    description: 'A nearby ball makes the route to the 2 part of the decision.',
    lesson: 'Plan the pot, stopping point and next lane together. Account for English when tracing any cushion rebound, and compare the complete strokes for a finish that keeps the route to the 2 open.',
    takeaway: 'A visible target can still be blocked at the contact point or on its way to the pocket.',
    briefing: {
      focus: 'Check both halves of the next shot',
      gotcha: 'Seeing the center of the 2 is not enough. The cue ball must reach the right contact point with room to pass.',
    },
    layout: [[0.45, 1.01], [1.1, 0.34], [1.95, 0.42], [1.57, 0.74], [2.12, 1.01]],
    position: { radius: 0.164, maxCutAngle: 52 },
  },
  // Navigate traffic: introduce one idea, develop it, then combine it with tighter demands.
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
    learning: { concept: 'next-shot-blocker', prerequisite: 'next-shot-availability', comparison: 'next-shot-blocker' },
    title: 'Position through traffic',
    description: 'Pot the 1 and keep the 2 playable among four object balls.',
    lesson: 'Compare the settled cue-ball positions: the 3 screens the next shot from one finish but leaves a route from another. Predict which stroke loses access to the 2, then compare that exact layout with the spare balls removed.',
    takeaway: 'Protect access to the next ball instead of accepting any successful pot.',
    briefing: {
      focus: 'Protect the next-ball lane',
      gotcha: 'A pot can leave no permitted route to the 2 even without touching a spare ball. Check both the cue approach and the object-to-pocket line.',
    },
    layout: [[0.74, 0.83], [1.15, 0.34], [1.85, 0.40], [1.60, 0.40], [0.40, 0.39]],
    position: { radius: 0.162, maxCutAngle: 51 },
  },
  {
    title: 'Pass the nearby ball',
    description: 'A nearby spare ball gives the cue-ball route a visible constraint.',
    lesson: 'Trace the cue ball after contact on the 1, allowing for its full width beside the nearby ball. Choose a route that still finishes in the zone with the 2 available.',
    takeaway: 'A safe-looking center line needs enough clearance for the whole cue ball.',
    briefing: {
      focus: 'Allow clearance after contact',
      gotcha: 'A glancing collision can change the stopping point without preventing the first pot.',
    },
    layout: [[0.7, 0.89], [1.13, 0.33], [1.89, 0.41], [1.51, 0.87], [0.39, 0.37]],
    position: { radius: 0.160, maxCutAngle: 51 },
  },
  {
    title: 'Protect both pocket lines',
    description: 'Balls at opposite ends make both the first and next pot worth checking.',
    lesson: 'Inspect the route from the 1 to its pocket, then the route the 2 will need. Use that scan to judge which cue-ball finish connects the two without depending on a collision.',
    takeaway: 'Two clear pocket lines are essential to a planned two-shot sequence.',
    briefing: {
      focus: 'Check each object-ball corridor',
      gotcha: 'Clearing the first pocket line does not guarantee that the second one stays open.',
    },
    layout: [[1.88, 0.94], [1.4, 0.34], [0.48, 0.42], [1.03, 0.87], [2.14, 0.38]],
    position: { radius: 0.158, maxCutAngle: 50 },
  },
  {
    title: 'Read the crowded half',
    description: 'More object balls share the half of the table containing the next shot.',
    lesson: 'Work outward from the 2 and identify the spaces its next shot needs. Then predict which finish reaches the zone without leaving the cue ball screened by a spare ball.',
    takeaway: 'Crowded position begins with identifying the spaces that must remain open.',
    briefing: {
      focus: 'Map the space around the 2',
      gotcha: 'The cue ball can reach the marked area yet lose sight of the correct contact point.',
    },
    layout: [[0.63, 0.96], [1.12, 0.32], [1.93, 0.42], [1.52, 0.83], [2.1, 1.0], [0.38, 0.37]],
    position: { radius: 0.156, maxCutAngle: 50 },
  },
  {
    title: 'Avoid borrowing a collision',
    description: 'A smaller zone makes accidental help from a traffic ball unreliable.',
    lesson: 'Compare the natural cue-ball routes before imagining help from nearby balls. Prefer a finish whose stopping point follows from the stroke and cut rather than an uncertain secondary contact.',
    takeaway: 'A planned route is easier to repeat when it does not rely on an accidental nudge.',
    briefing: {
      focus: 'Choose a route you can explain',
      gotcha: 'A helpful collision in one replay can become a harmful deflection after a tiny aiming change.',
    },
    layout: [[0.6, 0.98], [1.14, 0.34], [1.94, 0.41], [1.56, 0.79], [0.38, 0.38], [2.14, 1.02]],
    position: { radius: 0.154, maxCutAngle: 49 },
  },
  {
    title: 'Keep the return lane clear',
    description: 'A reversed layout brings traffic into the cue ball\'s return side.',
    lesson: 'Follow any rebound back across the table and compare it with nearby balls. Include the return path in your prediction before checking the landing zone and the shot on the 2.',
    takeaway: 'Traffic must be checked on the return route as well as the first trip across the table.',
    briefing: {
      focus: 'Inspect the route after a rebound',
      gotcha: 'A cushion can send the cue ball back toward a ball that looked safely behind the initial direction.',
    },
    layout: [[1.99, 1.01], [1.41, 0.33], [0.48, 0.42], [0.99, 0.81], [2.16, 0.37], [0.4, 1.0]],
    position: { radius: 0.152, maxCutAngle: 48 },
  },
  {
    title: 'Find the usable gap',
    description: 'Tighter position and several spare balls demand a careful lane check.',
    lesson: 'Inspect the gap leading from the predicted finish to the 2. Compare its available width with the full cue ball, then check the next-ball angle against the lesson limit.',
    takeaway: 'A useful gap must fit the ball and preserve the correct contact angle.',
    briefing: {
      focus: 'Check width and angle together',
      gotcha: 'A gap can look open from one finish and become unusable only a small distance to either side.',
    },
    layout: [[0.52, 1.0], [1.12, 0.32], [1.96, 0.43], [1.52, 0.77], [0.36, 0.37], [2.15, 1.02]],
    position: { radius: 0.150, maxCutAngle: 48 },
  },
  {
    englishPractice: 18,
    title: 'Hold position in company',
    description: 'A longer first approach must finish accurately among five object balls.',
    lesson: 'Compare the English option with the two strokes without side spin. Read each full route past the traffic, then check the landing zone and next-ball angle; a different rebound is useful only if the complete position survives.',
    takeaway: 'Crowding is a reason to keep every part of the routine, not to abandon the stopping-point check.',
    briefing: {
      focus: 'Keep the stopping point in the plan',
      gotcha: 'Following the moving cue ball around blockers can distract you from whether it will stop inside the zone.',
    },
    layout: [[0.47, 1.03], [1.11, 0.32], [1.97, 0.42], [1.54, 0.79], [0.35, 0.36], [2.16, 1.01]],
    position: { radius: 0.148, maxCutAngle: 47 },
  },
  {
    englishPractice: 18,
    title: 'A smaller window',
    description: 'Find a precise finish that leaves the 2 clear of surrounding balls.',
    lesson: 'Read English, pace and draw or follow together. Compare the complete strokes for a safe route through traffic, a finish in the smaller zone and a clear next shot. Predict all three before checking the replay.',
    takeaway: 'Reliable position means landing inside a useful window despite small stroke errors.',
    briefing: {
      focus: 'Leave room for a small error',
      gotcha: 'A finish near the edge of the zone has little spare room. One good replay does not show the whole spread.',
    },
    layout: [[1.12, 0.82], [0.53, 0.36], [1.91, 0.85], [0.4, 0.93], [1.92, 0.39], [1.49, 0.96]],
    position: { radius: 0.146, maxCutAngle: 46 },
  },
  // Bank shots: the cue ball must take a cushion route around a screened target.
  {
    title: 'Your first bank route',
    description: 'The 2 blocks the direct path to the 1. Reach the target off a cushion.',
    lesson: 'Send the cue ball to a cushion before it reaches the 1. This cushion-first route is also called a kick. Picture the rebound, the contact that pots the 1, and the cue-ball finish.',
    takeaway: 'A blocked contact line can open up when you approach the target from a cushion.',
    briefing: {
      focus: 'Use one cushion to reach the target',
      gotcha: 'Hitting the blocking ball first fails the shot. The cue ball must rebound before its first contact with the 1.',
    },
    layout: [[1.02, 0.78], [1.27, 0.28], [1.145, 0.53]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Read the rebound angle',
    description: 'A wider approach changes the angle coming off the cushion.',
    lesson: 'Trace the cue ball to the rail and back toward the contact point on the 1. Compare the three finishes while keeping the rebound angle in your picture of the shot.',
    takeaway: 'The useful rebound is the one that reaches the correct side of the object ball.',
    briefing: {
      focus: 'Connect the rebound to the pot',
      gotcha: 'Reaching the 1 is only half the task. Its contact angle still has to send it into a pocket.',
    },
    layout: [[0.89, 0.76], [1.25, 0.30], [1.07, 0.53]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Carry speed through the rail',
    description: 'A longer cushion route needs enough speed left for the pot.',
    lesson: 'Allow for the distance to the cushion, the rebound, and the run to the 1. Compare launch speeds against the entire route, then judge where the cue ball will stop.',
    takeaway: 'A bank route needs pace for both the approach and the shot after the rebound.',
    briefing: {
      focus: 'Budget speed for the whole route',
      gotcha: 'A cushion removes speed. A stroke that would work on a direct line can stop short on a longer bank route.',
    },
    layout: [[0.94, 0.66], [1.29, 0.27], [1.115, 0.465]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Bank from a new angle',
    description: 'The screen remains, but the approach asks for a different rebound.',
    lesson: 'Rebuild the route from this cue-ball position. Follow the cushion exit toward the 1 and compare the finish each speed and spin combination produces.',
    takeaway: 'A change in starting position changes the useful cushion contact point.',
    briefing: {
      focus: 'Recalculate the cushion contact',
      gotcha: 'Copying the previous rail point can miss the target even when the pocket looks the same.',
    },
    layout: [[1.65, 0.80], [1.28, 0.31], [1.465, 0.555]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Clear the bank corridor',
    description: 'Another traffic ball puts pressure on the route around the screen.',
    lesson: 'Check the full width of the cue ball along the approach and rebound. Compare the finishes only after you have accounted for every ball beside the bank corridor.',
    takeaway: 'A cushion route is usable only when both legs have room for a whole ball.',
    briefing: {
      focus: 'Inspect both sides of the bounce',
      gotcha: 'A clear line to the cushion does not guarantee a clear line away from it.',
    },
    layout: [[0.92, 0.72], [1.26, 0.29], [1.09, 0.505], [1.68, 0.86]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Control the bank finish',
    description: 'A tighter finish turns a successful rebound into a control exercise.',
    lesson: 'Read the bank, the pot, and the cue ball after contact as one continuous route. Use the offered finishes to decide which stroke leaves the most room for a small error.',
    takeaway: 'Controlling the cue ball after a bank is part of the shot, just as it is on a direct pot.',
    briefing: {
      focus: 'Plan beyond the first contact',
      gotcha: 'Rebound speed and spin affect the finish. A good contact on the 1 does not guarantee a safe stop.',
    },
    layout: [[1.63, 0.69], [1.29, 0.26], [1.46, 0.475], [0.88, 0.88]],
    bank: { ballId: 1, minCushions: 1 },
  },
  {
    title: 'Link two cushions',
    description: 'The route to the 1 now needs two cushion contacts before the hit.',
    lesson: 'Trace two rebounds in order before the cue ball reaches the 1. Work back from the potting contact to the last cushion, then connect it to the first.',
    takeaway: 'A two-cushion route connects two rebound angles to one precise contact.',
    briefing: {
      focus: 'Build a two-cushion approach',
      gotcha: 'A cushion touched after hitting the 1 does not count toward the approach. Both rebounds must come first.',
    },
    layout: [[0.65, 0.45], [1.27, 0.12], [0.96, 0.285], [0.77694, 0.29545], [0.69185, 0.64557], [0.453066, 0.415114], [0.848878, 0.428849], [0.7983, 0.6258], [0.467, 0.312], [0.9844, 0.5534]],
    bank: { ballId: 1, minCushions: 2 },
  },
  {
    title: 'Thread the double bank',
    description: 'Traffic narrows the space around a two-cushion route.',
    lesson: 'Apply the two-cushion sequence while checking the traffic beside each leg. Compare the three strokes for a repeatable pot and a controlled finish.',
    takeaway: 'Each extra leg adds another corridor that must stay clear.',
    briefing: {
      focus: 'Check every leg of the double bank',
      gotcha: 'Looking only at the two rail points can hide a blocking ball between them.',
    },
    layout: [[0.65, 0.4], [1.27, 0.12], [0.96, 0.26], [0.783096, 0.253282], [0.690424, 0.596026], [0.452222, 0.370272], [0.849191, 0.382025], [0.7983, 0.5758], [0.467, 0.262], [0.9844, 0.5034]],
    bank: { ballId: 1, minCushions: 2 },
  },
  {
    title: 'Hold the line across two rails',
    description: 'A more demanding double bank tests pace, contact, and stopping accuracy.',
    lesson: 'Predict the complete two-cushion journey before choosing a finish. After committing, compare the spread of the trials to see how small errors grow along the longer route.',
    takeaway: 'Longer rebound routes reward the stroke that stays reliable under small errors.',
    briefing: {
      focus: 'Choose margin over an exact replay',
      gotcha: 'A nominal double bank can look perfect while nearby strokes miss. Judge the ensemble as well as the replay.',
    },
    layout: [[0.55, 0.4], [1.27, 0.12], [0.91, 0.26], [0.691066, 0.264776], [0.599059, 0.59308], [0.352476, 0.368627], [0.74924, 0.382582], [0.6983, 0.5758], [0.367, 0.262], [0.8844, 0.5034]],
    bank: { ballId: 1, minCushions: 2 },
  },
  {
    title: 'The three-cushion escape',
    description: 'Finish the chapter by reaching the screened 1 after three cushion rebounds.',
    lesson: 'Plan all three banks, then the pot and the final cue-ball position. Choose the stroke with the most convincing complete route and use the trials to check your prediction.',
    takeaway: 'A multiple-bank shot succeeds when every rebound preserves the angle and speed needed for the next.',
    briefing: {
      focus: 'Connect three rebounds into one shot',
      gotcha: 'Count only cue-ball rebounds before the first object-ball contact. Three cushions and a pot still need a safe finish.',
    },
    layout: [[1.7, 0.9], [0.22, 0.16], [1.72541, 0.99154], [1.62389, 0.95685], [1.61943, 0.84967], [1.71772, 0.80667], [1.79355, 0.88344]],
    bank: { ballId: 1, minCushions: 3 },
  },
  // Plants: read the line through two object balls and compare it with a demanding direct pot.
  {
    title: 'Two balls, one pocket',
    description: 'Compare the 1–2 plant with a long cut on the free 3.',
    lesson: 'A plant uses one object ball to pot another: the cue ball hits the 1, which sends the 2 toward the pocket. Read the line through both balls, then compare it with the free ball and its cue-ball finish.',
    takeaway: 'Two contacts can be a sensible choice when the pair points naturally into the pocket.',
    briefing: { focus: 'Read through the pair', gotcha: 'Select the 1 to play the plant. The 2 is its potting target; a direct pot on the free 3 is the alternative.' },
    layout: [[1.00, 1.05], [1.27, 0.37], [1.27, 0.30], [1.85, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'Check the natural line',
    description: 'A tempting pair competes with another demanding free-ball cut.',
    lesson: 'Extend the line between the centers of the 1 and 2 all the way to the pocket. Decide whether that natural plant line has room to enter, then compare the longer shot on the 3.',
    takeaway: 'A ball near a pocket does not make a plant work; the line between the pair decides its direction.',
    briefing: { focus: 'Extend the line to the pocket', gotcha: 'Two nearby balls can look aligned at a glance. Check where their line reaches the pocket mouth.' },
    layout: [[0.70, 1.02], [1.288, 0.37], [1.27, 0.30], [1.55, 0.97]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'A pocket has edges',
    description: 'Read a less generous plant line against a long free-ball route.',
    lesson: 'Judge how much space the 2 has on either side of its intended path. A plant that can drop on one exact stroke may have less margin than a longer direct pot.',
    takeaway: 'A playable plant still needs enough pocket margin to survive a small contact error.',
    briefing: { focus: 'Judge the spare pocket width', gotcha: 'Seeing a line into the pocket is only the start. A line near a facing can turn a small error into a miss.' },
    layout: [[0.67, 1.02], [1.274, 0.39], [1.27, 0.32], [1.70, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'Approach the pair from an angle',
    description: 'A wider cue-ball approach changes the plant without moving its pocket.',
    lesson: 'Read the contact on the 1 as well as the line from the 1 through the 2. Compare how much precision the angled first contact needs with the available direct pot.',
    takeaway: 'A useful pair alignment still depends on delivering the first ball along that line.',
    briefing: { focus: 'Include the first contact', gotcha: 'The pair can point toward a pocket while the approach to the first ball remains demanding.' },
    layout: [[0.40, 0.98], [1.27, 0.41], [1.27, 0.34], [1.55, 0.97]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'Distance after the transfer',
    description: 'A corner-pocket plant sends the 2 farther after the transfer.',
    lesson: 'Compare the whole plant: cue-ball approach, transfer between the pair, and the 2’s run to the pocket. Then trace the free-ball pot using the same checks.',
    takeaway: 'A longer journey after the second contact magnifies a small directional error in the plant.',
    briefing: { focus: 'Follow the second ball to the pocket', gotcha: 'A short gap between the pair does not make the final pot short. Include the distance beyond the 2.' },
    layout: [[1.00, 1.05], [0.91068, 0.51490], [0.85, 0.48], [1.70, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 0 },
  },
  {
    title: 'Separate closeness from alignment',
    description: 'A close pair and a difficult free ball call for a careful line check.',
    lesson: 'Check the plant’s direction before comparing its stroke settings. Weigh the available margin on the 2 against the distance and angle of the 3, then include the cue-ball finish.',
    takeaway: 'When the natural plant line misses, a demanding direct pot can still be the better investment.',
    briefing: { focus: 'Verify the pair before choosing pace', gotcha: 'More speed does not automatically repair a plant line that reaches the pocket facing.' },
    layout: [[0.49, 1.08], [1.281, 0.50], [1.27, 0.43], [1.92, 0.79]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'Give the gap its due',
    description: 'More space between the pair makes the transfer another precision task.',
    lesson: 'Trace the first ball across the gap before judging the final pot. Compare that extra contact demand with the free-ball cut, including how each stroke controls the cue ball.',
    takeaway: 'A gap between the pair gives a small error more room to change the second contact.',
    briefing: { focus: 'Budget margin for both contacts', gotcha: 'The plant has two aiming demands. A clear first contact does not guarantee the second contact repeats.' },
    layout: [[0.48, 1.06], [1.27, 0.53], [1.27, 0.40], [1.55, 0.97]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'The tempting transfer',
    description: 'A narrow plant and a severe direct pot offer competing risks.',
    lesson: 'Make a complete comparison: pair alignment, first-contact angle, potting distance, and finish. Decide which route has more room for the same small stroke errors.',
    takeaway: 'A narrow plant can be playable without being the most repeatable complete shot.',
    briefing: { focus: 'Compare two demanding routes', gotcha: 'One successful replay cannot settle this choice. Consider how nearby strokes change both the pot and the finish.' },
    layout: [[0.60, 1.07], [1.27, 0.50], [1.27, 0.40], [1.85, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'A small difference in margin',
    description: 'Weigh a delicate plant alignment against a long cut on the free ball.',
    lesson: 'Use the same routine on both candidates without assuming that the direct pot is safer. Compare the contact margins first, then use the cue-ball travel to distinguish their best strokes.',
    takeaway: 'When the potting chances are close, the cue-ball finish can decide which complete shot repeats.',
    briefing: { focus: 'Let the finish break a close decision', gotcha: 'The best plant stroke and best free-ball stroke may use different pace and spin. Compare the strongest case for each route.' },
    layout: [[0.70, 1.02], [1.276, 0.41], [1.27, 0.32], [1.70, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  {
    title: 'Choose the better risk',
    description: 'Finish with a close decision between a sensitive plant and a hard free ball.',
    lesson: 'Build your own comparison of the two complete shots. Read both contacts of the plant, the free-ball cut, and all three finishes before committing. Use the ensemble afterward to test your reasoning.',
    takeaway: 'The better risk is the complete shot with more room for error, even when neither option feels comfortable.',
    briefing: { focus: 'Commit to a complete comparison', gotcha: 'Neither the shorter pot nor the simpler-looking route wins automatically. Include every contact and the final cue-ball control.' },
    layout: [[0.70, 1.02], [1.274, 0.41], [1.27, 0.32], [1.85, 0.85]],
    plant: { ballId: 1, targetBallId: 2, pocketId: 1 },
  },
  // Tournament table: introduce one idea, develop it, then combine it with tighter demands.
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
    position: { radius: 0.144, maxCutAngle: 45 },
  },
  {
    title: 'Open with a complete plan',
    description: 'A crowded layout tightens both the zone and next-shot angle.',
    lesson: 'Start with the shot on the 2 and work back through the zone to the 1. Compare all three strokes against that complete plan before choosing the opening pot.',
    takeaway: 'A tournament opener earns its value through the shot it leaves behind.',
    briefing: {
      focus: 'Start the opener from the next shot',
      gotcha: 'The most comfortable first pot can lead to the least comfortable second one.',
    },
    layout: [[0.51, 0.99], [1.14, 0.32], [1.94, 0.42], [1.53, 0.8], [0.36, 0.36], [2.14, 1.01]],
    position: { radius: 0.141, maxCutAngle: 45 },
  },
  {
    title: 'Control the long connection',
    description: 'More approach distance tests the link between the first two balls.',
    lesson: 'Estimate how the longer approach changes the speed arriving at the 1. Use the smaller zone and stricter next-ball angle to decide which finish completes the connection.',
    takeaway: 'A long opening shot still needs a precise reason for its cue-ball finish.',
    briefing: {
      focus: 'Carry control through the long approach',
      gotcha: 'Adding strength for distance can move the finish onto the wrong side of the 2.',
    },
    layout: [[0.44, 1.00], [1.15, 0.33], [1.97, 0.43], [1.54, 0.8], [0.32, 0.37], [2.17, 1.02]],
    position: { radius: 0.138, maxCutAngle: 44 },
  },
  {
    title: 'Read pressure from both sides',
    description: 'The direction changes while the position demands stay tight.',
    lesson: 'Rebuild your route and next-ball angle from this orientation. Use the same checks even when the opening picture is less familiar and the zone leaves little spare room.',
    takeaway: 'A dependable routine works when the table stops looking familiar.',
    briefing: {
      focus: 'Apply the routine in a new direction',
      gotcha: 'Recognizing a familiar ball arrangement is not a substitute for checking its actual contact lines.',
    },
    layout: [[2.04, 1.04], [1.41, 0.32], [0.48, 0.41], [0.99, 0.79], [2.19, 0.35], [0.39, 1.01]],
    position: { radius: 0.135, maxCutAngle: 44 },
  },
  {
    title: 'Protect the precise landing',
    description: 'Another spare ball adds pressure around a narrow stopping area.',
    lesson: 'Check every nearby ball against the cue-ball route and the shot on the 2. Choose the stroke that reaches the zone with the clearest explanation of how it slows and stops.',
    takeaway: 'Tight position rewards a controlled route more than an impressive-looking journey.',
    briefing: {
      focus: 'Explain the final part of the route',
      gotcha: 'A route that clears early traffic can still encounter a ball just before the intended finish.',
    },
    layout: [[0.54, 0.96], [1.12, 0.32], [1.94, 0.42], [1.52, 0.78], [0.34, 0.37], [2.15, 1.01], [0.91, 1.08]],
    position: { radius: 0.132, maxCutAngle: 43 },
  },
  {
    title: 'Refine the next-ball angle',
    description: 'The 2 must remain playable within an increasingly strict cut limit.',
    lesson: 'Picture the contact point on the 2 from the expected finish, then check its pocket line. Judge the opening stroke against that angle as carefully as you judge the landing zone.',
    takeaway: 'As cut limits tighten, the direction of the next shot matters as much as stopping accuracy.',
    briefing: {
      focus: 'Make the next contact precise',
      gotcha: 'A finish that worked with a generous angle limit may fail the tighter requirement even from the same distance.',
    },
    layout: [[0.57, 1.02], [1.12, 0.31], [1.98, 0.42], [1.52, 0.77], [0.34, 0.35], [2.17, 1.01], [0.91, 1.08]],
    position: { radius: 0.130, maxCutAngle: 43 },
  },
  {
    title: 'Keep control under congestion',
    description: 'A dense layout tests your route and stopping point together.',
    lesson: 'Identify a complete path from the opening contact to a usable next shot. Compare all three strokes for the zone and the next-ball lane while accounting for every spare ball near the route.',
    takeaway: 'Congestion makes a complete route prediction more valuable than a guess based on spin alone.',
    briefing: {
      focus: 'Keep the full path in view',
      gotcha: 'A stroke label describes its spin, but does not promise that its route clears this particular table.',
    },
    layout: [[2.04, 1.04], [1.41, 0.32], [0.48, 0.41], [0.99, 0.78], [2.2, 0.37], [0.38, 1.01], [1.64, 1.08]],
    position: { radius: 0.127, maxCutAngle: 42 },
  },
  {
    title: 'Choose margin under pressure',
    description: 'A very small zone asks for the most repeatable complete outcome.',
    lesson: 'Predict the stroke with the best room for error across potting and position. After committing, use the trial spread to distinguish a repeatable connection from a lucky exact finish.',
    takeaway: 'The strongest pressure choice is the one that keeps completing the whole assignment.',
    briefing: {
      focus: 'Value repeated complete success',
      gotcha: 'A visually perfect nominal finish can still have a poor success rate when small stroke errors are included.',
    },
    layout: [[0.43, 1.05], [1.14, 0.32], [1.95, 0.42], [1.53, 0.78], [0.33, 0.37], [2.16, 1.02], [0.92, 1.09]],
    position: { radius: 0.125, maxCutAngle: 42 },
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
    layout: [[0.62, 0.94], [1.11, 0.31], [1.97, 0.42], [1.51, 0.77], [0.35, 0.35], [2.16, 1.0], [0.91, 1.08]],
    position: { radius: 0.123, maxCutAngle: 41 },
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
    position: { radius: 0.120, maxCutAngle: 40 },
  },
  // Classic flat-table set-up shots: the real contact sequence is part of success.
  // Teaching references: Dr. Dave's easy trick-shot diagrams and VEPS combo/carom lessons.
  // https://drdavepoolinfo.com/resource_files/trick_shot_top_10.pdf
  // https://drdavebilliards.com/documents/veps/disc_I_shots.pdf
  {
    title: 'The three-ball train',
    description: 'Send a chain reaction through the 1 and 2 to pot the 3.',
    lesson: 'The train is a classic combination trick: the 1 drives the 2, which drives the 3 into the side pocket. Read all three centers before choosing the stroke. The setup supplies the line; your job is to deliver enough pace and control the cue-ball finish.',
    takeaway: 'A spectacular chain reaction starts with the same contact-line check as a simple plant.',
    briefing: { focus: 'Read the whole train', gotcha: 'The 3 must fall after the 1–2–3 transfer. Potting another ball alone does not complete the trick.' },
    layout: [[1, 0.95], [1.27, 0.45], [1.27, 0.37], [1.27, 0.29]],
    trick: { ballId: 1, potBallId: 3, pocketId: 1, aim: { x: 1.27, y: 0.50715 }, requiredPots: [3], requiredContacts: [[0, 1], [1, 2], [2, 3]], description: 'Hit the 1 into the 2, then the 2 into the 3, and pot the 3.' },
  },
  {
    title: 'The split shot',
    description: 'Split the close pair and pocket both balls in one stroke.',
    lesson: 'A split shot turns one incoming line into two outgoing lines. The 1 clips the 2 and carries on toward a different pocket. Use your cut-angle and combination reading together, then choose enough pace for both balls without losing the cue ball.',
    takeaway: 'Read both outgoing paths: the transferred motion and the motion left in the first ball.',
    briefing: { focus: 'Account for both pots', gotcha: 'One ball dropping is only half the trick. Both the 1 and 2 must be pocketed safely.' },
    layout: [[1.91555357, 1.08], [1.91555357, 0.64222123], [1.87571777, 0.59849673]],
    trick: { ballId: 1, potBallId: 2, pocketId: 1, aim: { x: 1.91555357, y: 0.64222123 }, requiredPots: [1, 2], requiredContacts: [[0, 1], [1, 2]], description: 'Hit the 1 into the 2 and pocket both object balls in the same stroke.' },
  },
  {
    title: 'The kiss shot',
    description: 'Use the 2 to redirect the 1 into a corner pocket.',
    lesson: 'In this kiss shot the 1 glances off the 2 and changes direction into the pocket. The 2 acts like a movable cushion. Read the contact between the object balls and the line leaving it, then compare pace and cue-ball position.',
    takeaway: 'A ball that blocks one line can create another when its contact angle is planned.',
    briefing: { focus: 'Read the line after the kiss', gotcha: 'The 1 must contact the 2 before it drops. A direct pot would miss the purpose of this setup.' },
    layout: [[0.6, 0.85], [0.6, 0.38], [0.619, 0.25]],
    trick: { ballId: 1, potBallId: 1, pocketId: 0, aim: { x: 0.6, y: 0.38 }, requiredPots: [1], requiredContacts: [[0, 1], [1, 2]], description: 'Send the 1 off the 2 and into a pocket, keeping the cue ball safe.' },
  },
  {
    title: 'The carom shot',
    description: 'Glance the cue ball off the 1 to pocket the waiting 2.',
    lesson: 'A carom uses the cue ball itself to make the second contact. It glances off the 1 and reaches the 2 near the side pocket. Reuse your tangent-line reading, then check how draw and follow bend the route after the first collision.',
    takeaway: 'The cue-ball path after contact can be the scoring path, not just the finish.',
    briefing: { focus: 'Connect two cue-ball contacts', gotcha: 'The cue ball must touch the 1 first and then the 2. Sending the 1 into the 2 is a different shot.' },
    layout: [[1.15, 0.8], [1.0976, 0.31], [1.27, 0.055]],
    trick: { ballId: 1, potBallId: 2, pocketId: 1, aim: { x: 1.15, y: 0.33 }, requiredPots: [2], requiredContacts: [[0, 1], [0, 2]], description: 'Carom the cue ball off the 1, then contact and pot the 2.' },
  },
  {
    title: 'Follow the leader',
    description: 'Pot the 2 with a combination, then follow through to pot the 1 too.',
    lesson: 'Topspin lets the cue ball catch the 1 again after the combination sends the 2 ahead. Both object balls follow the same pocket route. Compare follow and pace together: the second contact needs enough energy, while the cue ball still needs a safe stopping place.',
    takeaway: 'Follow can create a useful second contact when you plan the whole sequence.',
    briefing: { focus: 'Plan the catch-up contact', gotcha: 'Both balls must fall, and the cue ball must catch the 1 again. Too much forward travel can turn the finish into a scratch.' },
    layout: [[1.25, 0.7], [1.27, 0.24], [1.27, 0.16]],
    trick: { ballId: 1, potBallId: 2, pocketId: 1, aim: { x: 1.27, y: 0.29715 }, requiredPots: [1, 2], requiredContacts: [[0, 1], [1, 2], [0, 1]], description: 'Pot the 2 through the 1, then follow into the 1 again and pot it too.' },
  },
  {
    title: 'The draw-back double',
    description: 'Pot the 1, then draw the cue ball back to pocket the 2.',
    lesson: 'This classic double pot makes backspin visible: the cue ball hits the 1, reverses direction and reaches the 2 behind it. Compare the strength and draw in each stroke. Budget enough return speed for the second pot while protecting the final cue-ball position.',
    takeaway: 'Draw is most useful when the return path has a specific job and a safe finish.',
    briefing: { focus: 'Give the return journey a target', gotcha: 'Potting the 1 is only the opening. The cue ball must return to contact and pot the 2 without following it into the pocket.' },
    layout: [[1.27, 0.65], [1.27, 0.32], [1.262, 1.0]],
    trick: { ballId: 1, potBallId: 1, pocketId: 1, aim: { x: 1.27, y: 0.32 }, requiredPots: [1, 2], requiredContacts: [[0, 1], [0, 2]], description: 'Pot the 1 and draw back into the 2 to pot both balls in one stroke.' },
  },
  {
    title: 'The cross-side bank',
    description: 'Send the object ball off the opposite cushion into the side pocket.',
    lesson: 'This time the object ball makes the bank. Read the 1 to the cushion and back toward the side pocket, then include the cue-ball finish in your choice. Rebound losses and running spin make pace part of the aiming problem.',
    takeaway: 'An object-ball bank needs a complete rebound line and enough speed left after the cushion.',
    briefing: { focus: 'Bank the object ball', gotcha: 'The required cushion belongs to the 1. A cue-ball rebound does not satisfy this trick.' },
    layout: [[1.62, 0.26], [1.55, 0.75]],
    trick: { ballId: 1, potBallId: 1, pocketId: 1, aim: { x: 1.55, y: 0.75 }, requiredPots: [1], requiredContacts: [[0, 1]], minObjectCushions: 1, description: 'Bank the 1 off a cushion and pocket it, leaving the cue ball safe.' },
  },
  {
    title: 'The one-cushion escape',
    description: 'Kick around the blocking ball and pot the 1.',
    lesson: 'A cushion-first escape is an approachable trick with a practical use. Read the clear corridor around the 2, reflect the cue-ball line off the cushion and connect it to the potting contact on the 1. Finish the plan by checking where the cue ball stops.',
    takeaway: 'The easiest escape is the one whose rebound, contact and finish all have room.',
    briefing: { focus: 'Use the rail to get around traffic', gotcha: 'The cue ball must rebound before touching the 1. Hitting the blocking 2 first fails the trick.' },
    layout: [[1.02, 0.80], [1.27, 0.28], [1.145, 0.53]],
    bank: { ballId: 1, minCushions: 1 },
    trick: { ballId: 1, potBallId: 1, pocketId: 1, aim: { x: 1.27, y: 0.28 }, requiredPots: [1], requiredContacts: [[0, 1]], description: 'Reach the 1 after at least one cue-ball cushion and pot it without a scratch.' },
  },
  {
    title: 'Around the corner',
    description: 'Connect two cushion rebounds before pocketing the 1.',
    lesson: 'The two-cushion kick extends your escape route around the table. Work backward from the 1 to the second cushion, then to the first. Compare the complete strokes for the pace left at the final contact and a controlled finish.',
    takeaway: 'Two rebounds are manageable when you read them as one connected route.',
    briefing: { focus: 'Keep the two rebounds in order', gotcha: 'Both cue-ball rebounds must happen before contact with the 1. A later rail does not count toward the approach.' },
    layout: [[0.65, 0.45], [1.27, 0.12]],
    bank: { ballId: 1, minCushions: 2 },
    trick: { ballId: 1, potBallId: 1, pocketId: 1, aim: { x: 1.27, y: 0.12 }, requiredPots: [1], requiredContacts: [[0, 1]], description: 'Take at least two cue-ball cushions before contacting and potting the 1.' },
  },
  {
    englishPractice: 18,
    title: 'The carom-combination finale',
    description: 'Carom off the 1 into the 2, then send the 3 into the side pocket.',
    lesson: 'Bring your contact-line, spin, combination and position skills together. The cue ball glances off the 1, reaches the 2 and starts the final 2–3 combination. Compare the English option with the two strokes without side spin and choose the complete sequence with a finish you can repeat.',
    takeaway: 'A showpiece is a series of familiar contacts, linked by deliberate pace, spin and cue-ball control.',
    briefing: { focus: 'Link familiar skills into one sequence', gotcha: 'The cue ball must contact the 1 then the 2, and the 2 must send the 3 into a pocket. A lucky pot without that sequence is incomplete.' },
    layout: [[1.15, 0.8], [1.0976, 0.36], [1.27, 0.14], [1.27, 0.06]],
    trick: { ballId: 1, potBallId: 3, pocketId: 1, aim: { x: 1.15, y: 0.4 }, requiredPots: [3], requiredContacts: [[0, 1], [0, 2], [2, 3]], description: 'Carom off the 1 into the 2, then send the 2 into the 3 to pot the 3.' },
  },
  ...BROKEN_LESSONS,
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
  const reflectedPocket = (id: number) => {
    const x = mirrorX ? [2, 1, 0, 5, 4, 3][id] : id;
    return mirrorY ? [5, 4, 3, 2, 1, 0][x] : x;
  };
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
    ...(lesson.conditions ? { conditions: reflectTableConditions(lesson.conditions, mirrorX, mirrorY) } : {}),
    curriculum: {
      chapterId: chapter.id, chapterTitle: chapter.title, chapterIndex, lessonIndex, lessonCount,
      lesson: lesson.lesson, takeaway: lesson.takeaway,
      ...(lesson.learning ? { learning: { ...lesson.learning, ...(lesson.learning.pockets ? { pockets: lesson.learning.pockets.map(route => ({ ...route, pocketId: reflectedPocket(route.pocketId) })) } : {}) } } : {}),
      ...(lesson.englishPractice ? { englishPractice: lesson.englishPractice } : {}),
      briefing: { ...lesson.briefing, stage: lessonIndex === 0 ? 'introduce' : lessonIndex < 6 ? 'develop' : 'apply' },
    },
    ...(lesson.position ? { objective: { kind: 'position' as const, ballId: 1, nextBallId: 2, ...lesson.position } } : {}),
    ...(lesson.bank ? { bank: { ...lesson.bank } } : {}),
    ...(lesson.plant ? { plant: { ...lesson.plant, pocketId: reflectedPocket(lesson.plant.pocketId) } } : {}),
    ...(lesson.trick ? { trick: { ...lesson.trick,
      aim: { x: mirrorX ? TABLE.length - lesson.trick.aim.x : lesson.trick.aim.x, y: mirrorY ? TABLE.width - lesson.trick.aim.y : lesson.trick.aim.y },
      pocketId: reflectedPocket(lesson.trick.pocketId), requiredPots: [...lesson.trick.requiredPots],
      requiredContacts: lesson.trick.requiredContacts.map(([a, b]) => [a, b] as [number, number]),
    } } : {}),
  };
}
