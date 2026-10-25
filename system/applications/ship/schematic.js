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
const SCOPE = 'the-wildsea'
const MARKER_TEMPLATE = `${WILDSEA.root_path}/templates/schematic/marker.hbs`
const LISTS = ['conditions', 'cargoPassengers', 'reputations']
const ITEM_TYPES = ['design', 'fitting', 'undercrew']

// Every part of a ship that can be placed on a schematic, keyed for its placement flag
export const shipParts = (ship) => [
  ...['ratings', 'stakes', ...LISTS].map((key) => ({
    key,
    section: 'ship',
    label: game.i18n.localize(`wildsea.${key}`),
  })),
  ...ITEM_TYPES.flatMap((type) =>
    [...ship.itemTypes[type]]
      .sort((a, b) => a.sort - b.sort)
      .map((item) => ({
        key: `item-${item.id}`,
        section: type,
        label: item.name,
        item,
      })),
  ),
]

export const SECTIONS = ['ship', ...ITEM_TYPES]

// The ship linked to a scene opened from its sheet
export const sceneShip = (scene) => {
  const uuid = scene?.getFlag(SCOPE, 'ship')
  return uuid ? fromUuidSync(uuid) : null
}

export const placements = (ship) => ship.getFlag(SCOPE, 'schematic') ?? {}

export const placePart = (ship, key, placement) =>
  placement
    ? ship.setFlag(SCOPE, `schematic.${key}`, placement)
    : ship.unsetFlag(SCOPE, `schematic.${key}`)

// Opens the ship's linked scene, creating it the first time
export const openShipScene = async (ship) => {
  let scene = game.scenes.get(ship.getFlag(SCOPE, 'scene'))
  if (!scene) {
    if (!game.user.isGM)
      return ui.notifications.warn(
        game.i18n.localize('wildsea.SCHEMATIC.noScene'),
      )
    scene = await Scene.implementation.create({
      name: ship.name,
      grid: { type: CONST.GRID_TYPES.GRIDLESS },
      tokenVision: false,
      flags: { [SCOPE]: { ship: ship.uuid } },
    })
    await ship.setFlag(SCOPE, 'scene', scene.id)
  }
  await scene.view()
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
      const parts = Object.fromEntries(
        shipParts(ship).map((part) => [part.key, part]),
      )
      for (const [key, placement] of Object.entries(placements(ship))) {
        if (placement.scene !== canvas.scene.id || !parts[key]) continue
        markers.push(this.createPartMarker(ship, parts[key], placement))
      }
    }
    const rendered = await Promise.all(markers)
    if (renderId === this.#renderId) layer.replaceChildren(...rendered)
  }

  async createPartMarker(ship, part, placement) {
    const room = /room/i.test(part.item?.system.type ?? '')
    const marker = createMarker(
      `wildsea-schematic-part ${room ? 'wildsea-schematic-room' : ''}`,
      placement,
    )
    marker.innerHTML = await renderTemplate(
      MARKER_TEMPLATE,
      this.markerContext(ship, part),
    )

    if (ship.isOwner) this.activatePart(marker, ship)
    if (game.user.isGM) {
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
    } else {
      context.item = part.item
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
    if (data.type !== DRAG_TYPE || !game.user.isGM) return
    const ship = fromUuidSync(data.ship)
    if (!ship) return
    placePart(ship, data.key, {
      scene: canvas.scene.id,
      x: Math.round(data.x),
      y: Math.round(data.y),
    })
    return false
  }
}
