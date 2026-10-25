import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Dices, FlaskConical, LoaderCircle, MousePointer2, RotateCcw } from 'lucide-react'
import { POCKETS } from '../engine/constants'
import { prepareSandboxRoundAsync } from '../engine/client'
import { createSandboxScenario, SANDBOX_SCENARIOS, validateSandboxLayout } from '../engine/sandbox'
import type { PlayerCharacter, PreparedRound, Scenario } from '../engine/types'
import { Button } from './ui/button'
import { TableConditionSummary } from './TableConditions'
import BallLayoutEditor from './BallLayoutEditor'
import LabMode from './LabMode'
import './SandboxSetup.css'

type Placement = 'random' | 'manual'
type PreparationRequest = { scenario: Scenario; placement: Placement; version: number }
const freshSeed = () => Math.floor(Math.random() * 0x7fffffff)

type SandboxSetupProps = {
  onStart: (round: PreparedRound) => void
  initialScenario?: Scenario
  initialPlacement?: Placement
}

export default function SandboxSetup({ character, ...props }: SandboxSetupProps & { character: PlayerCharacter }) {
  const [mode, setMode] = useState<'scenario' | 'lab'>('scenario')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  return <section className="sandbox-setup" aria-labelledby="sandbox-heading">
    <div className="sandbox-intro">
      <span className="eyebrow"><FlaskConical size={14} /> THE SANDBOX</span>
      <h1 id="sandbox-heading" ref={heading} tabIndex={-1}>Make room to experiment.</h1>
      <p>Practice a scenario or build your own experiment. Compare how ball positions, strength, aim, and spin change your chances.</p>
    </div>
    <div className="sandbox-mode-options sandbox-placement-options" role="group" aria-label="Sandbox mode">
      <button type="button" aria-label="Scenario mode" aria-pressed={mode === 'scenario'} onClick={() => setMode('scenario')}><Dices size={21} /><span><strong>Scenario mode</strong><span>A practice layout with ready-made shot choices.</span></span></button>
      <button type="button" aria-label="Lab mode" aria-pressed={mode === 'lab'} onClick={() => setMode('lab')}><FlaskConical size={21} /><span><strong>Lab mode</strong><span>Your balls, your strokes, your comparisons.</span></span></button>
    </div>
    {mode === 'lab' ? <LabMode character={character} /> : <ScenarioSetup {...props} />}
  </section>
}

function ScenarioSetup({ onStart, initialScenario, initialPlacement = 'random' }: SandboxSetupProps) {
  const [scenario, setScenario] = useState(() => initialPlacement === 'manual' && initialScenario ? initialScenario : createSandboxScenario(initialScenario?.level ?? 1, freshSeed()))
  const [placement, setPlacement] = useState<Placement>(initialPlacement)
  const [prepared, setPrepared] = useState<PreparedRound | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const [request, setRequest] = useState<PreparationRequest | null>(() => initialPlacement === 'manual' ? null : { scenario, placement: 'random', version: 0 })
  const group = SANDBOX_SCENARIOS.find(entry => entry.lessons.some(lesson => lesson.level === scenario.level))
  const geometryError = validateSandboxLayout(scenario)
  const busy = request !== null


  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    let active = true
    prepareSandboxRoundAsync({ scenario: request.scenario, placement: request.placement }, { signal: controller.signal }).then(round => {
      if (!active || request.version !== requestVersion.current) return
      setScenario(round.scenario)
      setPrepared(round)
      setError(null)
      setRequest(null)
    }).catch((reason: unknown) => {
      if (!active || request.version !== requestVersion.current || controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : 'The layout could not be checked. Try again or adjust the ball positions.')
      setRequest(null)
    })
    return () => { active = false; controller.abort() }
  }, [request])

  function cancelCheck() {
    requestVersion.current += 1
    setRequest(null)
    setError(null)
  }

  function checkLayout(nextScenario: Scenario, nextPlacement: Placement) {
    cancelCheck()
    setPrepared(null)
    const invalid = validateSandboxLayout(nextScenario)
    if (nextPlacement === 'manual' && invalid) {
      setError(invalid)
      return
    }
    setRequest({ scenario: nextScenario, placement: nextPlacement, version: requestVersion.current })
  }

  function chooseScenario(level: number) {
    const nextScenario = createSandboxScenario(level, freshSeed())
    setScenario(nextScenario)
    setPrepared(null)
    if (placement === 'random') checkLayout(nextScenario, 'random')
    else cancelCheck()
  }

  function choosePlacement(nextPlacement: Placement) {
    if (nextPlacement === placement) return
    cancelCheck()
    setPlacement(nextPlacement)
    if (nextPlacement === 'random' && !prepared) checkLayout(scenario, 'random')
  }

  function randomize() {
    const nextScenario = createSandboxScenario(scenario.level, freshSeed())
    setScenario(nextScenario)
    checkLayout(nextScenario, 'random')
  }

  function editLayout(nextScenario: Scenario) {
    cancelCheck()
    setPrepared(null)
    setScenario(nextScenario)
  }

  return <div className="sandbox-layout">
      <div className="sandbox-controls">
        <section className="sandbox-control-section" aria-labelledby="sandbox-scenario-heading">
          <h2 id="sandbox-scenario-heading"><span>01</span> CHOOSE A SCENARIO</h2>
          <label htmlFor="sandbox-scenario">Scenario</label>
          <select id="sandbox-scenario" value={scenario.level} onChange={event => chooseScenario(Number(event.target.value))}>
            {SANDBOX_SCENARIOS.map(entry => <optgroup key={entry.id} label={entry.title}>{entry.lessons.map(lesson => <option key={lesson.level} value={lesson.level}>{lesson.title}</option>)}</optgroup>)}
          </select>
          <div className="sandbox-scenario-description"><span>{group?.title}</span><p>{scenario.description}</p></div>
          {(scenario.finalBall || scenario.bank || scenario.plant || scenario.objective || scenario.trick) && <p className="sandbox-objective">
            {scenario.finalBall ? `Pot the final ball ${scenario.finalBall.ballId} without scratching. No position target.` : scenario.trick ? scenario.trick.description : scenario.bank ? `Reach ball ${scenario.bank.ballId} after at least ${scenario.bank.minCushions} cushion ${scenario.bank.minCushions === 1 ? 'rebound' : 'rebounds'}.` : scenario.plant ? `Play ball ${scenario.plant.ballId} into ball ${scenario.plant.targetBallId} for the ${POCKETS.find(pocket => pocket.id === scenario.plant?.pocketId)?.name ?? 'assigned'} pocket.` : `Pot ball ${scenario.objective!.ballId} and leave a usable shot on ball ${scenario.objective!.nextBallId}.`}
          </p>}
        </section>
        <section className="sandbox-control-section" aria-labelledby="sandbox-placement-heading">
          <h2 id="sandbox-placement-heading"><span>02</span> SET THE BALL POSITIONS</h2>
          <div className="sandbox-placement-options" role="group" aria-label="Ball placement">
            <button type="button" aria-pressed={placement === 'random'} onClick={() => choosePlacement('random')}><Dices size={21} /><span><strong>Let the engine choose</strong><span>A random, playable layout.</span></span></button>
            <button type="button" aria-pressed={placement === 'manual'} onClick={() => choosePlacement('manual')}><MousePointer2 size={21} /><span><strong>Place the balls myself</strong><span>Build a layout and test it.</span></span></button>
          </div>
          <p className="sandbox-control-note">All scenarios are available from the start. No running total, no progression. Just a fresh chance to learn.</p>
        </section>
      </div>
      <section className="sandbox-editor" aria-labelledby="sandbox-layout-heading">
        <div className="sandbox-editor-heading"><div><h2 id="sandbox-layout-heading">{placement === 'manual' ? 'Your table, your setup.' : 'A fresh table.'}</h2><span>{placement === 'manual' ? 'Move any ball. The engine checks the complete shot.' : 'Preview the layout, then make your shot selection.'}</span></div><span className="sandbox-table-size">254 × 127 <span>cm</span></span></div>
        {scenario.conditions && <TableConditionSummary conditions={scenario.conditions} finalBoss={scenario.curriculum?.lessonIndex === 9} />}
        <BallLayoutEditor key={`${scenario.level}-${scenario.seed}-${placement}`} scenario={scenario} editable={placement === 'manual'} onChange={editLayout} />
        <div className="sandbox-editor-footer">
          <div className={`sandbox-layout-status${error || (placement === 'manual' && geometryError) ? ' sandbox-layout-error' : ''}`} role="status" aria-live="polite">
            {busy ? <><LoaderCircle className="sandbox-spinner" size={16} /><span>{request.placement === 'random' ? 'Finding a playable layout…' : 'Checking your layout…'}<small>You can keep adjusting the setup.</small></span></> : error || (placement === 'manual' && geometryError) ? <span>{error ?? geometryError}</span> : prepared ? <><CheckCircle2 size={16} /><span>Ready to play.<small>The engine found playable shots for this layout.</small></span></> : <span>Ready to test.<small>The engine will check these exact ball positions.</small></span>}
          </div>
          <div className="sandbox-editor-actions">
            <Button type="button" variant="outline" onClick={randomize}><RotateCcw size={15} /> {placement === 'manual' ? 'Random starting layout' : 'Generate another layout'}</Button>
            {prepared ? <Button type="button" onClick={() => onStart(prepared)}>Play this layout <ArrowRight size={17} /></Button> : <Button type="button" disabled={busy || (placement === 'manual' && !!geometryError)} onClick={() => checkLayout(scenario, placement)}>{busy ? <><LoaderCircle className="sandbox-spinner" size={16} /> Checking…</> : placement === 'manual' ? 'Test layout' : 'Try again'}{!busy && <ArrowRight size={17} />}</Button>}
          </div>
        </div>
      </section>
  </div>
}
