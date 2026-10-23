import { ChevronRight, FlaskConical, Play } from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import BallIcon from './BallIcon'
import { evaluateShotObjective, scoreSelection } from '@/engine'
import type { Scenario, ShotAnalysis, RoundAnalysis, ShotPlan } from '@/engine/types'
import { percent, englishDescription, verticalSpinDescription } from '@/lib/shot-presentation'

interface Props {
  result: RoundAnalysis
  scenario: Scenario
  inspected: ShotAnalysis | null
  playerName: string
  showEnsemble: boolean
  showFinishes: boolean
  playing: boolean
  showPlannedFinish: boolean
  onShowEnsemble: (show: boolean) => void
  onShowFinishes: (show: boolean) => void
  onInspect: (shot: ShotAnalysis) => void
  onPlay: (shot: ShotAnalysis) => void
  shotLabel: (plan: ShotPlan) => string
  finishLabel: (id: string) => string
}

function ScorePlacement({ shot, candidates }: { shot: ShotAnalysis; candidates: ShotAnalysis[] }) {
  const scoring = scoreSelection(shot, candidates)
  return <p className="analysis-placement"><span>{scoring.tiedCount > 1 ? 'Joint rank' : 'Rank'} {scoring.rank} of {scoring.candidateCount}</span><strong>{scoring.points} / 100</strong></p>
}

function ShotComparisonCard({ shot, candidates, active, isSelection, isBest, isPlant, isTrick, hasObjective, shotLabel, finishLabel, onInspect }: Pick<Props, 'shotLabel' | 'finishLabel' | 'onInspect'> & {
  shot: ShotAnalysis
  candidates: ShotAnalysis[]
  active: boolean
  isSelection: boolean
  isBest: boolean
  isPlant: boolean
  isTrick: boolean
  hasObjective: boolean
}) {
  return <button className={`analysis-card ${active ? 'analysis-active' : ''}`} aria-pressed={active} onClick={() => onInspect(shot)}>
    <div className="analysis-card-title"><BallIcon id={shot.plan.potBallId ?? shot.plan.ballId} small /><strong>{isSelection ? `Your selection${isPlant || isTrick ? ` · ${shotLabel(shot.plan)}` : ''} · ${finishLabel(shot.plan.id)}` : `${shotLabel(shot.plan)} · ${finishLabel(shot.plan.id)}`}</strong>{isBest ? <span className="best-tag">BEST SHOT</span> : <ChevronRight size={15} />}</div>
    <ScorePlacement shot={shot} candidates={candidates} />
    <p className="analysis-stroke">{shot.plan.speed.toFixed(2)} m/s · {verticalSpinDescription(shot.plan)}<br />{englishDescription(shot.plan)}</p>
    <div className="analysis-rate">{percent(shot.successRate)}<span>successful outcomes</span></div>
    <div className="rate-track"><span style={{ width: percent(shot.successRate) }} /></div>
    <div className="analysis-metrics"><span>{isTrick ? 'All pots' : `Pot${isPlant ? ` ${shot.plan.potBallId ?? shot.plan.ballId}` : ''}`} <strong>{percent(shot.potRate)}</strong></span>{isTrick && <span>Legal trick <strong>{percent(shot.legalPotRate)}</strong></span>}<span>Scratch <strong>{percent(shot.scratchRate)}</strong></span><span>Spread <strong>{(shot.spread * 100).toFixed(1)} cm</strong></span>{hasObjective && <><span>In zone <strong>{percent(shot.positionRate)}</strong></span><span>Next shot <strong>{percent(shot.nextShotRate ?? 0)}</strong></span></>}</div>
  </button>
}

function PlannedOutcome({ scenario, inspected, finishLabel, showPlannedFinish }: Pick<Props, 'scenario' | 'inspected' | 'finishLabel' | 'showPlannedFinish'>) {
  const inspectedOutcome = (scenario.objective || scenario.trick) && inspected ? evaluateShotObjective(scenario, inspected.plan, inspected.nominal) : null
  if (scenario.trick && inspected && inspectedOutcome) return <div className="stroke-outcome" role="region" aria-label="Planned stroke outcome"><span className="lesson-goal-label">STROKE {finishLabel(inspected.plan.id)} · PLANNED RESULT</span><strong>{inspectedOutcome.success ? 'The trick is complete, with the cue-ball finish controlled.' : inspectedOutcome.legalPot ? 'The trick is complete, but the cue ball misses its intended finish.' : 'The planned stroke does not complete the full trick.'}</strong><p>{showPlannedFinish ? `The pale gold cross marks the planned cue-ball finish. ` : ''}The trial rates show how often the complete trick and intended finish survive small stroke errors.</p></div>
  return <>{inspectedOutcome && inspected && <div className="stroke-outcome" role="region" aria-label="Planned stroke outcome"><span className="lesson-goal-label">STROKE {finishLabel(inspected.plan.id)} · PLANNED RESULT</span><strong>{inspectedOutcome.success ? 'In the zone, with the next shot available.' : !inspectedOutcome.legalPot ? 'The planned stroke does not complete a legal pot.' : !inspectedOutcome.positioned ? 'The cue ball finishes outside the position zone.' : 'Inside the zone, but the next shot is unavailable.'}</strong><p>{showPlannedFinish ? `The pale gold cross marks the planned cue-ball finish, ${(inspectedOutcome.error * 100).toFixed(0)} cm from the zone center. ` : ''}The trial rates above show how often small stroke errors still meet the full objective.</p></div>}</>
}

function EnsembleExplanation({ result, scenario, inspected, showEnsemble, showFinishes, playing, onPlay }: Pick<Props, 'result' | 'scenario' | 'inspected' | 'showEnsemble' | 'showFinishes' | 'playing' | 'onPlay'>) {
  const { objective, bank, plant, trick } = scenario
  return <div className="ensemble-explanation"><FlaskConical size={17} /><p>{inspected?.explanation} <span>{result.samples} seeded trials per shot; {showEnsemble ? `${inspected?.sampleObjectPaths.length ?? 0} object-ball paths and ${inspected?.samplePaths.length ?? 0} cue-ball paths shown.` : 'paths hidden.'} {trick ? `${trick.description} Success requires the complete contact sequence, every required pot, no scratch, and the intended cue-ball finish. The object-ball paths trace ball ${trick.potBallId}; cyan means all required balls dropped with the correct first contact. Replay shows the whole sequence.` : objective ? `Success needs a legal pot, the cyan zone, and a clear route to ball ${objective.nextBallId}.` : bank ? `Success needs ${bank.minCushions} cue-ball cushion contacts before ball ${bank.ballId}, a legal pot, and a safe finish.` : plant ? `A plant must contact ball ${plant.ballId} first and pot ball ${plant.targetBallId}; a free-ball shot must pot its selected ball. Both also need a safe cue-ball finish.` : "A pot can still scratch; success also requires a safe cue-ball finish."}</span>{showFinishes && <span className="finish-explanation">{playing ? 'Finish positions return after replay.' : `Colored rings show every ball’s final position across all ${inspected?.sampleBallEnds.length ?? 0} trials for the inspected shot. Pocketed balls are omitted.`}</span>}</p><Button variant="ghost" size="sm" onClick={() => inspected && onPlay(inspected)} disabled={playing}><Play size={14} /> Replay</Button></div>
}

export default function EnsembleResults({ result, scenario, inspected, playerName, showEnsemble, showFinishes, playing, showPlannedFinish, onShowEnsemble, onShowFinishes, onInspect, onPlay, shotLabel, finishLabel }: Props) {
  return <section className="ensemble-section">
    <div className="section-heading"><div><div className="eyebrow">A SMALL CHANGE. A DIFFERENT OUTCOME.</div><h2>The ensemble tells the story.</h2></div><div className="ensemble-controls" role="group" aria-label="Ensemble display"><label className="ensemble-switch"><Switch checked={showEnsemble} onCheckedChange={onShowEnsemble} aria-label="Show paths" /> Show paths</label><label className="ensemble-switch"><Switch checked={showFinishes} onCheckedChange={onShowFinishes} aria-label="Show finish positions" /> Show finish positions</label></div></div>
    <p className="ensemble-player-note">These ensembles use {playerName}’s angle, English, strength, and draw / follow precision.</p>
    <div className="analysis-grid">{[result.selected, ...result.candidates.filter(shot => shot.plan.id !== result.selected.plan.id)].map((shot, index) => <ShotComparisonCard key={shot.plan.id} shot={shot} candidates={result.candidates} active={inspected === shot} isSelection={index === 0} isBest={shot.plan.id === result.best.plan.id} isPlant={Boolean(scenario.plant)} isTrick={Boolean(scenario.trick)} hasObjective={Boolean(scenario.objective)} shotLabel={shotLabel} finishLabel={finishLabel} onInspect={onInspect} />)}</div>
    <PlannedOutcome scenario={scenario} inspected={inspected} finishLabel={finishLabel} showPlannedFinish={showPlannedFinish} />
    <EnsembleExplanation result={result} scenario={scenario} inspected={inspected} showEnsemble={showEnsemble} showFinishes={showFinishes} playing={playing} onPlay={onPlay} />
  </section>
}
