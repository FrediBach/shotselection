import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { TableFurniture } from './table/TableFurniture'
import { TableLighting } from './table/TableLighting'
import * as THREE from 'three'
import type { FinishOption, Scenario, ShotAnalysis, SimulationBall, SimulationSoundEvent, Vec2 } from '../engine/types'
import { TABLE, positionToleranceForLevel } from '../engine/constants'
import { CUSHIONS, POCKET_GEOMETRY } from '../engine/table-geometry'
import { PlaybackSoundCursor } from '../lib/playback-events'

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
  showFinishes: boolean
  playing: boolean
  playbackKey: number
  onPlaybackEnd: () => void
  onPlaybackSound?: (event: SimulationSoundEvent) => void
  interactive: boolean
}

const WIDTH = TABLE.length
const DEPTH = TABLE.width
const RADIUS = TABLE.ballRadius
const CLOTH_Y = 0.062
const BALL_Y = CLOTH_Y + RADIUS
const ENSEMBLE_COLORS = { cue: '#dbecb3', pot: '#78d9ec', miss: '#f49b85' } as const
const POSITION_COLOR = '#8ce6df'
const NOMINAL_FINISH_COLOR = '#f8dfb3'
const COLORS: Record<number, string> = {
  0: '#f5f1df', 1: '#e7af12', 2: '#174593', 3: '#b6251d', 4: '#4c207d',
  5: '#e36a16', 6: '#076342', 7: '#681e27', 8: '#11161a', 9: '#e7af12',
  10: '#3763b0', 11: '#bd4337', 12: '#65458a', 13: '#dd783c', 14: '#287a65', 15: '#81372d',
}
const toWorld = (p: Vec2, height = CLOTH_Y + 0.004): [number, number, number] => [p.x - WIDTH / 2, height, p.y - DEPTH / 2]
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

type Runtime = { balls: Map<number, SimulationBall>; elapsed: number; active: boolean; complete: boolean }

function makeNumberTexture(id: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 128, 128)
  ctx.fillStyle = '#f7f5e9'
  ctx.beginPath()
  ctx.arc(64, 64, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111510'
  ctx.font = '700 80px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(id), 64, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Curved resin inlay: its normals and reflections follow the ball surface. */
function makeNumberCap() {
  const geometry = new THREE.PlaneGeometry(RADIUS * 1.12, RADIUS * 1.12, 24, 24)
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const radius = RADIUS + 0.000035
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i)
    const z = Math.sqrt(radius * radius - x * x - y * y)
    positions.setZ(i, z)
    normals.setXYZ(i, x / radius, y / radius, z / radius)
  }
  geometry.computeBoundingSphere()
  return geometry
}

function makeContactTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(0,0,0,.48)')
  gradient.addColorStop(0.28, 'rgba(0,0,0,.26)')
  gradient.addColorStop(0.6, 'rgba(0,0,0,.08)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
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

function TopDownCamera() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera
    cam.position.set(0, 6, 0.001)
    cam.up.set(0, 1, 0)
    cam.lookAt(0, 0, 0)
    cam.zoom = Math.min(size.width / 3.23, size.height / 1.9)
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function PlaybackDriver({ scenario, analysis, playing, playbackKey, onPlaybackEnd, onPlaybackSound, runtime }: Pick<PoolTableProps, 'scenario' | 'analysis' | 'playing' | 'playbackKey' | 'onPlaybackEnd' | 'onPlaybackSound'> & { runtime: Runtime }) {
  const callback = useRef(onPlaybackEnd)
  const soundCallback = useRef(onPlaybackSound)
  const sounds = useRef<PlaybackSoundCursor | null>(null)
  useEffect(() => { callback.current = onPlaybackEnd }, [onPlaybackEnd])
  useEffect(() => { soundCallback.current = onPlaybackSound }, [onPlaybackSound])
  useEffect(() => {
    runtime.balls = new Map(scenario.balls.map(ball => [ball.id, { ...ball, position: { ...ball.position }, pocketed: false }]))
    runtime.active = false
    runtime.complete = false
    runtime.elapsed = 0
    sounds.current = null
  }, [scenario, analysis, runtime])
  useEffect(() => {
    if (playing && analysis?.nominal.frames.length) {
      runtime.elapsed = 0
      runtime.complete = false
      runtime.active = true
      sounds.current = new PlaybackSoundCursor(analysis.nominal.soundEvents ?? [])
    } else runtime.active = false
    return () => { runtime.active = false; sounds.current = null }
  }, [playing, playbackKey, scenario, analysis, runtime])
  useFrame((_, delta) => {
    if (!playing || !runtime.active || !analysis || document.hidden) return
    runtime.elapsed += Math.min(delta, 0.05) * 1.15
    const frames = analysis.nominal.frames
    if (!frames.length) return
    const last = frames[frames.length - 1]
    const current = Math.min(runtime.elapsed, last.time)
    sounds.current?.advance(current, soundCallback.current)
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

function PoolBall({ id, position, selected, isNext, interactive, onSelect, runtime }: { id: number; position: Vec2; selected: boolean; isNext: boolean; interactive: boolean; onSelect: (id: number) => void; runtime: Runtime }) {
  const group = useRef<THREE.Group>(null)
  const label = useRef<THREE.Mesh>(null)
  const drop = useRef(0)
  const { camera } = useThree()
  const texture = useMemo(() => id ? makeNumberTexture(id) : null, [id])
  const stripe = useMemo(() => id > 8 ? makeStripeTexture(id) : null, [id])
  const cap = useMemo(makeNumberCap, [])
  const contact = useMemo(makeContactTexture, [])
  const [hovered, setHovered] = useState(false)
  useEffect(() => () => { texture?.dispose(); stripe?.dispose(); cap.dispose(); contact.dispose() }, [texture, stripe, cap, contact])
  useEffect(() => {
    if (hovered && interactive) document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hovered, interactive])
  useFrame((_, delta) => {
    if (!group.current) return
    const state = runtime.balls.get(id)
    const p = state?.position || position
    // The solver decides when a ball drops; this short visual fall only eases
    // its disappearance into the pocket and never changes the shot outcome.
    drop.current = state?.pocketed ? Math.min(1, drop.current + delta / 0.19) : 0
    group.current.position.set(p.x - WIDTH / 2, BALL_Y - 0.15 * drop.current ** 2, p.y - DEPTH / 2)
    group.current.visible = drop.current < 1
    if (label.current) {
      label.current.quaternion.copy(camera.quaternion)
    }
  })
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (interactive && id !== 0) onSelect(id)
  }
  return <group ref={group} position={toWorld(position, BALL_Y)}>
    <mesh castShadow onClick={onClick} onPointerDown={e => e.stopPropagation()} onPointerOver={e => { e.stopPropagation(); if (id) setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <sphereGeometry args={[RADIUS, 64, 40]} />
      <meshPhysicalMaterial color={stripe ? '#ffffff' : COLORS[id] || '#f4ead5'} map={stripe} roughness={0.15} metalness={0} clearcoat={1} clearcoatRoughness={0.075} ior={1.57} envMapIntensity={1.2} />
    </mesh>
    {texture && <mesh ref={label} geometry={cap} raycast={() => null}>
      <meshPhysicalMaterial map={texture} transparent alphaTest={0.03} roughness={0.19} clearcoat={0.7} clearcoatRoughness={0.11} ior={1.57} envMapIntensity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RADIUS + 0.0006, 0]} raycast={() => null}>
      <planeGeometry args={[RADIUS * 3.1, RADIUS * 3.1]} />
      <meshBasicMaterial map={contact} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
    </mesh>
    {id !== 0 && interactive && <mesh visible={false} onClick={onClick} onPointerDown={e => e.stopPropagation()} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <sphereGeometry args={[RADIUS * 1.65, 12, 12]} /><meshBasicMaterial />
    </mesh>}
    {(selected || (hovered && interactive)) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RADIUS + 0.003, 0]} raycast={() => null}>
      <ringGeometry args={[RADIUS * 1.43, RADIUS * 1.57, 64]} />
      <meshBasicMaterial color={selected ? '#d8e7ac' : '#c3d0bb'} transparent opacity={selected ? 1 : 0.55} depthWrite={false} />
    </mesh>}
    {isNext && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RADIUS + 0.006, 0]} raycast={() => null}>
      <ringGeometry args={[RADIUS * 1.85, RADIUS * 1.97, 64]} />
      <meshBasicMaterial color={POSITION_COLOR} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
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

function PositionZone({ target, radius }: { target: Vec2; radius: number }) {
  return <group position={toWorld(target, CLOTH_Y + 0.01)} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh raycast={() => null}><circleGeometry args={[radius, 96]} /><meshBasicMaterial color={POSITION_COLOR} transparent opacity={0.13} depthWrite={false} toneMapped={false} /></mesh>
    <mesh raycast={() => null}><ringGeometry args={[Math.max(0, radius - 0.004), radius, 96]} /><meshBasicMaterial color={POSITION_COLOR} transparent opacity={0.9} depthWrite={false} toneMapped={false} /></mesh>
  </group>
}

/** Reveal the inspected stroke's settled finish only after the choice is scored. */
function NominalCueFinishMarker({ position }: { position: Vec2 }) {
  return <group position={toWorld(position, CLOTH_Y + 0.024)} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh raycast={() => null} renderOrder={8}><ringGeometry args={[0.017, 0.022, 48]} /><meshBasicMaterial color={NOMINAL_FINISH_COLOR} transparent opacity={0.95} depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
    <mesh raycast={() => null} renderOrder={8}><planeGeometry args={[0.065, 0.0025]} /><meshBasicMaterial color={NOMINAL_FINISH_COLOR} transparent opacity={0.95} depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
    <mesh raycast={() => null} renderOrder={8}><planeGeometry args={[0.0025, 0.065]} /><meshBasicMaterial color={NOMINAL_FINISH_COLOR} transparent opacity={0.95} depthWrite={false} depthTest={false} toneMapped={false} /></mesh>
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

function EnsembleFinishes({ trials }: { trials: SimulationBall[][] }) {
  const fill = useRef<THREE.InstancedMesh>(null)
  const outline = useRef<THREE.InstancedMesh>(null)
  const balls = useMemo(() => trials.flatMap(trial => trial.filter(ball => !ball.pocketed)), [trials])
  useLayoutEffect(() => {
    const marker = new THREE.Object3D()
    marker.rotation.x = -Math.PI / 2
    const color = new THREE.Color()
    const white = new THREE.Color('#ffffff')
    for (const mesh of [fill.current, outline.current]) {
      if (!mesh) continue
      balls.forEach((ball, index) => {
        marker.position.set(...toWorld(ball.position, CLOTH_Y + 0.02))
        marker.updateMatrix()
        mesh.setMatrixAt(index, marker.matrix)
        mesh.setColorAt(index, color.set(COLORS[ball.id] ?? '#b8c6ab').lerp(white, 0.3))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [balls])
  return <group>
    <instancedMesh ref={fill} args={[undefined, undefined, balls.length]} raycast={() => null} renderOrder={4}>
      <circleGeometry args={[RADIUS, 32]} />
      <meshBasicMaterial transparent opacity={0.08} depthWrite={false} toneMapped={false} />
    </instancedMesh>
    <instancedMesh ref={outline} args={[undefined, undefined, balls.length]} raycast={() => null} renderOrder={5}>
      <ringGeometry args={[RADIUS * 0.9, RADIUS, 32]} />
      <meshBasicMaterial transparent opacity={0.45} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  </group>
}

function Scene(props: PoolTableProps) {
  const { scenario, selectedBall, target, analysis, showEnsemble, showFinishes, playing, interactive } = props
  const objective = scenario.objective
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
    <TopDownCamera />
    <TableLighting />
    <TableFurniture />
    <PlaybackDriver {...props} runtime={runtime} />
    {scenario.balls.map(ball => <PoolBall key={`${scenario.seed}-${ball.id}`} {...ball} selected={selectedBall === ball.id && !playing} isNext={objective?.nextBallId === ball.id} interactive={interactive && !playing && props.selectableBallIds.includes(ball.id)} onSelect={props.onSelectBall} runtime={runtime} />)}
    {selected && cue && !analysis && !playing && <PathLines paths={aimPath} color="#e1e9cd" opacity={0.38} dashed height={BALL_Y} />}
    {!objective && !analysis && !playing && <FinishMarkers options={props.finishOptions} selectedOptionId={props.selectedOptionId} onSelect={props.onSelectOption} interactive={interactive} />}
    {objective?.target && <PositionZone target={objective.target} radius={objective.radius} />}
    {!objective && target && !playing && <TargetMarker target={target} tolerance={positionToleranceForLevel(scenario.level)} />}
    {showEnsemble && analysis && <>
      <PathLines paths={analysis.samplePaths} color={ENSEMBLE_COLORS.cue} opacity={0.14} />
      <PathLines paths={nominalPaths} color={ENSEMBLE_COLORS.cue} opacity={0.32} dashed height={CLOTH_Y + 0.006} />
      <PathLines paths={objectPaths} color={nominalObjectPotted ? ENSEMBLE_COLORS.pot : ENSEMBLE_COLORS.miss} opacity={0.16} dashed={!nominalObjectPotted} dashSize={0.045} gapSize={0.025} height={CLOTH_Y + 0.014} />
      <PathLines paths={pottedObjectPaths} color={ENSEMBLE_COLORS.pot} opacity={0.30} height={CLOTH_Y + 0.015} />
      <PathLines paths={missedObjectPaths} color={ENSEMBLE_COLORS.miss} opacity={0.50} dashed dashSize={0.045} gapSize={0.025} height={CLOTH_Y + 0.016} />
    </>}
    {showFinishes && analysis && !playing && <EnsembleFinishes trials={analysis.sampleBallEnds} />}
    {objective && analysis?.nominal.stopped && !analysis.nominal.scratch && !playing && <NominalCueFinishMarker position={analysis.nominal.cueEnd} />}
  </>
}

class CanvasBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Fully interactive 2D fallback for browsers without WebGL. */
function FlatTable(props: PoolTableProps) {
  const { scenario, selectedBall, target, analysis, showEnsemble, showFinishes, interactive, playing, playbackKey, onPlaybackEnd, onPlaybackSound } = props
  const objective = scenario.objective
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
  const soundCallback = useRef(onPlaybackSound)
  useEffect(() => { callback.current = onPlaybackEnd }, [onPlaybackEnd])
  useEffect(() => { soundCallback.current = onPlaybackSound }, [onPlaybackSound])
  useEffect(() => { setFrame(null) }, [scenario, analysis])
  useEffect(() => {
    if (!playing || !analysis?.nominal.frames.length) return
    let request = 0
    let previous: number | null = null
    let elapsed = 0
    const frames = analysis.nominal.frames
    const sounds = new PlaybackSoundCursor(analysis.nominal.soundEvents ?? [])
    const tick = (now: number) => {
      const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05)
      previous = now
      if (document.hidden) { request = requestAnimationFrame(tick); return }
      elapsed += delta * 1.15
      const t = Math.min(elapsed, frames[frames.length - 1].time)
      sounds.advance(t, soundCallback.current)
      let low = 0, high = frames.length - 1
      while (low < high) { const mid = (low + high) >>> 1; if (frames[mid].time < t) low = mid + 1; else high = mid }
      setFrame(frames[low].balls)
      if (elapsed > frames[frames.length - 1].time + 0.5) callback.current()
      else request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [playing, playbackKey, scenario, analysis])
  const balls = frame || scenario.balls.map(ball => ({ ...ball, pocketed: false }))
  const nominalObjectPotted = Boolean(analysis && analysis.nominal.potted.includes(analysis.plan.ballId) && analysis.nominal.firstContact === analysis.plan.ballId)
  const badgePositions = separateBadges(props.finishOptions.map(option => ({ x: option.plan.target.x * 100, y: option.plan.target.y * 100 })), 42 / svgScale, { left: -22 + 19 / svgScale, right: 276 - 19 / svgScale, top: -24 + 19 / svgScale, bottom: 151 - 19 / svgScale })
  return <svg ref={svgRef} viewBox="-22 -24 298 175" width="100%" height="100%" role="group" aria-label="Interactive pool table, top view" style={{ display: 'block' }}>
    <defs>
      <radialGradient id="table-cloth" cx=".45" cy=".38" r=".75"><stop stopColor="#248873" /><stop offset=".7" stopColor="#197763" /><stop offset="1" stopColor="#115a4d" /></radialGradient>
      <linearGradient id="table-walnut" x2=".25" y2="1"><stop stopColor="#7e5034" /><stop offset=".16" stopColor="#54321f" /><stop offset=".48" stopColor="#71472b" /><stop offset=".9" stopColor="#452a1c" /><stop offset="1" stopColor="#9b7050" /></linearGradient>
      <linearGradient id="cushion-fabric" x2=".3" y2="1"><stop stopColor="#45947a" /><stop offset=".28" stopColor="#277a61" /><stop offset="1" stopColor="#1a5946" /></linearGradient>
      <filter id="wood-grain" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency=".025 .8" numOctaves="2" seed="8" /><feColorMatrix type="saturate" values="0" /><feBlend in="SourceGraphic" mode="soft-light" /></filter>
      <filter id="cloth-weave" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="2.5" numOctaves="1" seed="3" /><feColorMatrix type="matrix" values="0 0 0 0 .3 0 0 0 0 .4 0 0 0 0 .35 0 0 0 .1 0" /><feBlend in="SourceGraphic" mode="soft-light" /></filter>
      <radialGradient id="pocket-well" cx=".5" cy=".3"><stop stopColor="#070a08" /><stop offset=".72" stopColor="#080b09" /><stop offset="1" stopColor="#3d3024" /></radialGradient>
      <radialGradient id="ball-shine" cx=".32" cy=".2" r=".8"><stop stopColor="white" stopOpacity=".85" /><stop offset=".16" stopColor="white" stopOpacity=".1" /><stop offset=".48" stopColor="white" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity=".48" /></radialGradient>
      <filter id="ball-shadow" x="-1" y="-1" width="3" height="3"><feDropShadow dx=".2" dy=".4" stdDeviation=".45" floodOpacity=".5" /></filter>
    </defs>
    <rect x="-19" y="-16" width="292" height="164" rx="7" fill="#121b17" />
    <rect x="-18" y="-18" width="290" height="163" rx="6" fill="url(#table-walnut)" stroke="#a9865c" strokeWidth=".35" filter="url(#wood-grain)" />
    <rect x={-TABLE.cushionDepth * 100} y={-TABLE.cushionDepth * 100} width={(WIDTH + 2 * TABLE.cushionDepth) * 100} height={(DEPTH + 2 * TABLE.cushionDepth) * 100} fill="url(#table-cloth)" />
    <rect width={WIDTH * 100} height={DEPTH * 100} fill="url(#table-cloth)" filter="url(#cloth-weave)" />
    <g pointerEvents="none">
      {POCKET_GEOMETRY.map(pocket => <g key={pocket.id}>
        <circle cx={pocket.center.x * 100} cy={pocket.center.y * 100} r={(pocket.radius + 0.0065) * 100} fill="#473425" stroke="#89654a" strokeWidth=".25" />
        <circle cx={pocket.center.x * 100} cy={pocket.center.y * 100} r={pocket.radius * 100} fill="url(#pocket-well)" />
      </g>)}
    </g>
    <g fill="url(#cushion-fabric)" stroke="#1b5342" strokeWidth=".25" pointerEvents="none">
      {CUSHIONS.map(cushion => <g key={cushion.id}>
        <polygon points={cushion.polygon.map(point => `${point.x * 100},${point.y * 100}`).join(' ')} />
        <line x1={cushion.nose.a.x * 100} y1={cushion.nose.a.y * 100} x2={cushion.nose.b.x * 100} y2={cushion.nose.b.y * 100} stroke="#103e30" strokeWidth=".55" />
        <line x1={cushion.polygon[2].x * 100} y1={cushion.polygon[2].y * 100} x2={cushion.polygon[3].x * 100} y2={cushion.polygon[3].y * 100} stroke="#65a58d" strokeWidth=".3" strokeOpacity=".65" />
      </g>)}
    </g>
    <g pointerEvents="none" fill="none"><rect x="-16.8" y="-16.8" width="287.6" height="160.6" rx="5.2" stroke="#c09c68" strokeOpacity=".4" strokeWidth=".25" /></g>
    {[-0.953, -0.635, -0.3175, 0.3175, 0.635, 0.953].flatMap((x, i) => [-1, 1].map(sign => <rect key={`${i}-${sign}`} x={(x + WIDTH / 2) * 100 - .6} y={(sign * .772 + DEPTH / 2) * 100 - .6} width="1.2" height="1.2" fill="#bfb9a7" transform={`rotate(45 ${(x + WIDTH / 2) * 100} ${(sign * .772 + DEPTH / 2) * 100})`} />))}
    {showEnsemble && analysis && <g data-testid="ensemble-paths" fill="none" pointerEvents="none">
      {analysis.samplePaths.map((path, i) => <polyline key={`cue-${i}`} data-testid="cue-ensemble-path" points={path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.cue} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".14" />)}
      <polyline points={analysis.nominal.cuePath.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.cue} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".32" strokeDasharray="2.5 1.8" />
      <polyline points={analysis.nominal.objectPath.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={nominalObjectPotted ? ENSEMBLE_COLORS.pot : ENSEMBLE_COLORS.miss} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".16" strokeDasharray={nominalObjectPotted ? undefined : '4.5 2.5'} />
      {analysis.sampleObjectPaths?.filter(trial => trial.outcome === 'pot').map((trial, i) => <polyline key={`object-pot-${i}`} data-testid="object-pot-path" points={trial.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.pot} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".30" />)}
      {analysis.sampleObjectPaths?.filter(trial => trial.outcome !== 'pot').map((trial, i) => <polyline key={`object-miss-${i}`} data-testid={trial.outcome === 'foul' ? 'object-foul-path' : 'object-miss-path'} points={trial.path.map(p => `${p.x * 100},${p.y * 100}`).join(' ')} stroke={ENSEMBLE_COLORS.miss} strokeWidth="1" vectorEffect="non-scaling-stroke" opacity=".50" strokeDasharray="4.5 2.5" />)}
    </g>}
    {showFinishes && analysis && !playing && <g data-testid="ensemble-finishes" pointerEvents="none">
      {analysis.sampleBallEnds.flatMap((trial, trialIndex) => trial.filter(ball => !ball.pocketed).map(ball => <circle key={`${trialIndex}-${ball.id}`} data-testid="ensemble-ball-finish" data-ball-id={ball.id} data-trial-index={trialIndex} cx={ball.position.x * 100} cy={ball.position.y * 100} r={RADIUS * 100} fill={COLORS[ball.id] ?? '#b8c6ab'} fillOpacity=".08" stroke={COLORS[ball.id] ?? '#b8c6ab'} strokeOpacity=".6" strokeWidth=".3" />))}
    </g>}
    {objective?.target && <g data-testid="position-objective" pointerEvents="none" role="img" aria-label={`Position zone: leave the cue ball inside this circle for ball ${objective.nextBallId}`}>
      <circle data-testid="position-zone" cx={objective.target.x * 100} cy={objective.target.y * 100} r={objective.radius * 100} fill={POSITION_COLOR} fillOpacity=".13" stroke={POSITION_COLOR} strokeOpacity=".9" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </g>}
    {!objective && target && !playing && <g pointerEvents="none" stroke="#dce9b6" fill="none"><circle cx={target.x * 100} cy={target.y * 100} r={positionToleranceForLevel(scenario.level) * 100} strokeWidth=".3" opacity=".55" /><path d={`M${target.x * 100 - 2},${target.y * 100}h4M${target.x * 100},${target.y * 100 - 2}v4`} strokeWidth=".3" /></g>}
    {balls.filter(b => !b.pocketed).map(ball => <g key={ball.id} transform={`translate(${ball.position.x * 100} ${ball.position.y * 100})`} role={ball.id ? 'button' : 'img'} aria-label={ball.id ? `Table ball ${ball.id}` : 'Cue ball'} aria-description={objective?.nextBallId === ball.id ? 'Next ball: leave the cue ball in the position zone to play this ball next.' : undefined} aria-disabled={ball.id ? !interactive || playing || !props.selectableBallIds.includes(ball.id) : undefined} tabIndex={interactive && !playing && props.selectableBallIds.includes(ball.id) ? 0 : -1} onPointerDown={e => e.stopPropagation()} onClick={() => { if (interactive && props.selectableBallIds.includes(ball.id) && !playing) props.onSelectBall(ball.id) }} onKeyDown={event => { if (interactive && !playing && props.selectableBallIds.includes(ball.id) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); props.onSelectBall(ball.id) } }} style={{ cursor: interactive && props.selectableBallIds.includes(ball.id) ? 'pointer' : undefined }}>
      {selectedBall === ball.id && !playing && <circle r="4.5" fill="none" stroke="#dbe9b5" strokeWidth=".4" />}
      {objective?.nextBallId === ball.id && <g data-testid="next-ball-marker" pointerEvents="none">
        <circle r={RADIUS * 197} fill="none" stroke={POSITION_COLOR} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </g>}
      <circle r={RADIUS * 100} fill={COLORS[ball.id]} filter="url(#ball-shadow)" />
      <circle r={RADIUS * 100} fill="url(#ball-shine)" />
      {!!ball.id && <><circle r="1.48" fill="#f2f0e4" /><text y=".08" textAnchor="middle" dominantBaseline="central" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="2.25" fill="#20271f">{ball.id}</text></>}
      <circle r="5" fill="transparent" />
    </g>)}
    {objective && analysis?.nominal.stopped && !analysis.nominal.scratch && !playing && <g data-testid="nominal-cue-finish" transform={`translate(${analysis.nominal.cueEnd.x * 100} ${analysis.nominal.cueEnd.y * 100})`} pointerEvents="none" role="img" aria-label="Nominal cue-ball finish for the inspected stroke" fill="none" stroke={NOMINAL_FINISH_COLOR}>
      <circle r="1.95" strokeWidth="1.3" vectorEffect="non-scaling-stroke" />
      <path d="M-3.25,0H3.25M0,-3.25V3.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </g>}
    {!objective && !analysis && !playing && props.finishOptions.map((option, i) => {
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
  return <div className="pool-table-scene" role={props.scenario.objective ? 'group' : undefined} aria-label={props.scenario.objective ? `Pool table. Pot ball ${props.scenario.objective.ballId} and leave the cue ball in the cyan position zone to play ball ${props.scenario.objective.nextBallId} next.` : undefined} style={{ width: '100%', height: '100%', minHeight: 280, position: 'relative' }}>
    {available ? <CanvasBoundary fallback={fallback}>
      <Canvas orthographic camera={{ position: [0, 6, 0.001], zoom: 230, near: 0.1, far: 30 }} shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={fallback} onCreated={({ gl }) => { gl.setClearColor('#0f1713', 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.08 }} style={{ touchAction: 'none' }}>
        <Suspense fallback={null}><Scene {...props} /></Suspense>
      </Canvas>
    </CanvasBoundary> : fallback}
    {!available && <span style={{ position: 'absolute', bottom: 8, right: 16, fontSize: 10, color: '#88978b' }}>2D view · WebGL unavailable</span>}
  </div>
}
