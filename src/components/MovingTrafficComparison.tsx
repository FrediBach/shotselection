import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { movingTrafficPairFinder } from '../engine/moving-traffic'
import { simulateShot } from '../engine/physics'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { TABLE } from '../engine/constants'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function MovingTrafficComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const [reset, setReset] = useState(false), [proof, setProof] = useState(false)
  const contrast = prepared.movingTraffic!
  const options = prepared.balls[0].options.filter(o => [contrast.blockedId, contrast.clearId].includes(o.id))
  const pair = useMemo(() => movingTrafficPairFinder(prepared.scenario)(prepared.balls[0].options
    .filter(o => [contrast.blockedId, contrast.clearId].includes(o.id))
    .map(o => ({ plan: o.plan, simulation: result?.candidates.find(s => s.plan.id === o.id)!.nominal ?? simulateShot(prepared.scenario, o.plan) }))), [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Moving-traffic comparison" hidden={hidden}>
    <h3>Where does the traffic finish?</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both pot ball 1 and land in the same zone. Which stroke nudges ball 3 into the next-shot corridor?</p>
    <div className="lesson-predictions" role="group" aria-label="Moving-blocker prediction">{options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {pair && options.map(option => {
      const blocked = option.id === contrast.blockedId, e = blocked ? pair.moved : pair.kept
      const restored = blocked && revealed && reset
      const opening = blocked ? pair.blocked : pair.clear
      const outcome = evaluateShotObjective(prepared.scenario, opening.plan, opening.simulation)
      const balls = restored ? e.resetBalls : e.balls
      const cue = balls.find(b => b.id === 0)!, next = balls.find(b => b.id === 2)!
      const route = (blocked ? e.resetRoutes : e.routes).find(r => r.pocketId === pair.pocketId)!
      const pocket = POCKET_GEOMETRY.find(p => p.id === pair.pocketId)!
      return <figure key={option.id} className="moving-traffic-branch">
        <figcaption><strong>Stroke {option.label} · {restored ? 'counterfactual: reset only ball 3' : 'actual settled finish'}</strong></figcaption>
        <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={`Stroke ${option.label}: ${restored ? 'only ball 3 reset' : 'settled traffic'}`}>
          <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
          {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill={revealed && p.id === pocket.id ? '#ffc16e' : '#071e1b'} />)}
          <circle cx={prepared.scenario.objective!.target!.x} cy={prepared.scenario.objective!.target!.y} r={prepared.scenario.objective!.radius} fill="#7de3ef" fillOpacity=".08" stroke="#7de3ef" strokeWidth=".006" />
          {revealed && <>
            <line x1={cue.position.x} y1={cue.position.y} x2={route.ghost.x} y2={route.ghost.y} stroke={blocked && !restored && pair.approachBlocked ? '#ff9f98' : '#7de3ef'} strokeWidth=".012" strokeDasharray={blocked && !restored && pair.approachBlocked ? '.035 .02' : undefined} />
            <line x1={next.position.x} y1={next.position.y} x2={pocket.center.x} y2={pocket.center.y} stroke={blocked && !restored && pair.pocketBlocked ? '#ff9f98' : '#ffc16e'} strokeWidth=".01" strokeDasharray={blocked && !restored && pair.pocketBlocked ? '.035 .02' : undefined} />
            <circle cx={route.ghost.x} cy={route.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".006" />
            {blocked && !restored && <>
              <circle cx={e.start.position.x} cy={e.start.position.y} r={TABLE.ballRadius} fill="none" stroke="#fff" strokeWidth=".006" strokeDasharray=".01 .01" />
              <line x1={e.start.position.x} y1={e.start.position.y} x2={e.blocker.position.x} y2={e.blocker.position.y} stroke="#fff" strokeWidth=".005" strokeDasharray=".02 .02" />
            </>}
          </>}
          {balls.map(ball => <g key={ball.id}>
            <circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? '#fff' : ball.id === 3 ? '#ff9f98' : '#ffc16e'} />
            <text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{ball.id || ''}</text>
          </g>)}
        </svg>
        {revealed && <>
          {restored && <p>These measurements describe the actual shot, before the diagnostic reset.</p>}
          <dl className="geometry-measures">
            <div><dt>Legal opening pot</dt><dd>{outcome.legalPot ? 'Yes' : 'No'}</dd></div>
            <div><dt>Inside the shared zone</dt><dd>{outcome.positioned ? 'Yes' : 'No'}</dd></div>
            <div><dt>Cue hit ball 3 after ball 1</dt><dd>{e.contacted ? 'Yes' : 'No'}</dd></div>
            <div><dt>Ball 3 start-to-finish displacement</dt><dd>{(e.moved * 100).toFixed(1)} cm</dd></div>
            <div><dt>Actual permitted next routes</dt><dd>{e.routes.length}</dd></div>
          </dl>
          {blocked && <>
            <p>In the actual finish, ball 3 blocks the {pair.approachBlocked ? 'cue approach' : 'object-to-pocket line'} to the {pocket.name} pocket. The other corridor is clear.</p>
            <Button size="sm" variant="outline" aria-expanded={reset} onClick={() => setReset(value => !value)}>{reset ? 'Show actual moved traffic' : 'Reset only ball 3'}</Button>
            {reset && <p>Counterfactual: ball 3 alone returns to its starting position. Keep the actual settled cue, ball 2 and ball 4 fixed. The {pocket.name} route returns under the same {prepared.scenario.objective!.maxCutAngle}° cut limit. Reset permitted routes: {e.resetRoutes.length}. This proves geometric access, not a pot.</p>}
          </>}
        </>}
      </figure>
    })}
    {revealed && pair && <>
      <p role="status"><strong>{prediction === null ? 'Compare where ball 3 finishes.' : prediction === contrast.blockedId ? 'Your prediction identifies the moving blocker.' : 'The other stroke moves ball 3 into the next corridor.'}</strong></p>
      <p>Your selected stroke {result!.selected.plan.id === contrast.blockedId ? 'moves ball 3 and loses access to ball 2.' : result!.selected.plan.id === contrast.clearId ? 'leaves ball 3 in place and keeps the next shot open.' : 'is the third alternative; these diagrams compare the other two finishes.'}</p>
      <p>The white dashed marker is ball 3’s original position; the dashed line shows net displacement, not its traveled path. Both diagrams retain all remaining balls. Ball 2 and ball 4 stay in place. Read the final traffic, not just the starting table.</p>
      <Button size="sm" variant="outline" aria-expanded={proof} onClick={() => setProof(value => !value)}>{proof ? 'Hide clear continuation' : 'Inspect clear continuation'}</Button>
      {proof && <><p>The clear finish supports this simulated legal pot on ball 2 without a scratch.</p><SequenceDiagram balls={pair.nextScenario.balls} simulation={pair.simulation} label="Unmoved traffic: simulated next pot" /></>}
      <p className="lesson-comparison-note">The score checks the opening pot, zone and next-shot access. The reset is a separate geometric diagnostic; the clear continuation is a nominal example.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setReset(false); setProof(false) }}>Try the prediction again</Button>
    </>}
    {!pair && <p role="status">The moving-traffic comparison could not be verified for this layout.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
