import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { TABLE } from '../../engine/constants'
import type { Scenario, Vec2 } from '../../engine/types'

export type BallPlacement = {
  onMoveBall: (id: number, position: Vec2) => void
  describedBy: string
}

/** Transparent input surface; all visible furniture and balls use PoolTable. */
export function BallPlacementControls({ scenario, selectedBall, onSelectBall, onMoveBall, describedBy, viewBox }: BallPlacement & {
  scenario: Scenario
  selectedBall: number | null
  onSelectBall: (id: number) => void
  viewBox: string
}) {
  const table = useRef<SVGSVGElement>(null)
  const drag = useRef<{ ballId: number; pointerId: number } | null>(null)
  const ball = scenario.balls.find(entry => entry.id === selectedBall) ?? scenario.balls[0]
  const clamp = (position: Vec2): Vec2 => ({
    x: Math.max(TABLE.ballRadius, Math.min(TABLE.length - TABLE.ballRadius, position.x)),
    y: Math.max(TABLE.ballRadius, Math.min(TABLE.width - TABLE.ballRadius, position.y)),
  })

  function tablePosition(event: PointerEvent<SVGSVGElement>): Vec2 | null {
    const svg = table.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return clamp(point.matrixTransform(matrix.inverse()))
  }

  function beginDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !ball) return
    const hit = (event.target as Element).closest('[data-ball-id]')
    const ballId = hit ? Number(hit.getAttribute('data-ball-id')) : ball.id
    onSelectBall(ballId)
    drag.current = { ballId, pointerId: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    if (!hit) {
      const position = tablePosition(event)
      if (position) onMoveBall(ballId, position)
    }
  }

  function dragBall(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    const position = tablePosition(event)
    if (position) onMoveBall(drag.current.ballId, position)
  }

  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function moveWithKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!ball) return
    const directions: Record<string, Vec2> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    const distance = event.shiftKey ? 0.001 : 0.01
    onMoveBall(ball.id, clamp({ x: ball.position.x + direction.x * distance, y: ball.position.y + direction.y * distance }))
  }

  return <svg ref={table} className="ball-placement-controls" viewBox={viewBox} role="group" aria-label={`Ball layout editor. ${ball?.id ? `Ball ${ball.id}` : 'Cue ball'} selected.`} aria-describedby={describedBy} tabIndex={0}
    onPointerDown={beginDrag} onPointerMove={dragBall} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null }} onKeyDown={moveWithKeyboard}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}>
    {scenario.balls.map(entry => <circle key={entry.id} data-ball-id={entry.id} cx={entry.position.x} cy={entry.position.y} r={TABLE.ballRadius + 0.018} fill="transparent" style={{ cursor: 'grab' }} />)}
  </svg>
}
