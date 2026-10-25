import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { POCKETS, TABLE } from '../engine/constants'
import type { Scenario, Vec2 } from '../engine/types'
import { BallGrimeSvg, TableConditionSvg } from './table/TableDamage'

const BALL_COLORS = ['#f4f1e7', '#e9b14e', '#6594d2', '#db7466', '#a68cce', '#e59857', '#71aa89', '#b7747d', '#787e79']
const TABLE_MARGIN = 0.13
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

/** The same accessible position editor serves scenario and free lab layouts. */
export default function BallLayoutEditor({ scenario, onChange, editable = true }: {
  scenario: Scenario
  onChange: (scenario: Scenario) => void
  editable?: boolean
}) {
  const [selectedBallId, setSelectedBallId] = useState(0)
  const table = useRef<SVGSVGElement>(null)
  const drag = useRef<{ ballId: number; pointerId: number } | null>(null)
  const selectedBall = scenario.balls.find(ball => ball.id === selectedBallId) ?? scenario.balls[0]

  function moveBall(ballId: number, position: Vec2) {
    onChange({ ...scenario,
      balls: scenario.balls.map(ball => ball.id === ballId ? { ...ball, position } : ball),
      ...(scenario.objective ? { objective: { ...scenario.objective, target: undefined, regions: undefined } } : {}),
    })
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
    if (!editable || event.button !== 0 || !selectedBall) return
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
    if (!editable || !selectedBall) return
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

  return <>
        <div className="sandbox-table-wrap">
          <svg ref={table} className={`sandbox-table${editable ? ' sandbox-table-editable' : ''}`} viewBox={`${-TABLE_MARGIN} ${-TABLE_MARGIN} ${TABLE.length + TABLE_MARGIN * 2} ${TABLE.width + TABLE_MARGIN * 2}`} role={editable ? 'group' : 'img'} aria-labelledby="sandbox-table-title" aria-describedby={editable ? 'sandbox-table-instructions' : 'sandbox-table-description'} tabIndex={editable ? 0 : undefined} onPointerDown={beginDrag} onPointerMove={dragBall} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null }} onKeyDown={moveWithKeyboard}>
            <title id="sandbox-table-title">{editable ? `Ball layout editor. ${ballName(selectedBall?.id ?? 0)} selected.` : 'Sandbox ball layout'}</title>
            <desc id="sandbox-table-description">{scenario.balls.map(ball => `${ballName(ball.id)} at ${centimeters(ball.position.x)} centimeters from the left and ${centimeters(ball.position.y)} centimeters from the top`).join('. ')}.</desc>
            <rect x={-0.105} y={-0.105} width={TABLE.length + 0.21} height={TABLE.width + 0.21} rx={0.075} fill="#111a15" stroke="#695f43" strokeWidth={0.012} />
            <rect x={-0.04} y={-0.04} width={TABLE.length + 0.08} height={TABLE.width + 0.08} rx={0.02} fill="#39553c" />
            <rect width={TABLE.length} height={TABLE.width} fill="#48674b" />
            <line x1={TABLE.length / 4} x2={TABLE.length / 4} y1={0} y2={TABLE.width} stroke="#d7dfc4" strokeOpacity={0.12} strokeWidth={0.003} />
            {[1, 2, 3, 5, 6, 7].flatMap(index => [0, TABLE.width].map(y => <circle key={`${index}-${y}`} cx={TABLE.length * index / 8} cy={y === 0 ? -0.071 : y + 0.071} r={0.006} fill="#d1bb8a" opacity={0.65} />))}
            {POCKETS.map(pocket => <circle key={pocket.id} cx={pocket.position.x} cy={pocket.position.y} r={pocket.kind === 'corner' ? TABLE.cornerPocketRadius : TABLE.sidePocketRadius} fill="#0c110e" stroke="#8c7a54" strokeWidth={0.006} />)}
            {scenario.conditions && <TableConditionSvg conditions={scenario.conditions} />}
            {scenario.balls.map(ball => <g key={ball.id} data-ball-id={ball.id} className="sandbox-table-ball" transform={`translate(${ball.position.x} ${ball.position.y})`}>
              {editable && selectedBall?.id === ball.id && <circle r={TABLE.ballRadius + 0.016} fill="none" stroke="#f2c789" strokeWidth={0.006} />}
              <circle cy={0.006} r={TABLE.ballRadius + 0.004} fill="#101a12" opacity={0.3} />
              <circle r={TABLE.ballRadius} fill={BALL_COLORS[ball.id > 8 ? ball.id - 8 : ball.id]} stroke="#111b1680" strokeWidth={0.003} />
              {!!scenario.conditions?.dirt && <BallGrimeSvg id={ball.id} dirt={scenario.conditions.dirt} />}
              {ball.id > 0 && <><circle r={TABLE.ballRadius * 0.58} fill="#f5f0df" /><text textAnchor="middle" dominantBaseline="central" fontFamily="Arial, sans-serif" fontSize={0.027} fontWeight={700} fill="#25291f">{ball.id}</text></>}
              <circle cx={-0.009} cy={-0.011} r={0.007} fill="white" opacity={0.32} />
              <circle r={TABLE.ballRadius + 0.018} fill="transparent" />
            </g>)}
          </svg>
        </div>
        {editable && <div className="sandbox-ball-editor">
          <p id="sandbox-table-instructions">Select a ball, then tap the table or drag it. Focus the table and use arrow keys to move 1 cm; hold Shift for 1 mm.</p>
          <div className="sandbox-ball-picker" role="group" aria-label="Ball to place">{scenario.balls.map(ball => <button type="button" key={ball.id} aria-label={`Place ${ballName(ball.id).toLowerCase()}`} aria-pressed={selectedBall?.id === ball.id} onClick={() => setSelectedBallId(ball.id)}><span style={{ background: BALL_COLORS[ball.id > 8 ? ball.id - 8 : ball.id] }}>{ball.id === 0 ? '' : ball.id}</span>{ball.id === 0 && <span>Cue</span>}</button>)}</div>
          {selectedBall && <div className="sandbox-coordinates"><span>{ballName(selectedBall.id)}<small>Position from the top left</small></span>{(['x', 'y'] as const).map(axis => <CoordinateInput key={`${selectedBall.id}-${axis}`} axis={axis} value={selectedBall.position[axis]} onChange={value => moveBall(selectedBall.id, { ...selectedBall.position, [axis]: value })} />)}</div>}
        </div>}
  </>
}
