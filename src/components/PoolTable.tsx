import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { FinishOption, Scenario, ShotAnalysis, SimulationBall, Vec2 } from '../engine/types'
import { TABLE, positionToleranceForLevel } from '../engine/constants'

export interface PoolTableProps {
  scenario: Scenario
  selectedBall: number | null
  target: Vec2 | null
  onSelectBall: (id: number) => void
  finishOptions: FinishOption[]
  selectedOptionId: string | null
  onSelectOption: (id: string) => void
  selectableBallIds: number[]
  analysis: ShotAnalysis | null
  showEnsemble: boolean
  playing: boolean
  playbackKey: number
  onPlaybackEnd: () => void
  view: 'table' | 'top'
  interactive: boolean
}

const WIDTH = TABLE.length
const DEPTH = TABLE.width
const RADIUS = TABLE.ballRadius
const CORNER_GAP = TABLE.cornerMouth / Math.SQRT2
const SIDE_GAP = TABLE.sideMouth / 2
const CLOTH_Y = 0.062
const BALL_Y = CLOTH_Y + RADIUS
const ENSEMBLE_COLORS = { cue: '#dbecb3', pot: '#78d9ec', miss: '#f49b85' } as const
const COLORS: Record<number, string> = {
  0: '#f6f5e9', 1: '#e5bb37', 2: '#3763b0', 3: '#bd4337', 4: '#65458a',
  5: '#dd783c', 6: '#287a65', 7: '#81372d', 8: '#202523', 9: '#e5bb37',
  10: '#3763b0', 11: '#bd4337', 12: '#65458a', 13: '#dd783c', 14: '#287a65', 15: '#81372d',
}
const POCKET_POSITIONS: [number, number, boolean][] = [
  [-WIDTH / 2, -DEPTH / 2, false], [0, -DEPTH / 2 - 0.018, true], [WIDTH / 2, -DEPTH / 2, false],
  [-WIDTH / 2, DEPTH / 2, false], [0, DEPTH / 2 + 0.018, true], [WIDTH / 2, DEPTH / 2, false],
]
const toWorld = (p: Vec2, height = CLOTH_Y + 0.004): [number, number, number] => [p.x - WIDTH / 2, height, p.y - DEPTH / 2]
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

type Runtime = { balls: Map<number, SimulationBall>; elapsed: number; active: boolean; complete: boolean }

function makeClothTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#287969'
  ctx.fillRect(0, 0, 256, 256)
  // Deterministic fine wool weave; no image downloads or external textures.
  let seed = 4472
  for (let y = 0; y < 256; y += 2) {
    for (let x = 0; x < 256; x += 2) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      ctx.fillStyle = `rgba(${seed % 2 ? '184,219,189' : '6,47,38'},${0.025 + (seed % 9) / 250})`
      ctx.fillRect(x, y, 1, 2)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(8, 4)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function makeWoodTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#302b24'
  ctx.fillRect(0, 0, 512, 128)
  for (let i = 0; i < 100; i++) {
    const y = (i * 19.7) % 128
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(116,94,69,.13)' : 'rgba(5,8,7,.17)'
    ctx.lineWidth = 0.4 + (i % 3) * 0.4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(130, y + Math.sin(i) * 5, 330, y - Math.cos(i) * 4, 512, y + Math.sin(i) * 2)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeNumberTexture(id: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.fillStyle = '#f7f5e9'
  ctx.beginPath()
  ctx.arc(64, 64, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#242b26'
  ctx.font = '600 76px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(id), 64, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeStripeTexture(id: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#f7f5e9'
  ctx.fillRect(0, 0, 128, 256)
  ctx.fillStyle = COLORS[id] || COLORS[1]
  ctx.fillRect(0, 69, 128, 118)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function CameraRig({ view }: Pick<PoolTableProps, 'view'>) {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.position.set(0, view === 'top' ? 6 : 5, view === 'top' ? 0.001 : 2.5)
    cam.up.set(0, 1, 0)
    cam.lookAt(0, 0, 0)
    cam.zoom = Math.min(size.width / 3.23, size.height / (view === 'top' ? 1.9 : 1.75))
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height, view])
  return null
}

function Cushion({ start, end, side }: { start: number; end: number; side: 'top' | 'bottom' | 'left' | 'right' }) {
  const geometry = useMemo(() => {
    const sideSign = side === 'top' || side === 'left' ? -1 : 1
    const horizontal = side === 'top' || side === 'bottom'
    const edge = horizontal ? DEPTH / 2 : WIDTH / 2
    const points = [
      [start, (edge + 0.003) * sideSign, CLOTH_Y + 0.035],
      [end, (edge + 0.003) * sideSign, CLOTH_Y + 0.035],
      [end + 0.042, (edge + 0.069) * sideSign, CLOTH_Y + 0.051],
      [start - 0.042, (edge + 0.069) * sideSign, CLOTH_Y + 0.051],
      [start, (edge + 0.003) * sideSign, CLOTH_Y],
      [end, (edge + 0.003) * sideSign, CLOTH_Y],
      [end + 0.042, (edge + 0.069) * sideSign, CLOTH_Y],
      [start - 0.042, (edge + 0.069) * sideSign, CLOTH_Y],
    ]
    const vertices = points.flatMap(([a, b, height]) => horizontal ? [a, height, b] : [b, height, a])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setIndex([0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7])
    geo.computeVertexNormals()
    return geo
  }, [start, end, side])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} castShadow receiveShadow><meshStandardMaterial color="#286e5b" roughness={0.94} side={THREE.DoubleSide} /></mesh>
}

function TableBed() {
  const cloth = useMemo(makeClothTexture, [])
  const wood = useMemo(makeWoodTexture, [])
  useEffect(() => () => { cloth.dispose(); wood.dispose() }, [cloth, wood])
  return <group>
    <RoundedBox args={[2.985, 0.19, 1.715]} radius={0.065} smoothness={4} position={[0, -0.065, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#141b19" roughness={0.52} metalness={0.12} />
    </RoundedBox>
    <RoundedBox args={[2.955, 0.066, 1.685]} radius={0.015} smoothness={4} position={[0, 0.022, 0]} receiveShadow>
      <meshStandardMaterial map={wood} roughness={0.55} metalness={0.08} />
    </RoundedBox>
    {[-1, 1].map(sign => <RoundedBox key={`long-rail-${sign}`} args={[2.945, 0.052, 0.14]} radius={0.018} smoothness={3} position={[0, 0.08, sign * 0.765]} receiveShadow castShadow>
      <meshStandardMaterial map={wood} roughness={0.52} metalness={0.06} />
    </RoundedBox>)}
    {[-1, 1].map(sign => <RoundedBox key={`short-rail-${sign}`} args={[0.14, 0.052, 1.41]} radius={0.014} smoothness={3} position={[sign * 1.402, 0.079, 0]} receiveShadow castShadow>
      <meshStandardMaterial map={wood} roughness={0.52} metalness={0.06} />
    </RoundedBox>)}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, CLOTH_Y, 0]} receiveShadow>
      <planeGeometry args={[WIDTH + 0.035, DEPTH + 0.035]} />
      <meshStandardMaterial map={cloth} roughness={1} />
    </mesh>
    {(['top', 'bottom'] as const).flatMap(side => [
      <Cushion key={`${side}-a`} side={side} start={-WIDTH / 2 + CORNER_GAP} end={-SIDE_GAP} />,
      <Cushion key={`${side}-b`} side={side} start={SIDE_GAP} end={WIDTH / 2 - CORNER_GAP} />,
    ])}
    <Cushion side="left" start={-DEPTH / 2 + CORNER_GAP} end={DEPTH / 2 - CORNER_GAP} />
    <Cushion side="right" start={-DEPTH / 2 + CORNER_GAP} end={DEPTH / 2 - CORNER_GAP} />
    {POCKET_POSITIONS.map(([x, z, side], i) => <group key={i} position={[x, CLOTH_Y + 0.002, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[side ? 0.075 : 0.079, 48]} />
        <meshStandardMaterial color="#070d0a" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[side ? 0.067 : 0.071, side ? 0.075 : 0.079, 48]} />
        <meshStandardMaterial color="#48413a" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[side ? 0.064 : 0.068, 48]} />
        <meshBasicMaterial color="#070c09" />
      </mesh>
    </group>)}
    {[-0.953, -0.635, -0.3175, 0.3175, 0.635, 0.953].flatMap((x) => [-1, 1].map(sign =>
      <mesh key={`${x}-${sign}`} position={[x, 0.107, sign * 0.772]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.012, 0.012]} /><meshStandardMaterial color="#d1cbbb" roughness={0.4} metalness={0.2} />
      </mesh>))}
    {[-0.3175, 0, 0.3175].flatMap((z) => [-1, 1].map(sign =>
      <mesh key={`${z}-${sign}`} position={[sign * 1.407, 0.106, z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.012, 0.012]} /><meshStandardMaterial color="#d1cbbb" roughness={0.4} metalness={0.2} />
      </mesh>))}
    {/* Foot and head spots are physically placed at quarter-table distances. */}
    {[WIDTH / 4, WIDTH * 3 / 4].map(x => <mesh key={x} position={[x - WIDTH / 2, CLOTH_Y + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.002, 0.004, 24]} /><meshBasicMaterial color="#a6bbaa" transparent opacity={0.42} depthWrite={false} />
    </mesh>)}
  </group>
}

function PlaybackDriver({ scenario, analysis, playing, playbackKey, onPlaybackEnd, runtime }: Pick<PoolTableProps, 'scenario' | 'analysis' | 'playing' | 'playbackKey' | 'onPlaybackEnd'> & { runtime: Runtime }) {
  const callback = useRef(onPlaybackEnd)
  useEffect(() => { callback.current = onPlaybackEnd }, [onPlaybackEnd])
  useEffect(() => {
    runtime.balls = new Map(scenario.balls.map(ball => [ball.id, { ...ball, position: { ...ball.position }, pocketed: false }]))
    runtime.active = false
    runtime.complete = false
    runtime.elapsed = 0
  }, [scenario, analysis, runtime])
  useEffect(() => {
    if (playing && analysis?.nominal.frames.length) {
      runtime.elapsed = 0
      runtime.complete = false
      runtime.active = true
    } else runtime.active = false
  }, [playing, playbackKey, analysis, runtime])
  useFrame((_, delta) => {
    if (!runtime.active || !analysis) return
    runtime.elapsed += Math.min(delta, 0.05) * 1.15
    const frames = analysis.nominal.frames
    if (!frames.length) return
    const last = frames[frames.length - 1]
    const current = Math.min(runtime.elapsed, last.time)
    let low = 0
    let high = frames.length - 1
    while (low < high) {
      const mid = (low + high) >>> 1
      if (frames[mid].time < current) low = mid + 1
      else high = mid
    }
    const b = frames[low]
    const a = frames[Math.max(0, low - 1)]
    const ratio = a === b ? 0 : clamp((current - a.time) / (b.time - a.time || 1), 0, 1)
    for (const next of b.balls) {
      const prev = a.balls.find(ball => ball.id === next.id) || next
      runtime.balls.set(next.id, {
        id: next.id,
        position: { x: THREE.MathUtils.lerp(prev.position.x, next.position.x, ratio), y: THREE.MathUtils.lerp(prev.position.y, next.position.y, ratio) },
        pocketed: next.pocketed && (prev.pocketed || ratio > 0.75),
      })
    }
    if (runtime.elapsed >= last.time + 0.5 && !runtime.complete) {
      runtime.active = false
      runtime.complete = true
      callback.current()
    }
  }, -1)
  return null
}

function PoolBall({ id, position, selected, interactive, onSelect, runtime }: { id: number; position: Vec2; selected: boolean; interactive: boolean; onSelect: (id: number) => void; runtime: Runtime }) {
  const group = useRef<THREE.Group>(null)
  const label = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const texture = useMemo(() => id ? makeNumberTexture(id) : null, [id])
  const stripe = useMemo(() => id > 8 ? makeStripeTexture(id) : null, [id])
  const [hovered, setHovered] = useState(false)
  const direction = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => () => { texture?.dispose(); stripe?.dispose() }, [texture, stripe])
  useEffect(() => {
    if (hovered && interactive) document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hovered, interactive])
  useFrame(() => {
    if (!group.current) return
    const state = runtime.balls.get(id)
    const p = state?.position || position
    group.current.position.set(p.x - WIDTH / 2, BALL_Y, p.y - DEPTH / 2)
    group.current.visible = !state?.pocketed
    if (label.current) {
      camera.getWorldDirection(direction).negate()
      label.current.position.copy(direction).multiplyScalar(RADIUS * 1.004)
      label.current.quaternion.copy(camera.quaternion)
    }
  })
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (interactive && id !== 0) onSelect(id)
  }
  return <group ref={group} position={toWorld(position, BALL_Y)}>
    <mesh castShadow onClick={onClick} onPointerDown={e => e.stopPropagation()} onPointerOver={e => { e.stopPropagation(); if (id) setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <sphereGeometry args={[RADIUS, 40, 28]} />
      <meshPhysicalMaterial color={stripe ? '#ffffff' : COLORS[id] || '#f4ead5'} map={stripe} roughness={0.19} metalness={0} clearcoat={0.6} clearcoatRoughness={0.12} />
    </mesh>
    {texture && <mesh ref={label} raycast={() => null}>
      <planeGeometry args={[RADIUS * 1.12, RADIUS * 1.12]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>}
    {id !== 0 && interactive && <mesh visible={false} onClick={onClick} onPointerDown={e => e.stopPropagation()} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <sphereGeometry args={[RADIUS * 1.65, 12, 12]} /><meshBasicMaterial />
    </mesh>}
    {(selected || (hovered && interactive)) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RADIUS + 0.003, 0]} raycast={() => null}>
      <ringGeometry args={[RADIUS * 1.43, RADIUS * 1.57, 64]} />
      <meshBasicMaterial color={selected ? '#d8e7ac' : '#c3d0bb'} transparent opacity={selected ? 1 : 0.55} depthWrite={false} />
    </mesh>}
  </group>
}

function PathLines({ paths, color, opacity = 1, dashed = false, height = CLOTH_Y + 0.005, dashSize = 0.025, gapSize = 0.018 }: { paths: Vec2[][]; color: string; opacity?: number; dashed?: boolean; height?: number; dashSize?: number; gapSize?: number }) {
  const object = useMemo(() => {
    const positions: number[] = []
    const distances: number[] = []
    for (const path of paths) {
      let distance = 0
      for (let i = 1; i < path.length; i++) {
        positions.push(...toWorld(path[i - 1], height), ...toWorld(path[i], height))
        distances.push(distance)
        distance += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
        distances.push(distance)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    // Restart each trial's dash phase at its origin so overlapping misses stay dashed.
    if (dashed) geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute(distances, 1))
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize, gapSize, depthWrite: false, toneMapped: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })
    const line = new THREE.LineSegments(geometry, material)
    line.renderOrder = 3
    line.raycast = () => {}
    return line
  }, [paths, color, opacity, dashed, height, dashSize, gapSize])
  useEffect(() => () => { object.geometry.dispose(); (object.material as THREE.Material).dispose() }, [object])
  return <primitive object={object} />
}

function TargetMarker({ target, tolerance }: { target: Vec2; tolerance: number }) {
  return <group position={toWorld(target, CLOTH_Y + 0.009)} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh raycast={() => null}><circleGeometry args={[tolerance, 64]} /><meshBasicMaterial color="#d7e2b7" transparent opacity={0.055} depthWrite={false} /></mesh>
    <mesh raycast={() => null}><ringGeometry args={[tolerance - 0.002, tolerance, 96]} /><meshBasicMaterial color="#d8e6b6" transparent opacity={0.45} depthWrite={false} /></mesh>
    <mesh position={[0, 0, 0.001]} raycast={() => null}><ringGeometry args={[0.011, 0.014, 32]} /><meshBasicMaterial color="#e2ecc9" transparent opacity={0.9} depthWrite={false} /></mesh>
    <mesh position={[0, 0, 0.002]} raycast={() => null}><planeGeometry args={[0.041, 0.002]} /><meshBasicMaterial color="#e2ecc9" transparent opacity={0.75} depthWrite={false} /></mesh>
    <mesh position={[0, 0, 0.002]} raycast={() => null}><planeGeometry args={[0.002, 0.041]} /><meshBasicMaterial color="#e2ecc9" transparent opacity={0.75} depthWrite={false} /></mesh>
  </group>
}


/** Separate letter badges in screen space while leaders preserve exact physical endpoints. */
function separateBadges(points: Vec2[], minDistance: number, bounds?: { left: number; right: number; top: number; bottom: number }) {
  const result = points.map(point => ({ ...point }))
  for (let step = 0; step < 24; step++) {
    let moved = false
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const length = Math.hypot(dx, dy)
        if (length >= minDistance - 0.01) continue
        moved = true
        const ux = length > 0.01 ? dx / length : 1
        const uy = length > 0.01 ? dy / length : 0
        const shift = (minDistance - length) / 2
        a.x -= ux * shift; a.y -= uy * shift
        b.x += ux * shift; b.y += uy * shift
      }
    }
    if (bounds) for (const point of result) {
      const x = clamp(point.x, bounds.left, bounds.right), y = clamp(point.y, bounds.top, bounds.bottom)
      if (x !== point.x || y !== point.y) moved = true
      point.x = x; point.y = y
    }
    if (!moved) break
  }
  return result
}

function makeFinishTexture(label: string, selected: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.beginPath()
  ctx.arc(64, 64, 49, 0, Math.PI * 2)
  ctx.fillStyle = selected ? '#e9c389' : '#1a342b'
  ctx.fill()
  ctx.lineWidth = selected ? 5 : 3
  ctx.strokeStyle = selected ? '#f8dfb3' : '#d5e2b9'
  ctx.stroke()
  ctx.font = '600 58px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = selected ? '#243126' : '#eef1dd'
  ctx.fillText(label, 64, 66)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function FinishBadge({ option, selected, interactive, onSelect, location }: { option: FinishOption; selected: boolean; interactive: boolean; onSelect: (id: string) => void; location: THREE.Vector3 }) {
  const sprite = useRef<THREE.Sprite>(null)
  const [hovered, setHovered] = useState(false)
  const { camera } = useThree()
  const textures = useMemo(() => [makeFinishTexture(option.label, false), makeFinishTexture(option.label, true)], [option.label])
  const leader = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3))
    const material = new THREE.LineBasicMaterial({ color: '#e1e6bd', transparent: true, opacity: 0.7, depthWrite: false, depthTest: false })
    const line = new THREE.Line(geometry, material)
    line.renderOrder = 18
    line.raycast = () => {}
    return line
  }, [])
  useEffect(() => () => { textures.forEach(texture => texture.dispose()); leader.geometry.dispose(); (leader.material as THREE.Material).dispose() }, [textures, leader])
  useEffect(() => {
    if (hovered && interactive) document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hovered, interactive])
  useFrame(() => {
    if (!sprite.current) return
    sprite.current.position.copy(location)
    const scale = (hovered && interactive ? 41 : 38) / (camera as THREE.OrthographicCamera).zoom
    sprite.current.scale.set(scale, scale, 1)
    const positions = leader.geometry.getAttribute('position') as THREE.BufferAttribute
    positions.setXYZ(0, option.plan.target.x - WIDTH / 2, CLOTH_Y + 0.012, option.plan.target.y - DEPTH / 2)
    positions.setXYZ(1, location.x, location.y, location.z)
    positions.needsUpdate = true
    leader.geometry.computeBoundingSphere()
  })
  return <>
    <primitive object={leader} />
    <mesh position={toWorld(option.plan.target, CLOTH_Y + 0.012)} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <circleGeometry args={[0.01, 24]} /><meshBasicMaterial color={selected ? '#f1cc91' : '#dce9be'} depthWrite={false} />
    </mesh>
    <sprite ref={sprite} position={toWorld(option.plan.target, CLOTH_Y + 0.025)} renderOrder={20} onClick={event => { event.stopPropagation(); if (interactive) onSelect(option.id) }} onPointerDown={event => event.stopPropagation()} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <spriteMaterial map={textures[selected ? 1 : 0]} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  </>
}

function FinishMarkers({ options, selectedOptionId, interactive, onSelect }: { options: FinishOption[]; selectedOptionId: string | null; interactive: boolean; onSelect: (id: string) => void }) {
  const { camera, size } = useThree()
  const locations = useMemo(() => options.map(option => new THREE.Vector3(...toWorld(option.plan.target, CLOTH_Y + 0.025))), [options])
  const projections = useMemo(() => options.map(() => new THREE.Vector3()), [options])
  useFrame(() => {
    const points = options.map((option, i) => {
      projections[i].set(...toWorld(option.plan.target, CLOTH_Y + 0.025)).project(camera)
      return { x: (projections[i].x + 1) * size.width / 2, y: (1 - projections[i].y) * size.height / 2 }
    })
    const spaced = separateBadges(points, 42, { left: 24, right: size.width - 24, top: 24, bottom: size.height - 24 })
    spaced.forEach((point, i) => {
      locations[i].set(clamp(point.x, 24, size.width - 24) / size.width * 2 - 1, 1 - clamp(point.y, 24, size.height - 24) / size.height * 2, projections[i].z).unproject(camera)
    })
  }, -0.5)
  return <>{options.map((option, i) => <FinishBadge key={option.id} option={option} selected={option.id === selectedOptionId} interactive={interactive} onSelect={onSelect} location={locations[i]} />)}</>
}

function EnsembleEndpoints({ points }: { points: Vec2[] }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => toWorld(p, CLOTH_Y + 0.008)), 3))
    return geo
  }, [points])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <points geometry={geometry} raycast={() => null}><pointsMaterial size={0.008} color="#d9e7a9" transparent opacity={0.6} depthWrite={false} sizeAttenuation /></points>
}

function Scene(props: PoolTableProps) {
  const { scenario, selectedBall, target, analysis, showEnsemble, playing, interactive } = props
  const runtime = useMemo<Runtime>(() => ({ balls: new Map(), elapsed: 0, active: false, complete: false }), [])
  const selected = scenario.balls.find(b => b.id === selectedBall)
  const cue = scenario.balls.find(b => b.id === 0)
  const aimPath = useMemo(() => cue && selected ? [[cue.position, selected.position]] : [], [cue, selected])
  const nominalPaths = useMemo(() => analysis ? [analysis.nominal.cuePath] : [], [analysis])
  const objectPaths = useMemo(() => analysis ? [analysis.nominal.objectPath] : [], [analysis])
  const nominalObjectPotted = Boolean(analysis && analysis.nominal.potted.includes(analysis.plan.ballId) && analysis.nominal.firstContact === analysis.plan.ballId)
  const pottedObjectPaths = useMemo(() => analysis?.sampleObjectPaths?.filter(trial => trial.outcome === 'pot').map(trial => trial.path) ?? [], [analysis])
  const missedObjectPaths = useMemo(() => analysis?.sampleObjectPaths?.filter(trial => trial.outcome !== 'pot').map(trial => trial.path) ?? [], [analysis])
  return <>
    <CameraRig view={props.view} />
    <ambientLight intensity={1.2} color="#dce6d9" />
    <hemisphereLight args={['#eaf1e5', '#333c30', 1.25]} />
    <directionalLight position={[-1.8, 4, -1.5]} intensity={2.3} color="#fff6dc" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.002} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={1.5} shadow-camera-bottom={-1.5} shadow-camera-near={0.1} shadow-camera-far={10} />
    <directionalLight position={[2, 2, 2]} intensity={0.55} color="#d2e5e1" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.165, 0]} receiveShadow>
      <planeGeometry args={[3.5, 2.25]} /><shadowMaterial transparent opacity={0.22} />
    </mesh>
    <TableBed />
    <PlaybackDriver {...props} runtime={runtime} />
    {scenario.balls.map(ball => <PoolBall key={`${scenario.seed}-${ball.id}`} {...ball} selected={selectedBall === ball.id && !playing} interactive={interactive && !playing && props.selectableBallIds.includes(ball.id)} onSelect={props.onSelectBall} runtime={runtime} />)}
    {selected && cue && !analysis && !playing && <PathLines paths={aimPath} color="#e1e9cd" opacity={0.38} dashed height={BALL_Y} />}
    {!analysis && !playing && <FinishMarkers options={props.finishOptions} selectedOptionId={props.selectedOptionId} onSelect={props.onSelectOption} interactive={interactive} />}
    {target && !playing && <TargetMarker target={target} tolerance={positionToleranceForLevel(scenario.level)} />}
    {showEnsemble && analysis && <>
      <PathLines paths={analysis.samplePaths} color={ENSEMBLE_COLORS.cue} opacity={0.14} />
      <EnsembleEndpoints points={analysis.sampleEnds} />
      <PathLines paths={nominalPaths} color={ENSEMBLE_COLORS.cue} opacity={0.32} dashed height={CLOTH_Y + 0.006} />
      <PathLines paths={objectPaths} color={nominalObjectPotted ? ENSEMBLE_COLORS.pot : ENSEMBLE_COLORS.miss} opacity={0.16} dashed={!nominalObjectPotted} dashSize={0.045} gapSize={0.025} height={CLOTH_Y + 0.014} />
      <PathLines paths={pottedObjectPaths} color={ENSEMBLE_COLORS.pot} opacity={0.30} height={CLOTH_Y + 0.015} />
      <PathLines paths={missedObjectPaths} color={ENSEMBLE_COLORS.miss} opacity={0.50} dashed dashSize={0.045} gapSize={0.025} height={CLOTH_Y + 0.016} />
    </>}
  </>
}

class CanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Fully interactive 2D fallback for browsers without WebGL. */
function FlatTable(props: PoolTableProps) {
  const { scenario, selectedBall, target, analysis, showEnsemble, interactive, playing, playbackKey, onPlaybackEnd } = props
  const [frame, setFrame] = useState<SimulationBall[] | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgScale, setSvgScale] = useState(2)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const update = () => { const box = svg.getBoundingClientRect(); setSvgScale(Math.max(0.1, Math.min(box.width / 298, box.height / 175))) }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  const callback = useRef(onPlaybackEnd)
  useEffect(() => { callback.current = onPlaybackEnd }, [onPlaybackEnd])
  useEffect(() => { setFrame(null) }, [scenario, analysis])
  useEffect(() => {
    if (!playing || !analysis?.nominal.frames.length) return
    let request = 0
    let started = 0
    const frames = analysis.nominal.frames
    const tick = (now: number) => {
      if (!started) started = now
      const t = (now - started) / 1000 * 1.15
      let low = 0, high = frames.length - 1
      while (low < high) { const mid = (low + high) >>> 1; if (frames[mid].time < t) low = mid + 1; else high = mid }
      setFrame(frames[low].balls)
      if (t > frames[frames.length - 1].time + 0.5) callback.current()
      else request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [playing, playbackKey, analysis])
  const balls = frame || scenario.balls.map(ball => ({ ...ball, pocketed: false }))
  const nominalObjectPotted = Boolean(analysis && analysis.nominal.potted.includes(analysis.plan.ballId) && analysis.nominal.firstContact === analysis.plan.ballId)
  const badgePositions = separateBadges(props.finishOptions.map(option => ({ x: option.plan.target.x * 100, y: option.plan.target.y * 100 })), 42 / svgScale, { left: -22 + 19 / svgScale, right: 276 - 19 / svgScale, top: -24 + 19 / svgScale, bottom: 151 - 19 / svgScale })
  return <svg ref={svgRef} viewBox="-22 -24 298 175" width="100%" height="100%" role="group" aria-label="Interactive pool table, top view" style={{ display: 'block' }}>
    <defs>
      <linearGradient id="table-cloth" x2="0.9" y2="1"><stop stopColor="#337b68" /><stop offset="1" stopColor="#256b59" /></linearGradient>
      <radialGradient id="ball-shine" cx=".3" cy=".2" r=".8"><stop stopColor="white" stopOpacity=".65" /><stop offset=".45" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity=".3" /></radialGradient>
      <filter id="ball-shadow" x="-1" y="-1" width="3" height="3"><feDropShadow dx=".3" dy=".8" stdDeviation=".7" floodOpacity=".45" /></filter>
    </defs>
    <rect x="-19" y="-16" width="292" height="164" rx="7" fill="#121b17" />
    <rect x="-18" y="-18" width="290" height="163" rx="6" fill="#322e26" stroke="#50483a" strokeWidth=".5" />
    <rect x="-4" y="-4" width="262" height="135" rx="2" fill="#235443" />
    <rect width="254" height="127" fill="url(#table-cloth)" />
    {POCKET_POSITIONS.map(([x, y, side], i) => <circle key={i} cx={(x + WIDTH / 2) * 100} cy={(y + DEPTH / 2) * 100} r={side ? 7 : 7.6} fill="#080e0b" stroke="#4a4339" strokeWidth="1.2" />)}
    {[-0.953, -0.635, -0.3175, 0.3175, 0.635, 0.953].flatMap((x, i) => [-1, 1].map(sign => <rect key={`${i}-${sign}`} x={(x + WIDTH / 2) * 100 - .6} y={(sign * .772 + DEPTH / 2) * 100 - .6} width="1.2" height="1.2" fill="#bfb9a7" transform={`rotate(45 ${(x + WIDTH / 2) * 100} ${(sign * .772 + DEPTH / 2) * 100})`} />))}
    {showEnsemble && analysis && <g data-testid="ensemble-paths" fill="none" pointerEvents="none">
      {analysis.samplePaths.map((path, i) => <polyline key={`cue-${i}`} data-testid="cue-ensemble-path" points={path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.cue} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".14" />)}
      <polyline points={analysis.nominal.cuePath.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.cue} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".32" strokeDasharray="2.5 1.8" />
      <polyline points={analysis.nominal.objectPath.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={nominalObjectPotted ? ENSEMBLE_COLORS.pot : ENSEMBLE_COLORS.miss} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".16" strokeDasharray={nominalObjectPotted ? undefined : '4.5 2.5'} />
      {analysis.sampleObjectPaths?.filter(trial => trial.outcome === 'pot').map((trial, i) => <polyline key={`object-pot-${i}`} data-testid="object-pot-path" points={trial.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.pot} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".30" />)}
      {analysis.sampleObjectPaths?.filter(trial => trial.outcome !== 'pot').map((trial, i) => <polyline key={`object-miss-${i}`} data-testid={trial.outcome === 'foul' ? 'object-foul-path' : 'object-miss-path'} points={trial.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.miss} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".50" strokeDasharray="4.5 2.5" />)}
    </g>}
    {target && !playing && <g pointerEvents="none" stroke="#dce9b6" fill="none"><circle cx={target.x * 100} cy={target.y * 100} r={positionToleranceForLevel(scenario.level) * 100} strokeWidth=".3" opacity=".55" /><path d={`M${target.x * 100 - 2},${target.y * 100}h4M${target.x * 100},${target.y * 100 - 2}v4`} strokeWidth=".3" /></g>}
    {balls.filter(b => !b.pocketed).map(ball => <g key={ball.id} transform={`translate(${ball.position.x * 100} ${ball.position.y * 100})`} role={ball.id ? 'button' : 'img'} aria-label={ball.id ? `Table ball ${ball.id}` : 'Cue ball'} aria-disabled={ball.id ? !interactive || playing || !props.selectableBallIds.includes(ball.id) : undefined} tabIndex={interactive && !playing && props.selectableBallIds.includes(ball.id) ? 0 : -1} onPointerDown={e => e.stopPropagation()} onClick={() => { if (interactive && props.selectableBallIds.includes(ball.id) && !playing) props.onSelectBall(ball.id) }} onKeyDown={event => { if (interactive && !playing && props.selectableBallIds.includes(ball.id) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); props.onSelectBall(ball.id) } }} style={{ cursor: interactive && props.selectableBallIds.includes(ball.id) ? 'pointer' : undefined }}>
      {selectedBall === ball.id && !playing && <circle r="4.5" fill="none" stroke="#dbe9b5" strokeWidth=".4" />}
      <circle r="2.8575" fill={COLORS[ball.id]} filter="url(#ball-shadow)" />
      <circle r="2.8575" fill="url(#ball-shine)" />
      {!!ball.id && <><circle r="1.48" fill="#f2f0e4" /><text y=".08" textAnchor="middle" dominantBaseline="central" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="2.25" fill="#20271f">{ball.id}</text></>}
      <circle r="5" fill="transparent" />
    </g>)}
    {!analysis && !playing && props.finishOptions.map((option, i) => {
      const selected = option.id === props.selectedOptionId
      const point = badgePositions[i]
      const select = () => { if (interactive) props.onSelectOption(option.id) }
      return <g key={option.id}>
        <line x1={option.plan.target.x * 100} y1={option.plan.target.y * 100} x2={point.x} y2={point.y} stroke="#dce5b7" strokeWidth={1 / svgScale} opacity=".7" pointerEvents="none" />
        <circle cx={option.plan.target.x * 100} cy={option.plan.target.y * 100} r="1" fill="#dce5b7" pointerEvents="none" />
        <g transform={`translate(${point.x} ${point.y})`} role="button" aria-label={`Table finish ${option.label}`} aria-pressed={selected} aria-disabled={!interactive} tabIndex={interactive ? 0 : -1} onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select() } }} style={{ cursor: interactive ? 'pointer' : undefined }}>
          <circle r={19 / svgScale} fill="transparent" />
          <circle r={15 / svgScale} fill={selected ? '#e9c389' : '#1a342b'} stroke={selected ? '#f8dfb3' : '#d5e2b9'} strokeWidth={(selected ? 1.5 : 1) / svgScale} />
          <text y={.5 / svgScale} textAnchor="middle" dominantBaseline="central" fontFamily="Arial,sans-serif" fontWeight="600" fontSize={17 / svgScale} fill={selected ? '#243126' : '#eef1dd'} pointerEvents="none">{option.label}</text>
        </g>
      </g>
    })}
  </svg>
}

export default function PoolTable(props: PoolTableProps) {
  const [available] = useState(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2')
      if (!gl) return false
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      return true
    } catch { return false }
  })
  const fallback = <FlatTable {...props} />
  return <div className="pool-table-scene" style={{ width: '100%', height: '100%', minHeight: 280, position: 'relative' }}>
    {available ? <CanvasBoundary fallback={fallback}>
      <Canvas orthographic camera={{ position: [0, 5, 2.5], zoom: 230, near: 0.1, far: 30 }} shadows={{ type: THREE.PCFSoftShadowMap }} dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={fallback} onCreated={({ gl }) => { gl.setClearColor('#0f1713', 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05 }} style={{ touchAction: 'none' }}>
        <Suspense fallback={null}><Scene {...props} /></Suspense>
      </Canvas>
    </CanvasBoundary> : fallback}
    {!available && <span style={{ position: 'absolute', bottom: 8, right: 16, fontSize: 10, color: '#88978b' }}>2D view · WebGL unavailable</span>}
  </div>
}
