import { useState } from 'react'
import { Button } from './ui/button'
import { slowDriftReplay } from '../engine/slow-drift'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function SlowDriftComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [zoom, setZoom] = useState(false)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = shot ? slowDriftReplay(prepared.scenario, shot.nominal) : null
  const bounds = data ? [...data.points, data.reference] : []
  const minX = Math.min(...bounds.map(p => p.x)), maxX = Math.max(...bounds.map(p => p.x))
  const minY = Math.min(...bounds.map(p => p.y)), maxY = Math.max(...bounds.map(p => p.y))
  const center = data ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : null
  const width = Math.max(.5, maxX - minX + .08), height = Math.max(.36, maxY - minY + .1)
  const magnitude = data ? Math.hypot(data.nap.x, data.nap.y) : 1
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Slow roll drift replay" hidden={hidden}>
    <h3>Watch the cue’s final slow roll</h3>
    <p>The uneven bed nudges moving balls downhill. As forward speed falls, that sideways influence becomes easier to see. Resting balls stay put.</p>
    {!shot ? <p>After committing your shot, inspect its slow route segment.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect drift stroke">{prepared.balls.flatMap(ball => ball.options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setZoom(false) }}>Ball {ball.ballId} · {o.label}</Button>))}</div>
      {!data || !center ? <p role="status">No uninterrupted slow cue segment was recorded for this stroke.</p> : <>
        <p role="status">Slow cue segment: {data.start.time.toFixed(3)}–{data.finish.time.toFixed(3)} s, lasting {data.elapsed.toFixed(3)} s.</p>
        <svg viewBox={zoom ? `${center.x - width / 2} ${center.y - height / 2} ${width} ${height}` : '-.08 -.08 2.70 1.43'} role="img" aria-label="Slow cue path and initial direction">
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
          <polyline points={shot.nominal.cuePath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#82a39d" strokeWidth=".005" />
          <polyline data-testid="drift-reference" points={[data.points[0], data.reference].map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff9f98" strokeWidth=".004" strokeDasharray=".01 .008" />
          <polyline data-testid="drift-slow-path" points={data.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7de3ef" strokeWidth=".006" />
          {[data.points[0], data.points.at(-1)!].map((p, i) => <g key={i} data-testid={`drift-marker-${i}`}><circle cx={p.x} cy={p.y} r=".009" fill={i ? '#ffc16e' : '#fff'} /><text textAnchor={i ? 'end' : 'start'} x={p.x + (i ? -.012 : .012)} y={p.y - .012} fontSize=".025" fill="#fff">{i ? 'End' : 'Slow'}</text></g>)}
          <g data-testid="drift-direction" transform={`translate(${center.x - .12} ${center.y - .12})`}>
            <line x1="0" y1="0" x2={data.nap.x / magnitude * .08} y2={data.nap.y / magnitude * .08} stroke="#ffc16e" strokeWidth=".004" />
            <circle cx={data.nap.x / magnitude * .08} cy={data.nap.y / magnitude * .08} r=".007" fill="#ffc16e" />
            <text x="0" y="-.015" fontSize=".025" fill="#fff">Downhill → dot</text>
          </g>
        </svg>
        <Button size="sm" variant="outline" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? 'Show full route' : 'Zoom slow segment'}</Button>
        <p data-testid="drift-measurement">Average speed in the first highlighted interval: {data.intervals[0].speed.toFixed(3)} m/s; last: {data.intervals.at(-1)!.speed.toFixed(3)} m/s. Sideways offset from the segment’s initial direction: {(Math.abs(data.sideways) * 100).toFixed(2)} cm.</p>
        <p>Cyan highlights the final moving intervals at 0.005–0.35 m/s, after the cue’s last collision or rebound. Speeds are averages between recorded frames. The gold end marker is the end of this sampled segment, not the exact stopping instant.</p>
        <p>Pink dashes extend the segment’s first sampled direction. They are a geometric reference, not a simulated level-table route. The offset describes the visible bend; it does not isolate slope from every other physical influence.</p>
      </>}
      <p>The offered aim already accounts for the slope. Compare the complete strokes and their slow tails; pace, spin and aim can vary together. This replay does not change the score or replace ordinary execution trials.</p>
    </>}
    <p className="lesson-comparison-note">Inspection is optional and never blocks advancement.</p>
  </section>
}
