import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Flag, RotateCcw, Sparkles, Target, Trophy } from 'lucide-react'
import { COURSE_CHAPTERS, TOTAL_LEVELS } from '@/engine/course'
import { buildCourseReport } from '@/lib/course-report'
import type { Session } from '@/lib/session'
import { Button } from './ui/button'
import './CourseCompletion.css'

type Report = ReturnType<typeof buildCourseReport>
type History = Report['history']
const rounded = (value: number) => Math.round(value)
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(rounded(value))}`

function linePath(values: { level: number; value: number }[], plotWidth: number) {
  return values.map((point, index) => `${index === 0 || point.level !== values[index - 1].level + 1 ? 'M' : 'L'}${44 + (point.level - 1) / (TOTAL_LEVELS - 1) * plotWidth},${218 - point.value * 1.9}`).join(' ')
}

function JourneyChart({ history }: { history: History }) {
  const [level, setLevel] = useState(() => history.at(-1)?.level ?? 1)
  const chart = useRef<SVGSVGElement>(null)
  const [chartWidth, setChartWidth] = useState(970)
  const chartId = useId()
  useEffect(() => {
    const element = chart.current
    if (!element) return
    const resize = () => setChartWidth(Math.max(240, element.getBoundingClientRect().width))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const plotWidth = chartWidth - 64
  const chosen = history.find(result => result.level === level)
  const chapter = COURSE_CHAPTERS.find(item => level >= item.firstLevel && level <= item.lastLevel)!
  const scores = history.map(result => ({ level: result.level, value: result.points }))
  // A missing level breaks the trend as well as the score line. Old totals
  // cannot reconstruct the order in which those points were earned.
  const averages = history.map((result, index) => {
    const window: number[] = [result.points]
    for (let previous = index - 1; previous >= 0 && window.length < 10; previous--) {
      if (history[previous].level !== history[previous + 1].level - 1) break
      window.push(history[previous].points)
    }
    return { level: result.level, value: window.reduce((sum, value) => sum + value, 0) / window.length }
  })
  const average = averages.find(result => result.level === level)
  const x = 44 + (level - 1) / (TOTAL_LEVELS - 1) * plotWidth
  return <>
    <div className="journey-legend"><span><i className="legend-level-score" /> Level score</span><span><i className="legend-rolling-score" /> Rolling average · up to 10 levels</span></div>
    <svg ref={chart} className="journey-chart" viewBox={`0 0 ${chartWidth} 258`} role="img" aria-label="Scores across 100 levels" aria-describedby={chartId} onPointerDown={event => {
      const bounds = event.currentTarget.getBoundingClientRect()
      setLevel(Math.max(1, Math.min(TOTAL_LEVELS, Math.round(((event.clientX - bounds.left) / bounds.width * chartWidth - 44) / plotWidth * (TOTAL_LEVELS - 1)) + 1)))
    }}>
      <desc>Level scores and a rolling average, each out of 100. Use the Inspect a level slider below for exact values. Gaps indicate unrecorded levels.</desc>
      {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="44" x2={chartWidth - 20} y1={218 - value * 1.9} y2={218 - value * 1.9} className="journey-grid" /><text x="30" y={222 - value * 1.9} textAnchor="end">{value}</text></g>)}
      {[1, 20, 40, 60, 80, 100].map(value => <text key={value} x={44 + (value - 1) / (TOTAL_LEVELS - 1) * plotWidth} y="246" textAnchor="middle">{value}</text>)}
      <path d={linePath(scores, plotWidth)} className="journey-score-line" />
      {scores.map(point => <circle key={point.level} cx={44 + (point.level - 1) / (TOTAL_LEVELS - 1) * plotWidth} cy={218 - point.value * 1.9} r="2.5" className="journey-score-dot" />)}
      <path d={linePath(averages, plotWidth)} className="journey-average-line" />
      <line x1={x} x2={x} y1="20" y2="222" className="journey-cursor" />
      {chosen && <circle cx={x} cy={218 - chosen.points * 1.9} r="5" className="journey-chosen-dot" />}
    </svg>
    <div className="journey-controls">
      <Button variant="outline" size="icon" aria-label="Inspect previous level" disabled={level === 1} onClick={() => setLevel(value => value - 1)}><ChevronLeft size={16} /></Button>
      <label className="journey-slider"><span>Inspect a level <span>1–{TOTAL_LEVELS}</span></span><input type="range" min={1} max={TOTAL_LEVELS} step={1} value={level} aria-label="Inspect a level" aria-valuetext={`Level ${level}, ${chosen ? `${chosen.points} points` : 'no recorded score'}`} onChange={event => setLevel(Number(event.target.value))} /></label>
      <Button variant="outline" size="icon" aria-label="Inspect next level" disabled={level === TOTAL_LEVELS} onClick={() => setLevel(value => value + 1)}><ChevronRight size={16} /></Button>
    </div>
    <div className="journey-selection" id={chartId} aria-live="polite" aria-atomic="true">
      <span className="journey-level-number">{String(level).padStart(2, '0')}</span>
      <div><strong>{chapter.title}</strong><span>Level {level}{chosen?.points === 100 ? ' · Perfect choice' : ''}</span></div>
      <div className="journey-selected-score"><strong>{chosen ? <>{chosen.points}<small> / 100</small></> : 'Not recorded'}</strong><span>{average ? `${rounded(average.value)} rolling average` : 'Your earned total is preserved'}</span></div>
    </div>
    <p className="report-caption">Scores measure shot selection, not pot success. Later levels introduce different challenges, so this is a record of your run, not a controlled measure of learning.</p>
    <details className="journey-data"><summary>View all level scores <ChevronDown size={15} /></summary><div className="journey-data-scroll" tabIndex={0} role="region" aria-label="Recorded level scores"><table><caption>Recorded scores out of 100. Unrecorded levels are omitted.</caption><thead><tr><th scope="col">Level</th><th scope="col">Chapter</th><th scope="col">Score</th></tr></thead><tbody>{history.map(result => <tr key={result.level}><th scope="row">{result.level}</th><td>{COURSE_CHAPTERS.find(item => result.level >= item.firstLevel && result.level <= item.lastLevel)?.title}</td><td>{result.points}</td></tr>)}</tbody></table></div></details>
  </>
}

function ChapterChart({ chapters }: { chapters: Report['chapters'] }) {
  const [selectedId, setSelectedId] = useState(() => chapters.filter(chapter => chapter.average !== null).sort((a, b) => a.average! - b.average!)[0]?.id ?? chapters[0].id)
  const selected = chapters.find(chapter => chapter.id === selectedId)!
  return <>
    <div className="chapter-score-axis"><span>Average points per level</span><span>0 — 100</span></div>
    <div className="chapter-score-chart" role="group" aria-label="Chapter average scores">{chapters.map((chapter, index) => <button type="button" className={`chapter-score-row${selectedId === chapter.id ? ' chapter-score-selected' : ''}`} key={chapter.id} aria-pressed={selectedId === chapter.id} onClick={() => setSelectedId(chapter.id)} aria-label={`${chapter.title}, ${chapter.average === null ? 'no recorded scores' : `${rounded(chapter.average)} average points from ${chapter.count} recorded levels`}`}>
      <span className="chapter-score-name"><small>{String(index + 1).padStart(2, '0')}</small>{chapter.title}</span>
      <span className="chapter-score-track" aria-hidden="true"><span style={{ width: `${chapter.average ?? 0}%` }} /></span>
      <strong>{chapter.average === null ? '—' : rounded(chapter.average)}</strong>
    </button>)}</div>
    <div className="chapter-score-detail" aria-live="polite" aria-atomic="true"><div><strong>{selected.title}</strong><span>Levels {selected.firstLevel}–{selected.lastLevel} · {selected.count}/10 recorded</span></div>
      {selected.change !== null && selected.earlyAverage !== null && selected.lateAverage !== null ? <><div className="chapter-half-scores"><span>First half <b>{rounded(selected.earlyAverage)}</b></span><ArrowRight size={16} /><span>Second half <b>{rounded(selected.lateAverage)}</b></span><strong className={selected.change > 0 ? 'report-positive' : selected.change < 0 ? 'report-attention' : ''}>{signed(selected.change)} pts</strong></div><p>Average score within this chapter. The second half introduces harder applications.</p></> : <p>More recorded results in both halves are needed to compare this chapter’s progress.</p>}
    </div>
  </>
}

const statusLabels = { persistent: 'Still a focus', emerging: 'Recent challenge', improving: 'Improving', resolved: 'Gap reduced', limited: 'More evidence needed', steady: 'Holding steady' }

function WeaknessCard({ weakness }: { weakness: Report['weaknesses'][number] }) {
  return <article className={`weakness-card weakness-${weakness.status}`}>
    <div className="weakness-heading"><h4>{weakness.title}</h4><span>{statusLabels[weakness.status]}</span></div>
    {weakness.earlyGap !== null && weakness.lateGap !== null && <div className="weakness-comparison"><span>Earlier <strong>{rounded(weakness.earlyGap)}<small> pp</small></strong></span><ArrowRight size={16} /><span>Later <strong>{rounded(weakness.lateGap)}<small> pp</small></strong></span><span className="weakness-gap-label">Average gap to the<br />best overall choice</span></div>}
    <p>{weakness.summary}</p>
    <div className="weakness-advice"><Target size={15} /><p>{weakness.advice}</p></div>
    <small className="weakness-evidence">{weakness.count} comparable levels{weakness.levels.length > 0 ? ` · Review levels ${weakness.levels.slice(0, 4).join(', ')}` : ''}</small>
  </article>
}

export default function CourseCompletion({ session, onRestart, headingRef }: { session: Session; onRestart: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const report = useMemo(() => buildCourseReport(session), [session])
  const averageScore = session.rounds ? rounded(session.score / session.rounds) : 0
  const completeChapters = report.chapters.filter(chapter => chapter.count === 10)
  const strongest = [...completeChapters].sort((a, b) => b.average! - a.average!)[0]
  const focus = report.weaknesses.filter(weakness => weakness.status === 'persistent' || weakness.status === 'emerging' || weakness.status === 'improving')
  const shownWeaknesses = [...focus, ...report.weaknesses.filter(weakness => weakness.status === 'resolved')]
  const enoughEvidence = report.weaknesses.some(weakness => weakness.status !== 'limited')
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [headingRef])

  return <section className="course-report" aria-label="Course complete">
    <div className="report-hero">
      <div className="report-hero-copy"><span className="report-complete-badge"><Check size={14} /> {TOTAL_LEVELS} / {TOTAL_LEVELS} LEVELS COMPLETE</span><h2 ref={headingRef} tabIndex={-1}>Even the broken table<br className="report-desktop-break" /> couldn’t stop you.</h2><p>From your first pot to the final boss. Ten chapters, ten trick shots, and a hundred decisions. You’ve earned a moment to look back, {session.character?.name ?? 'player'}.</p><span className="report-hero-signoff"><Flag size={15} /> Course finished. Your next chapter is yours.</span></div>
      <div className="report-trophy" aria-hidden="true"><div className="report-trophy-orbit" /><Trophy size={32} strokeWidth={1.3} /><strong>{TOTAL_LEVELS}</strong><span>THE FULL RUN</span><div className="report-trophy-dots">{COURSE_CHAPTERS.map(chapter => <i key={chapter.id} />)}</div></div>
    </div>

    <div className="report-stats"><div><span>Total points</span><strong>{session.score.toLocaleString('en-US')}<small> / {(session.rounds * 100).toLocaleString('en-US')}</small></strong></div><div><span>Average level score</span><strong>{averageScore}<small> / 100</small></strong></div><div><span>Perfect choices</span><strong>{session.perfect}<small> / {session.rounds}</small></strong></div><div><span>Best perfect streak</span><strong>{report.recordedLevels ? report.longestPerfectStreak : '—'}<small>{report.recordedLevels ? ` ${report.longestPerfectStreak === 1 ? 'level' : 'levels'}` : ' not recorded'}</small></strong></div></div>

    {report.missingLevels > 0 && <p className="report-history-note"><Flag size={17} aria-hidden="true" />{report.recordedLevels ? `${report.recordedLevels} of ${session.completedLessons} level scores were recorded. Charts and streaks cover those levels only.` : 'This save has no recorded level history. Your total points and perfect choices are preserved; individual scores and trends are unavailable.'} A new course will record the full journey.</p>}

    <section className="report-panel report-journey" aria-labelledby="journey-heading"><div className="report-panel-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h3 id="journey-heading">Your 100-level journey</h3></div><span className="report-panel-meta">{report.recordedLevels} levels recorded</span></div>
      {report.recordedLevels ? <JourneyChart history={report.history} /> : <div className="report-empty"><Flag size={26} /><h4>Your finish is saved.</h4><p>The level-by-level story will appear here after your next run. We can’t reconstruct it from a total score.</p></div>}
    </section>

    <div className="report-analysis-grid"><section className="report-panel" aria-labelledby="chapters-heading"><div className="report-panel-heading"><div><span className="eyebrow">TEN CHAPTERS. DIFFERENT CHALLENGES.</span><h3 id="chapters-heading">Chapter by chapter</h3></div></div><p className="report-section-intro">Select a chapter to compare its first and second halves.</p><ChapterChart chapters={report.chapters} />{strongest && <div className="report-highlight"><Sparkles size={18} /><p><strong>{strongest.title} was {completeChapters.filter(chapter => chapter.average === strongest.average).length > 1 ? 'one of' : ''} your highest-scoring {report.missingLevels > 0 ? 'fully recorded ' : ''}{completeChapters.filter(chapter => chapter.average === strongest.average).length > 1 ? 'chapters' : 'chapter'}.</strong><span>{rounded(strongest.average!)} points per level across all ten lessons.</span></p></div>}</section>
      <section className="report-panel" aria-labelledby="weakness-heading"><div className="report-panel-heading"><div><span className="eyebrow">YOUR NEXT PRACTICE SESSION</span><h3 id="weakness-heading">What still needs work</h3></div><Target size={21} className="report-heading-icon" /></div><p className="report-section-intro">Recurring gaps between your choices and the best overall option for the same table and player.</p>
        {shownWeaknesses.length ? <div className="weakness-list">{shownWeaknesses.map(weakness => <WeaknessCard key={weakness.id} weakness={weakness} />)}</div> : <div className="report-empty report-weakness-empty"><Check size={25} /><h4>{enoughEvidence ? 'No persistent gap stands out.' : 'A little more history is needed.'}</h4><p>{enoughEvidence ? 'The recorded comparisons don’t show a repeated weakness that stayed unresolved. Use the lower-scoring chapters to choose your next challenge.' : 'We need repeated shot comparisons from earlier and later levels before identifying a weakness that persisted.'}</p></div>}
        {enoughEvidence && report.weaknesses.some(weakness => weakness.status === 'limited') && <p className="report-caption">{report.weaknesses.filter(weakness => weakness.status !== 'limited').length} of 4 measures have enough recorded comparisons. The remaining measures need more evidence.</p>}
        <details className="report-method"><summary>How this analysis works <ChevronDown size={15} /></summary><p>We compare potting, cue-ball position, scratch risk, and next-shot availability with the best overall offered shot. A gap is measured in percentage points (pp); smaller is better.</p><p>Trends compare the first and last thirds of at least six comparable results. A recurring gap averages at least 8 pp with two affected choices in each period. Improvement means a reduction of at least 5 pp and 25%. Recent challenges only meet the gap threshold in the later period.</p><p>Perfect choices and tables with no successful alternative don’t count as avoidable gaps. Only measures with enough evidence are assessed. These are coaching signals from simulated outcomes, not proof that a specific skill caused a result. Your character’s talents stay fixed throughout the course.</p></details>
      </section></div>

    <div className="report-finish-actions"><div><span className="eyebrow">TAKE THE NEXT SHOT</span><h3>A fresh table. A sharper eye.</h3><p>Start again with a new player and put your takeaways into practice. Starting a new course replaces this run and its report.</p></div><Button onClick={onRestart}><RotateCcw size={16} /> Start a new course <ArrowRight size={16} /></Button></div>
  </section>
}
