import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareDirtyContact } from '../engine/dirty-contact'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function DirtyContactComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [variant, setVariant] = useState(0), [full, setFull] = useState(false)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = useMemo(() => shot ? compareDirtyContact(prepared.scenario, shot.plan, shot.nominal) : null, [prepared.scenario, shot])
  const current = data?.variants[variant]
  const center = current ? { x: (current.contact.positions[0].x + current.contact.positions[1].x) / 2, y: (current.contact.positions[0].y + current.contact.positions[1].y) / 2 } : null
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Dirty ball contact comparison" hidden={hidden}>
    <h3>Separate speed loss from direction change</h3>
    <p>Grime changes ball-to-ball bounce and friction as well as rolling drag. This comparison cleans the contact response while keeping the same cloth drag and requested stroke, so both balls arrive at the first impact in the same state.</p>
    {!shot ? <p>After committing your shot, compare the measured contact responses.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect dirty contact stroke">{prepared.balls.flatMap(ball => ball.options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setVariant(0); setFull(false) }}>Ball {ball.ballId} · {o.label}</Button>))}</div>
      {!data || !current || !center ? <p role="status">A matched contact comparison is unavailable for this stroke.</p> : <>
        <div className="lesson-predictions" role="group" aria-label="Choose contact response">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
        <p role="status">{current.label}: cue → ball {shot.plan.ballId} at {current.contact.time.toFixed(3)} s. {full ? 'Complete recorded route and finish.' : 'Matched positions immediately before impact.'}</p>
        <svg viewBox={full ? '-.08 -.08 2.70 1.43' : `${center.x - .35} ${center.y - .25} .7 .5`} role="img" aria-label="Matched ball contact and outgoing direction">
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          {full ? [current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`dirty-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />) : data.variants.map((v, i) => {
            const origin = v.contact.positions[v.contact.ballIds.indexOf(shot.plan.ballId)]
            const end = { x: origin.x + v.outgoing.x / v.speed * .22, y: origin.y + v.outgoing.y / v.speed * .22 }
            return <g key={i} data-testid={`dirty-direction-${i}`} opacity={variant === i ? 1 : .6}><line x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} stroke={i ? '#ff9f98' : '#7de3ef'} strokeWidth=".005" strokeDasharray={i ? '.012 .008' : undefined} /><circle cx={end.x} cy={end.y} r=".009" fill={i ? '#ff9f98' : '#7de3ef'} /></g>
          })}
          {(full ? current.simulation.finalBalls : current.contact.balls!).filter(b => !b.pocketed).map(b => <g key={b.id} data-testid={`dirty-ball-${b.id}`}><circle cx={b.position.x} cy={b.position.y} r=".029" fill={b.id ? '#ffc16e' : '#fff'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{b.id || 'C'}</text></g>)}
        </svg>
        <Button size="sm" variant="outline" aria-pressed={full} onClick={() => setFull(value => !value)}>{full ? 'Show contact close-up' : 'Show complete route'}</Button>
        <p>Contact view: solid cyan shows the dirty outgoing direction; pink dashes show the clean direction. Both guides have equal length, so they compare direction only. Dots mark guide ends, not ball positions. Full route: cyan traces the cue and gold the object ball.</p>
        <table><caption>Object-ball velocity just after impact</caption><thead><tr><th>Contact</th><th>Outgoing speed</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`dirty-speed-${i}`}><th>{v.label}</th><td>{v.speed.toFixed(3)} m/s</td></tr>)}</tbody></table>
        <p data-testid="dirty-differences">Clean minus dirty speed: {data.speedDifference.toFixed(3)} m/s. Outgoing direction difference: {data.angleDifference.toFixed(2)}°.</p>
        <p>Velocities are recorded immediately after the collision solver step. The comparison requires equal incoming velocities, positions and impact time. Cleaning changes contact friction and restitution together; it does not isolate either one separately.</p>
        <p>The clean-contact example retains the dirty table’s overall cloth drag. It is a controlled demonstration, not a fully cleaned table or a retuned shot. Later contacts may also differ. Your score and ordinary trials still use the actual dirty balls.</p>
      </>}
    </>}
    <p className="lesson-comparison-note">Inspection is optional and never blocks advancement.</p>
  </section>
}
