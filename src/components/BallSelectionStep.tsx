import type { RefObject } from 'react'
import { Check, MousePointer2 } from 'lucide-react'
import type { Scenario } from '@/engine/types'
import BallIcon from './BallIcon'

interface Props {
  reservedBallId?: number | null;
  scenario: Scenario
  selectedBall: number | null
  selectableBallIds: number[]
  preparing: boolean
  ready: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  ballChoiceLabel: (id: number) => string
  onSelect: (id: number) => void
}

function unavailableBallReason({ objective, bank, plant, trick }: Scenario, id: number) {
  if (trick) return `Part of the trick: play ball ${trick.ballId} first`
  if (objective) return id === objective.nextBallId ? 'Reserved for your next shot' : 'Traffic: read the route around this ball'
  if (bank) return 'Blocker: take a cushion-first route around this ball to reach the target'
  if (plant) return `Plant target: pot this ball by playing ball ${plant.ballId} first`
  return 'No three playable finishes found for this ball'
}

function ballSelectionLabel({ plant }: Scenario, id: number) {
  if (!plant) return `Select ball ${id}`
  if (id === plant.ballId) return `Select plant ${id} to ${plant.targetBallId}`
  if (id === plant.targetBallId) return `Plant target ball ${id}`
  return `Select free ball ${id}`
}

function ballSelectionCopy({ objective, bank, plant, trick, conditions }: Scenario, ballCount: number) {
  if (trick) return {
    description: trick.description,
    unavailable: `Play ball ${trick.ballId} first. The other balls are part of the trick’s setup.`,
    hint: 'Read the complete route, then compare aim, speed and spin. Every required pot and contact must happen in the same stroke.',
  }
  if (conditions) return {
    description: ballCount === 1 ? 'Same game. A very different table. Start with this ball, then compare three finishes under the faults in the table report.' : 'Which ball gives you room for error on this damaged table? Read the table report before choosing a route.',
    unavailable: 'Dimmed balls have no set of three playable finishes under these table conditions.',
    hint: 'The markings show real defects. Compare the whole route: the approach, contact, any rebounds, and where the cue ball stops.',
  }
  return {
    description: objective ? `Play ball ${objective.ballId} first. Keep ball ${objective.nextBallId} on the table for your next shot.` : bank ? `Reach ball ${bank.ballId} after at least ${bank.minCushions} cushion${bank.minCushions === 1 ? "" : "s"}, then pot it.` : plant ? `Play ball ${plant.ballId} into ball ${plant.targetBallId} for the plant, or attempt a difficult free ball. Read both contact lines before choosing.` : ballCount === 1 ? "Start with this object ball, then compare three ways to control the cue-ball finish." : "Which ball gives you the most room for error?",
    unavailable: objective ? "The next ball and traffic balls are reserved for this lesson." : bank ? "Dimmed balls are blockers. Ball 1 is the target for this lesson." : plant ? `Ball ${plant.targetBallId} is the plant target. Select ball ${plant.ballId} to attempt the plant.` : "Dimmed balls have no set of three playable finishes.",
    hint: objective ? "Select the first ball, then compare the strokes that could leave position for the next." : plant ? "Select the plant or a free ball, then compare the stroke and finish options. The plant is an attempt; its pot is not guaranteed." : "Choose a ball here or directly on the table. Then move on to its finish positions.",
  }
}

function BallChoice({ ball, reservedBallId, scenario, selected, selectable, preparing, ready, ballChoiceLabel, onSelect }: Pick<Props, 'scenario' | 'preparing' | 'ready' | 'ballChoiceLabel' | 'onSelect'> & {
  reservedBallId?: number | null
  ball: Scenario['balls'][number]
  selected: boolean
  selectable: boolean
}) {
  const { objective, plant, trick } = scenario
  return <button className={`ball-choice ${selected ? 'selected' : ''}`} onClick={() => onSelect(ball.id)} disabled={preparing || !selectable} title={ready && !selectable ? ball.id === reservedBallId ? 'Reserved for your nominated next shot' : unavailableBallReason(scenario, ball.id) : `Choose ${ballChoiceLabel(ball.id).toLowerCase()}`} aria-pressed={selected} aria-label={ballSelectionLabel(scenario, ball.id)}><BallIcon id={ball.id} /><span>{plant || trick ? ballChoiceLabel(ball.id) : `${objective?.nextBallId === ball.id || reservedBallId === ball.id ? 'Next' : 'Ball'} ${ball.id}`}</span>{selected && <span className="ball-check"><Check size={10} /></span>}</button>
}

export default function BallSelectionStep({ reservedBallId, scenario, selectedBall, selectableBallIds, preparing, ready, headingRef, ballChoiceLabel, onSelect }: Props) {
  const objectBalls = scenario.balls.filter(ball => ball.id > 0)
  const { description, unavailable, hint } = ballSelectionCopy(scenario, objectBalls.length)
  const selectableBalls = new Set(selectableBallIds)
  const singleChoice = ready && !preparing && selectableBallIds.length === 1
  return <>
    <h2 ref={headingRef} tabIndex={-1}>Choose your ball.</h2>
    <p className="panel-description">{scenario.curriculum?.learning?.comparison === 'nominated-next-ball' ? 'Nominate your next ball below, then choose a different ball as the opener.' : scenario.curriculum?.learning?.comparison === 'backward-plan' ? 'Ball 1 opens the shot. First plan the contact on ball 2 using the comparison below; then choose the opening stroke.' : description}</p>
    <div className="ball-choices" role="group" aria-label="Object ball choices">{objectBalls.map(ball => <BallChoice reservedBallId={reservedBallId} key={ball.id} ball={ball} scenario={scenario} selected={selectedBall === ball.id} selectable={selectableBalls.has(ball.id)} preparing={preparing} ready={ready} ballChoiceLabel={ballChoiceLabel} onSelect={onSelect} />)}</div>
    {ready && selectableBallIds.length < objectBalls.length && <p className="unavailable-note">{reservedBallId ? `Ball ${reservedBallId} is reserved for your next shot. Other dimmed balls have no three playable finishes.` : unavailable}</p>}
    <div className="wizard-hint"><MousePointer2 size={17} /><p>{scenario.curriculum?.learning?.comparison === 'backward-plan' ? 'Answer the contact question or show the plan without answering. Either reveals the landing area and lets you choose a stroke.' : singleChoice ? `${ballChoiceLabel(selectableBallIds[0])} ${scenario.trick ? 'starts this trick' : 'is the only playable ball'} and is selected automatically. Choose a stroke when you’re ready.` : hint}</p></div>
  </>
}
