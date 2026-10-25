import { SCOPE, placePart, placements } from './schematic.js'

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

export const MAX_DECKS = 4
const DECK_HEIGHT = 10
// Where the ladder between decks sits, as a fraction of the hull's length
const LADDER_T = 0.62

const spread = (count, from, to) =>
  Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 0.5)) / count)

const ladderPoint = ({ halfBeam, x }) => ({
  x: x(LADDER_T),
  y: halfBeam(LADDER_T) * 0.45,
})

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

const hatches = ({ B, x }, random) =>
  spread(4, 0.15, 0.85)
    .filter((t) => Math.abs(t - LADDER_T) > 0.08)
    .filter(() => random() > 0.3)
    .map((t) => {
      const s = B * 0.07
      const y = (random() - 0.5) * B * 0.25
      return `<rect x="${x(t) - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" />
      <path d="M ${x(t) - s / 2} ${y - s / 2} L ${x(t) + s / 2} ${y + s / 2} M ${x(t) + s / 2} ${y - s / 2} L ${x(t) - s / 2} ${y + s / 2}" />`
    })
    .join('')

const prow = ({ L, B, x }) => {
  const tip = x(1) + L * 0.05
  return `<path d="M ${x(1) - L * 0.03} ${-B * 0.05} L ${tip} 0 L ${x(1) - L * 0.03} ${B * 0.05} Z" />`
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

// One deck's plan: deck 0 is the main deck
export const buildSchematicSvg = (ship, options, deck = 0) => {
  const { width, height } = SCENE
  const main = deck === 0
  const colours = PALETTES[options.palette]
  const geometry = hullGeometry(options)
  const { halfBeam, x } = geometry
  const random = seededRandom(`${ship.id ?? ship.name}-${deck}`)

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
      <stop offset="0" stop-color="${colours.ink}" stop-opacity="${main ? 0.15 : 0.25}" />
      <stop offset="0.5" stop-color="${colours.ink}" stop-opacity="${main ? 0 : 0.08}" />
      <stop offset="1" stop-color="${colours.ink}" stop-opacity="${main ? 0.15 : 0.25}" />
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
    ${main ? `<g stroke-width="3" opacity="0.4" stroke-dasharray="20 15">${wake(geometry)}</g>` : ''}
    ${main ? `<g fill="${colours.hull}" stroke-width="6">${prow(geometry)}</g>` : ''}
    <path d="${outline(geometry)}" fill="${colours.hull}" />
    <path d="${outline(geometry)}" fill="url(#hullShade)" />
    <g clip-path="url(#hullClip)">
      <g stroke-width="2" opacity="${main ? 0.25 : 0.15}">${planking(geometry, random)}</g>
      <g stroke-width="3" opacity="0.45">${ribs}</g>
    </g>
    <path d="${outline(geometry, 0.92)}" stroke-width="4" />
    <line x1="${x(0)}" y1="0" x2="${x(1)}" y2="0" stroke-width="3" stroke-dasharray="60 30" opacity="0.5" />
    ${main ? `<g fill="${colours.hull}" stroke-width="4">${hatches(geometry, random)}</g>` : ''}
    ${main ? `<g fill="${colours.hull}" stroke-width="4">${rudder(geometry)}</g>` : ''}
    <path d="${outline(geometry)}" stroke-width="12" />
    ${main ? `<g stroke-width="3" opacity="0.7">${dimensions(geometry)}</g>` : ''}
  </g>
  <g stroke="${colours.ink}" fill="${colours.ink}" opacity="0.8">${compass(260, 300, 140)}</g>
</svg>`
}

// Text kept as scene drawings so it can be edited, moved or deleted
const textDrawings = (ship, options, origin, level) => {
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
    levels: [level],
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

// The scene's decks in order from the main deck down; an ungenerated scene's level is its main deck
export const deckLevels = (scene) => {
  const decks = scene.levels
    .filter((level) => Number.isInteger(level.getFlag(SCOPE, 'deck')))
    .sort((a, b) => a.getFlag(SCOPE, 'deck') - b.getFlag(SCOPE, 'deck'))
  if (decks.length) return decks
  return [scene.initialLevel ?? scene.levels.contents[0]].filter(Boolean)
}

const options = (values, labelPrefix) =>
  Object.keys(values).map((value) => ({
    value,
    label: `${labelPrefix}.${value}`,
  }))

const promptOptions = (ship, scene) => {
  const defaults = { ...defaultsFor(ship), decks: String(deckLevels(scene).length || 1) }
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
      createFormGroup({
        label: game.i18n.localize('wildsea.GENERATOR.decks'),
        input: createSelectInput({
          name: 'decks',
          value: defaults.decks,
          options: Array.from({ length: MAX_DECKS }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          })),
        }),
      }).outerHTML,
      select('palette', PALETTES),
    ].join(''),
    rejectClose: false,
  })
}

const onlyOn = (levels, removed) =>
  levels.size > 0 && [...levels].every((id) => removed.has(id))

// Confirms losing everything that exists only on the decks being removed
const confirmRemoval = (ship, scene, removedLevels, decks) => {
  const removed = new Set(removedLevels.map((level) => level.id))
  const count = (collection) =>
    collection.filter((doc) => onlyOn(doc.levels, removed)).length
  const cards = Object.values(placements(ship)).filter(
    (placement) => placement.scene === scene.id && removed.has(placement.level),
  ).length
  return DialogV2.confirm({
    window: { title: game.i18n.localize('wildsea.GENERATOR.removeDecksTitle') },
    content: `<p>${game.i18n.format('wildsea.GENERATOR.removeDecks', {
      decks,
      levels: removedLevels.map((level) => level.name).join(', '),
      tokens: scene.tokens.filter((token) => removed.has(token.level)).length,
      regions: count(scene.regions),
      drawings: count(scene.drawings),
      cards,
    })}</p>`,
    rejectClose: false,
  })
}

const deckName = (deck) => game.i18n.localize(`wildsea.GENERATOR.DECK_NAMES.${deck}`)

// The main deck is open above and the lowest open below
const deckElevation = (deck, decks) => ({
  bottom: deck === decks - 1 ? null : -deck * DECK_HEIGHT,
  top: deck === 0 ? null : -(deck - 1) * DECK_HEIGHT,
})

const syncDecks = async (scene, decks, paths) => {
  const existing = deckLevels(scene)
  const data = paths.map((src, deck) => ({
    name: deckName(deck),
    elevation: deckElevation(deck, decks),
    background: { src },
    flags: { [SCOPE]: { deck } },
  }))
  await scene.updateEmbeddedDocuments(
    'Level',
    existing.slice(0, decks).map((level, deck) => ({ _id: level.id, ...data[deck] })),
  )
  await scene.createEmbeddedDocuments('Level', data.slice(existing.length))
  await scene.deleteEmbeddedDocuments(
    'Level',
    existing.slice(decks).map((level) => level.id),
  )
  const levels = deckLevels(scene)
  await scene.update({ initialLevel: levels[0].id })
  return levels
}

// One ladder region through every deck; core's Change Level behaviour moves tokens between them
const syncLadder = async (ship, scene, options, levels, origin) => {
  const previous = scene.regions
    .filter((region) => region.getFlag(SCOPE, 'ladder'))
    .map((region) => region.id)
  await scene.deleteEmbeddedDocuments('Region', previous)
  if (levels.length < 2) return

  const { x, y } = ladderPoint(hullGeometry(options))
  await scene.createEmbeddedDocuments('Region', [
    {
      name: game.i18n.localize('wildsea.GENERATOR.ladder'),
      color: '#c9a227',
      levels: levels.map((level) => level.id),
      // Its icon stands in for it, so the region itself only shows on the Regions layer
      visibility: CONST.REGION_VISIBILITY.LAYER,
      shapes: [
        {
          type: 'rectangle',
          x: origin.x + SCENE.width / 2 + x - 50,
          y: origin.y + SCENE.height / 2 + y - 90,
          width: 100,
          height: 180,
        },
      ],
      behaviors: [{ type: 'changeLevel', name: game.i18n.localize('wildsea.GENERATOR.ladder') }],
      flags: { [SCOPE]: { ship: ship.uuid, ladder: true } },
    },
  ])
}

export const generateSchematic = async (ship, scene) => {
  const choices = await promptOptions(ship, scene)
  if (!choices) return
  const decks = Math.clamp(parseInt(choices.decks) || 1, 1, MAX_DECKS)

  const removed = deckLevels(scene).slice(decks)
  if (removed.length && !(await confirmRemoval(ship, scene, removed, decks))) return

  const paths = []
  for (let deck = 0; deck < decks; deck++) {
    const path = await uploadSvg(
      buildSchematicSvg(ship, { ...choices, decks }, deck),
      `${ship.id}-${Date.now()}-${deck}.svg`,
    )
    if (!path) return
    paths.push(path)
  }

  // Cards placed on removed decks go with them
  const removedIds = new Set(removed.map((level) => level.id))
  for (const [key, placement] of Object.entries(placements(ship)))
    if (placement.scene === scene.id && removedIds.has(placement.level))
      await placePart(ship, key, null)

  await scene.update({ ...SCENE, padding: 0.1 })
  const levels = await syncDecks(scene, decks, paths)
  const { sceneX, sceneY } = scene.dimensions
  const origin = { x: sceneX, y: sceneY }

  const previous = scene.drawings
    .filter((drawing) => drawing.getFlag(SCOPE, 'generated'))
    .map((drawing) => drawing.id)
  await scene.deleteEmbeddedDocuments('Drawing', previous)
  await scene.createEmbeddedDocuments(
    'Drawing',
    textDrawings(ship, choices, origin, levels[0].id),
  )
  await syncLadder(ship, scene, choices, levels, origin)
}
