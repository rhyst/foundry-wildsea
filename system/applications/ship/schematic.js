import { WILDSEA } from '../../config.js'
import { clickModifiers, markTrack } from '../../helpers.js'
import {
  createMarker,
  createRemoveButton,
  enableArranging,
  hudLayer,
} from '../hud-markers.js'

const { renderTemplate } = foundry.applications.handlebars

export const DRAG_TYPE = 'WildseaShipPart'
export const SCOPE = 'the-wildsea'
const MARKER_TEMPLATE = `${WILDSEA.root_path}/templates/schematic/marker.hbs`
const LISTS = ['conditions', 'cargoPassengers', 'reputations']
const ITEM_TYPES = ['design', 'fitting', 'undercrew']
export const STATION_ROLES = ['helm', 'watch', 'engine', 'charts', 'other']
const STATION_COLOURS = {
  helm: '#c9a227',
  watch: '#3d8fb8',
  engine: '#b8553d',
  charts: '#5e9e4f',
  other: '#8a7fa6',
}
const ROOM_COLOUR = '#858778'

const isRoom = (item) => /room/i.test(item?.system.type ?? '')

// The ship linked to a scene opened from its sheet
export const sceneShip = (scene) => {
  const uuid = scene?.getFlag(SCOPE, 'ship')
  return uuid ? fromUuidSync(uuid) : null
}

export const shipScene = (ship) => game.scenes.get(ship.getFlag(SCOPE, 'scene'))

// Regions on the ship's scene that belong to it: stations and room outlines
const shipRegions = (ship) =>
  shipScene(ship)?.regions.filter(
    (region) => region.getFlag(SCOPE, 'ship') === ship.uuid,
  ) ?? []

export const stationRegions = (ship) =>
  shipRegions(ship).filter((region) => region.getFlag(SCOPE, 'station'))

const partRegion = (ship, key) =>
  shipRegions(ship).find((region) => region.getFlag(SCOPE, 'part') === key)

// Token names standing in every station with the given role
export const crewAt = (ship, role) =>
  stationRegions(ship)
    .filter((region) => region.getFlag(SCOPE, 'station') === role)
    .flatMap((region) => [...region.tokens].map((token) => token.name))

// Every part of a ship that can go on its schematic
export const shipParts = (ship) => [
  ...['ratings', 'stakes', ...LISTS].map((key) => ({
    key,
    section: 'ship',
    label: game.i18n.localize(`wildsea.${key}`),
  })),
  ...stationRegions(ship).map((region) => ({
    key: `station-${region.id}`,
    section: 'station',
    label: region.name,
    region,
  })),
  ...ITEM_TYPES.flatMap((type) =>
    [...ship.itemTypes[type]]
      .sort((a, b) => a.sort - b.sort)
      .map((item) => {
        const key = `item-${item.id}`
        return { key, section: type, label: item.name, item, region: partRegion(ship, key) }
      }),
  ),
]

export const SECTIONS = ['ship', 'station', ...ITEM_TYPES]

export const placements = (ship) => ship.getFlag(SCOPE, 'schematic') ?? {}

export const placePart = (ship, key, placement) =>
  placement
    ? ship.setFlag(SCOPE, `schematic.${key}`, placement)
    : ship.unsetFlag(SCOPE, `schematic.${key}`)

// Cards placed before decks existed belong to the main deck
const placementLevel = (placement, scene) =>
  placement.level ?? scene.initialLevel?.id

const onViewedLevel = (levelId) => !canvas.level || levelId === canvas.level.id

// Where a part sits on a scene and which deck it is on: its region's centre, or its card placement
export const partPosition = (ship, part, scene = canvas.scene) => {
  if (part.region) {
    if (part.region.parent !== scene) return null
    const { x, y, width, height } = part.region.bounds
    const level = [...part.region.levels][0] ?? scene.initialLevel?.id
    return { x: x + width / 2, y: y + height / 2, level }
  }
  const placement = placements(ship)[part.key]
  if (placement?.scene !== scene?.id) return null
  return { ...placement, level: placementLevel(placement, scene) }
}

const viewedLevels = () => (canvas.level ? [canvas.level.id] : [])

// Ship owners arrange their ship; regions are scene documents, so the GM's client makes those changes
export const canArrange = (ship) => !!ship?.isOwner

const REGION_QUERY = `${SCOPE}.shipRegion`

const handleRegionQuery = async ({ action, ship: shipUuid, region: regionUuid, data }, { user }) => {
  const ship = fromUuidSync(shipUuid)
  if (!ship?.testUserPermission(user, 'OWNER'))
    throw new Error('Only owners of a ship can arrange it')

  if (action === 'create') {
    const scene = shipScene(ship)
    if (!scene) throw new Error('This ship has no scene')
    const flags = { [SCOPE]: { ...data.flags?.[SCOPE], ship: ship.uuid } }
    return scene.createEmbeddedDocuments('Region', [
      { visibility: CONST.REGION_VISIBILITY.ALWAYS, ...data, flags },
    ])
  }

  const region = fromUuidSync(regionUuid)
  if (region?.getFlag(SCOPE, 'ship') !== ship.uuid)
    throw new Error('That region is not part of this ship')
  if (action === 'delete')
    return region.parent.deleteEmbeddedDocuments('Region', [region.id])
  if (action === 'update') {
    const update = { shapes: data.shapes }
    if (data.iconScale !== undefined) update[`flags.${SCOPE}.iconScale`] = data.iconScale
    return region.update(update)
  }
}

export const registerShipQueries = () => {
  CONFIG.queries[REGION_QUERY] = handleRegionQuery
}

const requestRegionChange = async (ship, action, { region, data } = {}) => {
  const request = { action, ship: ship.uuid, region: region?.uuid, data }
  if (game.user.isGM) return handleRegionQuery(request, { user: game.user })
  const gm = game.users.activeGM
  if (!gm) return ui.notifications.warn(game.i18n.localize('wildsea.SCHEMATIC.noGM'))
  return gm.query(REGION_QUERY, request)
}

const createRegion = (ship, data) => requestRegionChange(ship, 'create', { data })

export const deleteRegion = (ship, region) =>
  requestRegionChange(ship, 'delete', { region })

const updateRegion = (ship, region, data) =>
  requestRegionChange(ship, 'update', { region, data })

// Region shapes moved by an offset and scaled about the region's centre
const transformShapes = (region, { dx = 0, dy = 0, factor = 1 }) => {
  const { x, y, width, height } = region.bounds
  const cx = x + width / 2
  const cy = y + height / 2
  const move = (px, py) => [cx + (px - cx) * factor + dx, cy + (py - cy) * factor + dy]
  return region.shapes.map((shape) => {
    const data = shape.toObject()
    if (data.type === 'polygon') {
      const points = []
      for (let i = 0; i < data.points.length; i += 2)
        points.push(...move(data.points[i], data.points[i + 1]))
      return { ...data, points }
    }
    const [nx, ny] = move(data.x, data.y)
    const scaled = { ...data, x: nx, y: ny }
    for (const key of ['width', 'height', 'radius', 'radiusX', 'radiusY'])
      if (key in data) scaled[key] = data[key] * factor
    return scaled
  })
}

export const addStation = (ship, scene, { label, role }, { x, y }, levels) =>
  createRegion(ship, {
    name: label,
    levels,
    color: STATION_COLOURS[role],
    shapes: [{ type: 'circle', x, y, radius: 150 }],
    flags: { [SCOPE]: { ship: ship.uuid, station: role } },
  })

const addRoom = (ship, item, { x, y }) =>
  createRegion(ship, {
    name: item.name,
    levels: viewedLevels(),
    color: ROOM_COLOUR,
    shapes: [{ type: 'rectangle', x: x - 250, y: y - 150, width: 500, height: 300 }],
    flags: { [SCOPE]: { ship: ship.uuid, part: `item-${item.id}` } },
  })

// Opens the ship's linked scene, creating it the first time
export const openShipScene = async (ship) => {
  let scene = shipScene(ship)
  if (!scene) {
    if (!game.user.isGM)
      return ui.notifications.warn(
        game.i18n.localize('wildsea.SCHEMATIC.noScene'),
      )
    scene = await Scene.implementation.create({
      name: ship.name,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      grid: { type: CONST.GRID_TYPES.GRIDLESS },
      tokenVision: false,
      flags: { [SCOPE]: { ship: ship.uuid } },
    })
    await ship.setFlag(SCOPE, 'scene', scene.id)
  }
  await scene.view()
  return scene
}

export class WildseaShipSchematic {
  #renderId = 0

  async render() {
    const renderId = ++this.#renderId
    const layer = hudLayer('wildsea-ship-schematic')
    if (!layer) return

    const ships = game.actors.filter(
      (actor) =>
        actor.type === 'ship' &&
        actor.testUserPermission(game.user, 'OBSERVER'),
    )
    const markers = []
    for (const ship of ships) {
      for (const part of shipParts(ship)) {
        const position = partPosition(ship, part)
        if (!position || !onViewedLevel(position.level)) continue
        if (part.region) markers.push(this.createRegionLabel(ship, part))
        else markers.push(this.createCardMarker(ship, part, placements(ship)[part.key]))
      }
    }
    for (const region of canvas.scene.regions) {
      if (!region.getFlag(SCOPE, 'ladder')) continue
      if (canvas.level && !region.includedInLevel(canvas.level.id)) continue
      markers.push(this.createLadderMarker(region))
    }
    const rendered = await Promise.all(markers)
    if (renderId === this.#renderId) layer.replaceChildren(...rendered)
  }

  async renderMarker(ship, part, classes, position) {
    const marker = createMarker(`wildsea-schematic-part ${classes}`, position)
    marker.innerHTML = await renderTemplate(
      MARKER_TEMPLATE,
      this.markerContext(ship, part),
    )
    if (ship.isOwner) this.activatePart(marker, ship)
    return marker
  }

  async createCardMarker(ship, part, placement) {
    const marker = await this.renderMarker(ship, part, '', placement)
    if (canArrange(ship)) {
      const header = marker.querySelector('.wildsea-hud-marker-header')
      header.append(
        createRemoveButton('wildsea.SCHEMATIC.removeFromScene', () =>
          placePart(ship, part.key, null),
        ),
      )
      enableArranging(marker, header, placement, (updated) =>
        placePart(ship, part.key, updated),
      )
    }
    return marker
  }

  // Sits on the region's top edge; dragging it moves the region and its grip resizes it
  async createRegionLabel(ship, part) {
    const { x, y, width } = part.region.bounds
    const anchor = { x: x + width / 2, y, scale: 1 }
    const classes = part.item ? 'wildsea-region-label' : 'wildsea-region-label wildsea-station-label'
    const marker = await this.renderMarker(ship, part, classes, anchor)
    if (canArrange(ship)) {
      const header = marker.querySelector('.wildsea-hud-marker-header')
      header.append(
        createRemoveButton('wildsea.SCHEMATIC.removeFromScene', () =>
          deleteRegion(ship, part.region),
        ),
      )
      enableArranging(marker, header, anchor, ({ x: nx, y: ny, scale }) =>
        updateRegion(ship, part.region, {
          shapes: transformShapes(part.region, {
            dx: nx - anchor.x,
            dy: ny - anchor.y,
            factor: scale,
          }),
        }),
      )
    }
    return marker
  }

  // Dragging the icon moves the ladder region with it
  createLadderMarker(region) {
    const { x, y, width, height } = region.bounds
    const centre = { x: x + width / 2, y: y + height / 2 }
    const placement = { ...centre, scale: region.getFlag(SCOPE, 'iconScale') ?? 1 }
    const marker = createMarker('wildsea-ladder-marker', placement)
    marker.dataset.tooltip = region.name
    const icon = document.createElement('i')
    icon.className = 'fas fa-stairs wildsea-hud-marker-header'
    marker.append(icon)

    const ship = fromUuidSync(region.getFlag(SCOPE, 'ship'))
    if (canArrange(ship))
      enableArranging(marker, icon, placement, ({ x: nx, y: ny, scale }) =>
        updateRegion(ship, region, {
          shapes: transformShapes(region, { dx: nx - centre.x, dy: ny - centre.y }),
          iconScale: scale,
        }),
      )
    return marker
  }

  markerContext(ship, part) {
    const context = { ship, part, title: part.label }
    if (part.key === 'ratings') {
      context.ratings = WILDSEA.shipRatings.map((rating) => ({
        rating,
        track: ship.system.ratings[rating],
      }))
    } else if (part.key === 'stakes') {
      context.stakes = ship.items.reduce(
        (total, item) => total + (parseInt(item.system.stakes) || 0),
        0,
      )
    } else if (LISTS.includes(part.key)) {
      context.entries = ship.system[part.key]
    } else if (part.item) {
      context.item = part.item
    } else {
      const role = part.region.getFlag(SCOPE, 'station')
      context.station = {
        role: game.i18n.localize(`wildsea.STATIONS.ROLES.${role}`),
        crew: [...part.region.tokens].map((token) => token.name),
      }
    }
    return context
  }

  activatePart(marker, ship) {
    for (const track of marker.querySelectorAll('.wildsea-track')) {
      const adjust = (change) => (event) => {
        event.preventDefault()
        this.adjustTrack(ship, track.dataset, clickModifiers(event), change)
      }
      track.addEventListener('click', adjust(1))
      track.addEventListener('contextmenu', adjust(-1))
    }
    for (const toggle of marker.querySelectorAll('[data-toggle-damaged]')) {
      toggle.addEventListener('click', () => {
        const fitting = ship.items.get(toggle.dataset.toggleDamaged)
        fitting?.update({ 'system.damaged': !fitting.system.damaged })
      })
    }
  }

  adjustTrack(ship, { itemId, itemType }, isBurn, change) {
    if (itemType === 'rating') {
      const { value, burn, max } = ship.system.ratings[itemId]
      return ship.update({
        [`system.ratings.${itemId}`]: markTrack(
          { value, burn, max },
          isBurn,
          change,
        ),
      })
    }
    const item = ship.items.get(itemId)
    if (item?.system.track)
      return item.update({
        'system.track': markTrack(item.system.track, isBurn, change),
      })
  }

  onDropCanvasData(data) {
    if (data.type !== DRAG_TYPE) return
    const ship = fromUuidSync(data.ship)
    if (!canArrange(ship)) return
    const position = { x: Math.round(data.x), y: Math.round(data.y) }

    const item = ship.items.get(data.key.replace('item-', ''))
    if (isRoom(item) && canvas.scene === shipScene(ship)) {
      const existing = partRegion(ship, data.key)
      if (existing) deleteRegion(ship, existing)
      addRoom(ship, item, position)
    } else {
      placePart(ship, data.key, {
        scene: canvas.scene.id,
        level: canvas.level?.id,
        ...position,
      })
    }
    return false
  }
}
