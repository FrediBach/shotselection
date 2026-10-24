import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
export default function DisconnectedPositionComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [region, setRegion] = useState(0), [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [removed, setRemoved] = useState(false)
  const e = prepared.disconnectedPosition!, zone = prepared.scenario.objective!, revealed = Boolean(result) && !retry
  const options = e.optionIds.map(id => prepared.balls[0].options.find(o => o.id === id)!), shot = result?.candidates.find(s => s.plan.id === options[region].id)
  const trials = shot?.disconnectedTrials ?? [], finishes = trials.filter(t => t.settled && !t.scratch), gap = finishes.filter(t => t.gap), blocked = gap.filter(t => !t.nextShotAvailable)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Disconnected position comparison" hidden={hidden}>
    <h3>Choose a region, avoid the gap</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} finish in separate target regions. Both nominally pot ball 1 and leave a proven pot on ball 2. Choose a region to inspect, then select its stroke below if that is your intended finish.</p>
    <div role="group" aria-label="Target region" className="lesson-predictions">{options.map((o, i) => <Button key={o.id} size="sm" variant={region === i ? 'default' : 'outline'} aria-pressed={region === i} onClick={() => setRegion(i)}>Region {i + 1} · stroke {o.label}</Button>)}</div>
    <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label="Two separate regions and actual trial endpoints">
      <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
      {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
      <line x1={e.centers[0].x} y1={e.centers[0].y} x2={e.centers[1].x} y2={e.centers[1].y} stroke="#ffc16e" strokeWidth=".005" strokeDasharray=".02 .02" />
      {e.centers.map((center, i) => <g key={i}><circle data-testid={`target-region-${i}`} cx={center.x} cy={center.y} r={zone.radius} fill="#7de3ef" fillOpacity={region === i ? '.2' : '.06'} stroke="#7de3ef" strokeWidth={region === i ? '.01' : '.005'} /><text x={center.x} y={center.y - zone.radius - .02} fontSize=".05" textAnchor="middle" fill="white">{i + 1}</text></g>)}
      {revealed && <>
        <polyline points={shot!.nominal.cuePath.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7de3ef" strokeWidth=".006" />
        {finishes.map((t, i) => <circle key={i} data-testid="region-trial" data-region={t.region} data-gap={t.gap} data-success={t.success} cx={t.point.x} cy={t.point.y} r=".012" fill={t.gap ? '#ff9f98' : t.region >= 0 ? '#9fe7b7' : '#ffc16e'}><title>{t.gap ? 'Gap' : t.region >= 0 ? `Region ${t.region + 1}` : 'Outside'} · {t.success ? 'complete success' : 'assignment failed'}</title></circle>)}
        <line x1={e.midpoint.x} y1={e.midpoint.y} x2={e.ghost.x} y2={e.ghost.y} stroke="#ff9f98" strokeWidth=".008" strokeDasharray=".025 .02" />
      </>}
      {e.blocked.balls.filter(b => b.id !== 0).map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === e.blockerId ? '#ff9f98' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{ball.id}</text></g>)}
      <circle data-testid="region-midpoint" cx={e.midpoint.x} cy={e.midpoint.y} r=".025" fill="none" stroke="white" strokeWidth=".008" />
    </svg>
    <p>The white ring is the midpoint between the two nominal finishes. The dashed connector is not a target. Each region has a {(zone.radius * 100).toFixed(1)} cm radius; the space between them is excluded.</p>
    <div role="group" aria-label="Midpoint prediction" className="lesson-predictions">{['Midpoint leaves a shot', 'Midpoint is blocked'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && <>
      <p role="status">{prediction === 'Midpoint is blocked' ? 'Your prediction matches. ' : ''}The midpoint is blocked. Ball {e.blockerId} obstructs the next shot; no direct route meets the {zone.maxCutAngle}° cut limit there.</p>
      <table><caption>Stroke {options[region].label}: actual scoring trials</caption><tbody><tr><th>Settled, non-scratch endpoints</th><td>{finishes.length}/{shot!.samples}</td></tr>{e.centers.map((_, i) => <tr key={i}><th>Inside region {i + 1}</th><td>{finishes.filter(t => t.region === i).length}</td></tr>)}<tr><th>In the gap</th><td>{gap.length}</td></tr><tr><th>Elsewhere outside</th><td>{finishes.filter(t => t.region < 0 && !t.gap).length}</td></tr><tr><th>Gap endpoints with no next shot</th><td>{blocked.length}/{gap.length}</td></tr><tr><th>Complete successes, all trials</th><td>{trials.filter(t => t.success).length}/{shot!.samples}</td></tr></tbody></table>
      <p>Green dots are inside either region; red dots are in the connecting strip outside both circles; amber dots are elsewhere. These are actual scoring endpoints, including missed openers. Scratches and unsettled trials are omitted from the diagram and counted in the total. Region membership alone is not success: each trial still needs a legal pot and next-shot access from its actual settled balls. Gap landings fail the region requirement even if a particular landing retains a shot.</p>
      <p><strong>Midpoint experiment:</strong> keep all remaining balls at their settled positions and place only the cue ball at the mathematical midpoint. This is a hypothetical next-shot layout, not a claim that an offered opener lands there. Removing only ball {e.blockerId} restores this actual pot; the same stroke with the blocker present fails.</p>
      <div role="group" aria-label="Midpoint experiment" className="lesson-predictions"><Button size="sm" variant={!removed ? 'default' : 'outline'} aria-pressed={!removed} onClick={() => setRemoved(false)}>Blocker present</Button><Button size="sm" variant={removed ? 'default' : 'outline'} aria-pressed={removed} onClick={() => setRemoved(true)}>Remove blocker</Button></div>
      <SequenceDiagram balls={removed ? e.removed.balls : e.blocked.balls} simulation={removed ? e.removalSimulation : e.blockedSimulation} label="Actual midpoint next-shot experiment" />
      <p>Both target centers have simulated next-pot proofs, possibly to different pockets. The circles are separate landing requirements, not a guarantee that every point inside offers a next shot. Averaging their centers would conceal the blocked midpoint.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRegion(0); setRemoved(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">Inspection and prediction are optional. Your chosen stroke is scored against either region and next-shot access.</p>
  </section>
}
