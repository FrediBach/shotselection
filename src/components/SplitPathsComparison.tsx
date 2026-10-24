import { useState } from 'react'
import { Button } from './ui/button'
import { splitPathsReplay } from '../engine/split-paths'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function SplitPathsComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [phase, setPhase] = useState<'contact' | 'paths' | 'settled'>('contact')
  const [visible, setVisible] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const replay = shot ? splitPathsReplay(prepared.scenario, shot.nominal) : null
  const balls = phase === 'settled' ? shot?.nominal.finalBalls : replay?.transfer.balls
  const center = replay ? { x: (replay.transfer.positions[0].x + replay.transfer.positions[1].x) / 2, y: (replay.transfer.positions[0].y + replay.transfer.positions[1].y) / 2 } : null
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Split shot paths" hidden={hidden}>
    <h3>One contact, two outgoing paths</h3>
    <p>Ball 1 keeps some motion after clipping ball 2. Ball 2 takes the transferred motion toward a different pocket. Follow each ball separately; both pots count.</p>
    {!shot ? <p>After committing your shot, inspect the contact and reveal both outgoing paths.</p> : !replay ? <p role="status">The recorded split paths are unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect split stroke">{prepared.balls[0].options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setPhase('contact'); setVisible(0) }}>Stroke {o.label}</Button>)}</div>
      <p role="status">{phase === 'contact' ? `Ball 1 contacts ball 2 at ${replay.transfer.time.toFixed(3)} s.` : phase === 'paths' ? 'Trace the motion left in ball 1 and the motion transferred to ball 2.' : `Settled result: ${evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal).success ? 'both pots complete the trick' : 'the full trick does not succeed'}.`}</p>
      <svg viewBox={phase === 'contact' ? `${center!.x - .35} ${center!.y - .25} .7 .5` : '-.08 -.08 2.70 1.43'} role="img" aria-label="Split shot contact and outgoing paths">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        {phase !== 'contact' && replay.paths.filter(path => !visible || visible === path.ballId).map(path => <polyline key={path.ballId} data-testid={`split-path-${path.ballId}`} points={path.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={path.ballId === 1 ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={path.ballId === 1 ? '.035 .018' : undefined} />)}
        {balls?.filter(ball => !ball.pocketed).map(ball => <g key={ball.id} data-testid={`split-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : ball.id === 1 ? '#ffc16e' : '#7de3ef'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || ''}</text></g>)}
      </svg>
      <p>Ball 1: gold dashed path · motion left after contact.<br />Ball 2: cyan solid path · transferred motion.</p>
      <div className="lesson-predictions" role="group" aria-label="Split replay phase">{(['contact', 'paths', 'settled'] as const).map(value => <Button key={value} size="sm" variant={phase === value ? 'default' : 'outline'} aria-pressed={phase === value} onClick={() => setPhase(value)}>{{ contact: 'Contact close-up', paths: 'Reveal outgoing paths', settled: 'Settled result' }[value]}</Button>)}</div>
      {phase !== 'contact' && <div className="lesson-predictions" role="group" aria-label="Trace split ball">{['Both balls', 'Ball 1 only', 'Ball 2 only'].map((label, id) => <Button key={id} size="sm" variant={visible === id ? 'default' : 'outline'} aria-pressed={visible === id} onClick={() => setVisible(id)}>{label}</Button>)}</div>}
      <p>{phase === 'contact' ? 'Close-up of the actual 1–2 contact. Reveal the paths to see where each ball travels next.' : phase === 'paths' ? 'Filled balls mark the contact positions. Traces join recorded positions after that contact and stop at each ball’s actual pocket capture; they are sampled paths, not straight-line predictions.' : `Ball 1 ${replay.paths[0].potted ? 'was potted' : 'was not potted'}; ball 2 ${replay.paths[1].potted ? 'was potted' : 'was not potted'}. The complete trick also requires the ordered contacts, nominated pocket and safe settled finish.`}</p>
      <p>This is the inspected stroke’s nominal simulation. Compare the ordinary trial results for execution variation; the two traces alone do not give success probabilities or an energy split.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
