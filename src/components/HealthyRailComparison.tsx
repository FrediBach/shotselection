import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareHealthyRail } from '../engine/healthy-rail'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import { verticalSpinDescription } from '../lib/shot-presentation'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function HealthyRailComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const [variant, setVariant] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = useMemo(() => shot ? compareHealthyRail(prepared.scenario, shot.plan, shot.nominal) : null, [prepared.scenario, shot])
  const current = data?.variants[variant]
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Healthy rail comparison" hidden={hidden}>
    <h3>The same rebound on a healthy rail</h3>
    <p>Compare the exact same launch with the marked cushion restored. Layout, aim, pace, spin, pocket and intended finish stay fixed. The other table conditions stay fixed too.</p>
    {!shot ? <p>After committing your shot, compare its weak and healthy cushion replays.</p> : !data || !current ? <p role="status">The cushion comparison is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect cushion stroke">{prepared.balls.flatMap(ball => ball.options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setVariant(0) }}>Ball {ball.ballId} · {option.label}</Button>))}</div>
      <p data-testid="rail-controls">Ball {shot.plan.ballId} · {shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}. These launch settings are identical in both replays.</p>
      <div className="lesson-predictions" role="group" aria-label="Choose cushion replay">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}: restitution {current.scenario.conditions!.cushions![0].restitution.toFixed(2)}. {current.simulation.stopped ? 'Settled result.' : 'Simulation ended before settling.'}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Cushion replay paths and finish">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {CUSHIONS.filter(c => c.side === data.fault.rail).map((c, i) => <line key={i} data-testid="rail-fault" x1={c.nose.a.x} y1={c.nose.a.y} x2={c.nose.b.x} y2={c.nose.b.y} stroke="#e0a969" strokeWidth=".02" />)}
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="rail-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`rail-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {current.event && <>
          <polyline data-testid="rail-return" points={current.returnPath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#fff" strokeWidth=".014" />
          <circle data-testid="rail-rebound" cx={current.event.position.x} cy={current.event.position.y} r=".045" fill="none" stroke="#ffc16e" strokeWidth=".009" />
        </>}
        {current.simulation.finalBalls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`rail-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan dashes trace the cue; gold traces the selected object ball. Filled balls show the final recorded positions. The pink ring marks the same intended cue finish in both replays.</p>
      {data.matched ? <p data-testid="rail-measurement">Matched cue rebound at {current.event!.time.toFixed(3)} s. Outgoing speed: {current.outgoingSpeed!.toFixed(2)} m/s. Recorded cue path after this rebound: {(current.returnLength * 100).toFixed(1)} cm. White highlights that path; the gold ring marks the rebound.</p> : <p data-testid="rail-no-match">No matched straight-rail cue rebound is available for this stroke. Compare the complete paths and outcomes; no rebound measurement is inferred.</p>}
      <table><caption>Same stroke, different cushion</caption><thead><tr><th>Cushion</th><th>Legal pot</th><th>Scratch</th><th>Finish error</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`rail-outcome-${i}`}><th>{v.label}</th><td>{v.outcome.legalPot ? 'Yes' : 'No'}</td><td>{v.simulation.scratch ? 'Yes' : 'No'}</td><td>{(v.outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <p data-testid="rail-shift">The cue endpoints differ by {(data.finishShift * 100).toFixed(1)} cm.</p>
      <p>The highlighted comparison requires the same cue position, time and incoming velocity at the marked rail. Outgoing speeds are measured at that rebound. The following path length is a sampled estimate and includes any later contacts or rebounds; it is not just straight-line return distance.</p>
      <p>These are nominal examples, not success probabilities. The healthy rail is an unscored comparison using the original stroke without retuning it. Your score and ordinary trials use the weak cushion. A longer return is not automatically a better finish.</p>
    </>}
    <p className="lesson-comparison-note">The comparison is optional and never blocks advancement.</p>
  </section>
}
