import type { RefObject } from 'react'
import type { PreparedRound } from '@/engine/types'
import { directShotGeometry } from '@/engine/shot-geometry'
import { strokeDescription } from '@/lib/shot-presentation'
import { Button } from './ui/button'
import BallIcon from './BallIcon'

export default function ShortlistSelectionStep({ prepared, shortlist, selectedBall, headingRef, onToggle, onChoose }: {
  prepared: PreparedRound; shortlist: number[]; selectedBall: number | null; headingRef: RefObject<HTMLHeadingElement | null>;
  onToggle: (id: number) => void; onChoose: (id: number) => void;
}) {
  return <>
    <h2 ref={headingRef} tabIndex={-1}>Choose your ball.</h2>
    <p className="panel-description">Shortlist two balls, compare their lines and strokes, then choose your opener. Remove a ball to replace it.</p>
    <div className="lesson-predictions" role="group" aria-label="Two-ball shortlist">{prepared.balls.map(ball => <Button key={ball.ballId} aria-label={`Ball ${ball.ballId}`} size="sm" variant={shortlist.includes(ball.ballId) ? 'default' : 'outline'} aria-pressed={shortlist.includes(ball.ballId)} disabled={shortlist.length === 2 && !shortlist.includes(ball.ballId)} onClick={() => onToggle(ball.ballId)}><BallIcon id={ball.ballId} small /> Ball {ball.ballId}</Button>)}</div>
    <p role="status">{shortlist.length} of 2 shortlisted.</p>
    <div className="shortlist-comparison" aria-label="Shortlisted routes and strokes">{shortlist.map(id => {
      const ball = prepared.balls.find(ball => ball.ballId === id)!
      const g = directShotGeometry(prepared.scenario, ball.options[0].plan)
      return <section key={id} className="shortlist-card" aria-label={`Shortlisted ball ${id}`}>
        <h3>Ball {id}</h3>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Ball ${id} contact line for stroke A; other pocket choices are listed below.`}>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          <path d={`M${g.cue.x},${g.cue.y} L${g.ghost.x},${g.ghost.y}`} fill="none" stroke="#7de3ef" strokeWidth=".022" />
          <path d={`M${g.object.x},${g.object.y} L${g.pocket.center.x},${g.pocket.center.y}`} fill="none" stroke="#ffc16e" strokeWidth=".022" />
          <circle cx={g.cue.x} cy={g.cue.y} r=".035" fill="white" /><circle cx={g.object.x} cy={g.object.y} r=".035" fill="#ffc16e" />
        </svg>
        <p>Stroke A: {g.cutDegrees.toFixed(0)}° cut · {g.cueDistance.toFixed(2)} m approach.</p>
        <ul>{ball.options.map(option => <li key={option.id}><strong>{option.label} · {option.plan.speed.toFixed(2)} m/s</strong><span>{strokeDescription(option.plan)}</span><span>{directShotGeometry(prepared.scenario, option.plan).pocket.name} pocket</span></li>)}</ul>
        <Button size="sm" variant={selectedBall === id ? 'default' : 'outline'} aria-pressed={selectedBall === id} disabled={shortlist.length !== 2} onClick={() => onChoose(id)}>Use ball {id}</Button>
      </section>
    })}</div>
    <p className="lesson-comparison-note">Cyan: cue approach · Gold: object route. The shortlist is your judgment; the results still compare every offered shot.</p>
  </>
}
