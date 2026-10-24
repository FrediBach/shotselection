import { useState } from 'react'
import { Button } from './ui/button'
import SequenceDiagram from './SequenceDiagram'
import { finalBallComparison } from '../engine/final-ball'
import type { PreparedRound, RoundAnalysis } from '../engine/types'

export default function FinalBallComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null), [retry, setRetry] = useState(false), [inspect, setInspect] = useState(0), [showTarget, setShowTarget] = useState(false)
  const data = result ? finalBallComparison(prepared, result) : null, revealed = Boolean(result) && !retry
  const options = prepared.balls[0].options, shot = result?.candidates.find(s => s.plan.id === options[inspect].id)
  const leaders = data ? data.shots.filter(s => s.wins === Math.max(...data.shots.map(s => s.wins))).map(s => s.label).join(' and ') : ''
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Final ball objective comparison" hidden={hidden}>
    <h3>When the game ends, position stops mattering</h3>
    <p>Only ball 1 remains. A settled legal pot with no scratch wins, wherever the cue stops on the table. Should that pot fail just because the cue misses an imagined position target?</p>
    <div className="lesson-predictions" role="group" aria-label="Final pot prediction">{['Still wins', 'Fails the target'].map(answer => <Button key={answer} size="sm" variant={prediction === answer ? 'default' : 'outline'} aria-pressed={prediction === answer} disabled={busy || revealed} onClick={() => setPrediction(answer)}>{answer}</Button>)}</div>
    {revealed && data && <>
      <p role="status">{prediction === 'Still wins' ? 'Your prediction matches. ' : ''}The legal final pot still wins. Stroke {leaders} has the highest winning-pot count in this sample.</p>
      <table><caption>Same trials, different objective</caption><thead><tr><th>Outcome</th>{data.shots.map(s => <th key={s.optionId}>Stroke {s.label}</th>)}</tr></thead><tbody>{['Actual final-ball wins', 'Wins plus imagined target', 'Wins outside imagined target'].map((label, row) => <tr key={label} data-testid={`final-ball-row-${row}`}><th>{label}</th>{data.shots.map(s => <td key={s.optionId}>{[s.wins, s.restricted, s.outside][row]}/{s.samples}</td>)}</tr>)}</tbody></table>
      <p>The imagined target is a {(data.radius * 100).toFixed(1)} cm-radius circle at stroke C’s nominal finish, fixed before looking at the trial results. It is shown only in this diagnostic. The last row remains successful in the real final-ball objective. Misses, scratches and unsettled trials remain failures in every row.</p>
      <p>Stroke C’s draw finish defines the imagined positional exercise. Compare its target count with its actual winning-pot count. The real score ranks legal winning-pot rates, with no reward for proximity to that circle. Small sampled differences do not establish a universal advantage for one stroke.</p>
      <div className="lesson-predictions" role="group" aria-label="Inspect final stroke">{options.map((o, i) => <Button key={o.id} size="sm" variant={inspect === i ? 'default' : 'outline'} aria-pressed={inspect === i} onClick={() => setInspect(i)}>Inspect stroke {o.label}</Button>)}</div>
      <Button size="sm" variant="outline" aria-pressed={showTarget} onClick={() => setShowTarget(value => !value)}>{showTarget ? 'Hide imagined target' : 'Show imagined target'}</Button>
      <SequenceDiagram balls={prepared.scenario.balls} simulation={shot!.nominal} zone={showTarget ? { target: data.target, radius: data.radius } : undefined} label="Final pot with optional imagined target" />
      <p>The diagram shows the actual nominal stroke. The finish ring records the cue’s resting position; it is not a scoring target. These counts reuse the scoring trials exactly, without extra simulations or changing your score.</p>
      <Button size="sm" variant="outline" onClick={() => { setRetry(true); setPrediction(null); setInspect(0); setShowTarget(false) }}>Try the prediction again</Button>
    </>}
    {revealed && !data && <p role="status">The final-ball comparison is unavailable for this result.</p>}
    {result && retry && <Button size="sm" onClick={() => setRetry(false)}>Check prediction</Button>}
    <p className="lesson-comparison-note">The prediction is optional and never blocks advancement.</p>
  </section>
}
