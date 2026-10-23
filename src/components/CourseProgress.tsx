import { useEffect, type CSSProperties, type RefObject } from 'react'
import { Check, Flag, Trophy } from 'lucide-react'
import { COURSE_CHAPTERS, TOTAL_LEVELS } from '@/engine/scenarios'
import type { Scenario } from '@/engine/types'

export default function CourseProgress({ completed, scenario, carriedTournamentLessons = 0 }: { completed: number; scenario: Scenario; carriedTournamentLessons?: number }) {
  const percentage = Math.round(completed / TOTAL_LEVELS * 100)
  return <section className="course-progress" aria-label="Course progression">
    <div className="course-progress-heading">
      <div><span className="eyebrow">FROM FIRST POT TO FINAL FRAME</span><h2>{completed === TOTAL_LEVELS ? 'Every lesson completed.' : 'Your road to tournament play.'}</h2></div>
      <div className="course-completion"><strong>{percentage}%</strong><span>{completed} of {TOTAL_LEVELS} levels complete</span></div>
    </div>
    <div className="course-track" role="progressbar" aria-label="Game completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${completed} of ${TOTAL_LEVELS} levels complete`}><span style={{ width: `${percentage}%` }} /></div>
    <ol className="course-chapters" aria-label="Learning scenarios" style={{ '--course-chapter-count': COURSE_CHAPTERS.length } as CSSProperties}>{COURSE_CHAPTERS.map((chapter, index) => {
      const done = completed >= chapter.lastLevel
      const current = !done && scenario.curriculum?.chapterId === chapter.id
      const count = Math.max(0, Math.min(chapter.lastLevel - chapter.firstLevel + 1, completed - chapter.firstLevel + 1))
      return <li key={chapter.id} className={done ? 'chapter-done' : current ? 'chapter-current' : ''} aria-current={current ? 'step' : undefined}>
        <span className="chapter-number">{done ? <Check size={13} /> : index === COURSE_CHAPTERS.length - 1 ? <Flag size={13} /> : String(index + 1).padStart(2, '0')}</span>
        <span><strong>{chapter.title}</strong><small>Levels {chapter.firstLevel}–{chapter.lastLevel}<span> · {count}/{chapter.lastLevel - chapter.firstLevel + 1}</span></small></span>
      </li>
    })}</ol>
    {carriedTournamentLessons > 0 && <p className="panel-description">{scenario.level <= 60 ? 'New bank-shot and plant lessons are ready.' : 'Ten new plant lessons are ready.'} Your {carriedTournamentLessons} completed tournament {carriedTournamentLessons === 1 ? 'lesson is' : 'lessons are'} saved and will count again after the Plants chapter.</p>}
  </section>
}

export function CourseCompletion({ score, perfect, rounds, onRestart, headingRef }: { score: number; perfect: number; rounds: number; onRestart: () => void; headingRef: RefObject<HTMLHeadingElement | null> }) {
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [headingRef])
  return <section className="course-finished" aria-label="Course complete">
    <div className="completion-emblem"><Trophy size={36} /></div>
    <span className="eyebrow">{TOTAL_LEVELS} LESSONS. A STRONGER TABLE SENSE.</span>
    <h2 ref={headingRef} tabIndex={-1}>From your first pot to the final frame.</h2>
    <p>You’ve completed the course: reading pots, controlling the cue ball, planning the next shot, banking around blockers, comparing plants with free balls, and choosing a route through tournament traffic.</p>
    <div className="completion-stats"><div><strong>100%</strong><span>Course complete</span></div><div><strong>{score}</strong><span>Session points</span></div><div><strong>{rounds ? Math.round(score / (rounds * 100) * 100) : 0}%</strong><span>Selection accuracy</span></div><div><strong>{perfect}</strong><span>Perfect choices</span></div></div>
    <p className="completion-note">Completion tracks lessons played. Your points measure how well you selected the shot. Play again to improve your decisions.</p>
    <button className="ui-button button-primary" onClick={onRestart}>Start a new course</button>
  </section>
}
