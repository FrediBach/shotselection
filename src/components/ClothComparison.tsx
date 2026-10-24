import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareCloth } from '../engine/cloth-comparison'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { verticalSpinDescription } from '../lib/shot-presentation'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function ClothComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const [variant, setVariant] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = useMemo(() => shot ? compareCloth(prepared.scenario, shot.plan, shot.nominal) : null, [prepared.scenario, shot])
  const current = data?.variants[variant]
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Cloth drag comparison" hidden={hidden}>
    <h3>The same stroke on normal cloth</h3>
    <p>Heavy cloth increases sliding and rolling drag for both balls. Compare the exact same launch on normal cloth: the layout, aim, pace, spin, pocket and intended finish stay fixed.</p>
    {!shot ? <p>After committing your shot, compare its two cloth replays.</p> : !data || !current ? <p role="status">The cloth comparison is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect cloth stroke">{prepared.balls.flatMap(ball => ball.options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setVariant(0) }}>Ball {ball.ballId} · {option.label}</Button>))}</div>
      <p data-testid="cloth-controls">Ball {shot.plan.ballId} · {shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}. These launch settings are identical in both replays.</p>
      <div className="lesson-predictions" role="group" aria-label="Choose cloth replay">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}: {current.scenario.conditions!.cloth!.toFixed(2)}× cloth drag. {current.simulation.stopped ? 'Settled result.' : 'Simulation ended before settling.'}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Cloth replay paths and finish">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="cloth-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`cloth-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {current.simulation.finalBalls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`cloth-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan dashes trace the cue; gold traces the selected object ball. Filled balls show the final recorded positions. The pink ring marks the same intended cue finish in both replays.</p>
      <table><caption>Same stroke, different cloth</caption><thead><tr><th>Cloth</th><th>Legal pot</th><th>Scratch</th><th>Finish error</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`cloth-outcome-${i}`}><th>{v.label}</th><td>{v.outcome.legalPot ? 'Yes' : 'No'}</td><td>{v.simulation.scratch ? 'Yes' : 'No'}</td><td>{(v.outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <p data-testid="cloth-shift">The cue endpoints differ by {(data.finishShift * 100).toFixed(1)} cm.</p>
      <p>The 1.75× setting multiplies cloth friction, not shot speed or distance. Changing drag can also change arrival speed, spin, contacts and rebounds. Follow both complete paths; a final endpoint alone does not measure how far a ball travelled.</p>
      <p>These are nominal examples, not success probabilities. Normal cloth is an unscored comparison using the heavy-table stroke without retuning it. Your score and ordinary trials use the heavy cloth.</p>
    </>}
    <p className="lesson-comparison-note">The comparison is optional and never blocks advancement.</p>
  </section>
}
