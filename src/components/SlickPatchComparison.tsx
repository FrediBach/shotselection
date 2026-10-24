import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import { compareSlickPatch } from '../engine/slick-patch'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { verticalSpinDescription } from '../lib/shot-presentation'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function SlickPatchComparison({ prepared, result, hidden }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean }) {
  const [inspect, setInspect] = useState<string | null>(null)
  const [variant, setVariant] = useState(0)
  const shot = result?.candidates.find(s => s.plan.id === (inspect ?? result.selected.plan.id))
  const data = useMemo(() => shot ? compareSlickPatch(prepared.scenario, shot.plan, shot.nominal) : null, [prepared.scenario, shot])
  const current = data?.variants[variant]
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Slick patch comparison" hidden={hidden}>
    <h3>Where the slick patch preserves speed</h3>
    <p>The pale patch applies only 0.60× ordinary cloth friction: moving balls lose speed more slowly there. The dark sticky repair applies 2.40×. Compare the same stroke with only the slick patch replaced by ordinary cloth; the sticky repair stays fixed.</p>
    {!shot ? <p>After committing your shot, inspect the slick crossing and its ordinary-cloth comparison.</p> : !data || !current ? <p role="status">The slick-patch comparison is unavailable for this stroke.</p> : <>
      <div className="lesson-predictions" role="group" aria-label="Inspect slick patch stroke">{prepared.balls.flatMap(ball => ball.options.map(option => <Button key={option.id} size="sm" variant={shot.plan.id === option.id ? 'default' : 'outline'} aria-pressed={shot.plan.id === option.id} onClick={() => { setInspect(option.id); setVariant(0) }}>Ball {ball.ballId} · {option.label}</Button>))}</div>
      <p data-testid="slick-controls">Ball {shot.plan.ballId} · {shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}. These launch settings are identical in both replays.</p>
      <div className="lesson-predictions" role="group" aria-label="Choose patch replay">{data.variants.map((v, i) => <Button key={v.label} size="sm" variant={variant === i ? 'default' : 'outline'} aria-pressed={variant === i} onClick={() => setVariant(i)}>{v.label}</Button>)}</div>
      <p role="status">{current.label}: {(current.scenario.conditions!.patches!.find(p => p.id === data.slick.id)!.friction).toFixed(2)}× friction in the pale area. {current.simulation.stopped ? 'Settled result.' : 'Simulation ended before settling.'}</p>
      <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Slick and sticky patch paths">
        <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
        {current.scenario.conditions!.patches!.map(p => <circle key={p.id} data-testid={`slick-area-${p.id}`} cx={p.center.x} cy={p.center.y} r={p.radius} fill={p.id === data.slick.id ? '#839b8b' : '#493d27'} stroke={p.id === data.slick.id ? '#c7e5cd' : '#ddbd82'} strokeWidth=".008" strokeDasharray=".02 .012" />)}
        {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
        <circle data-testid="slick-target" cx={shot.plan.target.x} cy={shot.plan.target.y} r=".045" fill="none" stroke="#ff9f98" strokeWidth=".009" />
        {[current.simulation.cuePath, current.simulation.objectPath].map((path, i) => <polyline key={i} data-testid={`slick-path-${i}`} points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={i ? undefined : '.025 .015'} />)}
        {current.routes.flatMap((route, i) => route.crossings.flatMap(c => c.segments.map(([a, b], j) => <line key={`${i}-${c.patch.id}-${j}`} data-testid={`slick-inside-${i}-${c.patch.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".022" />)))}
        {current.simulation.finalBalls.filter(b => !b.pocketed).map(ball => <g key={ball.id} data-testid={`slick-ball-${ball.id}`}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || 'C'}</text></g>)}
      </svg>
      <p>Cyan dashes trace the cue; gold traces the selected object ball. Filled balls show the final recorded positions. The pink ring marks the same intended cue finish in both replays.</p>
      <table><caption>Same stroke, different pale patch</caption><thead><tr><th>Patch</th><th>Legal pot</th><th>Scratch</th><th>Finish error</th></tr></thead><tbody>{data.variants.map((v, i) => <tr key={v.label} data-testid={`slick-outcome-${i}`}><th>{v.label}</th><td>{v.outcome.legalPot ? 'Yes' : 'No'}</td><td>{v.simulation.scratch ? 'Yes' : 'No'}</td><td>{(v.outcome.error * 100).toFixed(1)} cm</td></tr>)}</tbody></table>
      <p data-testid="slick-shift">The cue endpoints differ by {(data.finishShift * 100).toFixed(1)} cm.</p>
      <p>Thicker segments show the parts of each recorded path inside a patch. In the original pale area, drag is reduced; it does not accelerate the ball. The dark repair adds drag in both replays. Crossing lengths are estimates from straight lines between recorded positions, using the ball center; they are not measurements of speed gain or loss.</p>
      <table><caption>Where this replay crosses the patches</caption><thead><tr><th>Ball</th><th>Pale area</th><th>Sticky repair</th></tr></thead><tbody>{current.routes.map((route, i) => <tr key={i} data-testid={`slick-length-${i}`}><th>{route.label}</th>{[true, false].map(isSlick => {
        const length = route.crossings.filter(c => (c.patch.id === data.slick.id) === isSlick).reduce((sum, c) => sum + c.length, 0)
        return <td key={String(isSlick)}>{length > 0 ? `${(length * 100).toFixed(1)} cm` : 'No crossing'}</td>
      })}</tr>)}</tbody></table>
      <p>These are nominal examples, not success probabilities. The ordinary replacement is an unscored comparison with no retuning. Your score and ordinary trials use both actual patches. A changed cue endpoint can also reflect later collisions or rebounds; a longer route is not automatically better.</p>
    </>}
    <p className="lesson-comparison-note">The comparison is optional and never blocks advancement.</p>
  </section>
}
