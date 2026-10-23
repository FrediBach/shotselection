import type { RefObject } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { POCKETS } from '@/engine'
import type { Scenario, FinishOption } from '@/engine/types'
import { ENGLISH_EXPLANATION, englishDescription, verticalSpinDescription } from '@/lib/shot-presentation'
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

// Qualitative cue-tip placement; launch rotation does not specify an exact offset.
function SpinDiagram({ topSpin, sideSpin }: FinishOption['plan']) {
  const x = 28 - Math.sign(sideSpin) * 11
  const y = 28 - (Math.abs(topSpin) > 0.1 ? Math.sign(topSpin) * 11 : 0)
  return <svg className="spin-diagram" viewBox="0 0 56 56" aria-hidden="true">
    <circle cx="28" cy="28" r="24" fill="#eee9dc" />
    <circle cx="24" cy="23" r="18" fill="#fffdf5" opacity=".5" />
    <g fill="none" stroke="#888b86" strokeWidth=".8" opacity=".55">
      <circle cx="28" cy="28" r="6" />
      <circle cx="28" cy="28" r="12" />
      <circle cx="28" cy="28" r="18" />
      <path d="M 7 28 H 49 M 28 7 V 49" strokeWidth=".6" opacity=".6" />
    </g>
    <circle cx={x} cy={y} r="4" fill="#246b86" stroke="#fffdf5" strokeWidth="1.5" />
  </svg>
}

function StrokeOption({ option, scenario, selected, busy, onSelect }: Pick<Props, 'scenario' | 'busy' | 'onSelect'> & { option: FinishOption; selected: boolean }) {
  const { objective, bank, plant, trick } = scenario
  return <button
    className={`finish-option ${selected ? 'finish-selected' : ''}`}
    aria-label={`Choose ${objective || trick ? "stroke" : "finish"} ${option.label}`}
    aria-describedby={`finish-details-${option.id}`}
    aria-pressed={selected}
    disabled={busy}
    onClick={() => onSelect(option.id)}
  >
    <span className="finish-letter">{option.label}</span>
    <span className="finish-copy" id={`finish-details-${option.id}`}><strong>{option.plan.speed.toFixed(2)} m/s <span className="sr-only">cue-ball speed</span></strong><span title="Spin percentage is relative to natural rolling at launch, not cue-tip offset.">{verticalSpinDescription(option.plan)}</span><span>{englishDescription(option.plan)}</span>{(objective || bank || plant || trick) && <span className="stroke-pocket">{plant || trick ? `Attempt ball ${option.plan.potBallId ?? option.plan.ballId} to` : 'Pot to'} {POCKETS.find(pocket => pocket.id === option.plan.pocketId)?.name} pocket</span>}</span>
    <SpinDiagram {...option.plan} />
    {selected && <Check className="finish-check" size={12} />}
  </button>
}

export default function FinishSelectionStep({ scenario, selectedBall, finishOptions, selectedOptionId, busy, headingRef, ballChoiceLabel, onSelect }: Props) {
  const { objective, bank, plant, trick } = scenario
  return <>
    <h2 ref={headingRef} tabIndex={-1}>{objective || trick ? "Choose your stroke." : "Choose your finish."}</h2>
    <p className="panel-description">{trick ? 'Which aim, speed and spin can complete the trick and control the cue-ball finish?' : objective ? `Which speed and spin will land in the zone and leave ball ${objective.nextBallId} with a cut of ${objective.maxCutAngle}° or less?` : "Pick a finish on the table or compare the strokes below."}</p>
    {selectedBall !== null && <div className="selected-ball-summary"><BallIcon id={selectedBall} /><span><strong>{ballChoiceLabel(selectedBall)}</strong>{plant && selectedBall === plant.ballId && <span>Hit {plant.ballId} first · Pot {plant.targetBallId}</span>}{trick && <span>Hit {trick.ballId} first · Pot {trick.requiredPots.join(' + ')}</span>}</span></div>}
    <div className="finish-options" role="group" aria-label={objective || trick ? "Stroke options" : "Cue-ball finish options"}>
      {finishOptions.map(option => <StrokeOption key={option.id} option={option} scenario={scenario} selected={selectedOptionId === option.id} busy={busy} onSelect={onSelect} />)}
    </div>
    <details className="result-details finish-guide">
      <summary>Reading speed & spin <ChevronDown size={15} aria-hidden="true" /></summary>
      <p>The blue dot shows approximate cue-tip placement, viewed from behind the cue: high for topspin, low for backspin, and left or right for English. Gray rings help you read the position; exact spin amounts are listed beside the ball.</p>
      <p>Speed is the cue ball’s launch speed. Topspin and backspin percentages are relative to natural rolling at launch.</p>
      <p>{ENGLISH_EXPLANATION}</p>
      <p className="finish-assurance">{trick ? "These are attempts at the same trick. Some may miss a required pot or contact. The guide shows only the approach; predict the full sequence and finish, revealed after you lock in." : objective ? "All three can pot the first ball. The guide shows the approach; predict the travel after contact and the finish, revealed after you lock in." : bank ? `All three bank at least ${bank.minCushions} time${bank.minCushions === 1 ? "" : "s"} before reaching the target. Choose the most forgiving finish.` : plant ? "A plant may work, miss, or offer very little margin. Compare its alignment and cue-ball finish with the difficult free ball before committing." : "All three are playable. Choose the most forgiving."}</p>
    </details>
  </>
}
