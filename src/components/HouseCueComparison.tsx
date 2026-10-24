import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareHouseCue } from '../engine/house-cue'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function HouseCueComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const [variant, setVariant] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const comparisons = useMemo(() => result?.candidates.map(candidate => ({ candidate, data: compareHouseCue(prepared.scenario, candidate.plan, candidate.nominal) })) ?? [], [prepared.scenario, result])
  const data = comparisons.find(c => c.candidate.plan.id === shot?.plan.id)?.data
  const current = data?.variants[variant]
  return <section className="lesson-comparison plant-quality-comparison" aria-label="House cue spin comparison" hidden={hidden}>
    <h3>Requested spin is not delivered spin</h3>
    <p>The worn tip delivers only 68% of the requested spin setting. Compare a stroke that requests strong spin with one requesting little or none, then restore spin delivery alone to see how each route changes.</p>
    {!shot ? <p>After committing your shot, compare requested and delivered spin.</p> : !data || !current ? <p role="status">The spin comparison is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect house cue stroke">{prepared.balls.flatMap(ball => ball.options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setVariant(0) }}>Ball {ball.ballId} · {option.label}</Button>))}</div>
      <table><caption>Requested versus delivered at launch</caption><thead><tr><th>Spin</th><th>Requested</th><th>House cue</th></tr></thead><tbody>
        <tr data-testid="house-topspin"><th>Draw / follow</th><td>{(data.requested.topSpin * 100).toFixed(1)}%</td><td>{(data.delivered.topSpin * 100).toFixed(1)}%</td></tr>
        <tr data-testid="house-english"><th>English</th><td>{data.requested.sideSpin.toFixed(1)} rad/s</td><td>{data.delivered.sideSpin.toFixed(1)} rad/s</td></tr>
      </tbody></table>
      <p>Negative draw/follow values mean backspin; positive values mean topspin. Percentages are fractions of natural rolling spin at launch speed, not cue-tip offset. Zero requests no initial draw/follow.</p>
      <p data-testid="house-controls">Requested pace: {data.requested.speed.toFixed(2)} m/s; delivered pace: {data.delivered.speed.toFixed(2)} m/s in both replays. The fixed aim bias is also unchanged; the offered aim already compensates for it.</p>
      <div className="lesson-predictions" role="group" aria-label="Choose spin replay">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}: {(current.scenario.conditions!.cue!.spin * 100).toFixed(0)}% spin delivery. {current.simulation.stopped ? 'Settled result.' : 'Simulation ended before settling.'}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="House cue paths and finish">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="house-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`house-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {current.simulation.finalBalls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`house-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan dashes trace the cue; gold traces the selected object ball. Filled balls show the final recorded positions. The pink ring marks the same intended cue finish in both replays.</p>
      <table><caption>Same request, different spin delivery</caption><thead><tr><th>Cue</th><th>Legal pot</th><th>Scratch</th><th>Finish error</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`house-outcome-${i}`}><th>{v.label}</th><td>{v.outcome.legalPot ? 'Yes' : 'No'}</td><td>{v.simulation.scratch ? 'Yes' : 'No'}</td><td>{(v.outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <p data-testid="house-shift">The cue endpoints differ by {(data.finishShift * 100).toFixed(1)} cm.</p>
      <p>The spin-restored replay keeps the same requested stroke and restores only the spin multiplier to 100%. Power loss and aim bias remain. Compare the measured endpoint changes below: the zero-spin request is unaffected, while stronger-spin routes can change substantially. Endpoint separation is one diagnostic, not a reliability ranking.</p>
      <table><caption>Compare spin reliance across offered routes</caption><thead><tr><th>Route</th><th>Requested spin</th><th>Finish shift</th></tr></thead><tbody>{prepared.balls.flatMap(ball => ball.options.map(o => {
        const comparison = comparisons.find(c => c.candidate.plan.id === o.id)?.data
        return comparison ? <tr key={o.id} data-testid={`house-route-${ball.ballId}-${o.label}`}><th>Ball {ball.ballId} · {o.label}</th><td>{(o.plan.topSpin * 100).toFixed(0)}%</td><td>{(comparison.finishShift * 100).toFixed(1)} cm</td></tr> : null
      }))}</tbody></table>
      <p>These are nominal examples, not success probabilities. Restoring spin is an unscored comparison. Your score and ordinary trials use the actual house cue. A different finish is not automatically a better one.</p>
    </>}
    <p className="lesson-comparison-note">The comparison is optional and never blocks advancement.</p>
  </section>
}
