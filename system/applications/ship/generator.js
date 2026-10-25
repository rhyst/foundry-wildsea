import { SCOPE } from './schematic.js'

const { DialogV2 } = foundry.applications.api
const { createFormGroup, createSelectInput } = foundry.applications.fields

const SCENE = { width: 4000, height: 2400 }
const UPLOAD_SOURCE = 'data'

// Half-beam as a fraction of the full beam, from stern (t = 0) to bow (t = 1)
const HULLS = {
  longship: (t) => Math.sin(Math.PI * t) ** 0.6 * (1 - 0.3 * t),
  galleon: (t) =>
    (1 - Math.max(0, (t - 0.55) / 0.45) ** 2) *
    (0.75 + 0.25 * Math.sin((Math.PI / 2) * Math.min(t / 0.55, 1))),
  barge: (t) => Math.min(1, Math.min(t, 1 - t) * 8) ** 0.5,
  spindle: (t) => Math.sin(Math.PI * t),
}
const LENGTHS = { short: 0.5, medium: 0.65, long: 0.8 }
const BEAMS = { narrow: 0.22, standard: 0.3, wide: 0.4 }
const PALETTES = {
  blueprint: { ground: '#13304d', grid: '#244a70', hull: '#1b4166', ink: '#d8ecff' },
  parchment: { ground: '#e9dfc7', grid: '#d6c9a8', hull: '#f3ead6', ink: '#3b3426' },
}

const SIZE_LENGTHS = { nano: 'short', small: 'short', standard: 'medium', large: 'long' }
const FRAME_HULLS = {
  scything: 'longship',
  sleek: 'longship',
  sturdy: 'galleon',
  reinforced: 'galleon',
  moulded: 'galleon',
  spread: 'barge',
}

const designName = (ship, type) =>
  ship.itemTypes.design.find((design) => design.system.type === type)?.name

// Defaults for the generator dialog from the ship's own designs
const defaultsFor = (ship) => {
  const frame = designName(ship, 'frame')?.toLowerCase()
  return {
    hull: FRAME_HULLS[frame] ?? 'longship',
    length: SIZE_LENGTHS[designName(ship, 'size')?.toLowerCase()] ?? 'medium',
    beam: frame === 'spread' ? 'wide' : 'standard',
    palette: 'parchment',
  }
}

export const hullGeometry = ({ hull, length, beam }) => {
  const L = SCENE.width * LENGTHS[length]
  const B = SCENE.height * BEAMS[beam]
  const profile = HULLS[hull]
  const halfBeam = (t) => (profile(t) * B) / 2
  const x = (t) => -L / 2 + t * L
  return { L, B, halfBeam, x }
}

const outline = ({ halfBeam, x }, inset = 1, steps = 80) => {
  const ts = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  const top = ts.map((t) => `${x(t).toFixed(1)},${(-halfBeam(t) * inset).toFixed(1)}`)
  const bottom = [...ts]
    .reverse()
    .map((t) => `${x(t).toFixed(1)},${(halfBeam(t) * inset).toFixed(1)}`)
  return `M ${[...top, ...bottom].join(' L ')} Z`
}

// Deterministic per ship, so regenerating keeps the same details
const seededRandom = (seed) => {
  let h = 1779033703
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 3432918353)
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const MAST_COUNTS = { short: 1, medium: 2, long: 3 }
const WEAPON_TYPES = /weapon|armament/i

const spread = (count, from, to) =>
  Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 0.5)) / count)

const planking = ({ B, halfBeam, x }, random) => {
  const lines = []
  for (let y = -B / 2 + 40; y < B / 2; y += 40) {
    lines.push(`<line x1="${x(0)}" y1="${y}" x2="${x(1)}" y2="${y}" />`)
    for (let t = random() * 0.1; t < 1; t += 0.08 + random() * 0.06) {
      if (halfBeam(t) > Math.abs(y))
        lines.push(`<line x1="${x(t)}" y1="${y}" x2="${x(t)}" y2="${y + 40}" />`)
    }
  }
  return lines.join('')
}

const masts = ({ B, halfBeam, x }, count) =>
  spread(count, 0.3, 0.7)
    .map((t) => {
      const yard = halfBeam(t) * 0.8
      return `<line x1="${x(t)}" y1="${-yard}" x2="${x(t)}" y2="${yard}" stroke-width="12" />
      <circle cx="${x(t)}" cy="0" r="${B * 0.05}" stroke-width="6" />
      <circle cx="${x(t)}" cy="0" r="${B * 0.02}" stroke-width="4" />`
    })
    .join('')

const hatches = ({ B, x }, random, mastCount) => {
  const avoid = spread(mastCount, 0.3, 0.7)
  return spread(4, 0.15, 0.85)
    .filter((t) => avoid.every((m) => Math.abs(m - t) > 0.08))
    .filter(() => random() > 0.3)
    .map((t) => {
      const s = B * 0.07
      const y = (random() - 0.5) * B * 0.25
      return `<rect x="${x(t) - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" />
      <path d="M ${x(t) - s / 2} ${y - s / 2} L ${x(t) + s / 2} ${y + s / 2} M ${x(t) + s / 2} ${y - s / 2} L ${x(t) - s / 2} ${y + s / 2}" />`
    })
    .join('')
}

const gunports = ({ halfBeam, x }, count) =>
  spread(count, 0.3, 0.75)
    .flatMap((t) =>
      [-1, 1].map((side) => {
        const y = side * halfBeam(t)
        return `<rect x="${x(t) - 25}" y="${y - 15}" width="50" height="30" />`
      }),
    )
    .join('')

const prow = ({ L, B, x }) => {
  const tip = x(1) + L * 0.05
  return `<path d="M ${x(1) - L * 0.03} ${-B * 0.05} L ${tip} 0 L ${x(1) - L * 0.03} ${B * 0.05} Z" />`
}

const engine = ({ L, B, halfBeam, x }) => {
  const w = Math.max(halfBeam(0.08), B * 0.08)
  return `<rect x="${x(0.04)}" y="${-w * 0.6}" width="${L * 0.08}" height="${w * 1.2}" />
    <path d="M ${x(0.06)} ${-w * 0.6} V ${w * 0.6} M ${x(0.08)} ${-w * 0.6} V ${w * 0.6} M ${x(0.1)} ${-w * 0.6} V ${w * 0.6}" />`
}

const rudder = ({ L, x }) =>
  `<rect x="${x(0) - L * 0.03}" y="-12" width="${L * 0.03}" height="24" />`

const wake = ({ L, B, x }) =>
  [-1, 1]
    .map(
      (side) =>
        `<path d="M ${x(0) - L * 0.03} ${side * B * 0.05} Q ${x(0) - L * 0.12} ${side * B * 0.15} ${x(0) - L * 0.2} ${side * B * 0.35}" />`,
    )
    .join('')

const dimensions = ({ L, B, x }) => {
  const y = B / 2 + 160
  const xb = x(1) + L * 0.05 + 120
  const arrow = 'marker-start="url(#arrow)" marker-end="url(#arrow)"'
  return `<line x1="${x(0)}" y1="${y}" x2="${x(1)}" y2="${y}" ${arrow} />
    <line x1="${x(0)}" y1="${B / 2 + 40}" x2="${x(0)}" y2="${y + 40}" />
    <line x1="${x(1)}" y1="${B / 2 + 40}" x2="${x(1)}" y2="${y + 40}" />
    <line x1="${xb}" y1="${-B / 2}" x2="${xb}" y2="${B / 2}" ${arrow} />`
}

const compass = (cx, cy, r) =>
  `<g transform="translate(${cx} ${cy})">
    <circle r="${r}" fill="none" stroke-width="4" />
    <circle r="${r * 0.8}" fill="none" stroke-width="2" stroke-dasharray="8 8" />
    <path d="M 0 ${-r} L ${r * 0.15} 0 L 0 ${r} L ${-r * 0.15} 0 Z" />
    <path d="M ${-r} 0 L 0 ${r * 0.15} L ${r} 0 L 0 ${-r * 0.15} Z" opacity="0.6" />
    <text y="${-r - 20}" text-anchor="middle" font-size="50" stroke="none">N</text>
  </g>`

export const buildSchematicSvg = (ship, options) => {
  const { width, height } = SCENE
  const colours = PALETTES[options.palette]
  const geometry = hullGeometry(options)
  const { L, B, halfBeam, x } = geometry
  const random = seededRandom(ship.id ?? ship.name)
  const mastCount = MAST_COUNTS[options.length]
  const weapons = ship.itemTypes.fitting?.filter((fitting) =>
    WEAPON_TYPES.test(fitting.system.type),
  ).length ?? 0

  const ribs = spread(12, 0, 1)
    .map((t) => {
      const h = halfBeam(t) * 0.92
      return `<line x1="${x(t)}" y1="${-h}" x2="${x(t)}" y2="${h}" />`
    })
    .join('')


  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 H 0 V 100" fill="none" stroke="${colours.grid}" stroke-width="2" />
    </pattern>
    <pattern id="gridMajor" width="500" height="500" patternUnits="userSpaceOnUse">
      <path d="M 500 0 H 0 V 500" fill="none" stroke="${colours.grid}" stroke-width="5" />
    </pattern>
    <linearGradient id="hullShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${colours.ink}" stop-opacity="0.15" />
      <stop offset="0.5" stop-color="${colours.ink}" stop-opacity="0" />
      <stop offset="1" stop-color="${colours.ink}" stop-opacity="0.15" />
    </linearGradient>
    <clipPath id="hullClip"><path d="${outline(geometry)}" /></clipPath>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="${colours.ink}" />
    </marker>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" />
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.08 0" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="${colours.ground}" />
  <rect width="${width}" height="${height}" fill="url(#grid)" />
  <rect width="${width}" height="${height}" fill="url(#gridMajor)" />
  <rect width="${width}" height="${height}" filter="url(#grain)" />
  <g transform="translate(${width / 2} ${height / 2})" stroke="${colours.ink}" fill="none">
    <g stroke-width="3" opacity="0.4" stroke-dasharray="20 15">${wake(geometry)}</g>
    <g fill="${colours.hull}" stroke-width="6">${prow(geometry)}</g>
    <path d="${outline(geometry)}" fill="${colours.hull}" />
    <path d="${outline(geometry)}" fill="url(#hullShade)" />
    <g clip-path="url(#hullClip)">
      <g stroke-width="2" opacity="0.25">${planking(geometry, random)}</g>
      <g stroke-width="3" opacity="0.45">${ribs}</g>
      <g fill="${colours.hull}" stroke-width="4">${engine(geometry)}</g>
    </g>
    <path d="${outline(geometry, 0.92)}" stroke-width="4" />
    <line x1="${x(0)}" y1="0" x2="${x(1)}" y2="0" stroke-width="3" stroke-dasharray="60 30" opacity="0.5" />
    <g fill="${colours.hull}" stroke-width="4">${hatches(geometry, random, mastCount)}</g>
    <g fill="${colours.hull}" stroke-width="4">${rudder(geometry)}</g>
    <g fill="${colours.ground}" stroke-width="4">${gunports(geometry, weapons)}</g>
    <g fill="${colours.hull}">${masts(geometry, mastCount)}</g>
    <path d="${outline(geometry)}" stroke-width="12" />
    <g stroke-width="3" opacity="0.7">${dimensions(geometry)}</g>
  </g>
  <g stroke="${colours.ink}" fill="${colours.ink}" opacity="0.8">${compass(260, 300, 140)}</g>
</svg>`
}

// Text kept as scene drawings so it can be edited, moved or deleted
const textDrawings = (ship, options, origin) => {
  const { width, height } = SCENE
  const ink = PALETTES[options.palette].ink
  const specs = ['size', 'frame', 'hull']
    .map((type) => designName(ship, type))
    .filter(Boolean)
    .join(' · ')
  const text = (content, x, y, w, h, fontSize, frame = false) => ({
    shape: { type: 'r', width: w, height: h },
    x: origin.x + x,
    y: origin.y + y,
    text: content,
    fontSize,
    textColor: ink,
    fillType: CONST.DRAWING_FILL_TYPES.NONE,
    strokeWidth: frame ? 5 : 0,
    strokeColor: ink,
    flags: { [SCOPE]: { generated: true } },
  })
  return [
    text(ship.name.toUpperCase(), width - 1300, height - 330, 1200, 170, 110, true),
    specs && text(specs, width - 1300, height - 160, 1200, 90, 46, true),
  ].filter(Boolean)
}

const uploadSvg = async (svg, name) => {
  const FilePicker = foundry.applications.apps.FilePicker.implementation
  const dir = `worlds/${game.world.id}/wildsea-ships`
  await FilePicker.createDirectory(UPLOAD_SOURCE, dir).catch(() => {})
  const file = new File([svg], name, { type: 'image/svg+xml' })
  const result = await FilePicker.upload(UPLOAD_SOURCE, dir, file, {}, { notify: false })
  return result?.path
}

const options = (values, labelPrefix) =>
  Object.keys(values).map((value) => ({
    value,
    label: `${labelPrefix}.${value}`,
  }))

const promptOptions = (ship) => {
  const defaults = defaultsFor(ship)
  const select = (name, values) =>
    createFormGroup({
      label: game.i18n.localize(`wildsea.GENERATOR.${name}`),
      input: createSelectInput({
        name,
        value: defaults[name],
        options: options(values, `wildsea.GENERATOR.${name.toUpperCase()}S`),
        localize: true,
      }),
    }).outerHTML
  return DialogV2.input({
    window: { title: game.i18n.localize('wildsea.GENERATOR.title') },
    content: [
      select('hull', HULLS),
      select('length', LENGTHS),
      select('beam', BEAMS),
      select('palette', PALETTES),
    ].join(''),
    rejectClose: false,
  })
}

export const generateSchematic = async (ship, scene) => {
  const choices = await promptOptions(ship)
  if (!choices) return

  const path = await uploadSvg(
    buildSchematicSvg(ship, choices),
    `${ship.id}-${Date.now()}.svg`,
  )
  if (!path) return

  await scene.update({ ...SCENE, padding: 0.1 })
  const level = scene.levels.contents[0]
  if (level)
    await scene.updateEmbeddedDocuments('Level', [
      { _id: level.id, background: { src: path } },
    ])
  else
    await scene.createEmbeddedDocuments('Level', [
      { name: ship.name, background: { src: path } },
    ])

  const { sceneX, sceneY } = scene.dimensions
  const previous = scene.drawings
    .filter((drawing) => drawing.getFlag(SCOPE, 'generated'))
    .map((drawing) => drawing.id)
  await scene.deleteEmbeddedDocuments('Drawing', previous)
  await scene.createEmbeddedDocuments(
    'Drawing',
    textDrawings(ship, choices, { x: sceneX, y: sceneY }),
  )
}
