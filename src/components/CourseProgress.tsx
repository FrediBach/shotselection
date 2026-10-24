import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { COURSE_CHAPTERS, TOTAL_LEVELS } from '@/engine/scenarios'
import type { Scenario } from '@/engine/types'

function ChapterStrip({ completed, currentChapter }: { completed: number; currentChapter?: string }) {
  const list = useRef<HTMLOListElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const listId = useId()
  const hintId = useId()
  const complete = completed === TOTAL_LEVELS
  const [scroll, setScroll] = useState({ overflow: false, earlier: false, later: false })
  const updateScroll = useCallback(() => {
    const element = list.current
    const container = strip.current
    if (!element || !container) return
    // Compare the cards' minimum width with the whole strip, so showing the
    // controls cannot itself keep the strip in its overflow layout.
    const next = { overflow: element.scrollWidth > container.clientWidth + 1, earlier: element.scrollLeft > 1,
      later: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 }
    setScroll(previous => previous.overflow === next.overflow && previous.earlier === next.earlier && previous.later === next.later ? previous : next)
  }, [])
  const showCurrent = useCallback(() => {
    const element = list.current
    if (!element) return
    const current = element.querySelector<HTMLElement>('[aria-current="step"]')
      ?? (complete ? element.lastElementChild as HTMLElement : null)
    if (!current) return
    const left = current.offsetLeft
    if (left < element.scrollLeft || left + current.offsetWidth > element.scrollLeft + element.clientWidth) {
      element.scrollLeft = left - (element.clientWidth - current.offsetWidth) / 2
    }
  }, [complete])
  useEffect(() => {
    showCurrent()
    updateScroll()
    const observer = new ResizeObserver(() => { showCurrent(); updateScroll() })
    if (list.current) observer.observe(list.current)
    if (strip.current) observer.observe(strip.current)
    return () => observer.disconnect()
  }, [currentChapter, showCurrent, updateScroll])
  const move = (direction: number) => {
    const element = list.current
    if (element) element.scrollBy({ left: direction * Math.max(130, element.clientWidth * .8), behavior: 'auto' })
  }
  return <div ref={strip} className={`course-chapter-strip${scroll.overflow ? ' chapters-overflow' : ''}`}>
    {scroll.overflow && <button type="button" className="chapter-scroll" aria-label="Show earlier chapters" aria-controls={listId} disabled={!scroll.earlier} onClick={() => move(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>}
    <ol ref={list} id={listId} className="course-chapters" aria-label="Learning scenarios" tabIndex={scroll.overflow ? 0 : undefined} aria-describedby={scroll.overflow ? hintId : undefined} onScroll={updateScroll} onKeyDown={event => {
      if (!scroll.overflow) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1) }
      if ((event.key === 'Home' || event.key === 'End') && list.current) { event.preventDefault(); list.current.scrollLeft = event.key === 'Home' ? 0 : list.current.scrollWidth }
    }}>{COURSE_CHAPTERS.map((chapter, index) => {
      const done = completed >= chapter.lastLevel
      const current = !done && currentChapter === chapter.id
      const count = Math.max(0, Math.min(chapter.lastLevel - chapter.firstLevel + 1, completed - chapter.firstLevel + 1))
      return <li key={chapter.id} className={done ? 'chapter-done' : current ? 'chapter-current' : ''} aria-current={current ? 'step' : undefined} title={`${chapter.title}: ${chapter.description}`}>
        <strong>{chapter.title}</strong>
        <div className="chapter-meta"><span className="chapter-number" aria-hidden="true">{done ? <Check size={12} /> : index === COURSE_CHAPTERS.length - 1 ? <Flag size={12} /> : String(index + 1).padStart(2, '0')}</span>
          <small><span className="sr-only">Levels </span>{chapter.firstLevel}–{chapter.lastLevel}<span> · {count}/{chapter.lastLevel - chapter.firstLevel + 1}</span></small>
        </div>
      </li>
    })}</ol>
    {scroll.overflow && <><button type="button" className="chapter-scroll" aria-label="Show later chapters" aria-controls={listId} disabled={!scroll.later} onClick={() => move(1)}><ChevronRight size={16} aria-hidden="true" /></button><span id={hintId} className="sr-only">Swipe or use the arrow keys to explore all ten chapters. Home and End show the first and last chapters.</span></>}
  </div>
}

export default function CourseProgress({ completed, scenario, carriedTournamentLessons = 0 }: { completed: number; scenario: Scenario; carriedTournamentLessons?: number }) {
  const percentage = Math.round(completed / TOTAL_LEVELS * 100)
  return <section className="course-progress" aria-label="Course progression">
    <div className="course-progress-heading">
      <h2>{completed === TOTAL_LEVELS ? 'Every lesson completed.' : 'From first pots to the final boss.'}</h2>
      <div className="course-completion"><strong>{percentage}%</strong><span>{completed} of {TOTAL_LEVELS} levels complete</span></div>
    </div>
    <div className="course-track" role="progressbar" aria-label="Game completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${completed} of ${TOTAL_LEVELS} levels complete`}><span style={{ width: `${percentage}%` }} /></div>
    <ChapterStrip completed={completed} currentChapter={scenario.curriculum?.chapterId} />
    {carriedTournamentLessons > 0 && <p className="panel-description">{scenario.level <= 60 ? 'New bank-shot and plant lessons are ready.' : 'Ten new plant lessons are ready.'} Your {carriedTournamentLessons} completed tournament {carriedTournamentLessons === 1 ? 'lesson is' : 'lessons are'} saved and will count again after the Plants chapter.</p>}
  </section>
}
