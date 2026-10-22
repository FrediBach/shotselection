import * as THREE from 'three'

export interface TableMaterials {
  cloth: THREE.MeshPhysicalMaterial
  cushion: THREE.MeshPhysicalMaterial
  wood: THREE.MeshPhysicalMaterial
  leather: THREE.MeshStandardMaterial
  dispose(): void
}

type SurfacePixel = { red: number; green: number; blue: number; height: number; roughness: number }
type SurfaceMaps = { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture }

const TAU = Math.PI * 2
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value))
const wrap = (value: number, period: number) => ((value % period) + period) % period

/** Integer hashing keeps the material identical across mounts and game rounds. */
function noiseHash(x: number, y: number, seed: number) {
  let value = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

/** Periodic value noise avoids seams where a world-scale material repeats. */
function periodicNoise(columns: number, rows: number, seed: number) {
  const lattice = new Float32Array(columns * rows)
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) lattice[y * columns + x] = noiseHash(x, y, seed)
  return (u: number, v: number) => {
    const x = u * columns
    const y = v * rows
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const x0 = wrap(ix, columns)
    const x1 = wrap(ix + 1, columns)
    const y0 = wrap(iy, rows) * columns
    const y1 = wrap(iy + 1, rows) * columns
    const a = lattice[y0 + x0] * (1 - sx) + lattice[y0 + x1] * sx
    const b = lattice[y1 + x0] * (1 - sx) + lattice[y1 + x1] * sx
    return a * (1 - sy) + b * sy
  }
}

function makeMaps(
  width: number,
  height: number,
  repeat: [number, number],
  anisotropy: number,
  sample: (x: number, y: number, u: number, v: number) => SurfacePixel,
): SurfaceMaps {
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  })
  const contexts = canvases.map(canvas => {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('A canvas context is required for table materials.')
    return context
  })
  const images = contexts.map(context => context.createImageData(width, height))
  const [albedo, bump, roughness] = images.map(image => image.data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = sample(x, y, x / width, y / height)
      const offset = (y * width + x) * 4
      albedo[offset] = pixel.red
      albedo[offset + 1] = pixel.green
      albedo[offset + 2] = pixel.blue
      albedo[offset + 3] = 255
      bump[offset] = bump[offset + 1] = bump[offset + 2] = clamp(pixel.height) * 255
      bump[offset + 3] = 255
      roughness[offset] = roughness[offset + 1] = roughness[offset + 2] = clamp(pixel.roughness) * 255
      roughness[offset + 3] = 255
    }
  }
  const textures = canvases.map((canvas, index) => {
    contexts[index].putImageData(images[index], 0, 0)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
    texture.anisotropy = anisotropy
    texture.colorSpace = index === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    return texture
  })
  return { map: textures[0], bumpMap: textures[1], roughnessMap: textures[2] }
}

function makeCloth(anisotropy: number): SurfaceMaps {
  const broad = periodicNoise(5, 5, 2749)
  const yarnVariation = periodicNoise(128, 128, 1097)
  // A 160 mm square tile: four texels per thread gives a 0.625 mm weave.
  // Mipmaps deliberately average it at table distance instead of aliasing into stripes.
  return makeMaps(1024, 1024, [2.54 / 0.16, 1.27 / 0.16], anisotropy, (x, y, u, v) => {
    const warp = (Math.cos(x * TAU / 4) + 1) * 0.5
    const weft = (Math.cos(y * TAU / 4) + 1) * 0.5
    const over = ((x >> 2) + (y >> 2)) % 2 === 0
    const weave = over ? warp * 0.78 + weft * 0.22 : weft * 0.78 + warp * 0.22
    const fibre = noiseHash(x, y, 7133) - 0.5
    const variation = (broad(u, v) - 0.5) * 0.25 + (yarnVariation(u, v) - 0.5) * 1.2
    const tint = variation + (weave - 0.5) * 0.8 + fibre
    return {
      red: 23 + tint * 0.5,
      green: 99 + tint,
      blue: 74 + tint * 0.8,
      height: 0.29 + weave * 0.46 + fibre * 0.12,
      roughness: 0.96 + (weave - 0.5) * 0.02 + fibre * 0.01,
    }
  })
}

function makeWalnut(anisotropy: number): SurfaceMaps {
  const growth = periodicNoise(5, 9, 883)
  const ribbon = periodicNoise(3, 70, 7843)
  const broadRibbon = periodicNoise(2, 18, 6719)
  const fibres = periodicNoise(9, 220, 227)
  const tone = periodicNoise(4, 8, 751)
  // UV metres: one 1.2 m-long board section, 240 mm across its growth rings.
  // Grain runs along U, so short rails should rotate their geometric UV axes.
  return makeMaps(2048, 512, [1 / 1.2, 1 / 0.24], anisotropy, (x, y, u, v) => {
    const flow = v + Math.sin(TAU * u) * 0.038
      + Math.sin(TAU * (2 * u + v)) * 0.012
      + (growth(u, v) - 0.5) * 0.025
    const ring = Math.sin(TAU * flow * 16 + (broadRibbon(u, v) - 0.5) * 4.6 + (growth(u, v) - 0.5) * 3)
    const latewood = Math.pow(Math.max(0, ring), 6)
    const fineGrain = Math.sin(TAU * flow * 113 + (ribbon(u, v) - 0.5) * 1.8)
    const fibre = fibres(u, v) - 0.5
    const poreX = u * 200
    const poreY = v * 96
    const cellX = Math.floor(poreX)
    const cellY = Math.floor(poreY)
    const poreSeed = noiseHash(cellX, cellY, 9353)
    const localX = poreX - cellX - 0.5
    const localY = poreY - cellY - 0.5
    const pore = poreSeed > 0.72 ? Math.max(0, 1 - (localX / 0.34) ** 2 - (localY / 0.14) ** 2) : 0
    const micro = noiseHash(x, y, 7717) - 0.5
    const pigment = (tone(u, v) - 0.5) * 28 + (broadRibbon(u, v) - 0.5) * 24 + fibre * 5 + fineGrain * 0.6 - latewood * 21 - pore * 18 + micro * 1.2
    return {
      red: 75 + pigment,
      green: 41 + pigment * 0.68,
      blue: 22 + pigment * 0.4,
      height: 0.55 + fibre * 0.13 - latewood * 0.09 - pore * 0.3 + micro * 0.025,
      roughness: 0.9 + fibre * 0.06 + latewood * 0.05 + pore * 0.08,
    }
  })
}

function makeLeather(anisotropy: number): SurfaceMaps {
  const cells = 32
  const centers = Array.from({ length: cells * cells }, (_, index) => {
    const x = index % cells
    const y = Math.floor(index / cells)
    return { x: 0.2 + noiseHash(x, y, 23) * 0.6, y: 0.2 + noiseHash(x, y, 983) * 0.6, pigment: noiseHash(x, y, 817) }
  })
  return makeMaps(512, 512, [1 / 0.08, 1 / 0.08], anisotropy, (x, y, u, v) => {
    const px = u * cells
    const py = v * cells
    const cellX = Math.floor(px)
    const cellY = Math.floor(py)
    let nearest = Infinity
    let second = Infinity
    let pigment = 0.5
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const center = centers[wrap(cellY + dy, cells) * cells + wrap(cellX + dx, cells)]
        const distanceSquared = (cellX + dx + center.x - px) ** 2 + (cellY + dy + center.y - py) ** 2
        if (distanceSquared < nearest) {
          second = nearest
          nearest = distanceSquared
          pigment = center.pigment
        } else if (distanceSquared < second) second = distanceSquared
      }
    }
    const crease = Math.exp(-(Math.sqrt(second) - Math.sqrt(nearest)) * 24)
    const dome = Math.max(0, 1 - Math.sqrt(nearest) * 0.8)
    const micro = noiseHash(x, y, 872) - 0.5
    const color = (pigment - 0.5) * 4 - crease * 3 + micro * 1.3
    return {
      red: 29 + color,
      green: 23 + color * 0.8,
      blue: 18 + color * 0.65,
      height: 0.3 + dome * 0.35 - crease * 0.22 + micro * 0.035,
      roughness: 0.87 + crease * 0.09 + (pigment - 0.5) * 0.05,
    }
  })
}

/**
 * PBR maps contain pigment and surface structure, with no baked directional light.
 *
 * UV contract:
 * - cloth: normalized (0..1) across the complete 2.54 x 1.27 m bed;
 * - cushion: UV in metres along/across the cushion;
 * - wood: UV in metres, U along each rail's length/grain;
 * - leather: UV in metres across its surface.
 *
 * Every material's albedo, bump and roughness maps use identical transforms.
 */
export function createTableMaterials(maxAnisotropy: number): TableMaterials {
  const anisotropy = Math.max(1, Math.floor(Number.isFinite(maxAnisotropy) ? maxAnisotropy : 1))
  const clothMaps = makeCloth(anisotropy)
  const cushionMaps = Object.fromEntries(Object.entries(clothMaps).map(([name, texture]) => {
    const cloned = texture.clone()
    cloned.repeat.set(1 / 0.16, 1 / 0.16)
    cloned.needsUpdate = true
    return [name, cloned]
  })) as SurfaceMaps
  const woodMaps = makeWalnut(anisotropy)
  const leatherMaps = makeLeather(anisotropy)
  const cloth = new THREE.MeshPhysicalMaterial({
    ...clothMaps,
    color: '#ffffff',
    roughness: 1,
    metalness: 0,
    bumpScale: 0.00005,
    sheen: 0.15,
    sheenColor: new THREE.Color('#6b9f83'),
    sheenRoughness: 0.94,
    envMapIntensity: 0.28,
  })
  const cushion = new THREE.MeshPhysicalMaterial({
    ...cushionMaps,
    color: '#e9f1eb',
    roughness: 1,
    metalness: 0,
    bumpScale: 0.00005,
    sheen: 0.12,
    sheenColor: new THREE.Color('#6b9f83'),
    sheenRoughness: 0.94,
    envMapIntensity: 0.28,
    side: THREE.DoubleSide,
  })
  const wood = new THREE.MeshPhysicalMaterial({
    ...woodMaps,
    color: '#ffffff',
    roughness: 0.4,
    metalness: 0,
    bumpScale: 0.000095,
    specularIntensity: 0.55,
    clearcoat: 0.25,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.16,
    ior: 1.48,
  })
  const leather = new THREE.MeshStandardMaterial({
    ...leatherMaps,
    color: '#ffffff',
    roughness: 0.78,
    metalness: 0,
    bumpScale: 0.00038,
    envMapIntensity: 0.5,
    side: THREE.DoubleSide,
  })
  const textures = new Set([...Object.values(clothMaps), ...Object.values(cushionMaps), ...Object.values(woodMaps), ...Object.values(leatherMaps)])
  return {
    cloth, cushion, wood, leather,
    dispose() {
      for (const texture of textures) texture.dispose()
      cloth.dispose()
      cushion.dispose()
      wood.dispose()
      leather.dispose()
    },
  }
}
