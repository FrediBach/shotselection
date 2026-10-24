import { useState } from 'react'
import { Button } from './ui/button'
import { kissPathReplay } from '../engine/kiss-path'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function KissPathComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null), [phase, setPhase] = useState<'contact' | 'outgoing' | 'settled'>('contact'), [zoom, setZoom] = useState(false)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const replay = shot ? kissPathReplay(prepared.scenario, shot.nominal) : null
  const balls = phase === 'settled' ? shot?.nominal.finalBalls : replay?.contact.balls
  const center = replay ? replay.outgoing[0] : null
  const close = phase === 'contact' || (phase === 'outgoing' && zoom)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Kiss shot redirection" hidden={hidden}>
    <h3>Ball 2 changes ball 1’s route</h3>
    <p>In the split shot, both object balls scored. Here ball 1 glances off ball 2 and continues into the pocket. Follow the same scoring ball before and after the kiss.</p>
    {!shot ? <p>After committing your shot, pause at the kiss and reveal ball 1’s outgoing path.</p> : !replay ? <p role="status">The recorded kiss path is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect kiss stroke">{prepared.balls[0].options.map(o => <Button key={o.id} size="sm" variant={shot.plan.id === o.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === o.id} onClick={() => { setInspect(o.id); setPhase('contact'); setZoom(false) }}>Stroke {o.label}</Button>)}</div>
      <p role="status">{phase === 'contact' ? `Paused at the kiss: ball 1 contacts ball 2 at ${replay.contact.time.toFixed(3)} s.` : phase === 'outgoing' ? 'Ball 1 changes direction after contacting ball 2 and heads toward the pocket.' : `Settled result: ${evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal).success ? 'the kiss pot completes the trick' : 'the full trick does not succeed'}.`}</p>
      <svg viewBox={close ? `${center!.x - .35} ${center!.y - .25} .7 .5` : '-.08 -.08 2.70 1.43'} role="img" aria-label="Ball 1 path before and after the kiss">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <polyline data-testid="kiss-incoming" points={replay.incoming.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff9f98" strokeWidth=".012" strokeDasharray=".025 .015" />
        {phase !== 'contact' && <polyline data-testid="kiss-outgoing" points={replay.outgoing.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffc16e" strokeWidth=".012" />}
        {balls?.filter(ball => !ball.pocketed).map(ball => <g key={ball.id} data-testid={`kiss-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : ball.id === 1 ? '#ffc16e' : '#7de3ef'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || ''}</text>{phase !== 'settled' && ball.id !== 0 && <circle cx={ball.position.x} cy={ball.position.y} r=".042" fill="none" stroke="#7de3ef" strokeWidth=".005" />}</g>)}
      </svg>
      <p>Ball 1 before the kiss: pink dashes.<br />Ball 1 after the kiss: solid gold. Ball 2 is cyan.</p>
      <div className="lesson-predictions" role="group" aria-label="Kiss replay phase">{(['contact', 'outgoing', 'settled'] as const).map(value => <Button key={value} size="sm" variant={phase === value ? 'default' : 'outline'} aria-pressed={phase === value} onClick={() => { setPhase(value); setZoom(false) }}>{{ contact: 'Pause at the kiss', outgoing: 'Reveal outgoing path', settled: 'Settled result' }[value]}</Button>)}</div>
      {phase === 'outgoing' && <Button size="sm" variant="outline" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? 'Show whole route' : 'Zoom at contact'}</Button>}
      <p>{phase === 'settled' ? `Ball 1 ${replay.potted ? 'was potted' : 'was not potted'}. Ball 2 does not need to drop. The full objective checks cue → 1, then 1 → 2, the nominated pot and a safe settled finish.` : 'Filled balls mark their actual positions at the kiss. The paths join recorded ball-1 positions, meeting at the exact contact position. The gold trace ends at the recorded finish, including the actual capture point when the ball drops.'}</p>
      <p>This is the inspected stroke’s nominal result. It shows how ball 2 redirects ball 1. Use the ordinary trials to compare reliability under execution variation.</p>
    </>}
    <p className="lesson-comparison-note">The replay is optional and never blocks advancement.</p>
  </section>
}
