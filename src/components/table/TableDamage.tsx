import { useEffect, useId, useMemo } from 'react'
import * as THREE from 'three'
import { TABLE } from '../../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../../engine/table-geometry'
import type { TableConditions, Vec2 } from '../../engine/types'

const W = TABLE.length
const D = TABLE.width
const CLOTH_Y = 0.062
const AMBER = '#d7b477'
const CLOTH_OUTLINE = `M0 0H${W}V${D}H0Z ${POCKET_GEOMETRY.map(({ center: p, radius: r }) => `M${p.x - r} ${p.y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`).join(' ')}`
type Mark = {
  points?: Vec2[]
  circle?: { center: Vec2; radius: number }
  text?: { at: Vec2; label: string }
  fill?: string
  stroke?: string
  width?: number
  opacity: number
  dash?: number[]
  closed?: boolean
}

function damageMarks(conditions: TableConditions) {
  const cloth: Mark[] = []
  const rails: Mark[] = []
  if (conditions.cloth && conditions.cloth !== 1) {
    cloth.push({ points: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }], closed: true, fill: '#a9a16a', opacity: .1 })
    // Reproducible short fibres convey worn cloth without suggesting local hazards.
    for (let i = 0; i < 105; i++) {
      const x = .09 + ((i * 97) % 239) / 100
      const y = .08 + ((i * 53) % 112) / 100
      cloth.push({ points: [{ x, y }, { x: x + .02, y: y + .003 }], stroke: '#c3bf92', width: .0015, opacity: .22 })
    }
    cloth.push({ text: { at: { x: W / 2, y: .075 }, label: conditions.cloth > 1 ? 'WORN CLOTH' : 'SLICK CLOTH' }, fill: '#d1c695', opacity: .5 })
  }
  for (const patch of conditions.patches ?? []) {
    const slick = patch.friction < 1
    const patchColor = slick ? '#b6dbdf' : AMBER
    cloth.push({ circle: { center: patch.center, radius: patch.radius }, fill: slick ? '#7aafb7' : '#9e783e', stroke: patchColor, width: .005, opacity: .5, dash: slick ? undefined : [.018, .012] })
    // Each hatch ends exactly at the physical circle, including after reflection.
    for (let i = -4; i <= 4; i++) {
      const y = i * patch.radius / 5
      const halfWidth = Math.sqrt(patch.radius ** 2 - y ** 2)
      if (!slick) cloth.push({ points: [{ x: patch.center.x - halfWidth, y: patch.center.y + y }, { x: patch.center.x + halfWidth, y: patch.center.y + y }], stroke: patchColor, width: .002, opacity: .2 })
    }
  }
  if (conditions.nap && Math.hypot(conditions.nap.x, conditions.nap.y) > 0) {
    const magnitude = Math.hypot(conditions.nap.x, conditions.nap.y)
    const dir = { x: conditions.nap.x / magnitude, y: conditions.nap.y / magnitude }
    const center = { x: .33, y: D - .24 }
    const a = { x: center.x - dir.x * .1, y: center.y - dir.y * .1 }
    const b = { x: center.x + dir.x * .1, y: center.y + dir.y * .1 }
    cloth.push({ points: [a, b], stroke: AMBER, width: .008, opacity: .8 })
    cloth.push({ points: [b, { x: b.x - dir.x * .055 - dir.y * .03, y: b.y - dir.y * .055 + dir.x * .03 }, { x: b.x - dir.x * .055 + dir.y * .03, y: b.y - dir.y * .055 - dir.x * .03 }], closed: true, fill: AMBER, opacity: .85 })
    cloth.push({ text: { at: { x: center.x, y: center.y + .16 }, label: 'DRIFT' }, fill: AMBER, opacity: .85 })
  }
  for (const cushion of CUSHIONS.filter(cushion => conditions.cushions?.some(damaged => damaged.rail === cushion.side))) {
    rails.push({ points: cushion.polygon, closed: true, fill: '#a27842', stroke: AMBER, width: .003, opacity: .7 })
    const horizontal = cushion.side === 'top' || cushion.side === 'bottom'
    for (let i = 0; i < 9; i++) {
      const t = .12 + i * .095
      const x = cushion.nose.a.x + (cushion.nose.b.x - cushion.nose.a.x) * t
      const y = cushion.nose.a.y + (cushion.nose.b.y - cushion.nose.a.y) * t
      const sign = cushion.side === 'top' || cushion.side === 'left' ? -1 : 1
      rails.push({ points: horizontal ? [{ x, y: y + .009 * sign }, { x: x + .018, y: y + .039 * sign }] : [{ x: x + .009 * sign, y }, { x: x + .039 * sign, y: y + .018 }], stroke: '#efd29c', width: .007, opacity: .8 })
    }
  }
  if (conditions.cue) {
    const y = D + .09
    const bend = conditions.cue.angleBias ? Math.sign(conditions.cue.angleBias) * .027 : .005
    rails.push({ points: [{ x: .72, y }, { x: 1.13, y: y - .005 }], stroke: '#503421', width: .028, opacity: 1 })
    rails.push({ points: [{ x: 1.12, y: y - .005 }, { x: 1.4, y: y + bend }, { x: 1.72, y: y + .002 }], stroke: '#c9a775', width: .014, opacity: 1 })
    rails.push({ points: [{ x: 1.71, y: y + .002 }, { x: 1.755, y: y + .002 }], stroke: '#a7b2a0', width: .011, opacity: 1 })
    for (let i = 0; i < 4; i++) rails.push({ points: [{ x: .8 + i * .025, y: y - .012 }, { x: .808 + i * .025, y: y + .011 }], stroke: '#a28d6b', width: .008, opacity: .8 })
  }
  return { cloth, rails }
}

function SvgMark({ mark }: { mark: Mark }) {
  const style = { fill: mark.fill ?? 'none', stroke: mark.stroke, strokeWidth: mark.width, opacity: mark.opacity, strokeDasharray: mark.dash?.join(' '), strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (mark.circle) return <circle cx={mark.circle.center.x} cy={mark.circle.center.y} r={mark.circle.radius} {...style} />
  if (mark.text) return <text x={mark.text.at.x} y={mark.text.at.y} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="600" fontSize=".027" letterSpacing=".006" {...style}>{mark.text.label}</text>
  const points = mark.points!.map(p => `${p.x},${p.y}`).join(' ')
  return mark.closed ? <polygon points={points} {...style} /> : <polyline points={points} {...style} />
}

/** Native SVG uses metres, matching the solver and the sandbox layout. */
export function TableConditionSvg({ conditions }: { conditions: TableConditions }) {
  const clipId = useId()
  const marks = useMemo(() => damageMarks(conditions), [conditions])
  return <g data-testid="table-condition-markings" pointerEvents="none" aria-hidden="true">
    <defs><clipPath id={clipId}><path d={CLOTH_OUTLINE} clipRule="evenodd" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>{marks.cloth.map((mark, i) => <SvgMark key={i} mark={mark} />)}</g>
    {marks.rails.map((mark, i) => <SvgMark key={i} mark={mark} />)}
  </g>
}

function makeDamageTexture(marks: Mark[], margin: number) {
  const canvas = document.createElement('canvas')
  const width = W + 2 * margin, depth = D + 2 * margin
  canvas.width = 2048
  canvas.height = Math.round(2048 * depth / width)
  const context = canvas.getContext('2d')!
  context.scale(canvas.width / width, canvas.height / depth)
  context.translate(margin, margin)
  if (margin === 0) {
    context.beginPath()
    context.rect(0, 0, W, D)
    for (const pocket of POCKET_GEOMETRY) {
      context.moveTo(pocket.center.x + pocket.radius, pocket.center.y)
      context.arc(pocket.center.x, pocket.center.y, pocket.radius, 0, Math.PI * 2)
    }
    context.clip('evenodd')
  }
  for (const mark of marks) {
    context.globalAlpha = mark.opacity
    context.lineWidth = mark.width ?? .002
    context.lineCap = context.lineJoin = 'round'
    context.setLineDash(mark.dash ?? [])
    if (mark.fill) context.fillStyle = mark.fill
    if (mark.stroke) context.strokeStyle = mark.stroke
    if (mark.text) {
      context.font = '600 .027px Arial, sans-serif'
      context.textAlign = 'center'
      context.fillText(mark.text.label, mark.text.at.x, mark.text.at.y)
      continue
    }
    context.beginPath()
    if (mark.circle) context.arc(mark.circle.center.x, mark.circle.center.y, mark.circle.radius, 0, Math.PI * 2)
    else {
      mark.points!.forEach((point, i) => i === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y))
      if (mark.closed) context.closePath()
    }
    if (mark.fill) context.fill()
    if (mark.stroke) context.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Identical marks are painted at the actual cloth and cushion heights in 3D. */
export function TableConditionSurface({ conditions }: { conditions: TableConditions }) {
  const textures = useMemo(() => {
    const marks = damageMarks(conditions)
    return { cloth: makeDamageTexture(marks.cloth, 0), rails: makeDamageTexture(marks.rails, .22) }
  }, [conditions])
  useEffect(() => () => { textures.cloth.dispose(); textures.rails.dispose() }, [textures])
  return <group>
    <mesh position={[0, CLOTH_Y + .001, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[W, D]} /><meshBasicMaterial map={textures.cloth} transparent depthWrite={false} toneMapped={false} />
    </mesh>
    <mesh position={[0, CLOTH_Y + .05, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[W + .44, D + .44]} /><meshBasicMaterial map={textures.rails} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  </group>
}

export function BallGrime({ id, dirt }: { id: number; dirt: number }) {
  return <group>
    {[0, 1, 2, 3, 4, 5].map(i => {
      const angle = (i * 2.4 + id * .8)
      const offset = TABLE.ballRadius * (.5 + (i % 2) * .22)
      const x = Math.cos(angle) * offset, z = Math.sin(angle) * offset
      const y = Math.sqrt(TABLE.ballRadius ** 2 - offset ** 2)
      return <mesh key={i} position={[x, y + .0002, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[.002 + (i % 3) * .0006, 8]} /><meshBasicMaterial color="#655438" transparent opacity={.45 + dirt * .4} depthWrite={false} />
      </mesh>
    })}
  </group>
}

/** Ball-local coordinates in metres, also suitable for the sandbox. */
export function BallGrimeSvg({ id, dirt }: { id: number; dirt: number }) {
  return <g pointerEvents="none" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => {
    const angle = i * 2.4 + id * .8
    const offset = TABLE.ballRadius * (.5 + (i % 2) * .22)
    return <circle key={i} cx={Math.cos(angle) * offset} cy={Math.sin(angle) * offset} r={.002 + (i % 3) * .0006} fill="#655438" opacity={.45 + dirt * .4} />
  })}</g>
}
