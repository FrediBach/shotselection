import type { RefObject } from 'react'
import { Target, Trophy } from 'lucide-react'
import type { RoundAnalysis, Scenario, ShotPlan } from '@/engine/types'
import { percent } from '@/lib/shot-presentation'
import BallIcon from './BallIcon'

interface Props {
  result: RoundAnalysis
  scenario: Scenario
  headingRef: RefObject<HTMLHeadingElement | null>
  shotLabel: (plan: ShotPlan) => string
  finishLabel: (id: string) => string
}

function roundVerdict(result: RoundAnalysis) {
  if (result.candidates.every(shot => shot.successRate === 0)) return 'A difficult table.'
  if (result.points === 100) return 'That’s the smart shot.'
  if (result.points >= 80) return 'A strong choice.'
  if (result.points >= 50) return 'Room to improve.'
  return 'There’s a safer way.'
}

export default function RoundResultStep({ result, scenario, headingRef, shotLabel, finishLabel }: Props) {
  const { objective, bank, plant } = scenario
  return <>
    <h2 ref={headingRef} tabIndex={-1}>{roundVerdict(result)}</h2>
    <div className={`points-awarded${result.points === 100 ? ' points-perfect' : ''}`}><span>{result.points === 100 ? <Trophy size={18} /> : <Target size={18} />} Round score</span><strong>{result.points} <span>/ 100</span></strong></div>
    <section className="score-breakdown" aria-label="How your score adds up">
      <h3>How your score adds up</h3>
      <dl>
        <div><dt>Shot quality<span>About {percent(result.scoring.relativeQuality)} of best quality</span></dt><dd>{result.scoring.qualityPoints}<span> / 70</span></dd></div>
        <div><dt>Ensemble rank<span>{result.scoring.tiedCount > 1 ? 'Joint ' : ''}rank {result.scoring.rank} of {result.scoring.candidateCount} choices</span></dt><dd>{result.scoring.rankPoints}<span> / 30</span></dd></div>
      </dl>
      <p>{result.scoring.noSuccessfulTrials ? `No successful pot + finish in ${result.samples} trials, so both parts earn 0.` : 'Quality rewards pots, safe finishes and target accuracy. Rank rewards your place among all choices.'}</p>
      <p className="score-rounding">{result.scoring.qualityPoints} + {result.scoring.rankPoints} = {result.points}. Each part rounds to 10 points. Similar results share a rank.</p>
    </section>
    <div className="result-comparison"><div><span>Your shot{plant ? ` · ${shotLabel(result.selected.plan)}` : ''} · {finishLabel(result.selected.plan.id)}</span><strong>{percent(result.selected.successRate)}</strong></div><div><span>Best <BallIcon id={result.best.plan.potBallId ?? result.best.plan.ballId} small />{plant ? ` ${shotLabel(result.best.plan)}` : ''} · {finishLabel(result.best.plan.id)}</span><strong>{percent(result.best.successRate)}</strong></div><p>{objective ? `Pot + zone + a clear next shot on ball ${objective.nextBallId}` : bank ? `${bank.minCushions} bank${bank.minCushions === 1 ? "" : "s"} + pot + safe finish` : "Pot + safe finish"} in {result.samples} trials, within {Math.round(result.positionTolerance * 100)} cm of the target.</p></div>
  </>
}
