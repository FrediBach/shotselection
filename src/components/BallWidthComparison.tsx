import { useMemo, useState } from 'react'
import { ballWidthEvidence } from '../engine/ball-width'
import { TABLE } from '../engine/constants'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'

export default function BallWidthComparison({ prepared, result, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; busy: boolean }) {
  const evidence = useMemo(() => ballWidthEvidence(prepared.scenario), [prepared])
  const [prediction, setPrediction] = useState<number | null>(null), [retry, setRetry] = useState(false), [proof, setProof] = useState(false)
  const revealed = Boolean(result) && !retry
  if (!evidence) return <section className="lesson-comparison" aria-label="Full-ball-width comparison"><p role="status">The corridor comparison could not be verified for this layout.</p></section>
  const e = evidence, cases = [e.narrow, e.wide].sort((a, b) => a.pocket.id - b.pocket.id)
  return <section className="lesson-comparison" aria-label="Full-ball-width comparison">
    <h3>Does the whole ball fit?</h3>
    <p>Compare ball {e.ballId} to two pockets on the starting table. Both center lines miss the spare balls. Which route has room for the whole moving ball?</p>
    <div className="lesson-predictions" role="group" aria-label="Wide-corridor prediction">{cases.map(c => <Button key={c.pocket.id} size="sm" variant={prediction === c.pocket.id ? 'default' : 'outline'} aria-pressed={prediction === c.pocket.id} disabled={busy || revealed} onClick={() => setPrediction(c.pocket.id)}>{c.pocket.name} pocket</Button>)}</div>
    {cases.map(c => {
      const narrow = c === e.narrow
      return <figure key={c.pocket.id} className="width-case">
        <figcaption><strong>Ball {e.ballId} → {c.pocket.name}{revealed ? narrow ? ' · too narrow' : ' · wide corridor' : ''}</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`${c.pocket.name}: ${revealed ? 'full swept width' : 'center lines only'}`}>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill={p.id === c.pocket.id ? '#ffc16e' : '#071e1b'} />)}
          {c.legs.map((leg, i) => <g key={leg.kind}>
            {revealed && <line x1={leg.start.x} y1={leg.start.y} x2={leg.end.x} y2={leg.end.y} stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth={TABLE.ballDiameter} strokeOpacity=".3" strokeLinecap="round" />}
            <line x1={leg.start.x} y1={leg.start.y} x2={leg.end.x} y2={leg.end.y} stroke={i ? '#ffc16e' : '#7de3ef'} strokeWidth=".006" />
          </g>)}
          <circle cx={c.route.ghost.x} cy={c.route.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".004" />
          {revealed && narrow && <>
            <circle cx={e.closest.x} cy={e.closest.y} r={TABLE.ballRadius} fill="#ff9f98" fillOpacity=".4" stroke="#ff9f98" strokeWidth=".004" />
            <line x1={e.closest.x} y1={e.closest.y} x2={e.obstruction.blocker.position.x} y2={e.obstruction.blocker.position.y} stroke="#fff" strokeWidth=".004" strokeDasharray=".01 .008" />
          </>}
          {prepared.scenario.balls.map(ball => <g key={ball.id}>
            <circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? '#fff' : revealed && narrow && ball.id === e.obstruction.blocker.id ? '#ff9f98' : '#ffc16e'} />
            <text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{ball.id || ''}</text>
          </g>)}
        </svg>
        {revealed && <>
          {narrow && <>
            <p><strong>Closest approach, enlarged</strong></p>
            <svg viewBox={`${(e.closest.x + e.obstruction.blocker.position.x) / 2 - .12} ${(e.closest.y + e.obstruction.blocker.position.y) / 2 - .08} .24 .16`} role="img" aria-label="Narrow corridor: enlarged physical overlap">
              <rect x="0" y="0" width={TABLE.length} height={TABLE.width} fill="#143f38" />
              <line x1={e.obstruction.start.x} y1={e.obstruction.start.y} x2={e.obstruction.end.x} y2={e.obstruction.end.y} stroke="#ffc16e" strokeWidth={TABLE.ballDiameter} strokeOpacity=".3" />
              <line x1={e.obstruction.start.x} y1={e.obstruction.start.y} x2={e.obstruction.end.x} y2={e.obstruction.end.y} stroke="#ffc16e" strokeWidth=".001" />
              <circle cx={e.closest.x} cy={e.closest.y} r={TABLE.ballRadius} fill="#7de3ef" fillOpacity=".4" stroke="#7de3ef" strokeWidth=".001" />
              <circle cx={e.obstruction.blocker.position.x} cy={e.obstruction.blocker.position.y} r={TABLE.ballRadius} fill="#ff9f98" fillOpacity=".6" stroke="#ff9f98" strokeWidth=".001" />
              <text x={e.closest.x} y={e.closest.y + .003} textAnchor="middle" fontSize=".008" fill="#fff">Moving ball</text>
              <text x={e.obstruction.blocker.position.x} y={e.obstruction.blocker.position.y + .003} textAnchor="middle" fontSize=".008" fill="#fff">Ball {e.obstruction.blocker.id}</text>
            </svg>
          </>}
          <dl className="geometry-measures"><div><dt>Center lines clear of physical balls</dt><dd>Yes</dd></div><div><dt>Minimum surface clearance</dt><dd>{((c.minimum - TABLE.ballDiameter) * 1000).toFixed(1)} mm</dd></div></dl>
          <p>{narrow ? `Ball ${e.obstruction.blocker.id} overlaps the swept ${e.obstruction.kind}. The enlarged view shows the moving ball overlapping the blocker. A negative clearance means overlap.` : 'Both swept corridors clear every spare ball with at least 25 mm of surface clearance.'}</p>
        </>}
      </figure>
    })}
    <p>Cyan traces the cue approach to the contact ring; gold traces the object ball to the pocket. These are route illustrations, not extra selectable strokes.</p>
    {revealed && <>
      <p role="status"><strong>{prediction === null ? 'Compare the full swept widths.' : prediction === e.wide.pocket.id ? 'Your prediction leaves room for the whole ball.' : 'The center line fits, but the whole ball does not.'}</strong> The {e.wide.pocket.name} route is the wide corridor.</p>
      <p>The colored bands are one ball diameter wide: {(TABLE.ballDiameter * 1000).toFixed(2)} mm. The narrow route passes {(e.obstruction.distance * 1000).toFixed(1)} mm from ball {e.obstruction.blocker.id}’s center. That misses its {(TABLE.ballRadius * 1000).toFixed(2)} mm radius, but is less than the two radii needed for the balls to pass. Removing only that blocker restores the named route under the same cut and rail checks.</p>
      <Button size="sm" variant="outline" aria-expanded={proof} onClick={() => setProof(value => !value)}>{proof ? 'Hide wide-route proof' : 'Inspect wide-route proof'}</Button>
      {proof && <><p>This simulated pot on ball {e.ballId} uses the wide route from the original starting layout, with no scratch. It is a separate demonstration, not a replay of your selected stroke.</p><SequenceDiagram balls={prepared.scenario.balls} simulation={e.simulation} label="Wide corridor: simulated legal pot" /></>}
      <p className="lesson-comparison-note">The clearance values are geometric distances on the starting layout, not success probabilities. The regular opening-shot score remains separate.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setProof(false) }}>Try the prediction again</Button>
    </>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
