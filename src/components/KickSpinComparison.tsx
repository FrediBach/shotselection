import { useId, useState } from 'react'
import { Button } from './ui/button'
import { kickSpinEvidence } from '../engine/kick-spin'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { distance, normalize } from '../engine/math'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
const spinName = (spin: number) => `${Math.round(Math.abs(spin) * 100)}% ${spin < 0 ? 'draw' : 'follow'}`
export default function KickSpinComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const marker = useId(), x = prepared.kickSpin!, option = prepared.balls[0].options.find(o => o.id === x.referenceId)!
  const e = kickSpinEvidence(prepared.scenario, option.plan, x)!, revealed = Boolean(result) && !retry
  const answers = ['Keep the aim', 'Adjust the aim']
  const variants = [
    { key: 'reference', title: `Reference finish ${option.label}`, plan: option.plan, simulation: x.reference, exit: e.reference },
    { key: 'spin', title: 'Change spin only', plan: x.spinPlan, simulation: x.spinOnly, exit: e.spinOnly },
    { key: 'corrected', title: 'Correct the aim', plan: x.correctedPlan, simulation: x.corrected, exit: e.corrected },
  ]
  const aligned = (path: Vec2[], start: Vec2) => path.map(p => ({ x: p.x - start.x, y: p.y - start.y }))
  const immediate = normalize(e.reference.rebound.outgoing)
  return <section className="lesson-comparison" aria-label="Kick spin comparison" hidden={hidden}>
    <h3>Adjust a kick for draw or follow</h3>
    <p>Use finish {option.label} at {option.plan.speed.toFixed(2)} m/s. Change its launch spin from {spinName(option.plan.topSpin)} to {spinName(x.spinPlan.topSpin)}, keeping speed, English and every ball’s starting position fixed. To retain the pot into the same pocket, can this example keep the aim?</p>
    <p>The spin change and aim correction are separate, unscored experiments. The three offered finishes remain your regular choices.</p>
    <div className="lesson-predictions" role="group" aria-label="Kick spin prediction">{answers.map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? 'This spin change needs an aim correction.' : prediction === answers[1] ? 'Correct: this spin change needs an aim correction.' : 'Keeping the aim loses the pot; correcting it restores the pot.'}</strong></p>
      <p>Changing only draw/follow misses the pot. Keeping that new spin and changing only aim by {e.aimChange.toFixed(1)}° restores a legal pot into the original pocket, moving the cue-ball rebound point {(e.shift * 100).toFixed(1)} cm along the same rail.</p>
      <figure><figcaption><strong>After the rail · Original aim in both paths</strong></figcaption>
        <svg viewBox="-.24 -.24 .48 .48" role="img" aria-label="Spin-only comparison: first 20 cm after aligned rebounds">
          <defs><marker id={`${marker}-inset`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#fff" /></marker></defs>
          <rect x="-.24" y="-.24" width=".48" height=".48" fill="#143f38" />
          {[{ key: 'reference', exit: e.reference, color: '#7de3ef' }, { key: 'spin', exit: e.spinOnly, color: '#ff9f98' }].map(v => <g key={v.key}>
            <polyline data-testid={`kick-spin-exit-${v.key}`} points={points(aligned(v.exit.path, v.exit.rebound.position))} fill="none" stroke={v.color} strokeWidth=".0035" />
            <polyline points={points([{ x: 0, y: 0 }, v.exit.direction])} fill="none" stroke={v.color} strokeWidth=".0015" strokeDasharray=".006 .005" />
            <circle cx={v.exit.direction.x} cy={v.exit.direction.y} r=".005" fill={v.color} />
          </g>)}
          <polyline points={points([{ x: 0, y: 0 }, { x: immediate.x * .07, y: immediate.y * .07 }])} fill="none" stroke="#fff" strokeWidth=".002" markerEnd={`url(#${marker}-inset)`} />
          <circle r=".01" fill="#071e1b" stroke="#fff" strokeWidth=".002" />
        </svg>
      </figure>
      <p>Cyan is the reference; pink changes spin only. R1 is aligned in this inset to compare the first 20 cm of actual travel. Dashed lines join each rebound to its 20 cm endpoint. Their directions differ by {e.exitAngle.toFixed(1)}°.</p>
      <p>The white arrow shows the immediate outgoing direction: its difference is only {e.immediateAngle.toFixed(1)}°. The later paths separate as spin and speed evolve on the cloth. This is an effective route change, not evidence of a different instantaneous reflection angle.</p>
      {variants.map(v => {
        const index = v.simulation.cueApproachPath.findIndex(p => distance(p, v.exit.rebound.position) < 1e-9)
        return <figure key={v.key}><figcaption><strong>{v.title} · {spinName(v.plan.topSpin)}</strong></figcaption>
          <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${v.title}: actual approach, rebound and outcome`}>
            <defs><marker id={`${marker}-${v.key}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#fff" /></marker></defs>
            <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
            {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" stroke={p.id === option.plan.pocketId ? '#ffc16e' : 'none'} strokeWidth=".009" />)}
            <polyline data-testid={`kick-spin-path-${v.key}`} points={points(v.simulation.cuePath)} fill="none" stroke="#7de3ef" strokeWidth=".008" />
            <polyline points={points(v.simulation.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".009" />
            <polyline data-testid={`kick-spin-approach-${v.key}`} points={points(v.simulation.cueApproachPath.slice(0, Math.max(2, Math.floor((index + 1) * .7))))} fill="none" stroke="#fff" strokeWidth=".008" markerEnd={`url(#${marker}-${v.key})`} />
            {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 1 ? '#ffc16e' : '#ff9f98'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
            <g data-testid={`kick-spin-rebound-${v.key}`} transform={`translate(${v.exit.rebound.position.x} ${v.exit.rebound.position.y})`}><circle r=".065" fill="#071e1b" stroke="#7de3ef" strokeWidth=".007" /><text y=".016" textAnchor="middle" fontSize=".045" fill="#fff">R1</text></g>
          </svg>
          <p>{v.key === 'spin' ? 'Only launch spin changes. Ball 1 is not potted.' : v.key === 'reference' ? 'Original aim and spin: ball 1 is potted without a scratch.' : 'Only aim changes from the spin-only attempt: ball 1 is potted without a scratch.'}</p>
        </figure>
      })}
      <p>White arrows show the actual incoming approaches. Cyan shows cue-ball travel and gold shows ball 1’s path; filled balls mark their starts. Both successful pots use the same pocket without an object-ball cushion contact.</p>
      <p>{result?.selected.plan.id === option.id ? `You chose reference finish ${option.label}.` : `You chose another finish; this experiment uses finish ${option.label}.`} The correction is specific to this layout, pace and spin. It does not establish a universal draw/follow aim adjustment or measure reliability.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
