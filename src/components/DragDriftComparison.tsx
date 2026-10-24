import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareDragDrift } from '../engine/drag-drift'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { verticalSpinDescription } from '../lib/shot-presentation'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function DragDriftComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const [variant, setVariant] = useState(0), [pace, setPace] = useState(1)
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [checked, setChecked] = useState(false)
  const revealed = Boolean(result) && (!retry || checked)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const experiment = useMemo(() => shot ? compareDragDrift(prepared.scenario, shot.plan, shot.nominal) : null, [prepared.scenario, shot])
  const data = experiment?.[pace]
  const current = data?.variants[variant]
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Drag and drift comparison" hidden={hidden}>
    <h3>More pace changes the pot and the finish</h3>
    <p>Which adjustment can help the object ball reach the pocket, but risks carrying the cue beyond its planned finish?</p>
    <div className="lesson-predictions" role="group" aria-label="Pace tradeoff prediction">{['Increase pace', 'Reduce pace'].map((label, i) => <Button key={label} size="sm" variant={prediction === i ? 'default' : 'outline'} aria-pressed={prediction === i} disabled={revealed} onClick={() => setPrediction(i)}>{label}</Button>)}</div>
    {revealed && <p data-testid="drag-prediction">{prediction === 0 ? 'Your prediction matches. ' : ''}Increasing pace can help the pot reach its pocket, while changing the cue finish. It also changes how long the balls are exposed to drift. Check the measured examples; it is not a guarantee of a pot or an overshoot.</p>}
    {result && <Button size="sm" variant="outline" onClick={() => { if (retry && !checked) setChecked(true); else { setRetry(true); setChecked(false); setPrediction(null) } }}>{retry && !checked ? 'Check prediction' : 'Try the prediction again'}</Button>}
    {!shot ? <p>After committing your shot, compare slow cloth alone, drift alone and both together.</p> : !data || !current ? <p role="status">The drag/drift comparison is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect drag drift stroke">{prepared.balls.flatMap(ball => ball.options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setVariant(0); setPace(1) }}>Ball {ball.ballId} · {option.label}</Button>))}</div>
      <p data-testid="drag-controls">Ball {shot.plan.ballId} · {data.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(data.plan)}. At this pace, the same launch is used for all three table conditions.</p>
      <div className="lesson-predictions" role="group" aria-label="Choose practice pace">{experiment!.map((p, i) => <Button key={p.label} size="sm" variant={pace === i ? 'default' : 'outline'} aria-pressed={pace === i} onClick={() => setPace(i)}>{p.label}</Button>)}</div>
      <div className="lesson-predictions" role="group" aria-label="Choose table faults">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label} · {data.label}. {current.simulation.stopped ? 'Settled result.' : 'Simulation ended before settling.'}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Drag and drift paths and finish">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="drag-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`drag-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {current.simulation.finalBalls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`drag-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan dashes trace the cue; gold traces the selected object ball. Filled balls show the final recorded positions. The pink ring marks the same intended cue finish in every replay.</p>
      <table><caption>Same pace, separate and combined faults</caption><thead><tr><th>Conditions</th><th>Legal pot</th><th>Scratch</th><th>Finish error</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`drag-outcome-${i}`}><th>{v.label}</th><td>{v.outcome.legalPot ? 'Yes' : 'No'}</td><td>{v.simulation.scratch ? 'Yes' : 'No'}</td><td>{(v.outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <table><caption>Pace tradeoff with both faults</caption><thead><tr><th>Pace</th><th>Legal pot</th><th>Finish error</th></tr></thead><tbody>{experiment!.map((p, i) => <tr key={p.label} data-testid={`drag-pace-${i}`}><th>{p.label}</th><td>{p.variants[0].outcome.legalPot ? 'Yes' : 'No'}</td><td>{(p.variants[0].outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <p>Slow cloth drains speed; drift changes direction while a ball moves. Their combined route need not match either fault alone. Aim, spin settings and target stay fixed across practice paces; the draw/follow setting is relative to rolling speed, so changing pace also scales initial rotation. The target belongs to the original scored stroke and is never moved to fit a practice result.</p>
      <p>These are nominal examples, not success probabilities. The fault-removal and changed-pace replays are unscored demonstrations, without retuning aim. Your score and ordinary trials use both faults at the original pace. Finish error measures distance from the target, not necessarily overshoot in the direction of travel.</p>
    </>}
    <p className="lesson-comparison-note">The comparison is optional and never blocks advancement.</p>
  </section>
}
