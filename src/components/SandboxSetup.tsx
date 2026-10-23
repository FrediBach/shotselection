import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowRight, CheckCircle2, Dices, FlaskConical, LoaderCircle, MousePointer2, RotateCcw } from 'lucide-react'
import { POCKETS, TABLE } from '../engine/constants'
import { prepareSandboxRoundAsync } from '../engine/client'
import { createSandboxScenario, SANDBOX_SCENARIOS, validateSandboxLayout } from '../engine/sandbox'
import type { PreparedRound, Scenario, Vec2 } from '../engine/types'
import { Button } from './ui/button'
import './SandboxSetup.css'

type Placement = 'random' | 'manual'
type PreparationRequest = { scenario: Scenario; placement: Placement; version: number }
const BALL_COLORS = ['#f4f1e7', '#e9b14e', '#6594d2', '#db7466', '#a68cce', '#e59857', '#71aa89', '#b7747d', '#787e79']
const TABLE_MARGIN = 0.13
const freshSeed = () => Math.floor(Math.random() * 0x7fffffff)
const ballName = (id: number) => id === 0 ? 'Cue ball' : `Ball ${id}`
const centimeters = (value: number) => Number((value * 100).toFixed(2))

function CoordinateInput({ axis, value, onChange }: { axis: 'x' | 'y'; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return <label htmlFor={`sandbox-ball-${axis}`}><span>{axis.toUpperCase()}</span><input id={`sandbox-ball-${axis}`} type="number" min={0} max={(axis === 'x' ? TABLE.length : TABLE.width) * 100} step="0.1" value={draft ?? centimeters(value)} onBlur={() => setDraft(null)} onChange={event => {
    setDraft(event.target.value)
    const nextValue = event.target.valueAsNumber
    if (Number.isFinite(nextValue)) onChange(nextValue / 100)
  }} /><span>cm</span></label>
}

export default function SandboxSetup({ onStart, initialScenario, initialPlacement = 'random' }: {
  onStart: (round: PreparedRound) => void
  initialScenario?: Scenario
  initialPlacement?: Placement
}) {
  const [scenario, setScenario] = useState(() => initialPlacement === 'manual' && initialScenario ? initialScenario : createSandboxScenario(initialScenario?.level ?? 1, freshSeed()))
  const [placement, setPlacement] = useState<Placement>(initialPlacement)
  const [selectedBallId, setSelectedBallId] = useState(0)
  const [prepared, setPrepared] = useState<PreparedRound | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const [request, setRequest] = useState<PreparationRequest | null>(() => initialPlacement === 'manual' ? null : { scenario, placement: 'random', version: 0 })
  const heading = useRef<HTMLHeadingElement>(null)
  const table = useRef<SVGSVGElement>(null)
  const drag = useRef<{ ballId: number; pointerId: number } | null>(null)
  const selectedBall = scenario.balls.find(ball => ball.id === selectedBallId) ?? scenario.balls[0]
  const group = SANDBOX_SCENARIOS.find(entry => entry.lessons.some(lesson => lesson.level === scenario.level))
  const geometryError = validateSandboxLayout(scenario)
  const busy = request !== null

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

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
    drag.current = null
    setSelectedBallId(0)
    setScenario(nextScenario)
    setPrepared(null)
    if (placement === 'random') checkLayout(nextScenario, 'random')
    else cancelCheck()
  }

  function choosePlacement(nextPlacement: Placement) {
    if (nextPlacement === placement) return
    drag.current = null
    cancelCheck()
    setPlacement(nextPlacement)
    if (nextPlacement === 'random' && !prepared) checkLayout(scenario, 'random')
  }

  function randomize() {
    const nextScenario = createSandboxScenario(scenario.level, freshSeed())
    drag.current = null
    setScenario(nextScenario)
    checkLayout(nextScenario, 'random')
  }

  function moveBall(ballId: number, position: Vec2) {
    cancelCheck()
    setPrepared(null)
    setScenario(previous => ({
      ...previous,
      balls: previous.balls.map(ball => ball.id === ballId ? { ...ball, position } : ball),
      ...(previous.objective ? { objective: { ...previous.objective, target: undefined } } : {}),
    }))
  }

  function tablePosition(event: PointerEvent<SVGSVGElement>): Vec2 | null {
    const svg = table.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const position = point.matrixTransform(matrix.inverse())
    return {
      x: Math.max(TABLE.ballRadius, Math.min(TABLE.length - TABLE.ballRadius, position.x)),
      y: Math.max(TABLE.ballRadius, Math.min(TABLE.width - TABLE.ballRadius, position.y)),
    }
  }

  function beginDrag(event: PointerEvent<SVGSVGElement>) {
    if (placement !== 'manual' || event.button !== 0 || !selectedBall) return
    const hit = (event.target as Element).closest('[data-ball-id]')
    const ballId = hit ? Number(hit.getAttribute('data-ball-id')) : selectedBall.id
    setSelectedBallId(ballId)
    drag.current = { ballId, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    if (!hit) {
      const position = tablePosition(event)
      if (position) moveBall(ballId, position)
    }
  }

  function dragBall(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const position = tablePosition(event)
    if (position) moveBall(drag.current.ballId, position)
  }

  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function moveWithKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (placement !== 'manual' || !selectedBall) return
    const directions: Record<string, Vec2> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const distance = event.shiftKey ? 0.001 : 0.01
    moveBall(selectedBall.id, {
      x: Math.max(TABLE.ballRadius, Math.min(TABLE.length - TABLE.ballRadius, selectedBall.position.x + direction.x * distance)),
      y: Math.max(TABLE.ballRadius, Math.min(TABLE.width - TABLE.ballRadius, selectedBall.position.y + direction.y * distance)),
    })
  }

  return <section className="sandbox-setup" aria-labelledby="sandbox-heading">
    <div className="sandbox-intro">
      <span className="eyebrow"><FlaskConical size={14} /> THE SANDBOX</span>
      <h1 id="sandbox-heading" ref={heading} tabIndex={-1}>Make room to experiment.</h1>
      <p>Choose a scenario, set the table, and find out what works. Every round stands on its own, with the same scoring and ensemble feedback.</p>
    </div>
    <div className="sandbox-layout">
      <div className="sandbox-controls">
        <section className="sandbox-control-section" aria-labelledby="sandbox-scenario-heading">
          <h2 id="sandbox-scenario-heading"><span>01</span> CHOOSE A SCENARIO</h2>
          <label htmlFor="sandbox-scenario">Scenario</label>
          <select id="sandbox-scenario" value={scenario.level} onChange={event => chooseScenario(Number(event.target.value))}>
            {SANDBOX_SCENARIOS.map(entry => <optgroup key={entry.id} label={entry.title}>{entry.lessons.map(lesson => <option key={lesson.level} value={lesson.level}>{lesson.title}</option>)}</optgroup>)}
          </select>
          <div className="sandbox-scenario-description"><span>{group?.title}</span><p>{scenario.description}</p></div>
          {(scenario.bank || scenario.plant || scenario.objective || scenario.trick) && <p className="sandbox-objective">
            {scenario.trick ? scenario.trick.description : scenario.bank ? `Reach ball ${scenario.bank.ballId} after at least ${scenario.bank.minCushions} cushion ${scenario.bank.minCushions === 1 ? 'rebound' : 'rebounds'}.` : scenario.plant ? `Play ball ${scenario.plant.ballId} into ball ${scenario.plant.targetBallId} for the ${POCKETS.find(pocket => pocket.id === scenario.plant?.pocketId)?.name ?? 'assigned'} pocket.` : `Pot ball ${scenario.objective!.ballId} and leave a usable shot on ball ${scenario.objective!.nextBallId}.`}
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
        <div className="sandbox-table-wrap">
          <svg ref={table} className={`sandbox-table${placement === 'manual' ? ' sandbox-table-editable' : ''}`} viewBox={`${-TABLE_MARGIN} ${-TABLE_MARGIN} ${TABLE.length + TABLE_MARGIN * 2} ${TABLE.width + TABLE_MARGIN * 2}`} role={placement === 'manual' ? 'group' : 'img'} aria-labelledby="sandbox-table-title" aria-describedby={placement === 'manual' ? 'sandbox-table-instructions' : 'sandbox-table-description'} tabIndex={placement === 'manual' ? 0 : undefined} onPointerDown={beginDrag} onPointerMove={dragBall} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null }} onKeyDown={moveWithKeyboard}>
            <title id="sandbox-table-title">{placement === 'manual' ? `Ball layout editor. ${ballName(selectedBallId)} selected.` : 'Sandbox ball layout'}</title>
            <desc id="sandbox-table-description">{scenario.balls.map(ball => `${ballName(ball.id)} at ${centimeters(ball.position.x)} centimeters from the left and ${centimeters(ball.position.y)} centimeters from the top`).join('. ')}.</desc>
            <rect x={-0.105} y={-0.105} width={TABLE.length + 0.21} height={TABLE.width + 0.21} rx={0.075} fill="#111a15" stroke="#695f43" strokeWidth={0.012} />
            <rect x={-0.04} y={-0.04} width={TABLE.length + 0.08} height={TABLE.width + 0.08} rx={0.02} fill="#39553c" />
            <rect width={TABLE.length} height={TABLE.width} fill="#48674b" />
            <line x1={TABLE.length / 4} x2={TABLE.length / 4} y1={0} y2={TABLE.width} stroke="#d7dfc4" strokeOpacity={0.12} strokeWidth={0.003} />
            {[1, 2, 3, 5, 6, 7].flatMap(index => [0, TABLE.width].map(y => <circle key={`${index}-${y}`} cx={TABLE.length * index / 8} cy={y === 0 ? -0.071 : y + 0.071} r={0.006} fill="#d1bb8a" opacity={0.65} />))}
            {POCKETS.map(pocket => <circle key={pocket.id} cx={pocket.position.x} cy={pocket.position.y} r={pocket.kind === 'corner' ? TABLE.cornerPocketRadius : TABLE.sidePocketRadius} fill="#0c110e" stroke="#8c7a54" strokeWidth={0.006} />)}
            {scenario.balls.map(ball => <g key={ball.id} data-ball-id={ball.id} className="sandbox-table-ball" transform={`translate(${ball.position.x} ${ball.position.y})`}>
              {placement === 'manual' && selectedBallId === ball.id && <circle r={TABLE.ballRadius + 0.016} fill="none" stroke="#f2c789" strokeWidth={0.006} />}
              <circle cy={0.006} r={TABLE.ballRadius + 0.004} fill="#101a12" opacity={0.3} />
              <circle r={TABLE.ballRadius} fill={BALL_COLORS[ball.id] ?? '#c4c0a7'} stroke="#111b1680" strokeWidth={0.003} />
              {ball.id > 0 && <><circle r={TABLE.ballRadius * 0.58} fill="#f5f0df" /><text textAnchor="middle" dominantBaseline="central" fontFamily="Arial, sans-serif" fontSize={0.027} fontWeight={700} fill="#25291f">{ball.id}</text></>}
              <circle cx={-0.009} cy={-0.011} r={0.007} fill="white" opacity={0.32} />
              <circle r={TABLE.ballRadius + 0.018} fill="transparent" />
            </g>)}
          </svg>
        </div>
        {placement === 'manual' && <div className="sandbox-ball-editor">
          <p id="sandbox-table-instructions">Select a ball, then tap the table or drag it. Focus the table and use arrow keys to move 1 cm; hold Shift for 1 mm.</p>
          <div className="sandbox-ball-picker" role="group" aria-label="Ball to place">{scenario.balls.map(ball => <button type="button" key={ball.id} aria-label={`Place ${ballName(ball.id).toLowerCase()}`} aria-pressed={selectedBallId === ball.id} onClick={() => setSelectedBallId(ball.id)}><span style={{ background: BALL_COLORS[ball.id] ?? '#c4c0a7' }}>{ball.id === 0 ? '' : ball.id}</span>{ball.id === 0 && <span>Cue</span>}</button>)}</div>
          {selectedBall && <div className="sandbox-coordinates"><span>{ballName(selectedBall.id)}<small>Position from the top left</small></span>{(['x', 'y'] as const).map(axis => <CoordinateInput key={`${selectedBall.id}-${axis}`} axis={axis} value={selectedBall.position[axis]} onChange={value => moveBall(selectedBall.id, { ...selectedBall.position, [axis]: value })} />)}</div>}
        </div>}
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
  </section>
}
