import { TABLE } from './constants';
import { COURSE_CHAPTERS, TOTAL_LEVELS } from './course';
import { seededRandom } from './math';
import type { Ball, LessonBriefing, Scenario } from './types';

export { COURSE_CHAPTERS, LEVELS_PER_CHAPTER, TOTAL_LEVELS } from './course';
export type { CourseChapter } from './course';

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
    title: 'Keep the long pot simple',
    description: 'Choose a controlled finish after a demanding cross-table approach.',
    lesson: 'Apply your line, spin and cushion checks to this longer pot. Favor a finish you can explain from the contact and stroke settings before looking at the replay.',
    takeaway: 'A reliable long pot starts with a clear contact line and an understandable cue-ball route.',
    briefing: {
      focus: 'Combine line and pace',
      gotcha: 'A long approach magnifies an aiming mistake before spin has any chance to affect the finish.',
    },
    layout: [[0.39, 1.08], [1.55, 0.48]],
  },
  {
    title: 'Let the cue ball travel',
    description: 'A long approach brings the contact line, pace and cue-ball route together.',
    lesson: 'Put the potting line and cue-ball finish together. On this cut shot, picture the cue ball moving across the potting line, including any cushion rebounds.',
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
    title: 'Compare the corner pots',
    description: 'Two corner routes ask for different contact lines.',
    lesson: 'Read each corner pot from the object ball back to the cue ball. Compare the cut and predicted finish on both sides of the table before selecting an opener.',
    takeaway: 'Similar-looking corner pots can leave very different cue-ball finishes.',
    briefing: {
      focus: 'Compare both contact points',
      gotcha: 'Symmetry in the pockets does not guarantee symmetry in the shots when the cue ball starts off-center.',
    },
    layout: [[0.73, 0.83], [1.84, 0.39], [0.41, 0.38]],
  },
  {
    title: 'Choose the cleaner angle',
    description: 'Two open pots reward a closer look at their contact angles.',
    lesson: 'Estimate each cut before comparing stroke strength. Choose the route that gives both the object ball and the cue ball enough room to follow their intended paths.',
    takeaway: 'A slightly longer route may reward you with a fuller contact.',
    briefing: {
      focus: 'Look for the fuller contact',
      gotcha: 'Judging only the gap to a pocket overlooks the angle needed to send the ball there.',
    },
    layout: [[0.73, 0.83], [1.17, 0.34], [1.87, 0.41]],
  },
  {
    title: 'Read opposite ends',
    description: 'Compare a side-pocket candidate with a ball toward the far end.',
    lesson: 'Scan the whole table before choosing. One ball offers a shorter first journey while the other changes the finishing direction; predict both before committing.',
    takeaway: 'An open table gives choices only when you check balls beyond the first one you notice.',
    briefing: {
      focus: 'Scan both halves of the table',
      gotcha: 'Fixating on the ball nearest the side pocket can hide a more comfortable route at the far end.',
    },
    layout: [[0.73, 0.86], [1.16, 0.33], [1.89, 0.95]],
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
    title: 'Favor a calm finish',
    description: 'Three spread-out balls offer different amounts of cue-ball travel.',
    lesson: 'After checking the pot, compare how far each finish sends the cue ball. A shorter controlled route can be easier to reproduce even when another pot looks inviting.',
    takeaway: 'The finish belongs in an open-table decision even before a next-ball zone is required.',
    briefing: {
      focus: 'Compare the travel after contact',
      gotcha: 'A pot close to a pocket can still release the cue ball into a long journey.',
    },
    layout: [[0.70, 0.83], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]],
  },
  {
    title: 'Distance with a choice',
    description: 'A deeper cue-ball start stretches all three opening options.',
    lesson: 'Use the extra approach distance to test your earlier comparisons. Weigh the object-ball journey and cue-ball approach together, then select the finish with room for a small error.',
    takeaway: 'When every option is longer, compare their complete demands instead of looking for a short shot.',
    briefing: {
      focus: 'Judge the total journey',
      gotcha: 'A short object-ball path can conceal a long and sensitive cue-ball approach.',
    },
    layout: [[0.46, 1.02], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95]],
  },
  {
    title: 'Shortlist four open balls',
    description: 'Four open candidates test your table-reading routine.',
    lesson: 'Scan all four balls, narrow the choice to two promising pots, and compare their three finishes. Use angle and travel to explain why your final choice survives the shortlist.',
    takeaway: 'A deliberate shortlist keeps a larger table from turning into a rushed guess.',
    briefing: {
      focus: 'Narrow the field deliberately',
      gotcha: 'The first playable ball is only a candidate; another ball may offer a much simpler finish.',
    },
    layout: [[0.73, 0.80], [1.16, 0.33], [1.84, 0.39], [1.88, 0.95], [0.41, 0.38]],
  },
  {
    title: 'Choose the comfortable stroke',
    description: 'Read four open balls and choose a dependable pot and finish.',
    lesson: 'Apply your comparison to four balls. Shortlist a comfortable pot, then compare its finishes against the other balls before locking in your shot.',
    takeaway: 'Choose the finish you can reproduce, then judge it against the other available strokes.',
    briefing: {
      focus: 'Choose a repeatable finish',
      gotcha: 'An easy pot can hide a demanding finish. Extra cue-ball travel gives speed errors more room to matter.',
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
    title: 'Control the length',
    description: 'Finish inside a smaller zone after potting the 1.',
    lesson: 'Keep the same pot-zone-next-shot routine, now with less room to stop. Predict which stroke finishes short, near the middle or long, then check your prediction after committing.',
    takeaway: 'Too short and too long can both spoil position. Plan a stopping area before the shot.',
    briefing: {
      focus: 'Calibrate your stopping distance',
      gotcha: 'Speed alone does not tell you the finish. Backspin and topspin change the cue ball\'s motion after contact.',
    },
    layout: [[0.61, 0.88], [1.09, 0.35], [1.94, 0.85]],
    position: { radius: 0.198, maxCutAngle: 64 },
  },
  {
    title: 'Find the middle of the zone',
    description: 'Read a landing area with a little less room around its edge.',
    lesson: 'Predict the stopping point before selecting a stroke. Aim your decision at the useful middle of the zone and check that the 2 stays available from there.',
    takeaway: 'A finish near the middle preserves more room for a small speed error.',
    briefing: {
      focus: 'Use the whole landing area',
      gotcha: 'Reaching the edge once gives little evidence that the same stroke will hold the zone repeatedly.',
    },
    layout: [[0.82, 0.9], [1.15, 0.33], [1.91, 0.9]],
    position: { radius: 0.196, maxCutAngle: 64 },
  },
  {
    title: 'Bring position back across',
    description: 'A reversed layout puts the next ball on the other side.',
    lesson: 'Work from the 2 back to the marked zone before reading the pot on the 1. Reversing the table changes the picture, but the same pot-zone-next-shot routine still applies.',
    takeaway: 'Position principles transfer when the next ball changes sides.',
    briefing: {
      focus: 'Rebuild the plan from the next ball',
      gotcha: 'Repeating a familiar spin choice without reading the new direction can leave you on the wrong side.',
    },
    layout: [[1.81, 0.94], [1.4, 0.33], [0.52, 0.85]],
    position: { radius: 0.194, maxCutAngle: 63 },
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
    position: { radius: 0.192, maxCutAngle: 62 },
  },
  {
    title: 'Leave space to approach',
    description: 'The 2 sits farther toward the end of the table.',
    lesson: 'Check the cue-ball approach to the 2 as well as its pocket line. Select a finish that reaches the zone while leaving enough room to contact the correct side of the next ball.',
    takeaway: 'Useful position leaves access to the next contact point, not just a view of the ball.',
    briefing: {
      focus: 'Allow room before the next contact',
      gotcha: 'Finishing almost on top of the 2 can make an otherwise visible pot awkward or unavailable.',
    },
    layout: [[0.59, 0.94], [1.12, 0.33], [2.03, 0.61]],
    position: { radius: 0.190, maxCutAngle: 62 },
  },
  {
    title: 'Match spin to the stopping point',
    description: 'A longer approach and smaller zone demand a clearer spin prediction.',
    lesson: 'Compare where draw, center ball and follow leave the cue ball after this cut. Choose by the predicted stopping point and next shot, then use the replay to test your reasoning.',
    takeaway: 'Spin is useful when it supports a specific stopping point and next-ball angle.',
    briefing: {
      focus: 'Give spin a defined job',
      gotcha: 'Choosing draw simply because the zone looks nearby ignores how the cut redirects the cue ball.',
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
    title: 'Hold a useful side',
    description: 'The next ball requires a more deliberate angle from the zone.',
    lesson: 'Picture the shot on the 2 from both sides of your predicted finish. Use the tighter cut limit to distinguish a useful landing from one that merely looks close.',
    takeaway: 'Good position respects the next shot even when the cue ball is already inside the landing area.',
    briefing: {
      focus: 'Check the angle from the finish',
      gotcha: 'A clear line to the 2 may still exceed the permitted cut angle.',
    },
    layout: [[1.99, 1.04], [1.38, 0.32], [0.45, 0.83]],
    position: { radius: 0.184, maxCutAngle: 60 },
  },
  {
    title: 'Complete the two-ball plan',
    description: 'Combine a longer first pot, a smaller zone and the next-ball check.',
    lesson: 'Make the full two-ball plan before committing: contact on the 1, cue-ball route, stopping point, then a playable 2. Compare the result with each part of that prediction.',
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
    title: 'Choose a sequence with margin',
    description: 'A tighter zone asks you to evaluate the reliability of the connection.',
    lesson: 'Predict which stroke gives the most room around its intended finish while leaving the 2 playable. After committing, compare the spread with the route you expected.',
    takeaway: 'A good connection remains usable across a range of small stroke errors.',
    briefing: {
      focus: 'Leave margin in the connection',
      gotcha: 'A single perfect finish can hide a spread that frequently loses the next shot.',
    },
    layout: [[1.99, 1.02], [1.39, 0.32], [0.48, 0.43], [0.97, 0.81], [2.15, 0.35]],
    position: { radius: 0.166, maxCutAngle: 53 },
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
    title: 'Position through traffic',
    description: 'Pot the 1 and keep the 2 playable among four object balls.',
    lesson: 'Add position to your traffic check. Use the cut angle, speed and spin to predict a route into the zone that keeps access to the 2 open.',
    takeaway: 'Protect access to the next ball instead of accepting any successful pot.',
    briefing: {
      focus: 'Protect the next-ball lane',
      gotcha: 'Brushing a traffic ball can change your finish even when the 1 drops. Include possible contacts in your prediction.',
    },
    layout: [[0.74, 0.83], [1.15, 0.34], [1.85, 0.40], [1.52, 0.88], [0.40, 0.39]],
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
    title: 'Hold position in company',
    description: 'A longer first approach must finish accurately among five object balls.',
    lesson: 'Use the full routine while traffic competes for your attention. Predict the pot, route, stopping point and next-shot lane before choosing the stroke, then inspect all four in the result.',
    takeaway: 'Crowding is a reason to keep every part of the routine, not to abandon the stopping-point check.',
    briefing: {
      focus: 'Keep the stopping point in the plan',
      gotcha: 'Following the moving cue ball around blockers can distract you from whether it will stop inside the zone.',
    },
    layout: [[0.47, 1.03], [1.11, 0.32], [1.97, 0.42], [1.54, 0.79], [0.35, 0.36], [2.16, 1.01]],
    position: { radius: 0.148, maxCutAngle: 47 },
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
    layout: [[1.12, 0.82], [0.53, 0.36], [1.91, 0.85], [0.4, 0.93], [1.92, 0.39], [1.49, 0.96]],
    position: { radius: 0.146, maxCutAngle: 46 },
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
      briefing: { ...lesson.briefing, stage: lessonIndex === 0 ? 'introduce' : lessonIndex < 6 ? 'develop' : 'apply' },
    },
    ...(lesson.position ? { objective: { kind: 'position' as const, ballId: 1, nextBallId: 2, ...lesson.position } } : {}),
  };
}
