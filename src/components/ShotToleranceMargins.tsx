import { scoresPosition } from '../engine/objectives'
import { useState } from 'react'
import { englishDescription, verticalSpinDescription } from '@/lib/shot-presentation'
import type { Scenario, ShotAnalysis, ShotTolerance, ToleranceAxis, ToleranceBound } from '@/engine/types'

interface Props {
  scenario: Scenario
  shot: ShotAnalysis
  best: ShotAnalysis
  shotLabel: string
  bestLabel: string
  isSelection: boolean
  inspected?: ShotTolerance
  ideal?: ShotTolerance
}

const rows: { label: string; axis: ToleranceAxis; direction: 'negative' | 'positive'; unit: string }[] = [
  { label: 'Aim left', axis: 'angle', direction: 'negative', unit: '°' },
  { label: 'Aim right', axis: 'angle', direction: 'positive', unit: '°' },
  { label: 'Left English', axis: 'sideSpin', direction: 'positive', unit: ' rad/s' },
  { label: 'Right English', axis: 'sideSpin', direction: 'negative', unit: ' rad/s' },
  { label: 'Softer stroke', axis: 'speed', direction: 'negative', unit: '%' },
  { label: 'Harder stroke', axis: 'speed', direction: 'positive', unit: '%' },
]

function MarginValue({ bound, axis, unit, limit, valid }: { bound?: ToleranceBound; axis: ToleranceAxis; unit: string; limit?: number; valid?: boolean }) {
  if (!bound || limit === undefined) return <span className="margin-pending" aria-label="Calculating">—</span>
  if (!valid) return <span className="margin-pending">No margin</span>
  // Round down: the displayed accepted offset must not exceed a passing probe.
  const precision = axis === 'angle' ? 100 : 10
  const value = (Math.floor((bound.value + 1e-9) * precision) / precision).toFixed(axis === 'angle' ? 2 : 1)
  return <div className="margin-value"><strong>{bound.limited ? '≥ ' : ''}{value}{unit}</strong><span className="margin-track" aria-hidden="true"><span style={{ width: `${Math.min(100, bound.value / limit * 100)}%` }} /></span></div>
}

function PlannedStroke({ shot }: { shot: ShotAnalysis }) {
  return <span className="margin-planned-stroke">{shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}<br />{englishDescription(shot.plan)}</span>
}

export default function ShotToleranceMargins({ scenario, shot, best, shotLabel, bestLabel, isSelection, inspected, ideal }: Props) {
  const [criterion, setCriterion] = useState<'success' | 'pot'>('success')
  const sameShot = shot.plan.id === best.plan.id

  return <div className="tolerance-margins">
    <div className="tolerance-card-heading"><h3>One change at a time</h3><div className="tolerance-segment" role="group" aria-label="Margin success condition"><button aria-pressed={criterion === 'success'} onClick={() => setCriterion('success')}>{!scoresPosition(scenario) ? "Legal pot success" : scenario.objective || scenario.trick ? "Full objective" : "Pot + target"}</button><button aria-pressed={criterion === 'pot'} onClick={() => setCriterion('pot')}>{scenario.trick ? 'Legal trick' : 'Legal pot'}</button></div></div>
    <p className="tolerance-condition">{!scoresPosition(scenario) ? 'Full success and legal-pot success are the same: the cue may stop anywhere on the table.' : scenario.trick ? `${scenario.trick.description} ${criterion === 'success' ? 'Complete the sequence and stop the cue ball inside the target.' : 'Complete the sequence, wherever the cue ball finishes.'}` : criterion === 'success' ? scenario.objective ? `Pot the ${scenario.objective.ballId}, stop inside the zone and leave a clear shot on the ${scenario.objective.nextBallId}.` : 'Pot the ball and stop the cue ball inside the target.' : 'Pot the ball, wherever the cue ball finishes.'} Both require correct first contact, no scratch, and all balls stopped.{scenario.bank && ` Both also require at least ${scenario.bank.minCushions} cue-ball cushion contacts before the target.`}{scenario.plant && ` For the plant, contact ball ${scenario.plant.ballId} first and pot ball ${scenario.plant.targetBallId}; for a free ball, contact and pot that ball.`}</p>
    <table className="margin-table" aria-label="Stroke tolerance margins">
      <thead><tr><th scope="col">Change</th><th scope="col"><span>Inspected shot</span><strong>{shotLabel}</strong><small>{isSelection ? 'Your selection' : 'Selected for inspection'}</small><PlannedStroke shot={shot} /></th><th scope="col"><span>Best shot</span><strong>{bestLabel}</strong><small>{sameShot ? 'Same shot' : 'Highest ensemble quality'}</small><PlannedStroke shot={best} /></th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{[{ role: 'inspected', analysis: inspected }, { role: 'best', analysis: ideal }].map(({ role, analysis }) => <td key={role}><MarginValue bound={analysis?.axes[row.axis][criterion][row.direction]} axis={row.axis} unit={row.unit} limit={analysis?.volume.limits[row.axis]} valid={criterion === 'success' ? analysis?.nominalSuccess : analysis?.nominalPot} /></td>)}</tr>)}</tbody>
    </table>
    <p className="tolerance-note">Estimated margins from each planned stroke, with the other inputs fixed. Left/right aim is relative to the shot direction. Strength is cue-ball launch speed; English is added side spin in rad/s.</p>
    <p className="tolerance-note">Ranges stop at the first sampled failure. ≥ means the shot still works at the search or modeled speed limit. Small gaps between samples may be missed.</p>
    {sameShot && <p className="tolerance-match">You’re inspecting the best shot, so both columns match.</p>}
  </div>
}
