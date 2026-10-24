import { useState } from 'react'
import { Button } from './ui/button'
import { plantQualitySummary, qualityWinner } from '../engine/plant-quality'
import type { PreparedRound, RoundAnalysis } from '../engine/types'
export default function PlantQualityComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [goal, setGoal] = useState<'completion' | 'score' | null>(null)
  const options = prepared.balls.map(b => b.options.find(o => o.label === 'C')!)
  const shots = options.map(o => result?.candidates.find(c => c.plan.id === o.id))
  const summaries = shots.map(s => s ? plantQualitySummary(s) : null)
  const ready = shots.every(Boolean) && summaries.every(Boolean)
  const completion = ready ? qualityWinner(shots[0]!.successRate, shots[1]!.successRate) : ''
  const score = ready ? qualityWinner(shots[0]!.score, shots[1]!.score) : ''
  const percent = (value: number) => `${(value * 100).toFixed(2)}%`
  return <section className="lesson-comparison plant-quality-comparison" aria-label="Plant scoring-quality comparison" hidden={hidden}>
    <h3>What does best mean?</h3>
    <p>Compare plant C with free-ball C. Their target markers are authored finish requirements, not predicted stopping points. Choose the objective you want to optimize.</p>
    <div role="group" aria-label="Comparison objective" className="lesson-predictions">
      <Button size="sm" disabled={busy} variant={goal === 'completion' ? 'default' : 'outline'} aria-pressed={goal === 'completion'} onClick={() => setGoal('completion')}>Complete more often</Button>
      <Button size="sm" disabled={busy} variant={goal === 'score' ? 'default' : 'outline'} aria-pressed={goal === 'score'} onClick={() => setGoal('score')}>Maximize weighted score</Button>
    </div>
    {result && ready && <>
      <p role="status">{goal ? `${goal === 'completion' ? 'Completion-rate' : 'Weighted-score'} choice: ${goal === 'completion' ? completion : score}.` : 'Choose an objective to name your preferred candidate.'} {completion === 'Tie' || score === 'Tie' ? 'At least one ranking is tied.' : completion !== score ? 'The rankings reverse in this sample.' : 'The rankings agree in this sample.'}</p>
      <table><caption>Same indexed stroke errors · {shots[0]!.samples} trials per candidate</caption><thead><tr><th>Measure</th><th>Plant C</th><th>Free-ball C</th></tr></thead><tbody>
        <tr><th>Complete successes</th>{shots.map((s, i) => <td key={i}>{summaries[i]!.successes}/{s!.samples}</td>)}</tr>
        <tr><th>Centering among successes</th>{summaries.map((s, i) => <td key={i}>{s!.conditional === null ? 'No successes' : percent(s!.conditional)}</td>)}</tr>
        {['72% × completion rate', '20% × all-trial centering', '8% × legal-pot rate'].map((label, row) => <tr key={label}><th>{label}</th>{summaries.map((s, i) => <td key={i}>{(s!.components[row] * 100).toFixed(2)} pts</td>)}</tr>)}
        <tr><th>Weighted score / 100</th>{shots.map((s, i) => <td key={i}>{(s!.score * 100).toFixed(2)}</td>)}</tr>
      </tbody></table>
      <p>Centering among successes averages only the {summaries[0]!.successes} successful plant trials and {summaries[1]!.successes} successful free-ball trials. It is descriptive, not a score component.</p>
      <p>The score averages centering credit over every trial: legal pots can earn credit even outside the finish tolerance; misses, fouls and scratches earn zero. Credit is highest at the target center and decreases with distance. Legal-pot credit also contributes, so a score reversal cannot be attributed to successful-shot centering alone. Displayed components are rounded.</p>
      <p>These are finite-sample comparisons between two named finishes, not proof of a universal best shot. Other players and samples can reverse, agree or tie. Your objective choice changes this comparison only; the game still awards its existing weighted score and compares all six finishes.</p>
    </>}
    {result && !ready && <p role="status">The scoring components could not be verified for this result.</p>}
    <p className="lesson-comparison-note">Choosing an objective is optional and never blocks advancement.</p>
  </section>
}
