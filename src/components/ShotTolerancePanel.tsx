import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, LoaderCircle } from 'lucide-react'
import { analyzeShotToleranceAsync } from '@/engine'
import type { Scenario, ShotAnalysis, ShotTolerance, ToleranceAxis, ToleranceBound } from '@/engine/types'
import { Button } from '@/components/ui/button'
import ToleranceVolume from './ToleranceVolume'
import './ShotTolerancePanel.css'

interface Props {
  scenario: Scenario
  shot: ShotAnalysis
  best: ShotAnalysis
  shotLabel: string
  bestLabel: string
  isSelection: boolean
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
  const spin = shot.plan.topSpin
  return <span className="margin-planned-stroke">{shot.plan.speed.toFixed(2)} m/s · {Math.abs(spin) < 0.01 ? 'center ball' : `${Math.round(Math.abs(spin) * 100)}% ${spin < 0 ? 'draw' : 'follow'}`}<br />{shot.plan.sideSpin === 0 ? 'No English' : `${Math.abs(shot.plan.sideSpin).toFixed(1)} rad/s ${shot.plan.sideSpin > 0 ? 'left' : 'right'} English`}</span>
}

export default function ShotTolerancePanel({ scenario, shot, best, shotLabel, bestLabel, isSelection }: Props) {
  const cache = useRef(new Map<string, ShotTolerance>())
  const [analyses, setAnalyses] = useState<Record<string, ShotTolerance>>({})
  const [criterion, setCriterion] = useState<'success' | 'pot'>('success')
  const [volumeChoice, setVolumeChoice] = useState<'inspected' | 'best'>('inspected')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const inspected = analyses[shot.plan.id]
  const ideal = analyses[best.plan.id]
  const sameShot = shot.plan.id === best.plan.id
  const loading = !error && (!inspected || !ideal)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    async function calculate() {
      try {
        for (const candidate of [shot, best]) {
          if (cache.current.has(candidate.plan.id)) continue
          const analysis = await analyzeShotToleranceAsync(scenario, candidate.plan, { signal: controller.signal })
          if (controller.signal.aborted) return
          cache.current.set(candidate.plan.id, analysis)
          setAnalyses(previous => ({ ...previous, [candidate.plan.id]: analysis }))
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The margins could not be calculated.')
      }
    }
    void calculate()
    return () => controller.abort()
  }, [scenario, shot, best, attempt])

  const graph = volumeChoice === 'best' ? ideal : inspected
  const graphLabel = volumeChoice === 'best' ? `Best shot · ${bestLabel}` : `${isSelection ? 'Your selection' : 'Inspected shot'} · ${shotLabel}`

  return <section className="tolerance-section" aria-label="Shot tolerance comparison">
    <div className="section-heading"><div><div className="eyebrow"><ArrowLeftRight size={12} /> THE MARGIN FOR ERROR</div><h2>How much room does this shot give you?</h2></div><span className="tolerance-radius">Target radius · {Math.round((inspected?.positionTolerance ?? ideal?.positionTolerance ?? 0) * 100) || '…'} cm</span></div>
    <p className="tolerance-intro">Move away from the planned stroke and see what still works. Compare the shot you’re inspecting with the best offered choice from this round.</p>
    <div className="tolerance-layout">
      <div className="tolerance-margins">
        <div className="tolerance-card-heading"><h3>One change at a time</h3><div className="tolerance-segment" role="group" aria-label="Margin success condition"><button aria-pressed={criterion === 'success'} onClick={() => setCriterion('success')}>{scenario.objective ? "Full objective" : "Pot + target"}</button><button aria-pressed={criterion === 'pot'} onClick={() => setCriterion('pot')}>Legal pot</button></div></div>
        <p className="tolerance-condition">{criterion === 'success' ? scenario.objective ? `Pot the ${scenario.objective.ballId}, stop inside the zone and leave a clear shot on the ${scenario.objective.nextBallId}.` : 'Pot the ball and stop the cue ball inside the target.' : 'Pot the ball, wherever the cue ball finishes.'} Both require correct first contact, no scratch, and all balls stopped.{scenario.bank && ` Both also require at least ${scenario.bank.minCushions} cue-ball cushion contacts before the target.`}</p>
        <table className="margin-table" aria-label="Stroke tolerance margins">
          <thead><tr><th scope="col">Change</th><th scope="col"><span>Inspected shot</span><strong>{shotLabel}</strong><small>{isSelection ? 'Your selection' : 'Selected for inspection'}</small><PlannedStroke shot={shot} /></th><th scope="col"><span>Best shot</span><strong>{bestLabel}</strong><small>{sameShot ? 'Same shot' : 'Highest ensemble quality'}</small><PlannedStroke shot={best} /></th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{[inspected, ideal].map((analysis, index) => <td key={index}><MarginValue bound={analysis?.axes[row.axis][criterion][row.direction]} axis={row.axis} unit={row.unit} limit={analysis?.volume.limits[row.axis]} valid={criterion === 'success' ? analysis?.nominalSuccess : analysis?.nominalPot} /></td>)}</tr>)}</tbody>
        </table>
        <p className="tolerance-note">Estimated margins from each planned stroke, with the other inputs fixed. Left/right aim is relative to the shot direction. Strength is cue-ball launch speed; English is added side spin in rad/s.</p>
        <p className="tolerance-note">Ranges stop at the first sampled failure. ≥ means the shot still works at the search or modeled speed limit. Small gaps between samples may be missed.</p>
        {sameShot && <p className="tolerance-match">You’re inspecting the best shot, so both columns match.</p>}
      </div>
      <div className="tolerance-combinations">
        <div className="tolerance-card-heading"><h3>Change all three together</h3></div>
        <p className="tolerance-condition">The 3D view always requires a legal pot <em>and</em> a cue-ball finish inside the target{scenario.objective ? ` with a clear next shot on ball ${scenario.objective.nextBallId}` : ""}. Follow/draw stays fixed for each shot.</p>
        {!sameShot && <div className="tolerance-segment volume-choice" role="group" aria-label="Shot shown in volume"><button aria-pressed={volumeChoice === 'inspected'} onClick={() => setVolumeChoice('inspected')}>Inspected volume</button><button aria-pressed={volumeChoice === 'best'} onClick={() => setVolumeChoice('best')}>Best volume</button></div>}
        {graph ? <ToleranceVolume key={graph.planId} tolerance={graph} label={graphLabel} /> : <div className="tolerance-graph-placeholder"><ArrowLeftRight size={28} /><p>Mapping angle, English, and strength…</p><span>Each point is a simulated stroke.</span></div>}
      </div>
    </div>
    {loading && <div role="status" className="tolerance-status"><LoaderCircle size={15} className="spin" /><span>{inspected ? 'Comparing the best shot’s margins…' : 'Testing stroke limits and combinations…'} You can keep exploring the table.</span></div>}
    {error && <div role="alert" className="tolerance-error"><p>{error}</p><Button variant="outline" size="sm" onClick={() => setAttempt(previous => previous + 1)}>Retry margins</Button></div>}
  </section>
}
