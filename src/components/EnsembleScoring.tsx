import { scoreSelection } from '@/engine'
import { positionToleranceForScenario } from '@/engine/objectives'
import type { RoundAnalysis, Scenario, ShotPlan } from '@/engine/types'
import { buildShotFeedback } from '@/lib/shot-feedback'

export default function EnsembleScoring({ result, scenario, shotLabel, finishLabel }: {
  result: RoundAnalysis
  scenario: Scenario
  shotLabel: (plan: ShotPlan) => string
  finishLabel: (id: string) => string
}) {
  const feedback = buildShotFeedback(scenario, result)
  const shots = [result.selected, ...result.candidates.filter(shot => shot.plan.id !== result.selected.plan.id)]
  return <div className="ensemble-scoring">
    <p><strong>Why this score? </strong>{feedback.reasons[0]?.detail ?? feedback.summary}</p>
    {feedback.tradeoff && <p>{feedback.tradeoff}</p>}
    {!scenario.finalBall && <p className="ensemble-scoring-note">{scenario.objective
      ? 'Full success requires the legal pot and all position requirements in the same trial.'
      : `Full success requires a legal pot and the cue ball stopping within ${(positionToleranceForScenario(scenario) * 100).toFixed(1)} cm of that shot’s intended finish, without scratching. Each option has its own finish target.`} Pot, scratch and finish rates overlap; they cannot be added or subtracted to calculate success. Spread measures clustering around the average finish, not distance from the target.</p>}
    <details>
      <summary>How the score is calculated</summary>
      <p>{scenario.finalBall ? 'Shot quality is the legal final-pot success rate. Position earns no extra credit.' : 'Shot quality combines 72% full success, 20% target accuracy and 8% legal pots. Target accuracy averages credit across all trials: closer finishes earn more; illegal pots and unavailable required next shots earn zero.'}</p>
      <div className="ensemble-score-table"><table>
        <caption>Quality contributions and round points · values rounded for display</caption>
        <thead><tr><th scope="col">Measure</th>{shots.map((shot, i) => <th scope="col" key={shot.plan.id}>{i === 0 ? 'Your selection' : shotLabel(shot.plan)} · {finishLabel(shot.plan.id)}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Full successes</th>{shots.map(shot => <td key={shot.plan.id}>{Math.round(shot.successRate * shot.samples)} / {shot.samples}</td>)}</tr>
          {!scenario.finalBall && <>
            <tr><th scope="row">Full success × 72</th>{shots.map(shot => <td key={shot.plan.id}>{(shot.successRate * 72).toFixed(2)}</td>)}</tr>
            <tr><th scope="row">Target accuracy × 20</th>{shots.map(shot => <td key={shot.plan.id}>{(shot.targetQuality * 20).toFixed(2)}</td>)}</tr>
            <tr><th scope="row">Legal pots × 8</th>{shots.map(shot => <td key={shot.plan.id}>{(shot.legalPotRate * 8).toFixed(2)}</td>)}</tr>
          </>}
          <tr><th scope="row">Shot quality / 100</th>{shots.map(shot => <td key={shot.plan.id}>{(shot.score * 100).toFixed(2)}</td>)}</tr>
          <tr><th scope="row">Quality points + rank points</th>{shots.map(shot => {
            const score = scoreSelection(shot, result.candidates)
            return <td key={shot.plan.id}>{score.qualityPoints} + {score.rankPoints} = {score.points}</td>
          })}</tr>
        </tbody>
      </table></div>
      <p>Round points combine up to 70 for quality relative to the best offered shot and up to 30 for rank, each rounded to the nearest ten. Quality within 4.5 points of a rank group’s leader shares that rank. Zero full successes earns zero round points.</p>
    </details>
  </div>
}
