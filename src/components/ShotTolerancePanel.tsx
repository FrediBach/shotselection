import { useState } from 'react'
import { ArrowLeftRight, LoaderCircle } from 'lucide-react'
import type { Scenario, ShotAnalysis, ShotTolerance } from '@/engine/types'
import { Button } from '@/components/ui/button'
import ToleranceVolume from './ToleranceVolume'
import ShotToleranceMargins from './ShotToleranceMargins'
import { useShotTolerances } from './useShotTolerances'
import './ShotTolerancePanel.css'

interface Props {
  scenario: Scenario
  shot: ShotAnalysis
  best: ShotAnalysis
  shotLabel: string
  bestLabel: string
  isSelection: boolean
}

function ToleranceComparisonVolume({ scenario, shot, best, shotLabel, bestLabel, isSelection, inspected, ideal }: Props & { inspected?: ShotTolerance; ideal?: ShotTolerance }) {
  const [volumeChoice, setVolumeChoice] = useState<'inspected' | 'best'>('inspected')
  const sameShot = shot.plan.id === best.plan.id

  const graphShot = volumeChoice === 'best' ? best : shot
  const graph = volumeChoice === 'best' ? ideal : inspected
  const graphLabel = volumeChoice === 'best' ? `Best shot · ${bestLabel}` : `${isSelection ? 'Your selection' : 'Inspected shot'} · ${shotLabel}`

  return <div className="tolerance-combinations">
    <div className="tolerance-card-heading"><h3>Change all three together</h3></div>
    {scenario.finalBall ? <p className="tolerance-condition">The 3D view requires a settled legal pot of the final ball with no scratch. The cue can finish anywhere; no target accuracy is scored. Follow/draw stays fixed.</p> : <>
    <p className="tolerance-condition">The 3D view always requires {scenario.trick ? 'the complete trick' : 'a legal pot'} <em>and</em> a cue-ball finish inside the target{scenario.objective ? ` with a clear next shot on ball ${scenario.objective.nextBallId}` : ""}. Follow/draw stays fixed for each shot.{scenario.plannedMovement && ` Success also requires the ordered cue contact with ball ${scenario.plannedMovement.blockerId}, moving it at least 3 cm and opening a route blocked by its original position.`}{scenario.trick && ` ${scenario.trick.description} Every required pot, contact and cushion rebound must succeed together.`}{scenario.plant && ` This view tracks ball ${graphShot.plan.potBallId ?? graphShot.plan.ballId} for the pot.`}</p>
    </>}
    {!sameShot && <div className="tolerance-segment volume-choice" role="group" aria-label="Shot shown in volume"><button aria-pressed={volumeChoice === 'inspected'} onClick={() => setVolumeChoice('inspected')}>Inspected volume</button><button aria-pressed={volumeChoice === 'best'} onClick={() => setVolumeChoice('best')}>Best volume</button></div>}
    {graph ? <ToleranceVolume key={graph.planId} tolerance={graph} label={graphLabel} /> : <div className="tolerance-graph-placeholder"><ArrowLeftRight size={28} /><p>Mapping angle, English, and strength…</p><span>Each point is a simulated stroke.</span></div>}
  </div>
}

export default function ShotTolerancePanel({ scenario, shot, best, shotLabel, bestLabel, isSelection }: Props) {
  const { inspected, ideal, loading, error, retry } = useShotTolerances(scenario, shot, best)

  return <section className="tolerance-section" aria-label="Shot tolerance comparison">
    <div className="section-heading"><div><div className="eyebrow"><ArrowLeftRight size={12} /> THE MARGIN FOR ERROR</div><h2>How much room does this shot give you?</h2></div><span className="tolerance-radius">{scenario.finalBall ? 'Final ball · no position target' : scenario.objective?.regions ? `Two separate targets · ${(scenario.objective.radius * 100).toFixed(1)} cm radius each` : scenario.objective?.ellipse ? `Target ellipse · ${(scenario.objective.ellipse.longRadius * 200).toFixed(1)} × ${(scenario.objective.radius * 200).toFixed(1)} cm` : `Target radius · ${Math.round((inspected?.positionTolerance ?? ideal?.positionTolerance ?? 0) * 100) || '…'} cm`}</span></div>
    <p className="tolerance-intro">Move away from the planned stroke and see what still works. Compare the shot you’re inspecting with the best offered choice from this round.</p>
    <div className="tolerance-layout">
      <ShotToleranceMargins scenario={scenario} shot={shot} best={best} shotLabel={shotLabel} bestLabel={bestLabel} isSelection={isSelection} inspected={inspected} ideal={ideal} />
      <ToleranceComparisonVolume scenario={scenario} shot={shot} best={best} shotLabel={shotLabel} bestLabel={bestLabel} isSelection={isSelection} inspected={inspected} ideal={ideal} />
    </div>
    {loading && <div role="status" className="tolerance-status"><LoaderCircle size={15} className="spin" /><span>{inspected ? 'Comparing the best shot’s margins…' : 'Testing stroke limits and combinations…'} You can keep exploring the table.</span></div>}
    {error && <div role="alert" className="tolerance-error"><p>{error}</p><Button variant="outline" size="sm" onClick={retry}>Retry margins</Button></div>}
  </section>
}
