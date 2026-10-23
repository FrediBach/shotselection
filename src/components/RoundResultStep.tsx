import type { RefObject } from 'react'
import { ChevronDown, MessageCircle, Target, Trophy } from 'lucide-react'
import type { RoundAnalysis, Scenario, ShotPlan } from '@/engine/types'
import { percent } from '@/lib/shot-presentation'
import { shotFeedbackVerdict } from '@/lib/shot-feedback'
import { Button } from './ui/button'
import BallIcon from './BallIcon'

interface Props {
  result: RoundAnalysis
  scenario: Scenario
  headingRef: RefObject<HTMLHeadingElement | null>
  shotLabel: (plan: ShotPlan) => string
  finishLabel: (id: string) => string
  onExplain: (opener: HTMLElement) => void
}

function roundVerdict(result: RoundAnalysis) {
  if (result.candidates.every(shot => shot.successRate === 0)) return 'A difficult table.'
  const feedback = shotFeedbackVerdict(result)
  if (feedback.kind === 'close' || feedback.kind === 'tied') return feedback.title
  if (result.points === 100) return 'That’s the smart shot.'
  if (result.points >= 80) return 'A strong choice.'
  if (result.points >= 50) return 'Room to improve.'
  return 'There’s a safer way.'
}

export default function RoundResultStep({ result, scenario, headingRef, shotLabel, finishLabel, onExplain }: Props) {
  const { objective, bank, plant, trick } = scenario
  return <>
    <h2 ref={headingRef} tabIndex={-1}>{roundVerdict(result)}</h2>
    <section className="score-breakdown" aria-label="How your score adds up">
      <div className={`points-awarded${result.points === 100 ? ' points-perfect' : ''}`}><span>{result.points === 100 ? <Trophy size={18} /> : <Target size={18} />} Round score</span><strong>{result.points} <span>/ 100</span></strong></div>
      <dl>
        <div><dt>Shot quality</dt><dd>{result.scoring.qualityPoints}<span> / 70</span></dd><span>About {percent(result.scoring.relativeQuality)} of best quality</span></div>
        <div><dt>Ensemble rank</dt><dd>{result.scoring.rankPoints}<span> / 30</span></dd><span>{result.scoring.tiedCount > 1 ? 'Joint rank' : 'rank'} {result.scoring.rank} of {result.scoring.candidateCount} choices</span></div>
      </dl>
    </section>
    <section className="result-comparison" aria-label="Shot success rates">
      <h3>Success rate</h3>
      <div className="result-comparison-grid">
        <div><span>Your shot</span><strong>{percent(result.selected.successRate)}</strong><small><BallIcon id={result.selected.plan.potBallId ?? result.selected.plan.ballId} small />{plant || trick ? `${shotLabel(result.selected.plan)} · ` : ''}{finishLabel(result.selected.plan.id)}</small></div>
        <div><span>Best shot</span><strong>{percent(result.best.successRate)}</strong><small><BallIcon id={result.best.plan.potBallId ?? result.best.plan.ballId} small />{plant || trick ? `${shotLabel(result.best.plan)} · ` : ''}{finishLabel(result.best.plan.id)}</small></div>
      </div>
    </section>
    <Button variant="outline" size="sm" className="shot-feedback-trigger full-width" aria-haspopup="dialog" onClick={event => onExplain(event.currentTarget)}><MessageCircle size={15} /> Explain my shot</Button>
    <details className="result-details">
      <summary>Scoring details <ChevronDown size={15} aria-hidden="true" /></summary>
      <p>{result.scoring.noSuccessfulTrials ? `No successful ${trick ? 'trick' : 'pot'} + finish in ${result.samples} trials, so both parts earn 0.` : 'Quality rewards pots, safe finishes and target accuracy. Rank rewards your place among all choices.'}</p>
      <p>{result.scoring.qualityPoints} + {result.scoring.rankPoints} = {result.points}. Each part rounds to 10 points. Similar results share a rank.</p>
      <p>Success rate: {trick ? `complete trick + pots ${trick.requiredPots.join(' + ')} + safe finish` : objective ? `pot + zone + a clear next shot on ball ${objective.nextBallId}` : bank ? `${bank.minCushions} bank${bank.minCushions === 1 ? "" : "s"} + pot + safe finish` : "pot + safe finish"} in {result.samples} trials, within {Math.round(result.positionTolerance * 100)} cm of the target.</p>
    </details>
  </>
}
