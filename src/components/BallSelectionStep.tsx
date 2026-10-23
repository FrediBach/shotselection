import type { RefObject } from 'react'
import { Check, MousePointer2 } from 'lucide-react'
import type { Scenario } from '@/engine/types'
import BallIcon from './BallIcon'

interface Props {
  scenario: Scenario
  selectedBall: number | null
  selectableBallIds: number[]
  preparing: boolean
  ready: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  ballChoiceLabel: (id: number) => string
  onSelect: (id: number) => void
}

function unavailableBallReason({ objective, bank, plant }: Scenario, id: number) {
  if (objective) return id === objective.nextBallId ? 'Reserved for your next shot' : 'Traffic: read the route around this ball'
  if (bank) return 'Blocker: bank around this ball to reach the target'
  if (plant) return `Plant target: pot this ball by playing ball ${plant.ballId} first`
  return 'No three playable finishes found for this ball'
}

function ballSelectionLabel({ plant }: Scenario, id: number) {
  if (!plant) return `Select ball ${id}`
  if (id === plant.ballId) return `Select plant ${id} to ${plant.targetBallId}`
  if (id === plant.targetBallId) return `Plant target ball ${id}`
  return `Select free ball ${id}`
}

function ballSelectionCopy({ objective, bank, plant }: Scenario, ballCount: number) {
  return {
    description: objective ? `Play ball ${objective.ballId} first. Keep ball ${objective.nextBallId} on the table for your next shot.` : bank ? `Reach ball ${bank.ballId} after at least ${bank.minCushions} cushion${bank.minCushions === 1 ? "" : "s"}, then pot it.` : plant ? `Play ball ${plant.ballId} into ball ${plant.targetBallId} for the plant, or attempt a difficult free ball. Read both contact lines before choosing.` : ballCount === 1 ? "Start with this object ball, then compare three ways to control the cue-ball finish." : "Which ball gives you the most room for error?",
    unavailable: objective ? "The next ball and traffic balls are reserved for this lesson." : bank ? "Dimmed balls are blockers. Ball 1 is the target for this lesson." : plant ? `Ball ${plant.targetBallId} is the plant target. Select ball ${plant.ballId} to attempt the plant.` : "Dimmed balls have no set of three playable finishes.",
    hint: objective ? "Select the first ball, then compare the strokes that could leave position for the next." : plant ? "Select the plant or a free ball, then compare the stroke and finish options. The plant is an attempt; its pot is not guaranteed." : "Choose a ball here or directly on the table. Then move on to its finish positions.",
  }
}

function BallChoice({ ball, scenario, selected, selectable, preparing, ready, ballChoiceLabel, onSelect }: Pick<Props, 'scenario' | 'preparing' | 'ready' | 'ballChoiceLabel' | 'onSelect'> & {
  ball: Scenario['balls'][number]
  selected: boolean
  selectable: boolean
}) {
  const { objective, plant } = scenario
  return <button className={`ball-choice ${selected ? 'selected' : ''}`} onClick={() => onSelect(ball.id)} disabled={preparing || !selectable} title={ready && !selectable ? unavailableBallReason(scenario, ball.id) : `Choose ${ballChoiceLabel(ball.id).toLowerCase()}`} aria-pressed={selected} aria-label={ballSelectionLabel(scenario, ball.id)}><BallIcon id={ball.id} /><span>{plant ? ballChoiceLabel(ball.id) : `${objective?.nextBallId === ball.id ? 'Next' : 'Ball'} ${ball.id}`}</span>{selected && <span className="ball-check"><Check size={10} /></span>}</button>
}

export default function BallSelectionStep({ scenario, selectedBall, selectableBallIds, preparing, ready, headingRef, ballChoiceLabel, onSelect }: Props) {
  const objectBalls = scenario.balls.filter(ball => ball.id > 0)
  const { description, unavailable, hint } = ballSelectionCopy(scenario, objectBalls.length)
  const selectableBalls = new Set(selectableBallIds)
  const singleChoice = ready && !preparing && selectableBallIds.length === 1
  return <>
    <h2 ref={headingRef} tabIndex={-1}>Choose your ball.</h2>
    <p className="panel-description">{description}</p>
    <div className="ball-choices" role="group" aria-label="Object ball choices">{objectBalls.map(ball => <BallChoice key={ball.id} ball={ball} scenario={scenario} selected={selectedBall === ball.id} selectable={selectableBalls.has(ball.id)} preparing={preparing} ready={ready} ballChoiceLabel={ballChoiceLabel} onSelect={onSelect} />)}</div>
    {ready && selectableBallIds.length < objectBalls.length && <p className="unavailable-note">{unavailable}</p>}
    <div className="wizard-hint"><MousePointer2 size={17} /><p>{singleChoice ? `${ballChoiceLabel(selectableBallIds[0])} is the only playable ball and is selected automatically. Choose a stroke when you’re ready.` : hint}</p></div>
  </>
}
