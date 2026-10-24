import { useState } from 'react'
import { Button } from './ui/button'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function ConditionRobustnessComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [checked, setChecked] = useState(false)
  const [variant, setVariant] = useState(0), [inspect, setInspect] = useState<string | null>(null)
  const data = result?.conditionRobustness, current = data?.variants[variant]
  const revealed = Boolean(result) && (!retry || checked)
  const options = prepared.balls.flatMap(b => b.options.map(o => ({ ...o, name: `Ball ${b.ballId} · ${o.label}` })))
  const name = (id: string) => options.find(o => o.id === id)?.name ?? id
  const names = (ids: string[]) => ids.length ? ids.map(name).join(' / ') : 'none with a positive minimum score'
  const shot = current?.shots.find(s => s.plan.id === (inspect ?? result?.selected.plan.id))
  const route = data?.routes.find(r => r.optionId === shot?.plan.id)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Table condition robustness" hidden={hidden}>
    <h3>What if the condition report is slightly wrong?</h3>
    <p>Predict the offered stroke with the highest minimum comparison score across the reported table and four uncertainty probes. A small score change alone does not make a weak route a good choice.</p>
    <div className="lesson-predictions" role="group" aria-label="Robustness prediction">{options.map(o => <Button key={o.id} size="sm" variant={prediction === o.id ? 'default' : 'outline'} aria-pressed={prediction === o.id} disabled={revealed} onClick={() => setPrediction(o.id)}>Predict {o.name}</Button>)}</div>
    {revealed && data && <p data-testid="robust-prediction">{prediction === null ? 'Prediction skipped. ' : data.robust.includes(prediction) ? 'Your prediction matches these probes. ' : 'That prediction does not match these probes. '}Highest minimum score: {names(data.robust)}.</p>}
    {result && <Button size="sm" variant="outline" onClick={() => { if (retry && !checked) setChecked(true); else { setRetry(true); setChecked(false); setPrediction(null) } }}>{retry && !checked ? 'Check prediction' : 'Try the prediction again'}</Button>}
    {!result ? <p>After your shot, test each offer against the uncertain report.</p> : !data || !current || !shot || !route ? <p role="status">The condition comparison is unavailable.</p> : <>
      <p data-testid="robust-leaders">Reported-condition leader: {names(data.reported)}. Highest minimum across probes: {names(data.robust)}. {data.reported.join('|') === data.robust.join('|') ? 'The two criteria agree for these offers.' : 'The two criteria prefer different sets of offers.'}</p>
      <p>We test global cloth drag at −10% and +10%, and drift magnitude at −20% and +20%, one at a time. Drift direction and the other faults stay fixed. These are teaching assumptions, not measured confidence bounds for the table.</p>
      <table><caption>Reported score versus downside across probes</caption><thead><tr><th>Stroke</th><th>Reported</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>{options.map(o => {
        const row = data.routes.find(r => r.optionId === o.id)!
        return <tr key={o.id} data-testid={`robust-row-${o.plan.ballId}-${o.label}`}><th>{o.name}{data.robust.includes(o.id) ? ' ★' : ''}</th><td>{(row.reported * 100).toFixed(1)}</td><td>{(row.worst * 100).toFixed(1)}</td><td>{(row.best * 100).toFixed(1)}</td></tr>
      })}</tbody></table>
      <p>Stars mark all tied highest minimum scores. These scores use the same pot-and-finish criteria as your round; they are not probabilities. A small empirical difference is not proof of a dependable advantage.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect robust stroke">{options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setVariant(0) }}>{o.name}</Button>)}</div>
      <div className="lesson-predictions" role="group" aria-label="Inspect condition probe">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}. {name(shot.plan.id)}: comparison score {(shot.score * 100).toFixed(1)}; full success {(shot.successRate * 100).toFixed(0)}% of {data.samples} trials.</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Uncertain condition nominal route">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="robust-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[shot.nominal.cuePath, shot.nominal.objectPath].map((path, i) => <polyline key={i} data-testid={`robust-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {shot.nominal.finalBalls.filter(b => !b.pocketed).map(b => <g key={b.id} data-testid={`robust-ball-${b.id}`}><circle cx={b.position.x} cy={b.position.y} r=".029" fill={b.id ? '#ffc16e' : '#fff'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{b.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan traces the cue; gold traces the object ball. Filled balls show the nominal finish. The pink target stays fixed.</p>
      <p>Each table variant uses your player's same execution profile and indexed trial errors. The strokes, aim and target are never retuned. Condition uncertainty is separate from ordinary execution variation; it changes the table for an entire set of trials.</p>
      <p>The minimum covers only these five sampled settings, not every intermediate setting, simultaneous fault error or unknown defect. This is a conservative comparison among the offered strokes, not a guaranteed optimum. The scored final challenge still uses the reported conditions.</p>
    </>}
    <p className="lesson-comparison-note">Prediction and inspection are optional and never block course completion.</p>
  </section>
}
