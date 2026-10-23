import type { RefObject } from 'react'
import { Check } from 'lucide-react'
import { POCKETS } from '@/engine'
import type { Scenario, FinishOption } from '@/engine/types'
import { strokeDescription } from '@/lib/shot-presentation'
import BallIcon from './BallIcon'

interface Props {
  scenario: Scenario
  selectedBall: number | null
  finishOptions: FinishOption[]
  selectedOptionId: string | null
  busy: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
  ballChoiceLabel: (id: number) => string
  onSelect: (id: string) => void
}

function StrokeOption({ option, scenario, selected, busy, onSelect }: Pick<Props, 'scenario' | 'busy' | 'onSelect'> & { option: FinishOption; selected: boolean }) {
  const { objective, bank, plant } = scenario
  return <button
    className={`finish-option ${selected ? 'finish-selected' : ''}`}
    aria-label={`Choose ${objective ? "stroke" : "finish"} ${option.label}`}
    aria-describedby={`finish-details-${option.id}`}
    aria-pressed={selected}
    disabled={busy}
    onClick={() => onSelect(option.id)}
  >
    <span className="finish-letter">{option.label}</span>
    <span className="finish-copy" id={`finish-details-${option.id}`}><strong>{option.plan.speed.toFixed(2)} m/s <span>cue-ball speed</span></strong><span title="Spin percentage is relative to natural rolling at launch, not cue-tip offset.">{strokeDescription(option.plan)}</span>{(objective || bank || plant) && <span className="stroke-pocket">{plant ? `Attempt ball ${option.plan.potBallId ?? option.plan.ballId} to` : 'Pot to'} {POCKETS.find(pocket => pocket.id === option.plan.pocketId)?.name} pocket</span>}</span>
    {selected && <Check size={14} />}
  </button>
}

export default function FinishSelectionStep({ scenario, selectedBall, finishOptions, selectedOptionId, busy, headingRef, ballChoiceLabel, onSelect }: Props) {
  const { objective, bank, plant } = scenario
  return <>
    <h2 ref={headingRef} tabIndex={-1}>{objective ? "Choose your stroke." : "Choose your finish."}</h2>
    <p className="panel-description">{objective ? `Which speed and spin will land in the zone and leave ball ${objective.nextBallId} with a cut of ${objective.maxCutAngle}° or less?` : "Where should the cue ball stop? Pick A, B, or C on the table or below."}</p>
    {selectedBall !== null && <div className="selected-ball-summary"><BallIcon id={selectedBall} /><span>{plant ? 'Your shot' : 'Your object ball'}<strong>{ballChoiceLabel(selectedBall)}</strong>{plant && selectedBall === plant.ballId && <span>Hit {plant.ballId} first · Pot {plant.targetBallId}</span>}</span></div>}
    <div className="finish-options" role="group" aria-label={objective ? "Stroke options" : "Cue-ball finish options"}>
      {finishOptions.map(option => <StrokeOption key={option.id} option={option} scenario={scenario} selected={selectedOptionId === option.id} busy={busy} onSelect={onSelect} />)}
    </div>
    <p className="finish-assurance">{objective ? "All three can pot the first ball. The guide shows the approach; predict the travel after contact and the finish, revealed after you lock in." : bank ? `All three bank at least ${bank.minCushions} time${bank.minCushions === 1 ? "" : "s"} before reaching the target. Choose the most forgiving finish.` : plant ? "A plant may work, miss, or offer very little margin. Compare its alignment and cue-ball finish with the difficult free ball before committing." : "All three are playable. Choose the most forgiving."}</p>
  </>
}
