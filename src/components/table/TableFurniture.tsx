import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TABLE } from '../../engine/constants'
import { createTableMaterials } from './materials'

const W = TABLE.length
const D = TABLE.width
const CLOTH_Y = 0.062
const CORNER_GAP = TABLE.cornerMouth / Math.SQRT2
const SIDE_GAP = TABLE.sideMouth / 2
const RAIL_TOP = CLOTH_Y + 0.048

type Side = 'top' | 'bottom' | 'left' | 'right'
type Pocket = { x: number; z: number; side: boolean; sign: number; path: THREE.Path }

function roundedOutline(width: number, depth: number, radius: number) {
  const x = width / 2, y = depth / 2
  const shape = new THREE.Shape()
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.quadraticCurveTo(x, -y, x, -y + radius)
  shape.lineTo(x, y - radius)
  shape.quadraticCurveTo(x, y, x - radius, y)
  shape.lineTo(-x + radius, y)
  shape.quadraticCurveTo(-x, y, -x, y - radius)
  shape.lineTo(-x, -y + radius)
  shape.quadraticCurveTo(-x, -y, -x + radius, -y)
  return shape
}

/** Paths are in the shape's XY plane: shape Y maps to negative table Z. */
function pocketContours(): Pocket[] {
  const pockets: Pocket[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * W / 2, z = sz * D / 2
    const path = new THREE.Path()
    path.absarc(x, -z, CORNER_GAP, 0, Math.PI * 2, false)
    pockets.push({ x, z, side: false, sign: sz, path })
  }
  for (const sign of [-1, 1]) {
    const z = sign * D / 2
    const point = (a: number, b: number): [number, number] => [a, -(z + sign * b)]
    const path = new THREE.Path()
    path.moveTo(...point(-SIDE_GAP, 0))
    // Match the engine's 9 mm inward side jaws over their 36 mm depth.
    path.lineTo(...point(-SIDE_GAP + 0.009, 0.036))
    path.bezierCurveTo(...point(-0.062, 0.072), ...point(-0.036, 0.108), ...point(0, 0.108))
    path.bezierCurveTo(...point(0.036, 0.108), ...point(0.062, 0.072), ...point(SIDE_GAP - 0.009, 0.036))
    path.lineTo(...point(SIDE_GAP, 0))
    path.bezierCurveTo(...point(0.049, -0.033), ...point(-0.049, -0.033), ...point(-SIDE_GAP, 0))
    path.closePath()
    pockets.push({ x: 0, z, side: true, sign, path })
  }
  return pockets
}

function horizontalGeometry(shape: THREE.Shape, thickness = 0, bevel = 0) {
  const geometry = thickness
    ? new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 24 })
    : new THREE.ShapeGeometry(shape, 40)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function reverseWinding(geometry: THREE.BufferGeometry) {
  if (geometry.index) {
    const index = geometry.index
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i)
      index.setX(i, index.getX(i + 2)); index.setX(i + 2, a)
    }
  } else {
    for (const attribute of Object.values(geometry.attributes)) {
      const array = attribute.array
      for (let i = 0; i < attribute.count; i += 3) for (let c = 0; c < attribute.itemSize; c++) {
        const a = i * attribute.itemSize + c, b = (i + 2) * attribute.itemSize + c
        const value = array[a]; array[a] = array[b]; array[b] = value
      }
      attribute.needsUpdate = true
    }
  }
}

/** Local U follows each rail, V points outwards, local Z is height. */
function orientRail(geometry: THREE.BufferGeometry, side: Side, baseY: number) {
  const horizontal = side === 'top' || side === 'bottom'
  const sign = side === 'top' || side === 'left' ? -1 : 1
  const matrix = horizontal
    ? new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, baseY, 0, sign, 0, sign * D / 2, 0, 0, 0, 1)
    : new THREE.Matrix4().set(0, sign, 0, sign * W / 2, 0, 0, 1, baseY, 1, 0, 0, 0, 0, 0, 0, 1)
  geometry.applyMatrix4(matrix)
  if (matrix.determinant() < 0) reverseWinding(geometry)
  return geometry
}

function railGeometry(side: Side) {
  const horizontal = side === 'top' || side === 'bottom'
  const halfLength = (horizontal ? W : D) / 2
  const inner = 0.066, outer = 0.208
  const innerDepth = (u: number) => {
    let depth = inner
    for (const center of [-halfLength, halfLength]) {
      const x = u - center
      if (Math.abs(x) < 0.096) depth = Math.max(depth, Math.sqrt(0.096 ** 2 - x ** 2))
    }
    if (horizontal && Math.abs(u) < 0.09) depth = Math.max(depth, 0.031 + Math.sqrt(0.09 ** 2 - u ** 2))
    return depth
  }
  const shape = new THREE.Shape()
  const from = -halfLength - inner, to = halfLength + inner
  shape.moveTo(from, innerDepth(from))
  for (let i = 1; i <= 256; i++) {
    const u = from + (to - from) * i / 256
    shape.lineTo(u, innerDepth(u))
  }
  // Four diagonal joints make a real mitered frame instead of overlapping boxes.
  shape.lineTo(halfLength + outer, outer)
  shape.lineTo(-halfLength - outer, outer)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.0325, bevelEnabled: true, bevelSize: 0.0075, bevelThickness: 0.0075, bevelSegments: 5, steps: 1 })
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
  const uv: number[] = []
  for (let i = 0; i < positions.count; i++) {
    // Top faces and the long apron both keep grain parallel to rail length.
    const top = Math.abs(normals.getZ(i)) > 0.65
    const end = Math.abs(normals.getX(i)) > 0.8
    uv.push(end ? positions.getY(i) : positions.getX(i), top ? positions.getY(i) : positions.getZ(i))
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return orientRail(geometry, side, RAIL_TOP - 0.04)
}

function cushionGeometry(side: Side, start: number, end: number, startJaw: 'corner' | 'side', endJaw: 'corner' | 'side') {
  const nose = TABLE.ballDiameter * 0.635
  // A cloth-wrapped K-style cushion: small nose bevel, sloping crown, flat back.
  const profile: [number, number][] = [
    [0, nose], [0.0016, nose + 0.0027], [0.014, 0.045], [0.057, 0.0475],
    [0.069, 0.043], [0.069, 0.003], [0.019, 0.003], [0.0012, nose - 0.003],
  ]
  const positions: number[] = [], uv: number[] = []
  const capU = (u: number, depth: number, jaw: 'corner' | 'side', endSign: number) => {
    const amount = jaw === 'corner' ? Math.min(depth / 0.04, 1.45) * 0.043 : Math.min(depth / 0.036, 1.2) * 0.009
    return u + endSign * amount
  }
  const vertex = (index: number, far: boolean) => {
    const [v, h] = profile[index]
    return [capU(far ? end : start, v, far ? endJaw : startJaw, far ? 1 : -1), v, h] as const
  }
  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[], cap = false, across?: number[]) => {
    for (const [i, p] of [a, b, c].entries()) { positions.push(...p); uv.push(cap ? p[1] : p[0], across?.[i] ?? p[2]) }
  }
  let clothDistance = 0
  for (let j = 0; j < profile.length; j++) {
    const next = (j + 1) % profile.length
    const a = vertex(j, false), b = vertex(j, true), c = vertex(next, true), d = vertex(next, false)
    const nextDistance = clothDistance + Math.hypot(profile[next][0] - profile[j][0], profile[next][1] - profile[j][1])
    addTriangle(a, b, c, false, [clothDistance, clothDistance, nextDistance])
    addTriangle(a, c, d, false, [clothDistance, nextDistance, nextDistance])
    clothDistance = nextDistance
  }
  for (let i = 1; i < profile.length - 1; i++) {
    addTriangle(vertex(0, false), vertex(i + 1, false), vertex(i, false), true)
    addTriangle(vertex(0, true), vertex(i, true), vertex(i + 1, true), true)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals() // Independent faces keep the crown and jaws crisp.
  return orientRail(geometry, side, CLOTH_Y)
}

function wellGeometry(pocket: Pocket, clothLip: boolean) {
  const contour = pocket.path.getSpacedPoints(96).slice(0, -1)
  const centerZ = pocket.z + (pocket.side ? pocket.sign * 0.028 : 0)
  const levels = clothLip
    ? [{ y: CLOTH_Y, scale: 1 }, { y: CLOTH_Y - 0.009, scale: 1 }]
    : [{ y: CLOTH_Y - 0.008, scale: 1 }, { y: CLOTH_Y - 0.03, scale: 1.015 }, { y: CLOTH_Y - 0.11, scale: 0.82 }, { y: CLOTH_Y - 0.195, scale: 0.68 }]
  const positions: number[] = [], uv: number[] = []
  let perimeter = 0
  for (let i = 0; i < contour.length; i++) {
    const next = (i + 1) % contour.length
    const a = contour[i], b = contour[next]
    const nextPerimeter = perimeter + a.distanceTo(b)
    for (let j = 0; j < levels.length - 1; j++) {
      const vertex = (p: THREE.Vector2, level: number) => {
        const { y, scale } = levels[level]
        return [pocket.x + (p.x - pocket.x) * scale, y, centerZ + (-p.y - centerZ) * scale]
      }
      const vertices = [vertex(a, j), vertex(b, j), vertex(b, j + 1), vertex(a, j), vertex(b, j + 1), vertex(a, j + 1)]
      positions.push(...vertices.flat())
      uv.push(perimeter, levels[j].y, nextPerimeter, levels[j].y, nextPerimeter, levels[j + 1].y, perimeter, levels[j].y, nextPerimeter, levels[j + 1].y, perimeter, levels[j + 1].y)
    }
    perimeter = nextPerimeter
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals()
  return geometry
}

function collarGeometry(pocket: Pocket) {
  const shape = new THREE.Shape()
  if (pocket.side) {
    const radius = 0.068
    // A recessed leather facing set into the rail, open all the way to the mouth.
    shape.moveTo(-radius, 0.034)
    shape.lineTo(-0.098, 0.034)
    shape.lineTo(-0.098, 0.12)
    shape.quadraticCurveTo(-0.098, 0.133, -0.085, 0.133)
    shape.lineTo(0.085, 0.133)
    shape.quadraticCurveTo(0.098, 0.133, 0.098, 0.12)
    shape.lineTo(0.098, 0.034)
    shape.lineTo(radius, 0.034)
    shape.absarc(0, 0.034, radius, 0, Math.PI, false)
  } else {
    const radius = CORNER_GAP + 0.0015
    const endpoint = radius / Math.SQRT2
    shape.moveTo(-endpoint, endpoint)
    shape.lineTo(-0.078, 0.082)
    shape.lineTo(-0.078, 0.122)
    shape.lineTo(0.108, 0.122)
    shape.quadraticCurveTo(0.122, 0.122, 0.122, 0.108)
    shape.lineTo(0.122, -0.078)
    shape.lineTo(0.082, -0.078)
    shape.lineTo(endpoint, -endpoint)
    shape.absarc(0, 0, radius, -Math.PI / 4, Math.PI * 3 / 4, false)
  }
  shape.closePath()
  const geometry = horizontalGeometry(shape, 0.0015, 0.0005)
  const sx = pocket.side ? 1 : Math.sign(pocket.x)
  const sz = Math.sign(pocket.z)
  geometry.scale(sx, 1, -sz)
  if (-sx * sz < 0) reverseWinding(geometry)
  geometry.translate(pocket.x, RAIL_TOP - 0.001, pocket.z)
  const positions = geometry.getAttribute('position')
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: positions.count }, (_, i) => [positions.getX(i), positions.getZ(i)]).flat(), 2))
  return geometry
}

function frameShape(width: number, depth: number, radius: number, openingWidth: number, openingDepth: number) {
  const shape = roundedOutline(width, depth, radius)
  shape.holes.push(roundedOutline(openingWidth, openingDepth, 0.035))
  return shape
}

export function TableFurniture() {
  const { gl } = useThree()
  const materials = useMemo(() => createTableMaterials(gl.capabilities.getMaxAnisotropy()), [gl])
  const apronMaterial = useMemo(() => {
    const material = materials.wood.clone()
    material.color.set('#a08b72')
    material.roughness = 0.48
    material.clearcoat = 0.2
    return material
  }, [materials])
  const assets = useMemo(() => {
    const pockets = pocketContours()
    const clothShape = roundedOutline(W + 0.24, D + 0.24, 0.035)
    clothShape.holes.push(...pockets.map(pocket => pocket.path))
    const cloth = horizontalGeometry(clothShape)
    const positions = cloth.getAttribute('position')
    cloth.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: positions.count }, (_, i) => [(positions.getX(i) + W / 2) / W, (D / 2 - positions.getZ(i)) / D]).flat(), 2))
    const slate = horizontalGeometry(clothShape, 0.027)
    const body = horizontalGeometry(frameShape(W + 0.44, D + 0.44, 0.06, W + 0.245, D + 0.245), 0.145, 0.006)
    const trim = horizontalGeometry(frameShape(W + 0.434, D + 0.434, 0.055, W + 0.428, D + 0.428), 0.0015)
    const darkLip = horizontalGeometry(frameShape(W + 0.433, D + 0.433, 0.055, W + 0.245, D + 0.245), 0.008)
    const rails = (['top', 'bottom', 'left', 'right'] as const).map(railGeometry)
    const cushions = (['top', 'bottom'] as const).flatMap(side => [
      cushionGeometry(side, -W / 2 + CORNER_GAP, -SIDE_GAP, 'corner', 'side'),
      cushionGeometry(side, SIDE_GAP, W / 2 - CORNER_GAP, 'side', 'corner'),
    ])
    cushions.push(cushionGeometry('left', -D / 2 + CORNER_GAP, D / 2 - CORNER_GAP, 'corner', 'corner'))
    cushions.push(cushionGeometry('right', -D / 2 + CORNER_GAP, D / 2 - CORNER_GAP, 'corner', 'corner'))
    const wells = pockets.map(pocket => wellGeometry(pocket, false))
    const lips = pockets.map(pocket => wellGeometry(pocket, true))
    const collars = pockets.map(collarGeometry)
    const diamondShape = new THREE.Shape()
    diamondShape.moveTo(0, -0.0127); diamondShape.lineTo(0.005555, 0); diamondShape.lineTo(0, 0.0127); diamondShape.lineTo(-0.005555, 0); diamondShape.closePath()
    const diamond = horizontalGeometry(diamondShape, 0.0005, 0.00035)
    return { pockets, cloth, slate, body, trim, darkLip, rails, cushions, wells, lips, collars, diamond }
  }, [])
  useEffect(() => () => {
    apronMaterial.dispose()
    materials.dispose()
    for (const value of Object.values(assets)) {
      if (value instanceof THREE.BufferGeometry) value.dispose()
      else if (Array.isArray(value)) value.forEach(item => { if (item instanceof THREE.BufferGeometry) item.dispose() })
    }
  }, [assets, materials, apronMaterial])
  return <group>
    {/* The structural frame has a large open centre; nothing caps the pocket wells. */}
    <mesh geometry={assets.body} position={[0, -0.125, 0]} material={apronMaterial} castShadow receiveShadow />
    <mesh geometry={assets.darkLip} position={[0, 0.046, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#161815" roughness={0.38} metalness={0.22} />
    </mesh>
    <mesh geometry={assets.trim} position={[0, 0.034, 0]} receiveShadow>
      <meshStandardMaterial color="#9e8e6d" roughness={0.3} metalness={0.75} />
    </mesh>
    <mesh geometry={assets.slate} position={[0, CLOTH_Y - 0.028, 0]} receiveShadow>
      <meshStandardMaterial color="#1c2923" roughness={0.95} />
    </mesh>
    <mesh geometry={assets.cloth} position={[0, CLOTH_Y, 0]} material={materials.cloth} receiveShadow />
    {assets.rails.map((geometry, i) => <mesh key={`rail-${i}`} geometry={geometry} material={materials.wood} castShadow receiveShadow />)}
    {assets.cushions.map((geometry, i) => <mesh key={`cushion-${i}`} geometry={geometry} material={materials.cushion} receiveShadow />)}
    {assets.lips.map((geometry, i) => <mesh key={`lip-${i}`} geometry={geometry} material={materials.cushion} receiveShadow />)}
    {assets.wells.map((geometry, i) => <mesh key={`well-${i}`} geometry={geometry} material={materials.leather} receiveShadow />)}
    {assets.collars.map((geometry, i) => <mesh key={`collar-${i}`} geometry={geometry} material={materials.leather} />)}
    {assets.pockets.flatMap((pocket, i) => (pocket.side ? [[-0.083, 0.115], [0.083, 0.115]] : [[0.102, 0.014], [0.014, 0.102]]).map(([a, b], j) => <mesh key={`pocket-rivet-${i}-${j}`} position={[pocket.x + a * (pocket.side ? 1 : Math.sign(pocket.x)), RAIL_TOP + 0.0011, pocket.z + b * Math.sign(pocket.z)]}>
      <cylinderGeometry args={[0.0018, 0.0018, 0.0009, 16]} /><meshStandardMaterial color="#7c715b" metalness={0.7} roughness={0.38} />
    </mesh>))}
    {assets.pockets.map((pocket, i) => <mesh key={`well-bottom-${i}`} position={[pocket.x, CLOTH_Y - 0.198, pocket.z + (pocket.side ? pocket.sign * 0.028 : 0)]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[pocket.side ? 0.048 : CORNER_GAP * 0.69, 48]} /><meshBasicMaterial color="#030504" />
    </mesh>)}
    {[-3, -2, -1, 1, 2, 3].flatMap(n => [-1, 1].map(sign => <mesh key={`long-sight-${n}-${sign}`} geometry={assets.diamond} position={[n * W / 8, RAIL_TOP + 0.0007, sign * (D / 2 + 0.139)]}>
      <meshPhysicalMaterial color="#e4dfcb" roughness={0.24} metalness={0.12} clearcoat={0.8} iridescence={0.2} />
    </mesh>))}
    {[-1, 0, 1].flatMap(n => [-1, 1].map(sign => <mesh key={`short-sight-${n}-${sign}`} geometry={assets.diamond} position={[sign * (W / 2 + 0.139), RAIL_TOP + 0.0007, n * D / 4]} rotation={[0, Math.PI / 2, 0]}>
      <meshPhysicalMaterial color="#e4dfcb" roughness={0.24} metalness={0.12} clearcoat={0.8} iridescence={0.2} />
    </mesh>))}
    {[-W / 4, W / 4].map(x => <mesh key={x} position={[x, CLOTH_Y + 0.00015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.003, 24]} /><meshBasicMaterial color="#c2ccad" transparent opacity={0.5} depthWrite={false} />
    </mesh>)}
  </group>
}
