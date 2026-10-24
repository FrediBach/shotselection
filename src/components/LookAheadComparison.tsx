import { angleTravelEvidence } from '../engine/angle-travel'
import { useMemo, useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { lookAheadPairFinder, LOOK_AHEAD_CUT } from '../engine/look-ahead'
import { evaluateShotObjective } from '../engine/objectives'
import { POCKET_GEOMETRY } from '../engine/table-geometry'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function LookAheadComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null)
  const [retry, setRetry] = useState(false)
  const pair = useMemo(() => result ? lookAheadPairFinder(prepared.scenario)(result.candidates.filter(shot => prepared.lookAheadOptionIds?.includes(shot.plan.id)).map(shot => ({ plan: shot.plan, simulation: shot.nominal }))) : null, [prepared, result])
  const angleTravel = prepared.scenario.curriculum?.learning?.comparison === 'angle-travel'
  const revealed = Boolean(result) && !retry
  const label = (id: string) => prepared.balls[0].options.find(o => o.id === id)!.label
  const choices = prepared.balls[0].options.filter(option => prepared.lookAheadOptionIds?.includes(option.id))
  return <section className="lesson-comparison" aria-label={angleTravel ? 'Angle and travel to ball 3' : 'Look ahead to ball 3'} hidden={hidden}>
    <h3>{angleTravel ? 'How much angle is enough?' : 'What comes after ball 2?'}</h3>
    <p>Strokes {choices.map(o => o.label).join(' and ')} both reach the zone and leave ball 2 playable. {angleTravel ? 'Both next contacts are on the same useful side. Which opener leaves enough angle for the matched second stroke to reach the third-shot setup?' : 'Which opening stroke also leaves a route to ball 3 after the matched second shot?'}</p>
    <div className="lesson-predictions" role="group" aria-label="Look-ahead prediction">{choices.map(option => <Button key={option.id} size="sm" variant={prediction === option.id ? 'default' : 'outline'} aria-pressed={prediction === option.id} disabled={busy || revealed} onClick={() => setPrediction(option.id)}>Stroke {option.label}</Button>)}</div>
    {revealed && pair && <div>
      <p role="status"><strong>{prediction === null ? (angleTravel ? 'Compare the fuller and thinner second contacts.' : 'Follow both second shots to their finishes.') : prediction === pair.kept.opening.plan.id ? (angleTravel ? 'Your prediction leaves enough angle and travel.' : 'Your prediction keeps the route to ball 3.') : (angleTravel ? 'The fuller contact leaves the cue short. Compare its travel with the thinner contact.' : 'Both first links work. Look at what happens after the pot on ball 2.')}</strong></p>
      <p>Your selected opener: {result!.selected.plan.id === pair.kept.opening.plan.id ? (angleTravel ? 'leaves the thinner contact and enough travel toward ball 3.' : 'keeps the demonstrated route to ball 3.') : result!.selected.plan.id === pair.lost.opening.plan.id ? (angleTravel ? 'leaves the fuller contact, which finishes short of the demonstrated third-shot setup.' : 'leaves ball 2 playable, but the demonstrated second shot loses the route to ball 3.') : 'is the third alternative, outside this matched comparison.'}</p>
      <p><strong>Matched second shot:</strong> pot ball 2 to the {POCKET_GEOMETRY.find(p => p.id === pair.kept.plan.pocketId)!.name} pocket at {pair.kept.plan.speed.toFixed(1)} m/s, {pair.kept.plan.topSpin < 0 ? `${Math.round(Math.abs(pair.kept.plan.topSpin) * 100)}% draw` : pair.kept.plan.topSpin > 0 ? 'natural-roll follow' : 'center ball'}, with no English. Only the aim adjusts to the incoming position.</p>
      {[pair.lost, pair.kept].sort((a, b) => label(a.opening.plan.id).localeCompare(label(b.opening.plan.id))).map(branch => {
        const kept = branch === pair.kept
        const travel = angleTravel ? angleTravelEvidence(prepared.scenario, branch.opening.simulation, branch.simulation, branch.plan.pocketId) : null
        const objective = evaluateShotObjective(prepared.scenario, branch.opening.plan, branch.opening.simulation)
        return <div key={branch.opening.plan.id} className="look-ahead-branch">
          <h4>Stroke {label(branch.opening.plan.id)} · {angleTravel ? (kept ? 'Thinner contact · enough travel' : 'Fuller contact · short finish') : kept ? 'Third route preserved' : 'Third route lost'}</h4>
          <dl className="geometry-measures">
            <div><dt>Legal opening pot</dt><dd>{objective.legalPot ? 'Yes' : 'No'}</dd></div>
            <div><dt>Opening finish in zone</dt><dd>{objective.positioned ? 'Yes' : 'No'}</dd></div>
            <div><dt>Matched second pot</dt><dd>Legal, no scratch</dd></div>
            {travel && <>
              <div><dt>Second-cut magnitude</dt><dd>{Math.abs(travel.angle).toFixed(1)}°</dd></div>
              <div><dt>Signed second angle</dt><dd>{travel.angle > 0 ? '+' : ''}{travel.angle.toFixed(1)}°</dd></div>
              <div><dt>Speed before contact</dt><dd>{travel.incomingSpeed.toFixed(2)} m/s</dd></div>
              <div><dt>Contact-to-finish distance</dt><dd>{(travel.travel * 100).toFixed(1)} cm</dd></div>
            </>}
            <div><dt>Routes to ball 3 (≤{LOOK_AHEAD_CUT}°)</dt><dd>{branch.routes.length}</dd></div>
          </dl>
          <figure><figcaption>From the opening finish: play ball 2</figcaption><SequenceDiagram balls={branch.scenario.balls} simulation={branch.simulation} setupPoint={angleTravel ? pair.kept.simulation.cueEnd : undefined} label={`Stroke ${label(branch.opening.plan.id)}: actual second-shot paths`} /></figure>
          <figure><figcaption>After ball 2: {kept ? `a ${pair.thirdCut.toFixed(0)}° cut on ball 3` : `no direct route to ball 3 within ${LOOK_AHEAD_CUT}°`}</figcaption><SequenceDiagram balls={branch.thirdScenario.balls} simulation={kept ? pair.third : undefined} label={`Stroke ${label(branch.opening.plan.id)}: ${kept ? 'verified third pot' : 'settled layout with no permitted third route'}`} /></figure>
        </div>
      })}
      {angleTravel && <p>The pink cross marks the same demonstrated third-shot setup in both diagrams. Both departures point toward it, but the fuller contact finishes short. The thinner cut adds at least 8° of angle and 12 cm of net travel. Contact speeds are within 10% and roll ratios within 0.15; neither second shot hits a cushion or another ball after the intended contact. Distances measure straight-line displacement from contact, not path length. Signed angles use clockwise as positive from the object-to-pocket direction toward the incoming cue direction.</p>}
      <p>The opening layouts differ only in the cue-ball finish; balls 2, 3 and 4 stay in their original positions until the second stroke. Each subsequent layout uses the actual settled simulation, including any later ball movement.</p>
      <p>White marks the starting cue ball, cyan its travelled path and finish, and gold the object-ball path. In the preserved branch, the third pot is also simulated successfully. The other branch has no clear direct route within {LOOK_AHEAD_CUT}° after this particular second stroke; different second-shot settings or harder routes may work.</p>
      <p className="lesson-comparison-note">Your score still measures the opening pot, zone and access to ball 2. This separate nominal comparison {angleTravel ? 'shows the effect of second-contact angle in these matched strokes' : 'teaches the extra look-ahead step'}; it is not a sequence success rate.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null) }}>Try the prediction again</Button>
    </div>}
    {revealed && !pair && <p role="status">A matched continuation could not be verified for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">This prediction is optional and never blocks advancement.</p>
  </section>
}
