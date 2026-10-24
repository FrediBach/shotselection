import { useId, useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { returnLanePairFinder } from '../engine/return-lane'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis, Vec2 } from '../engine/types'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')
export default function ReturnLaneComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [probe, setProbe] = useState(false)
  const marker = useId(), contrast = prepared.returnLane!
  const options = prepared.balls[0].options.filter(o => [contrast.riskyId, contrast.clearId].includes(o.id))
  const pair = useMemo(() => result ? returnLanePairFinder(prepared.scenario)(result.candidates.filter(s => [contrast.riskyId, contrast.clearId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  const zone = { target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius }
  return <section className="lesson-comparison" aria-label="Return-lane clearance comparison" hidden={hidden}>
    <h3>Check the trip back</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both pot ball 1, rebound once and reach the same zone with ball 2 available. Which leaves more room beside ball 3 on the return leg?</p>
    <div className="lesson-predictions" role="group" aria-label="Return-lane prediction">{options.map(o => <Button key={o.id} size="sm" variant={prediction === o.id ? 'default' : 'outline'} aria-pressed={prediction === o.id} disabled={busy || revealed} onClick={() => setPrediction(o.id)}>Stroke {o.label}</Button>)}</div>
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare clearance after the rebound.' : prediction === contrast.clearId ? 'Your prediction leaves more room on the return leg.' : 'The other return leg has more clearance.'}</strong></p>
      <p>Both nominal routes avoid every spare ball. All remaining object balls stay in place. The narrow pass is a clearance risk, not an actual nominal graze or a measured collision probability.</p>
      {options.map(o => {
        const risky = o.id === contrast.riskyId, e = risky ? pair.narrow : pair.wide, color = risky ? '#ff9f98' : '#7de3ef'
        return <figure key={o.id}>
          <figcaption><strong>Stroke {o.label} · {risky ? 'Narrow return' : 'Wide return'}</strong></figcaption>
          <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Stroke ${o.label}: highlighted ${risky ? 'narrow' : 'wide'} return leg`}>
            <defs><marker id={`${marker}-${o.label}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={color} /></marker></defs>
            <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
            {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
            <circle cx={zone.target.x} cy={zone.target.y} r={zone.radius} fill="#7de3ef" fillOpacity=".1" stroke="#7de3ef" strokeWidth=".005" strokeDasharray=".025 .02" />
            <polyline points={points(e.traced.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".008" />
            <polyline points={points(e.outbound)} fill="none" stroke="#c8cfcc" strokeWidth=".009" strokeDasharray=".025 .02" />
            <polyline points={points(e.returning)} fill="none" stroke={color} strokeWidth={TABLE.ballDiameter} strokeOpacity=".18" />
            <polyline points={points(e.returning)} fill="none" stroke={color} strokeWidth=".01" markerEnd={`url(#${marker}-${o.label})`} />
            <circle cx={e.rebound.position.x} cy={e.rebound.position.y} r=".045" fill="none" stroke="white" strokeWidth=".008" />
            <line x1={e.nearest.x} y1={e.nearest.y} x2={e.blocker.position.x} y2={e.blocker.position.y} stroke={color} strokeWidth=".005" />
            {prepared.scenario.balls.map(b => <g key={b.id}><circle cx={b.position.x} cy={b.position.y} r={TABLE.ballRadius} fill={b.id === 0 ? '#fff' : b.id === 3 ? '#ff9f98' : '#ffc16e'} /><text x={b.position.x} y={b.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{b.id || ''}</text></g>)}
          </svg>
          <dl className="geometry-measures"><div><dt>Clearance before the rebound</dt><dd>{(e.outboundClearance * 1000).toFixed(1)} mm</dd></div><div><dt>Clearance on the return leg</dt><dd>{(e.clearance * 1000).toFixed(1)} mm</dd></div></dl>
        </figure>
      })}
      <p>The white ring marks the recorded cushion rebound. Grey dashes show the earlier cue path; the coloured arrow and ball-width band mark the return leg. Gold shows ball 1’s pot. Balls are drawn at their starting positions; the outlined zone is shared.</p>
      <h4>The narrowest return gap</h4>
      <svg viewBox={`${pair.narrow.blocker.position.x - .15} ${pair.narrow.blocker.position.y - .15} .3 .3`} role="img" aria-label="Enlarged narrow return clearance at full ball width">
        <rect width="2.54" height="1.27" fill="#143f38" />
        <polyline points={points(pair.narrow.returning)} fill="none" stroke="#ff9f98" strokeWidth={TABLE.ballDiameter} strokeOpacity=".2" />
        <polyline points={points(pair.narrow.returning)} fill="none" stroke="#ff9f98" strokeWidth=".003" />
        <circle cx={pair.narrow.nearest.x} cy={pair.narrow.nearest.y} r={TABLE.ballRadius} fill="#fff" fillOpacity=".6" stroke="#fff" strokeWidth=".002" />
        <circle cx={pair.narrow.blocker.position.x} cy={pair.narrow.blocker.position.y} r={TABLE.ballRadius} fill="#ffc16e" />
        <text x={pair.narrow.blocker.position.x} y={pair.narrow.blocker.position.y + .006} textAnchor="middle" fontSize=".02" fill="#071e1b">3</text>
      </svg>
      <p>The white ball represents the cue at its closest return pass. The surface-to-surface gap is only {(pair.narrow.clearance * 1000).toFixed(1)} mm. The cue’s earlier path clears ball 3 by {(pair.narrow.outboundClearance * 1000).toFixed(1)} mm, so checking only the trip out misses this constraint.</p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.riskyId ? 'is the narrow-return reference.' : result!.selected.plan.id === contrast.clearId ? 'is the wide-return reference.' : 'is the third alternative; these diagrams compare the other two strokes.'}</p>
      <Button size="sm" variant="outline" aria-expanded={probe} onClick={() => setProbe(v => !v)}>{probe ? 'Hide the clearance test' : 'Test the narrow return gap'}</Button>
      {probe && <><p><strong>Diagnostic layout change:</strong> move only ball 3 {(pair.shifted.shift * 1000).toFixed(1)} mm toward the narrow return path. Keep the cue, every other starting ball, zone and stroke controls fixed. The same stroke still legally pots ball 1, but now contacts ball 3 after the cushion rebound. This tests the available space; it is not an execution-error trial or a collision-rate estimate.</p><SequenceDiagram balls={pair.shifted.scenario.balls} simulation={pair.shifted.simulation} zone={zone} label="Same stroke contacts shifted ball 3 after the rebound" /></>}
      <p className="lesson-comparison-note">The regular score still checks the opening pot, zone and next-shot access. This optional comparison checks nominal return clearance. The offered strokes differ in pace and spin; only the diagnostic keeps the stroke fixed.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProbe(false) }}>Try the prediction again</Button>
    </>}
    {revealed && !pair && <p role="status">The return-lane comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
