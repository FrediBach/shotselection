import { useState } from 'react'
import { Button } from './ui/button'
import { patchRouteReplay } from '../engine/patch-route'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function PatchRouteComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [focus, setFocus] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = shot ? patchRouteReplay(prepared.scenario, shot.plan, shot.nominal) : null
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Sticky patch route replay" hidden={hidden}>
    <h3>Which parts of the shot cross the spill?</h3>
    <p>Unlike heavy cloth across the whole table, this patch adds drag only while a ball’s center is inside its boundary. Inspect the cue before and after contact, then the object ball’s journey.</p>
    {!shot ? <p>After committing your shot, inspect the highlighted crossings.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect patch stroke">{prepared.balls.flatMap(ball => ball.options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setFocus(0) }}>Ball {ball.ballId} · {o.label}</Button>))}</div>
      {!data ? <p role="status">The recorded patch crossings are unavailable.</p> : <>
        <p role="status">Cue → ball {shot.plan.ballId} at {data.contact.time.toFixed(3)} s. Bright segments lie inside the spill.</p>
        <div className="lesson-predictions" role="group" aria-label="Inspect patch route">{['All routes', 'Cue before contact', 'Cue after contact', 'Object route'].map((label, i) => <Button key={label} size="sm" variant={focus === i ? 'default' : 'outline'} aria-pressed={focus === i} onClick={() => setFocus(i)}>{label}</Button>)}</div>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Paths inside the sticky patch">
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          {data.patches.map(p => <circle key={p.id} data-testid={`patch-area-${p.id}`} cx={p.center.x} cy={p.center.y} r={p.radius} fill="#493d27" stroke="#ddbd82" strokeWidth=".008" strokeDasharray=".02 .012" />)}
          {data.routes.map((route, i) => focus === 0 || focus === i + 1 ? <g key={route.label} data-testid={`patch-route-${i}`}>
            <polyline points={route.path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={['#fff', '#7de3ef', '#ffc16e'][i]} strokeOpacity=".45" strokeWidth=".008" strokeDasharray={i === 0 ? '.025 .015' : undefined} />
            {route.crossings.flatMap(c => c.segments.map(([a, b], j) => <line key={`${c.patchId}-${j}`} data-testid={`patch-inside-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={['#fff', '#7de3ef', '#ffc16e'][i]} strokeWidth=".02" />))}
          </g> : null)}
          {shot.nominal.finalBalls.filter(b => !b.pocketed).map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r=".029" fill={b.id ? '#ffc16e' : '#fff'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{b.id || 'C'}</text></g>)}
        </svg>
        <p>White: cue approach. Cyan: cue after contact. Gold: selected object ball. Filled balls show the settled result. Only the thicker, bright parts are inside the patch.</p>
        <table><caption>Recorded path inside the spill</caption><thead><tr><th>Route</th><th>Inside length</th></tr></thead><tbody>{data.routes.map((route, i) => <tr key={route.label} data-testid={`patch-length-${i}`}><th>{route.label}</th><td>{route.crossings.some(c => c.length > 0) ? `${(route.crossings.reduce((sum, c) => sum + c.length, 0) * 100).toFixed(1)} cm` : 'No crossing'}</td></tr>)}</tbody></table>
        <p>The boundary clips straight lines between recorded positions. Highlighted lengths are sampled path estimates, not exact entry times or measurements of speed loss. The patch uses ball-center position, not the edge of the drawn ball.</p>
        <p>Crossing the spill can change the rest of the journey, even after a ball leaves it. Compare both approach and finish; a clear object-ball route does not mean the cue avoided the patch.</p>
      </>}
      <p>This is the inspected stroke’s nominal result. Ordinary trials and scoring still use the actual sticky table; inspecting paths does not change your score.</p>
    </>}
    <p className="lesson-comparison-note">Inspection is optional and never blocks advancement.</p>
  </section>
}
