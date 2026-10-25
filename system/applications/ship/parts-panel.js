import { WILDSEA } from '../../config.js'
import {
  DRAG_TYPE,
  SECTIONS,
  openShipScene,
  placements,
  shipParts,
  shipScene,
} from './schematic.js'
import { generateSchematic } from './generator.js'

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export class WildseaShipPartsPanel extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static instances = new Map()

  static open(ship) {
    let panel = this.instances.get(ship.id)
    if (!panel) {
      panel = new this(ship)
      this.instances.set(ship.id, panel)
    }
    return panel.render({ force: true })
  }

  static renderAll() {
    for (const panel of this.instances.values())
      if (panel.rendered) panel.render()
  }

  constructor(ship, options = {}) {
    super({ id: `wildsea-ship-parts-${ship.id}`, ...options })
    this.ship = ship
  }

  static DEFAULT_OPTIONS = {
    classes: ['wildsea-ship-parts'],
    position: { width: 300, height: 600 },
    window: { resizable: true },
    actions: {
      locatePart: WildseaShipPartsPanel._onLocatePart,
      generateSchematic: WildseaShipPartsPanel._onGenerateSchematic,
    },
  }

  static PARTS = {
    parts: {
      template: `${WILDSEA.root_path}/templates/schematic/parts.hbs`,
    },
  }

  get title() {
    return game.i18n.format('wildsea.SCHEMATIC.partsTitle', {
      ship: this.ship.name,
    })
  }

  async _prepareContext() {
    const placed = placements(this.ship)
    const parts = shipParts(this.ship).map((part) => ({
      ...part,
      here: placed[part.key]?.scene === canvas.scene?.id,
    }))
    return {
      isGM: game.user.isGM,
      sections: SECTIONS.map((section) => ({
        label: game.i18n.localize(`wildsea.SCHEMATIC.SECTIONS.${section}`),
        parts: parts.filter((part) => part.section === section),
      })).filter((section) => section.parts.length),
    }
  }

  _onRender(context, options) {
    super._onRender(context, options)
    for (const row of this.element.querySelectorAll('[data-part-key]')) {
      row.addEventListener('dragstart', (event) =>
        event.dataTransfer.setData(
          'text/plain',
          JSON.stringify({
            type: DRAG_TYPE,
            ship: this.ship.uuid,
            key: row.dataset.partKey,
          }),
        ),
      )
    }
  }

  static async _onGenerateSchematic() {
    const scene = shipScene(this.ship) ?? (await openShipScene(this.ship))
    if (scene) await generateSchematic(this.ship, scene)
  }

  static _onLocatePart(_event, target) {
    const key = target.closest('[data-part-key]').dataset.partKey
    const placement = placements(this.ship)[key]
    if (placement?.scene !== canvas.scene?.id) return
    canvas.animatePan({ x: placement.x, y: placement.y })
  }
}
