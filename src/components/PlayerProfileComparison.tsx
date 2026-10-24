import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { TRAINING_PROFILES } from '../engine/player-profile'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function PlayerProfileComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [predictions, setPredictions] = useState<Record<number, string>>({}), [retry, setRetry] = useState(false), [inspect, setInspect] = useState(0)
  const options = prepared.balls[0].options, data = result?.playerProfiles, revealed = Boolean(result) && !retry
  const shot = result?.candidates.find(s => s.plan.id === options[inspect].id)
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Player error profile comparison" hidden={hidden}>
    <h3>Which stroke fits each player?</h3>
    <p>Use the same table, strokes and landing zone for both training profiles. A and B both complete the assignment nominally. Predict the highest complete-success rate for each profile.</p>
    <p>Precise pace: aim precision 0, strength precision 100. Precise aim: aim 100, strength 0. Both keep English and draw/follow precision at 100, which still includes some error. These deliberately contrasting training profiles do not change your saved player.</p>
    {TRAINING_PROFILES.map((p, i) => <div key={p.name}><strong>{p.name}</strong><div className="lesson-predictions" role="group" aria-label={`${p.name} prediction`}>{[...options.map(o => o.label), 'Tie'].map(label => <Button key={label} size="sm" variant={predictions[i] === label ? 'default' : 'outline'} aria-pressed={predictions[i] === label} disabled={busy || revealed} onClick={() => setPredictions(previous => ({ ...previous, [i]: label }))}>{label === 'Tie' ? 'Tie' : `Stroke ${label}`}</Button>)}</div></div>)}
    {revealed && data && <>
      <p role="status">{data.switched ? 'The preferred stroke changes between these profiles.' : 'This sample does not show a unique ranking reversal.'} {data.profiles.map((p, i) => {
        const winners = data.winners[i], answer = winners.length > 1 ? 'Tie' : winners.length ? options[winners[0]].label : null
        return `${p.name}: ${winners.length ? winners.map(w => `stroke ${options[w].label}`).join(' and ') : 'no successful trials'}${winners.length > 1 ? ' tied' : ''}.${answer && predictions[i] === answer ? ' Your prediction matches.' : ''} `
      })}</p>
      <table><caption>Complete successes · all execution errors</caption><thead><tr><th>Profile</th>{options.map(o => <th key={o.id}>Stroke {o.label}</th>)}</tr></thead><tbody>{data.profiles.map((p, i) => <tr key={p.name} data-testid={`profile-row-${i}`}><th>{p.name}</th>{p.shots.map(s => <td key={s.optionId}>{s.count}/{data.samples}</td>)}</tr>)}</tbody></table>
      <p>Each cell uses {data.samples} matched random draws. One fixed training sample is reflected with the table so mirrored layouts keep the same comparison. Only the aim and speed error scales change between profiles: aim standard deviation is about 0.44° versus 0.06°, while speed is 0.88% versus 6.13%. Success requires a legal pot, the shared zone and an available next shot from the settled balls. These are finite-sample rankings, not proof of a universal preference.</p>
      <table><caption>Separate sensitivity probes · one error at a time</caption><thead><tr><th>Error varied</th>{options.map(o => <th key={o.id}>Stroke {o.label}</th>)}</tr></thead><tbody>{['Aim only', 'Speed only'].map((name, row) => <tr key={name} data-testid={`profile-sensitivity-${row}`}><th>{name}</th>{data.sensitivity.map(s => <td key={s.optionId}>{row ? s.speedCount : s.aimCount}/{data.samples}</td>)}</tr>)}</tbody></table>
      <p>Both isolated probes use precision 0 for the named axis and hold all other controls exactly fixed. More failures mean greater sensitivity in that probe. The counts are not independent losses to add together, and cannot be substituted for the complete profile trials.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect profile stroke">{options.map((o, i) => <Button key={o.id} size="sm" variant={inspect === i ? 'default' : 'outline'} aria-pressed={inspect === i} onClick={() => setInspect(i)}>Inspect stroke {o.label}</Button>)}</div>
      <p>Stroke {options[inspect].label}: {options[inspect].plan.speed.toFixed(3)} m/s; longitudinal spin {options[inspect].plan.topSpin.toFixed(2)}. This diagram shows its nominal path, which stays identical for both profiles.</p>
      <SequenceDiagram balls={prepared.scenario.balls} simulation={shot!.nominal} zone={{ target: prepared.scenario.objective!.target!, radius: prepared.scenario.objective!.radius }} label="Fixed stroke for both player profiles" />
      <p>Your ordinary score still uses your own character and the normal scoring formula. This comparison ranks complete-success counts only; it does not award extra points or select a stroke for you.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPredictions({}); setInspect(0) }}>Try the predictions again</Button>
    </>}
    {revealed && !data && <p role="status">Profile evidence is unavailable for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check predictions</Button>}
    <p className="lesson-comparison-note">Predictions are optional and never block advancement.</p>
  </section>
}
