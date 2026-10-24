export interface CourseChapter {
  id: string;
  title: string;
  description: string;
  firstLevel: number;
  lastLevel: number;
}

export const LEVELS_PER_CHAPTER = 10;

export const COURSE_CHAPTERS: readonly CourseChapter[] = [
  { id: 'fundamentals', title: 'First strokes', description: 'Learn the pot, the angle and the cue-ball finish.' },
  { id: 'open-table', title: 'Everyday pool', description: 'Choose a reliable shot on an open table.' },
  { id: 'position', title: 'Play for position', description: 'Pot one ball and leave a usable shot on the next.' },
  { id: 'patterns', title: 'Build a pattern', description: 'Practice the opening shot and the link from ball 1 to ball 2.' },
  { id: 'traffic', title: 'Navigate traffic', description: 'Protect the next shot when other balls crowd the table.' },
  { id: 'banks', title: 'Kick shots', description: 'Send the cue ball to a cushion before the target, then link multiple rebounds.' },
  { id: 'plants', title: 'Plants', description: 'Compare a combination pot with a difficult free ball and choose the more reliable shot.' },
  { id: 'tournament', title: 'Tournament table', description: 'Bring potting, position and small margins together.' },
  { id: 'trick-shots', title: 'Trick shots', description: 'Learn ten classic set-up shots with combinations, kisses, spin and cushions.' },
  { id: 'broken-table', title: 'Broken table', description: 'Take on ten battered tables: read the faults, adapt your shot and beat the final boss.' },
].map((chapter, index) => ({
  ...chapter,
  firstLevel: index * LEVELS_PER_CHAPTER + 1,
  lastLevel: (index + 1) * LEVELS_PER_CHAPTER,
}));

export const TOTAL_LEVELS = COURSE_CHAPTERS.length * LEVELS_PER_CHAPTER;
