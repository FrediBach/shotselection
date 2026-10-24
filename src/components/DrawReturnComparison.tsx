import { useState } from 'react'
import { Button } from './ui/button'
import { drawReturnReplay } from '../engine/draw-return'
import { evaluateShotObjective } from '../engine/objectives'
import { verticalSpinDescription } from '../lib/shot-presentation'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function DrawReturnComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [phase, setPhase] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = shot ? drawReturnReplay(prepared.scenario, shot.nominal) : null
  const balls = data ? phase === 0 ? data.first.balls! : phase === 1 ? data.turn.balls : phase === 2 ? data.second.balls! : shot!.nominal.finalBalls : []
  const path = data ? data.samples.slice(0, phase === 0 ? 1 : phase === 1 ? data.turnIndex + 1 : undefined).map(s => s.position) : []
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Draw return replay" hidden={hidden}>
    <h3>Save enough speed for the return pot</h3>
    <p>After contacting ball 1, the cue reverses and travels back to ball 2. Inspect the turn and the speed it still has when it reaches the second ball.</p>
    {!shot ? <p>After committing your shot, reveal the draw’s return journey.</p> : !data ? <p role="status">The recorded draw return is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect draw stroke">{prepared.balls[0].options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setPhase(0) }}>Stroke {o.label}</Button>)}</div>
      <p data-testid="draw-controls">Launch pace: {shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}. Spin percentage is relative to natural rolling at launch.</p>
      <p role="status">{phase === 0 ? `First contact: cue → 1 at ${data.first.time.toFixed(3)} s.` : phase === 1 ? `Turn estimate: furthest recorded cue position at ${data.turn.time.toFixed(3)} s.` : phase === 2 ? `Return contact: cue → 2 at ${data.second.time.toFixed(3)} s.` : `Settled result: ${evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal).success ? 'both pots complete the trick' : 'the full trick does not succeed'}.`}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Cue reversal and return to ball 2">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {phase > 0 && <polyline data-testid="draw-return-path" points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7de3ef" strokeWidth=".012" />}
        {phase > 0 && <path data-testid="draw-turn-marker" d={`M${data.turn.position.x-.04},${data.turn.position.y}h.08 M${data.turn.position.x},${data.turn.position.y-.04}v.08`} stroke="#ff9f98" strokeWidth=".008" />}
        {balls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`draw-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <div className="lesson-predictions" role="group" aria-label="Draw replay phase">{['First contact', 'Locate the turn', 'Return contact', 'Settled result'].map((label, i) => <Button key={i} size="sm" variant={phase === i ? 'default' : 'outline'} aria-pressed={phase === i} onClick={() => setPhase(i)}>{label}</Button>)}</div>
      {phase > 0 && <p data-testid="draw-turn-note">The pink cross marks the furthest recorded point along the cue’s original direction. Nearby recorded states span {data.bracket[0].toFixed(3)}–{data.bracket[1].toFixed(3)} s. This locates the turn approximately; it does not measure the exact instant of zero forward speed.</p>}
      {phase >= 2 && <p data-testid="draw-return-speed">The cue still has {data.returnSpeed.toFixed(2)} m/s immediately before hitting ball 2. Cyan traces its recorded return from the first contact. The second contact is the return’s scoring target.</p>}
      {phase === 3 && <p>Ball 1 {shot.nominal.potted.includes(1) ? 'was potted' : 'was not potted'}; ball 2 {shot.nominal.potted.includes(2) ? 'was potted' : 'was not potted'}. The full trick also checks contact order, the nominated pocket and a safe settled finish.</p>}
      <p>These strokes vary pace and draw together. Compare their combined settings and measured return speed; this nominal replay does not isolate spin’s effect or estimate success rates. The ordinary trials show execution variation.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
