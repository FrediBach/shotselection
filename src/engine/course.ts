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
  { id: 'patterns', title: 'Build a pattern', description: 'Read a sequence before committing to its first shot.' },
  { id: 'traffic', title: 'Navigate traffic', description: 'Protect the next shot when other balls crowd the table.' },
  { id: 'banks', title: 'Bank shots', description: 'Reach a blocked ball with one cushion, then link multiple banks.' },
  { id: 'plants', title: 'Plants', description: 'Compare a combination pot with a difficult free ball and choose the more reliable shot.' },
  { id: 'tournament', title: 'Tournament table', description: 'Bring potting, position and small margins together.' },
].map((chapter, index) => ({
  ...chapter,
  firstLevel: index * LEVELS_PER_CHAPTER + 1,
  lastLevel: (index + 1) * LEVELS_PER_CHAPTER,
}));

export const TOTAL_LEVELS = COURSE_CHAPTERS.length * LEVELS_PER_CHAPTER;
