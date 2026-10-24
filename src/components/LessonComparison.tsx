import ConditionRobustnessComparison from './ConditionRobustnessComparison'
import EquipmentRepairComparison from './EquipmentRepairComparison'
import DragDriftComparison from './DragDriftComparison'
import SlickPatchComparison from './SlickPatchComparison'
import DirtyContactComparison from './DirtyContactComparison'
import HouseCueComparison from './HouseCueComparison'
import HealthyRailComparison from './HealthyRailComparison'
import PatchRouteComparison from './PatchRouteComparison'
import SlowDriftComparison from './SlowDriftComparison'
import ClothComparison from './ClothComparison'
import TwoObjectBankComparison from './TwoObjectBankComparison'
import DoubleKissComparison from './DoubleKissComparison'
import ObjectBankComparison from './ObjectBankComparison'
import DrawReturnComparison from './DrawReturnComparison'
import KissPathComparison from './KissPathComparison'
import SplitPathsComparison from './SplitPathsComparison'
import ContactChainComparison from './ContactChainComparison'
import LandingRecoveryComparison from './LandingRecoveryComparison'
import FinalBallComparison from './FinalBallComparison'
import PlayerProfileComparison from './PlayerProfileComparison'
import PlannedMovementComparison from './PlannedMovementComparison'
import DefensiveOutcomeComparison from './DefensiveOutcomeComparison'
import DisconnectedPositionComparison from './DisconnectedPositionComparison'
import MirrorEnglishComparison from './MirrorEnglishComparison'
import StrengthAsymmetryComparison from './StrengthAsymmetryComparison'
import ConditionalContinuationComparison from './ConditionalContinuationComparison'
import AssignmentFailureComparison from './AssignmentFailureComparison'
import PlantSetupComparison from './PlantSetupComparison'
import PlantQualityComparison from './PlantQualityComparison'
import PlantFailureComparison from './PlantFailureComparison'
import PlantGapComparison from './PlantGapComparison'
import PlantThrowComparison from './PlantThrowComparison'
import PlantDistanceComparison from './PlantDistanceComparison'
import PlantDeliveryComparison from './PlantDeliveryComparison'
import PlantMarginComparison from './PlantMarginComparison'
import PlantLineComparison from './PlantLineComparison'
import PlantIntroduction from './PlantIntroduction'
import KickFinalComparison from './KickFinalComparison'
import KickErrorComparison from './KickErrorComparison'
import KickMiddleComparison from './KickMiddleComparison'
import KickSequenceComparison from './KickSequenceComparison'
import KickFinishComparison from './KickFinishComparison'
import KickCorridorComparison from './KickCorridorComparison'
import KickSpinComparison from './KickSpinComparison'
import KickPaceComparison from './KickPaceComparison'
import KickContactComparison from './KickContactComparison'
import KickIntroduction from './KickIntroduction'
import ElongatedPositionComparison from './ElongatedPositionComparison'
import EnglishRoutingComparison from './EnglishRoutingComparison'
import CorridorCenterComparison from './CorridorCenterComparison'
import ReturnLaneComparison from './ReturnLaneComparison'
import CollisionAssistanceComparison from './CollisionAssistanceComparison'
import OpenCorridorComparison from './OpenCorridorComparison'
import PocketChangeComparison from './PocketChangeComparison'
import SpareGrazeComparison from './SpareGrazeComparison'
import MovingTrafficComparison from './MovingTrafficComparison'
import BallWidthComparison from './BallWidthComparison'
import FallbackPlanComparison from './FallbackPlanComparison'
import SequenceReliabilityComparison from './SequenceReliabilityComparison'
import SteppingStoneComparison from './SteppingStoneComparison'
import ZoneExitComparison from './ZoneExitComparison'
import LookAheadComparison from './LookAheadComparison'
import KeyBallComparison from './KeyBallComparison'
import SignedAngleComparison from './SignedAngleComparison'
import DrawDecayComparison from './DrawDecayComparison'
import ContactAccessComparison from './ContactAccessComparison'
import AngleTrapComparison from './AngleTrapComparison'
import PositionLessonComparison from './PositionLessonComparison'
import EverydayExperiment from './EverydayExperiment'
import NearTieComparison from './NearTieComparison'
import GeometryLessonComparison from './GeometryLessonComparison'
import { isGeometryComparison } from '@/engine/shot-geometry'
import { useState } from 'react'
import type { PreparedRound, RoundAnalysis, Scenario, ShotAnalysis, Vec2 } from '@/engine/types'
import { nextShotBlockerEvidence, postContactRebounds } from '@/engine/lesson-evidence'
import { POCKET_GEOMETRY } from '@/engine/table-geometry'
import { Button } from './ui/button'

const points = (path: Vec2[]) => path.map(p => `${p.x},${p.y}`).join(' ')

function EvidenceDiagram({ scenario, shot }: { scenario: Scenario; shot: ShotAnalysis }) {
  const traffic = scenario.curriculum?.learning?.comparison === 'next-shot-blocker'
  const sim = shot.nominal
  const evidence = nextShotBlockerEvidence(scenario, sim)
  const balls = traffic ? sim.finalBalls.filter(ball => !ball.pocketed) : scenario.balls
  const cue = balls.find(ball => ball.id === 0)!
  const next = balls.find(ball => ball.id === scenario.objective?.nextBallId)
  return <svg viewBox="-.08 -.08 2.70 1.43" role="img" aria-label={traffic ? 'Settled layout: solid routes are available; dashed routes are blocked by spare balls.' : 'Measured cue path in cyan and object path in gold; rings mark cue-ball rebounds after contact.'}>
    <rect width="2.54" height="1.27" rx=".04" fill="#143f38" />
    {POCKET_GEOMETRY.map(p => <circle key={p.id} cx={p.center.x} cy={p.center.y} r=".045" fill="#071e1b" />)}
    {traffic && next ? <>{evidence.withoutSpareBalls.map(route => <polyline key={route.pocketId} points={points([cue.position, route.ghost, next.position, POCKET_GEOMETRY[route.pocketId].center])} fill="none" stroke={evidence.blockedRoutes.some(r => r.pocketId === route.pocketId) ? '#ffc16e' : '#7de3ef'} strokeWidth=".012" strokeDasharray={evidence.blockedRoutes.some(r => r.pocketId === route.pocketId) ? '.04 .025' : undefined} />)}</> : <>
      <polyline points={points(sim.cuePath)} fill="none" stroke="#7de3ef" strokeWidth=".012" />
      <polyline points={points(sim.objectPath)} fill="none" stroke="#ffc16e" strokeWidth=".012" />
      {postContactRebounds(sim).map((event, i) => <circle key={i} cx={event.position.x} cy={event.position.y} r=".045" fill="none" stroke="white" strokeWidth=".008" />)}
    </>}
    {balls.map(ball => <g key={ball.id}><circle cx={ball.position.x} cy={ball.position.y} r=".029" fill={ball.id === 0 ? '#fff' : '#ffc16e'} /><text x={ball.position.x} y={ball.position.y + .014} textAnchor="middle" fontSize=".042" fill="#071e1b">{ball.id || ''}</text></g>)}
  </svg>
}

/** Prediction stays local to this round and never gates course advancement. */
export default function LessonComparison({ prepared, result, hidden, busy }: { prepared: PreparedRound; result: RoundAnalysis | null; hidden: boolean; busy: boolean }) {
  const [prediction, setPrediction] = useState<string | null>(null)
  const [checkingAgain, setCheckingAgain] = useState(false)
  const { scenario } = prepared
  const comparison = scenario.curriculum?.learning?.comparison
  if (!comparison || comparison === 'corridor-diagnosis' || comparison === 'nominated-next-ball' || comparison === 'intended-next-pocket' || comparison === 'shortlist' || comparison === 'backward-plan') return null
  if (comparison === 'defensive-outcome') return <DefensiveOutcomeComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'disconnected-position') return <DisconnectedPositionComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'mirror-english') return <MirrorEnglishComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'strength-asymmetry') return <StrengthAsymmetryComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'conditional-continuation') return <ConditionalContinuationComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'assignment-failure') return <AssignmentFailureComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-setup') return <PlantSetupComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-quality') return <PlantQualityComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-failure') return <PlantFailureComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-gap') return <PlantGapComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-throw') return <PlantThrowComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-distance') return <PlantDistanceComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-delivery') return <PlantDeliveryComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-margin') return <PlantMarginComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-line') return <PlantLineComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'plant-introduction') return <PlantIntroduction prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-final') return <KickFinalComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-error') return <KickErrorComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-middle') return <KickMiddleComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-sequence') return <KickSequenceComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-finish') return <KickFinishComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-corridor') return <KickCorridorComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-spin') return <KickSpinComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-pace') return <KickPaceComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-contact') return <KickContactComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'kick-introduction') return <KickIntroduction prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'elongated-position') return <ElongatedPositionComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'english-routing') return <EnglishRoutingComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'corridor-center') return <CorridorCenterComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'return-lane') return <ReturnLaneComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'two-object-bank') return <TwoObjectBankComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'double-kiss') return <DoubleKissComparison prepared={prepared} result={result} hidden={hidden} busy={busy} />
  if (comparison === 'object-bank') return <ObjectBankComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'draw-return') return <DrawReturnComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'kiss-path') return <KissPathComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'split-paths') return <SplitPathsComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'condition-robustness') return <ConditionRobustnessComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'equipment-repair') return <EquipmentRepairComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'drag-drift') return <DragDriftComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'slick-patch') return <SlickPatchComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'dirty-contact') return <DirtyContactComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'house-cue') return <HouseCueComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'healthy-rail') return <HealthyRailComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'patch-route') return <PatchRouteComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'slow-drift') return <SlowDriftComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'cloth-drag') return <ClothComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'carom-plant' || comparison === 'contact-chain' || comparison === 'carom-contact' || comparison === 'follow-contact') return <ContactChainComparison prepared={prepared} result={result} hidden={hidden} />
  if (comparison === 'landing-recovery') return <LandingRecoveryComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'final-ball') return <FinalBallComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'player-profile') return <PlayerProfileComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'planned-movement') return <PlannedMovementComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'collision-assistance') return <CollisionAssistanceComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'open-corridor') return <OpenCorridorComparison prepared={prepared} result={result} busy={busy} />
  if (comparison === 'pocket-change') return <PocketChangeComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'spare-graze') return <SpareGrazeComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'moving-traffic') return <MovingTrafficComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'ball-width') return <BallWidthComparison prepared={prepared} result={result} busy={busy} />
  if (comparison === 'fallback-plan') return <FallbackPlanComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'sequence-reliability') return <SequenceReliabilityComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'stepping-stone') return <SteppingStoneComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'zone-exit') return <ZoneExitComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'look-ahead' || comparison === 'angle-travel') return <LookAheadComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (comparison === 'key-ball') return <KeyBallComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (prepared.signedAnglePreview) return <SignedAngleComparison prepared={prepared} result={result} hidden={hidden} busy={busy} />
  if (prepared.drawDecay) return <DrawDecayComparison prepared={prepared} result={result} hidden={hidden} busy={busy} />
  if (comparison === 'contact-access') return <ContactAccessComparison prepared={prepared} result={result} hidden={hidden} busy={busy} />
  if (comparison === 'next-angle-trap' || comparison === 'position-overshoot') return <AngleTrapComparison prepared={prepared} result={result} hidden={hidden} busy={busy} />
  if (comparison === 'contact-roll' || comparison === 'zone-margin') return <PositionLessonComparison prepared={prepared} result={result} busy={busy} hidden={hidden} />
  if (prepared.experiment) return <EverydayExperiment prepared={prepared} result={result} busy={busy} />
  if (comparison === 'near-tie') return <NearTieComparison result={result} />
  // Geometry compares both openers, so it is visible during the ball step too.
  if (isGeometryComparison(comparison)) return <GeometryLessonComparison prepared={prepared} result={result} busy={busy} />
  const options = prepared.balls[0].options
  const shots = result ? options.map(option => result.candidates.find(shot => shot.plan.id === option.id)!) : []
  const cut = comparison === 'cut-paths'
  const rebound = comparison === 'cue-rebound'
  const choices = cut ? [{ id: 'pocket', label: 'Object-to-pocket line' }, { id: 'approach', label: 'Cue-ball approach line' }] : options.map(option => ({ id: option.id, label: `Stroke ${option.label}` }))
  const answers = cut ? ['pocket'] : shots.filter(shot => rebound ? postContactRebounds(shot.nominal).length > 0 : (() => {
    const evidence = nextShotBlockerEvidence(scenario, shot.nominal)
    return evidence.routes.length === 0 && evidence.blockedRoutes.length > 0
  })()).map(shot => shot.plan.id)
  const revealed = Boolean(result) && !checkingAgain
  return <section className="lesson-comparison" aria-label="Lesson comparison" hidden={hidden}>
    <h3>{revealed ? 'Check your prediction' : 'Predict before the reveal'}</h3>
    <p>{cut ? 'After contact, which line should the object ball follow into the side pocket?' : rebound ? 'Which stroke sends the cue ball to a cushion after hitting the object ball? Choose any one that does.' : 'Which stroke leaves no next-shot route because spare balls block it? Choose any one that does.'}</p>
    <div className="lesson-predictions" role="group" aria-label="Your prediction">{choices.map(choice => <Button key={choice.id} size="sm" variant={prediction === choice.id ? 'default' : 'outline'} aria-pressed={prediction === choice.id} disabled={busy || revealed} onClick={() => { setPrediction(choice.id); if (checkingAgain) setCheckingAgain(false) }}>{choice.label}</Button>)}</div>
    {revealed && <div aria-live="polite">
      <p><strong>{prediction === null ? 'Compare the measured routes.' : answers.includes(prediction) ? 'Your prediction matches the simulation.' : 'Take another look at the measured routes.'}</strong> {cut ? 'All three strokes use the same side pocket and contact line. Cyan shows the cue ball; gold shows the object ball. Pace and spin vary together here, so this is a comparison of complete strokes.' : rebound ? 'The rings mark actual cue-ball rebounds after contact. An object-ball cushion does not count. Follow the cyan path beyond the ring to see the outgoing direction.' : 'Solid cyan lines are permitted next-shot routes. Dashed gold lines become available only when spare balls are removed from the same settled position. These are geometric routes within the cut limit, not guaranteed pots.'}</p>
      {shots.map((shot, index) => {
        const evidence = nextShotBlockerEvidence(scenario, shot.nominal)
        return <figure key={shot.plan.id}><figcaption>Stroke {options[index].label}{rebound ? ` · ${postContactRebounds(shot.nominal).length} cue-ball rebounds after contact` : !cut ? ` · ${evidence.routes.length} routes; ${evidence.withoutSpareBalls.length} without spare balls` : ''}</figcaption><EvidenceDiagram scenario={scenario} shot={shot} /></figure>
      })}
      <Button variant="outline" size="sm" onClick={() => { setPrediction(null); setCheckingAgain(true) }}>Try the prediction again</Button>
      <p className="lesson-comparison-note">This check is practice. You can continue regardless of your answer.</p>
    </div>}
  </section>
}
