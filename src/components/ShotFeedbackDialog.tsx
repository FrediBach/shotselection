import type { RefObject } from 'react'
import { ArrowRight, MessageCircle } from 'lucide-react'
import type { RoundAnalysis, Scenario, ShotPlan } from '@/engine/types'
import { buildShotFeedback } from '@/lib/shot-feedback'
import { ENGLISH_EXPLANATION, percent, englishDescription, verticalSpinDescription } from '@/lib/shot-presentation'
import { Button } from './ui/button'
import { DialogDescription, DialogTitle } from './ui/dialog'
import './ShotFeedbackDialog.css'

interface Props {
  result: RoundAnalysis
  scenario: Scenario
  headingRef: RefObject<HTMLHeadingElement | null>
  shotLabel: (plan: ShotPlan) => string
  finishLabel: (id: string) => string
  onClose: () => void
  onReplay: () => void
}

export default function ShotFeedbackDialog({ result, scenario, headingRef, shotLabel, finishLabel, onClose, onReplay }: Props) {
  const feedback = buildShotFeedback(scenario, result)
  const { selected, best } = result
  const sameShot = selected.plan.id === best.plan.id
  const rows = [
    { label: 'Full objective', yours: percent(selected.successRate), best: percent(best.successRate) },
    { label: 'Legal pot', yours: percent(selected.legalPotRate), best: percent(best.legalPotRate) },
    { label: 'Scratch', yours: percent(selected.scratchRate), best: percent(best.scratchRate) },
    { label: scenario.objective ? 'In shared zone' : 'In intended finish', yours: percent(selected.positionRate), best: percent(best.positionRate) },
    ...(scenario.objective ? [{ label: `Next shot · ball ${scenario.objective.nextBallId}`, yours: percent(selected.nextShotRate ?? 0), best: percent(best.nextShotRate ?? 0) }] : []),
  ]
  return <>
    <div className="modal-symbol"><MessageCircle size={25} /></div>
    <DialogTitle ref={headingRef} tabIndex={-1}>{feedback.title}</DialogTitle>
    <DialogDescription>{feedback.summary}</DialogDescription>
    <div className="feedback-plans">
      {[{ label: 'Your choice', shot: selected }, { label: sameShot ? 'Best · your choice' : 'Best offered shot', shot: best }].map(({ label, shot }) => <div key={label}>
        <span>{label}</span><strong>{shotLabel(shot.plan)} · {finishLabel(shot.plan.id)}</strong>
        <small>{verticalSpinDescription(shot.plan)}<br />{englishDescription(shot.plan)}<br />{shot.plan.speed.toFixed(2)} m/s</small>
      </div>)}
    </div>
    <p className="feedback-evidence">{ENGLISH_EXPLANATION}</p>
    <div className="feedback-reasons">{feedback.reasons.map(reason => <section key={reason.title}>
      <h3>{reason.title}</h3><p>{reason.detail}</p>
    </section>)}</div>
    {feedback.tradeoff && <p className="feedback-tradeoff"><strong>The tradeoff. </strong>{feedback.tradeoff}</p>}
    <table className="feedback-table" aria-label="Your shot compared with the best shot">
      <thead><tr><th scope="col">In the trials</th><th scope="col">Your choice</th><th scope="col">Best</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.yours}</td><td>{row.best}</td></tr>)}</tbody>
    </table>
    <p className="feedback-evidence">{result.samples} trials per shot, using the same variations for your player. Rates overlap; full success requires every condition in the same trial.{!scenario.objective && ' Each option has its own intended finish.'}{!sameShot && ' The comparison tests the complete strokes, so the advantage cannot be assigned to spin alone.'}{feedback.kind === 'close' && ' A small sampled edge is not a guaranteed advantage on every attempt.'}</p>
    <p className="feedback-takeaway">{feedback.takeaway}</p>
    <div className="dialog-actions feedback-actions"><Button variant="outline" onClick={onClose}>Back to comparison</Button><Button onClick={onReplay}>Watch the best shot <ArrowRight size={15} /></Button></div>
  </>
}
