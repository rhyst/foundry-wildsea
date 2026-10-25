import { placePart, shipParts } from './schematic.js'

const { DialogV2 } = foundry.applications.api
const { createCheckboxInput, createFormGroup, createSelectInput } =
  foundry.applications.fields

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

const escapeXml = (text) =>
  String(text).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)

const designName = (ship, type) =>
  ship.itemTypes.design.find((design) => design.system.type === type)?.name

// Defaults for the generator dialog from the ship's own designs
const defaultsFor = (ship) => {
  const frame = designName(ship, 'frame')?.toLowerCase()
  return {
    hull: FRAME_HULLS[frame] ?? 'longship',
    length: SIZE_LENGTHS[designName(ship, 'size')?.toLowerCase()] ?? 'medium',
    beam: frame === 'spread' ? 'wide' : 'standard',
    palette: 'blueprint',
    placeRooms: true,
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

export const buildSchematicSvg = (ship, options) => {
  const { width, height } = SCENE
  const colours = PALETTES[options.palette]
  const geometry = hullGeometry(options)
  const { L, halfBeam, x } = geometry

  const ribs = Array.from({ length: 11 }, (_, i) => (i + 1) / 12)
    .map((t) => {
      const h = halfBeam(t) * 0.92
      return `<line x1="${x(t)}" y1="${-h}" x2="${x(t)}" y2="${h}" />`
    })
    .join('')

  const label = (text, tx, anchor) =>
    text
      ? `<text x="${tx}" y="${height * 0.2}" text-anchor="${anchor}" font-size="60">${escapeXml(text)}</text>`
      : ''
  const specs = ['size', 'frame', 'hull']
    .map((type) => designName(ship, type))
    .filter(Boolean)
    .map(escapeXml)
    .join(' · ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 H 0 V 100" fill="none" stroke="${colours.grid}" stroke-width="2" />
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="${colours.ground}" />
  <rect width="${width}" height="${height}" fill="url(#grid)" />
  <g transform="translate(${width / 2} ${height / 2})">
    <path d="${outline(geometry)}" fill="${colours.hull}" stroke="${colours.ink}" stroke-width="10" />
    <g stroke="${colours.ink}" stroke-width="3" opacity="0.5">${ribs}</g>
    <path d="${outline(geometry, 0.85)}" fill="none" stroke="${colours.ink}" stroke-width="4" stroke-dasharray="30 20" />
    <line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="${colours.ink}" stroke-width="3" stroke-dasharray="60 30" opacity="0.6" />
  </g>
  <g fill="${colours.ink}" font-family="sans-serif" letter-spacing="4">
    ${label(designName(ship, 'engine'), width / 2 - L / 2, 'start')}
    ${label(designName(ship, 'bite'), width / 2 + L / 2, 'end')}
    <text x="${width - 120}" y="${height - 200}" text-anchor="end" font-size="120">${escapeXml(ship.name.toUpperCase())}</text>
    <text x="${width - 120}" y="${height - 110}" text-anchor="end" font-size="50" opacity="0.8">${specs}</text>
  </g>
</svg>`
}

// Room fittings spread evenly along the hull, in two rows when there are many
const roomPositions = (ship, options, origin) => {
  const rooms = shipParts(ship).filter((part) =>
    /room/i.test(part.item?.system.type ?? ''),
  )
  const { halfBeam, x } = hullGeometry(options)
  const rows = rooms.length > 4 ? 2 : 1
  const perRow = Math.ceil(rooms.length / rows)
  return rooms.map((part, i) => {
    const row = Math.floor(i / perRow)
    const t = 0.2 + (0.6 * ((i % perRow) + 0.5)) / perRow
    const offset = rows === 1 ? 0 : (row === 0 ? -1 : 1) * halfBeam(t) * 0.45
    return {
      key: part.key,
      x: Math.round(origin.x + SCENE.width / 2 + x(t)),
      y: Math.round(origin.y + SCENE.height / 2 + offset),
    }
  })
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
      createFormGroup({
        label: game.i18n.localize('wildsea.GENERATOR.placeRooms'),
        input: createCheckboxInput({ name: 'placeRooms', value: defaults.placeRooms }),
      }).outerHTML,
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

  if (choices.placeRooms) {
    const { sceneX, sceneY } = scene.dimensions
    for (const { key, x, y } of roomPositions(ship, choices, { x: sceneX, y: sceneY }))
      await placePart(ship, key, { scene: scene.id, x, y })
  }
}
