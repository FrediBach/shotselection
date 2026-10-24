import { useState } from 'react'
import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function EquipmentRepairComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [checked, setChecked] = useState(false)
  const [variant, setVariant] = useState(0), [inspect, setInspect] = useState<string | null>(null)
  const data = result?.equipmentRepairs, current = data?.variants[variant]
  const revealed = Boolean(result) && (!retry || checked)
  const options = prepared.balls.flatMap(b => b.options.map(o => ({ ...o, name: `Ball ${b.ballId} · ${o.label}` })))
  const name = (id: string) => options.find(o => o.id === id)?.name ?? id
  const shot = current?.shots.find(s => s.plan.id === (inspect ?? result?.selected.plan.id))
  const correct = data && prediction !== null && (prediction === 0 ? data.variants.slice(1).every(v => !v.changed) : data.variants[prediction].changed)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Equipment repair diagnosis" hidden={hidden}>
    <h3>Which repair changes the preferred shot?</h3>
    <p>Predict one repair that changes the top-ranked offered stroke, or choose no change. More than one repair can change the answer.</p>
    <div className="lesson-predictions" role="group" aria-label="Equipment repair prediction">{['No repair changes it', 'Repair cue', 'Clean balls', 'Restore rail'].map((label, i) => <Button key={label} size="sm" variant={prediction === i ? 'default' : 'outline'} aria-pressed={prediction === i} disabled={revealed} onClick={() => setPrediction(i)}>{label}</Button>)}</div>
    {revealed && data && <p data-testid="repair-prediction">{prediction === null ? 'Prediction skipped. ' : correct ? 'Your prediction matches these trials. ' : 'That prediction does not match these trials. '}{data.variants.slice(1).filter(v => v.changed).map(v => v.label).join(', ') || 'No single repair'} changes the top-ranked set among these fixed offers.</p>}
    {result && <Button size="sm" variant="outline" onClick={() => { if (retry && !checked) setChecked(true); else { setRetry(true); setChecked(false); setPrediction(null) } }}>{retry && !checked ? 'Check prediction' : 'Try the prediction again'}</Button>}
    {!result ? <p>After your shot, inspect all three single repairs.</p> : !data || !current || !shot ? <p role="status">The repair comparison is unavailable.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect equipment repair">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}. Top-ranked: {current.winners.length ? current.winners.map(name).join(' / ') : 'none with positive comparison score'}. {variant > 0 ? current.changed ? 'The top-ranked set changes.' : 'The top-ranked set stays the same.' : 'Original equipment is the reference.'}</p>
      <table><caption>Same offers, one repair at a time</caption><thead><tr><th>Stroke</th><th>Original score</th><th>Current score</th><th>Full success</th></tr></thead><tbody>{options.map(o => {
        const original = data.variants[0].shots.find(s => s.plan.id === o.id)!, changed = current.shots.find(s => s.plan.id === o.id)!
        return <tr key={o.id} data-testid={`repair-row-${o.plan.ballId}-${o.label}`}><th>{o.name}{current.winners.includes(o.id) ? ' ★' : ''}</th><td>{(original.score * 100).toFixed(1)}</td><td>{(changed.score * 100).toFixed(1)}</td><td>{(changed.successRate * 100).toFixed(0)}%</td></tr>
      })}</tbody></table>
      <p>Scores use the same pot-and-finish criteria as your round; they are not success percentages. Full success is the measured fraction of {data.samples} trials satisfying the complete objective. Stars mark all tied highest scores; small differences are not proof of a dependable advantage.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect repaired stroke">{options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => setInspect(o.id)}>{o.name}</Button>)}</div>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Repaired equipment nominal route">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="repair-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[shot.nominal.cuePath, shot.nominal.objectPath].map((path, i) => <polyline key={i} data-testid={`repair-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {shot.nominal.finalBalls.filter(b => !b.pocketed).map(b => <g key={b.id} data-testid={`repair-ball-${b.id}`}><circle cx={b.position.x} cy={b.position.y} r=".029" fill={b.id ? '#ffc16e' : '#fff'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{b.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan traces the cue; gold traces the object ball. Filled balls show the nominal finish. The pink target stays fixed.</p>
      <p>Every comparison uses your player’s execution profile and the same indexed trial errors. Layout, requested strokes and finish targets stay fixed. Repairing the cue removes its power, spin and aim faults together; cleaning balls changes contact response and rolling drag; restoring the rail changes only its rebound.</p>
      <p>These rankings apply to the existing offers, without re-aiming or optimizing for repaired equipment. In particular, the old cue’s aim compensation remains in the request after its repair. A repair need not improve that fixed request. Comparisons are unscored; your round still uses unchanged equipment.</p>
    </>}
    <p className="lesson-comparison-note">The prediction and inspection are optional and never block advancement.</p>
  </section>
}
