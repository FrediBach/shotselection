import { useState } from 'react'
import { Button } from './ui/button'
import { shiftedPlantSetup, setupComparison } from '../engine/plant-setup'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
const labels = { flip: 'Route flips', same: 'Same route', tie: 'A ranking ties' }
export default function PlantSetupComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<keyof typeof labels | null>(null), [retry, setRetry] = useState(false)
  const [layout, setLayout] = useState<'A' | 'B'>('A')
  const source = prepared.scenario, shifted = shiftedPlantSetup(source), shown = layout === 'A' ? source : shifted
  const first = source.balls.find(b => b.id === source.plant!.ballId)!, target = source.balls.find(b => b.id === source.plant!.targetBallId)!
  const moved = shifted.balls.find(b => b.id === first.id)!
  const angle = Math.atan2(.002, Math.hypot(first.position.x - target.position.x, first.position.y - target.position.y)) * 180 / Math.PI
  const comparison = result?.plantSetup ? setupComparison(result.candidates, result.plantSetup, first.id) : null
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Plant setup comparison" hidden={hidden}>
    <h3>Can 2 mm change the preferred route?</h3>
    <p>A is the playable layout. B moves only ball 1 by 2 mm perpendicular to the original pair line, rotating that line by {angle.toFixed(2)}°. Predict whether the best offered route by weighted score changes.</p>
    <div role="group" aria-label="Setup view" className="lesson-predictions">{(['A', 'B'] as const).map(v => <Button key={v} size="sm" variant={layout === v ? 'default' : 'outline'} aria-pressed={layout === v} onClick={() => setLayout(v)}>Layout {v}</Button>)}</div>
    <figure><figcaption>Layout {layout} · Full table</figcaption><svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Layout ${layout}: only ball 1 changes position`}>
      <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
      {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
      {shown.balls.map(b => <g key={b.id}><circle data-testid={`setup-ball-${b.id}`} cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#7de3ef' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".04" fill="#071e1b">{b.id || ''}</text></g>)}
    </svg></figure>
    <figure><figcaption>Pair detail · Both positions at the same scale</figcaption><svg viewBox={`${target.position.x - .13} ${target.position.y - .13} .26 .26`} role="img" aria-label="Original and shifted plant-pair alignment">
      <rect x={target.position.x - .13} y={target.position.y - .13} width=".26" height=".26" fill="#143f38" />
      {[first, moved].map((b, i) => <g key={i}><line x1={b.position.x} y1={b.position.y} x2={target.position.x} y2={target.position.y} stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".001" strokeDasharray={i ? undefined : '.004 .003'} /><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".001" /></g>)}
      <circle cx={target.position.x} cy={target.position.y} r={TABLE.ballRadius} fill="#ffc16e" />
      <text x={target.position.x} y={target.position.y + .007} textAnchor="middle" fontSize=".02" fill="#071e1b">2</text>
    </svg></figure>
    <p>Cyan: A. Gold: B. Ball 2 stays fixed. All six strokes repeat without re-aiming or changing pace, spin, pocket or finish target. The player and indexed error draws also stay fixed. Moving ball 1 can affect both the cue’s delivery and the 1 → 2 transfer.</p>
    <div role="group" aria-label="Setup prediction" className="lesson-predictions">{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <Button key={key} size="sm" variant={prediction === key ? 'default' : 'outline'} aria-pressed={prediction === key} disabled={busy || revealed} onClick={() => setPrediction(key)}>{labels[key]}</Button>)}</div>
    {revealed && comparison && <>
      <p role="status">{prediction === comparison.outcome ? 'Your prediction matches. ' : ''}{labels[comparison.outcome as keyof typeof labels]} in this sample. A: {comparison.before}. B: {comparison.after}.</p>
      <table><caption>Weighted score / 100 · {result!.samples} matched trials per stroke and setup</caption><thead><tr><th>Route / finish</th><th>A</th><th>B</th></tr></thead><tbody>{prepared.balls.flatMap(b => b.options.map(o => {
        const a = result!.candidates.find(c => c.plan.id === o.id)!, changed = result!.plantSetup!.find(c => c.plan.id === o.id)!
        return <tr key={o.id} data-testid={`setup-score-${o.id}`}><th>{b.ballId === first.id ? 'Plant' : 'Free'} {o.label}</th><td>{(a.score * 100).toFixed(2)}</td><td>{(changed.score * 100).toFixed(2)}</td></tr>
      }))}</tbody></table>
      <p>Each route is represented by its highest-scoring offered finish in that layout; a different finish can lead after the move. These scores use the existing 72% completion, 20% centering and 8% legal-pot weights. B is a separate diagnostic experiment and never changes your points for A.</p>
      <p>This paired comparison isolates the setup change from new execution-error draws. It does not estimate how a player would adapt their aim, nor prove a universal ranking. Other players and samples can agree or tie instead of flipping; the free-ball results are measured again because moving an obstacle could affect a route.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setLayout('A') }}>Try the prediction again</Button>
    </>}
    {revealed && !comparison && <p role="status">The paired setup results could not be verified.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
