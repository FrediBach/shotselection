import { COURSE_CHAPTERS, type CourseChapter } from '../engine/course'
import { normalizeLessonHistory, type LessonResult, type OutcomeRates, type Session } from './session'

export type ChapterReport = CourseChapter & {
  count: number
  average: number | null
  earlyAverage: number | null
  lateAverage: number | null
  change: number | null
}

export type WeaknessReport = {
  id: 'potting' | 'position' | 'scratch' | 'next-shot'
  title: string
  status: 'persistent' | 'improving' | 'resolved' | 'emerging' | 'steady' | 'limited'
  /** Percentage-point gaps against the highest-quality offered shot, not failure rates. */
  earlyGap: number | null
  lateGap: number | null
  count: number
  /** Recent recorded levels with a material gap, for targeted practice. */
  levels: number[]
  summary: string
  advice: string
}

export type CourseReport = {
  history: LessonResult[]
  chapters: ChapterReport[]
  weaknesses: WeaknessReport[]
  recordedLevels: number
  missingLevels: number
  average: number | null
  longestPerfectStreak: number
  earlyAverage: number | null
  lateAverage: number | null
  change: number | null
}

const mean = (values: number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const average = (history: LessonResult[]) => mean(history.map(result => result.points))

function compareScores(early: LessonResult[], late: LessonResult[], minimum: number) {
  const earlyAverage = early.length >= minimum ? average(early) : null
  const lateAverage = late.length >= minimum ? average(late) : null
  return { earlyAverage, lateAverage, change: earlyAverage !== null && lateAverage !== null ? lateAverage - earlyAverage : null }
}

type Metric = { id: WeaknessReport['id']; key: keyof Omit<OutcomeRates, 'quality' | 'successRate'>; title: string; advice: string }
const METRICS: Metric[] = [
  { id: 'potting', key: 'potRate', title: 'Pot selection', advice: 'Compare how often each offered route makes the intended pot. Favor a pot that survives small aiming errors, then check its finish.' },
  { id: 'position', key: 'positionRate', title: 'Cue-ball position', advice: 'Picture the full cue-ball path and stopping area. Compare pace and spin together, then choose the finish that stays inside its target more often.' },
  { id: 'scratch', key: 'scratchRate', title: 'Scratch avoidance', advice: 'Trace the cue ball beyond contact toward nearby pockets. Compare the safer routes before committing to the pot.' },
  { id: 'next-shot', key: 'nextShotRate', title: 'Next-shot planning', advice: 'Work backward from the next ball: look for a clear line and a usable angle, then choose the opening stroke that preserves them.' },
]

const MATERIAL_GAP = 8
const MINIMUM_OBSERVATIONS = 6

function measureWeakness(history: LessonResult[], metric: Metric): WeaknessReport {
  const observations = history.flatMap(result => {
    const evidence = result.evidence
    // A highest-ranked shot with no complete successes is not evidence of an
    // attainable better choice. Missing diagnostic rates are not zero rates.
    if (!evidence || evidence.best.successRate <= 0) return []
    const selected = evidence.selected[metric.key]
    const best = evidence.best[metric.key]
    if (selected === undefined || best === undefined) return []
    // A perfect or equally good decision may trade one diagnostic for another;
    // do not relabel such a decision as a weakness. Keep its zero as evidence of
    // good decision making, so improving choices can reduce the measured gap.
    const optimal = result.points === 100 || evidence.best.quality - evidence.selected.quality <= 1e-12
    const gap = optimal ? 0 : Math.max(0, (metric.id === 'scratch' ? selected - best : best - selected) * 100)
    return [{ level: result.level, gap }]
  })
  const count = observations.length
  const levels = observations.filter(item => item.gap >= MATERIAL_GAP - 1e-9).map(item => item.level).reverse().slice(0, 5)
  if (count < MINIMUM_OBSERVATIONS) return {
    id: metric.id, title: metric.title, advice: metric.advice, count, levels, status: 'limited', earlyGap: null, lateGap: null,
    summary: count ? `Only ${count} comparable ${count === 1 ? 'decision is' : 'decisions are'} recorded. At least six are needed to compare early and recent choices.`
      : 'No comparable decisions are recorded for this measure. There is not enough evidence to assess a weakness.',
  }
  const window = Math.floor(count / 3)
  const early = observations.slice(0, window)
  const late = observations.slice(-window)
  const earlyGap = mean(early.map(item => item.gap))!
  const lateGap = mean(late.map(item => item.gap))!
  const material = (items: typeof observations, gap: number) => gap >= MATERIAL_GAP - 1e-9 && items.filter(item => item.gap >= MATERIAL_GAP - 1e-9).length >= 2
  const earlyWeakness = material(early, earlyGap)
  const lateWeakness = material(late, lateGap)
  const improved = earlyWeakness && earlyGap - lateGap >= 5 - 1e-9 && lateGap <= earlyGap * .75 + 1e-9
  const status: WeaknessReport['status'] = improved ? lateWeakness ? 'improving' : 'resolved'
    : earlyWeakness && lateWeakness ? 'persistent' : lateWeakness ? 'emerging' : 'steady'
  const comparison = `The average gap was ${Math.round(earlyGap)} percentage points in your first ${window} comparable choices and ${Math.round(lateGap)} in your latest ${window}.`
  const summaries: Record<typeof status, string> = {
    persistent: `This remained a recurring opportunity to choose a stronger shot. ${comparison}`,
    improving: `Your choices reduced this gap, with room still to improve. ${comparison}`,
    resolved: `The earlier gap narrowed below the recurring-weakness threshold. ${comparison}`,
    emerging: `A recurring gap appeared in your more recent choices. ${comparison}`,
    steady: `No recurring early-to-late weakness was established by these choices. ${comparison}`,
  }
  return { id: metric.id, title: metric.title, advice: metric.advice, count, levels, status, earlyGap, lateGap, summary: summaries[status] }
}

/** Trends describe recorded decisions on changing tables; they are not a
 * controlled test of learning or a diagnosis of the character's fixed talents. */
export function buildCourseReport(session: Session): CourseReport {
  const history = session.mode === 'course' ? normalizeLessonHistory(session.history, session.completedLessons) : []
  const chapters = COURSE_CHAPTERS.map(chapter => {
    const results = history.filter(result => result.level >= chapter.firstLevel && result.level <= chapter.lastLevel)
    const midpoint = (chapter.firstLevel + chapter.lastLevel) / 2
    return { ...chapter, count: results.length, average: average(results),
      ...compareScores(results.filter(result => result.level <= midpoint), results.filter(result => result.level > midpoint), 3) }
  })
  let longestPerfectStreak = 0
  let streak = 0
  let previousLevel = 0
  for (const result of history) {
    streak = result.points === 100 ? result.level === previousLevel + 1 ? streak + 1 : 1 : 0
    longestPerfectStreak = Math.max(longestPerfectStreak, streak)
    previousLevel = result.level
  }
  const order = { persistent: 0, emerging: 1, improving: 2, resolved: 3, limited: 4, steady: 5 }
  const weaknesses = METRICS.map(metric => measureWeakness(history, metric))
    .sort((a, b) => order[a.status] - order[b.status] || (b.lateGap ?? 0) - (a.lateGap ?? 0))
  return { history, chapters, weaknesses, recordedLevels: history.length,
    missingLevels: session.mode === 'course' ? Math.max(0, session.completedLessons - history.length) : 0,
    average: average(history), longestPerfectStreak,
    ...compareScores(history.filter(result => result.level <= 50), history.filter(result => result.level > 50), 10) }
}
