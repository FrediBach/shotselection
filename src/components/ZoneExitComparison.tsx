import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { zoneExitEvidence, zoneExitPairFinder } from '../engine/zone-exit'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import { TABLE } from '../engine/constants'
import type { PreparedRound, RoundAnalysis, Simulation } from '../engine/types'

function ExitDiagram({ prepared, simulation, removed = false, label }: { prepared: PreparedRound; simulation: Simulation; removed?: boolean; label: string }) {
  const { blockerId, pocketId } = prepared.zoneExit!
  const evidence = zoneExitEvidence(prepared.scenario, simulation, blockerId, pocketId)
  const route = evidence.route ?? evidence.restored
  const objective = prepared.scenario.objective!
  const blocked = evidence.approachBlocked && !removed
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={label}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    <circle cx={objective.target!.x} cy={objective.target!.y} r={objective.radius} fill="#7de3ef" fillOpacity=".08" stroke="#7de3ef" strokeWidth=".006" />
    {route && evidence.cue && evidence.next && <>
      <line x1={evidence.cue.position.x} y1={evidence.cue.position.y} x2={route.ghost.x} y2={route.ghost.y} stroke={blocked ? '#ff9f98' : '#7de3ef'} strokeWidth=".012" strokeDasharray={blocked ? '.035 .02' : undefined} />
      <line x1={evidence.next.position.x} y1={evidence.next.position.y} x2={evidence.pocket.center.x} y2={evidence.pocket.center.y} stroke="#ffc16e" strokeWidth=".01" />
      <circle cx={route.ghost.x} cy={route.ghost.y} r={TABLE.ballRadius} fill="none" stroke="#7de3ef" strokeWidth=".006" />
    </>}
    {simulation.finalBalls.filter(b => !b.pocketed && (!removed || b.id !== blockerId)).map(ball => <g key={ball.id}>
      {ball.id === blockerId && <circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballDiameter * 1.025} fill="#ff9f98" fillOpacity=".1" stroke="#ff9f98" strokeWidth=".006" strokeDasharray=".015 .01" />}
      <circle cx={ball.position.x} cy={ball.position.y} r={TABLE.ballRadius} fill={ball.id === 0 ? '#fff' : ball.id === blockerId ? '#ff9f98' : '#ffc16e'} />
      <text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".043" fill="#071e1b">{ball.id || ''}</text>
    </g>)}
  </svg>
}

export default function ZoneExitComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false)
  const [removed, setRemoved] = useState(false), [proof, setProof] = useState(false)
  const contrast = prepared.zoneExit!
  const options = prepared.balls[0].options.filter(o => [contrast.blockedId, contrast.clearId].includes(o.id))
  const pair = useMemo(() => result ? zoneExitPairFinder(prepared.scenario)(result.candidates.filter(s => [contrast.blockedId, contrast.clearId].includes(s.plan.id)).map(s => ({ plan: s.plan, simulation: s.nominal }))) : null, [prepared, result, contrast])
  const revealed = Boolean(result) && !retry
  return <section className="lesson-comparison" aria-label="Exit from the landing zone" hidden={hidden}>
    <h3>Inside the zone, but can you get out?</h3>
    <p>Strokes {options.map(o => o.label).join(' and ')} both pot ball 1 and finish inside the same zone. Which one leaves a spare ball blocking the cue-ball approach to ball 2?</p>
    <div className="lesson-predictions" role="group" aria-label="Blocked-exit prediction">{options.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {revealed && pair && <div>
      <p role="status"><strong>{prediction === null ? 'Trace both exits from the shared zone.' : prediction === contrast.blockedId ? 'Your prediction identifies the blocked exit.' : 'Reaching the circle is only the first check. Follow the approach through the spare ball.'}</strong></p>
      <p>Your selected stroke: {result!.selected.plan.id === contrast.blockedId ? `reaches the zone, but ball ${contrast.blockerId} blocks the exit.` : result!.selected.plan.id === contrast.clearId ? 'reaches the zone and leaves a clear exit.' : 'is the third alternative, outside this matched comparison.'}</p>
      {options.map(option => {
        const shot = result!.candidates.find(s => s.plan.id === option.id)!
        const e = zoneExitEvidence(prepared.scenario, shot.nominal, contrast.blockerId, contrast.pocketId)
        const objective = evaluateShotObjective(prepared.scenario, shot.plan, shot.nominal)
        return <figure key={option.id} className="zone-exit-branch">
          <figcaption><strong>Stroke {option.label} · {option.id === contrast.blockedId ? 'Blocked exit' : 'Clear exit'}</strong></figcaption>
          <ExitDiagram prepared={prepared} simulation={shot.nominal} label={`Stroke ${option.label}: ${option.id === contrast.blockedId ? `approach blocked by ball ${contrast.blockerId}` : 'clear approach to the same next pocket'}`} />
          <dl className="geometry-measures">
            <div><dt>Legal opening pot</dt><dd>{objective.legalPot ? 'Yes' : 'No'}</dd></div>
            <div><dt>Inside the shared zone</dt><dd>{objective.positioned ? 'Yes' : 'No'}</dd></div>
            <div><dt>Object-to-pocket line clear of ball {contrast.blockerId}</dt><dd>{e.potLineClear ? 'Yes' : 'No'}</dd></div>
            <div><dt>Cue approach blocked by ball {contrast.blockerId}</dt><dd>{e.approachBlocked ? 'Yes' : 'No'}</dd></div>
            <div><dt>Permitted next routes</dt><dd>{e.routes.length}</dd></div>
          </dl>
        </figure>
      })}
      <p>Both diagrams use the same next pocket and actual settled balls. The cyan ring beside ball 2 marks the cue-ball center needed at contact. Gold shows the object’s pocket line; the red dashed approach crosses ball {contrast.blockerId}’s clearance area. Its dashed circle is the forbidden area for the moving cue center, not a larger ball.</p>
      <Button size="sm" variant="outline" aria-expanded={removed} onClick={() => setRemoved(value => !value)}>{removed ? 'Restore the blocker' : `Check without ball ${contrast.blockerId}`}</Button>
      {removed && <>
        <p><strong>Counterfactual: remove only ball {contrast.blockerId}.</strong> Keep the cue and ball 2 fixed. The same next-pocket route returns under the unchanged {prepared.scenario.objective!.maxCutAngle}° cut limit. The missing approach was caused by this spare ball, not merely by the cut angle.</p>
        <ExitDiagram prepared={prepared} simulation={pair.blocked.simulation} removed label={`Counterfactual clear approach with only ball ${contrast.blockerId} removed`} />
      </>}
      <Button size="sm" variant="outline" aria-expanded={proof} onClick={() => setProof(value => !value)}>{proof ? 'Hide the clear continuation' : 'Inspect the clear continuation'}</Button>
      {proof && <><p>The clear finish also supports this simulated legal pot on ball 2 without a scratch.</p><SequenceDiagram balls={pair.nextScenario.balls} simulation={pair.simulation} label="Simulated next pot from the clear exit" /></>}
      <p className="lesson-comparison-note">The score requires the opening pot, zone and next-shot access. The removal check proves geometric access only; the clear continuation is a nominal example, not a guarantee for every stroke.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setRemoved(false); setProof(false) }}>Try the prediction again</Button>
    </div>}
    {revealed && !pair && <p role="status">The matched exit comparison could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
