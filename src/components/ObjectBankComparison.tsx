import { useState } from 'react'
import { Button } from './ui/button'
import { objectBankReplay } from '../engine/object-bank'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function ObjectBankComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [phase, setPhase] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = shot ? objectBankReplay(prepared.scenario, shot.nominal) : null
  const balls = data ? phase === 0 ? data.contact.balls! : phase === 3 ? shot!.nominal.finalBalls : data.rebound.balls : []
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Object ball bank replay" hidden={hidden}>
    <h3>Which ball uses the cushion?</h3>
    <p>This bank sends ball 1 to a cushion after the cue hits it. A kick sends the cue to a cushion before it reaches the object ball. Track the numbered ball at the rebound.</p>
    {!shot ? <p>After committing your shot, reveal the object ball’s cushion contact.</p> : !data ? <p role="status">The recorded object-ball rebound is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect bank stroke">{prepared.balls[0].options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setPhase(0) }}>Stroke {o.label}</Button>)}</div>
      <p role="status">{phase === 0 ? `Cue → ball 1 at ${data.contact.time.toFixed(3)} s.` : phase === 1 ? `Ball 1 → cushion at ${data.rebound.time.toFixed(3)} s. This is the object-ball rebound that counts.` : phase === 2 ? 'Ball 1 leaves the cushion toward the nominated pocket.' : `Settled result: ${evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal).success ? 'the bank pot completes the trick' : 'the full trick does not succeed'}.`}</p>
      <svg viewBox={phase === 1 ? `${data.rebound.position.x-.35} ${data.rebound.position.y-.25} .7 .5` : '-.08 -.08 2.70 1.43'} role="img" aria-label="Ball 1 cushion contact and bank path">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {phase > 0 && <polyline data-testid="bank-before" points={data.before.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff9f98" strokeWidth=".012" strokeDasharray=".025 .015" />}
        {phase > 1 && <polyline data-testid="bank-after" points={data.after.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffc16e" strokeWidth=".012" />}
        {phase > 0 && <circle data-testid="bank-rebound" cx={data.rebound.position.x} cy={data.rebound.position.y} r=".045" fill="none" stroke="#7de3ef" strokeWidth=".008" />}
        {balls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`bank-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y+.014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <div className="lesson-predictions" role="group" aria-label="Bank replay phase">{['Cue contact', 'Cushion close-up', 'Reveal bank path', 'Settled result'].map((label,i) => <Button key={i} size="sm" variant={phase===i ? 'default' : 'outline'} aria-pressed={phase===i} onClick={() => setPhase(i)}>{label}</Button>)}</div>
      {phase > 0 && <p>{phase === 3 ? 'The cyan ring retains ball 1’s rebound position.' : 'Ball 1 is inside the cyan rebound ring.'} Pink dashes show its incoming path; solid gold shows its outgoing path when revealed. Filled balls mark the recorded {phase === 3 ? 'settled' : 'contact'} positions.</p>}
      {phase > 1 && <p data-testid="bank-counts">Counted object-ball cushions: {shot.nominal.objectCushions ?? 0}. Cue cushions before first contact: {shot.nominal.cueBanksBeforeContact ?? 0}. A cue rebound cannot replace the required ball-1 rebound.</p>}
      <p>The rebound marker is the ball’s recorded center immediately after cushion resolution. Traces join recorded positions through that exact point and end at the actual finish. The settled result also requires the nominated pot and a safe cue-ball finish.</p>
      <p>This is the inspected stroke’s nominal simulation. Ordinary trials measure execution variation; inspecting the rebound does not change your score.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
