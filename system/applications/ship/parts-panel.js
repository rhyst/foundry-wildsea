import { WILDSEA } from '../../config.js'
import {
  DRAG_TYPE,
  SECTIONS,
  STATION_ROLES,
  addStation,
  deleteRegion,
  openShipScene,
  partPosition,
  shipParts,
  shipScene,
} from './schematic.js'
import { generateSchematic } from './generator.js'

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } =
  foundry.applications.api
const { createFormGroup, createSelectInput, createTextInput } =
  foundry.applications.fields

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
      addStation: WildseaShipPartsPanel._onAddStation,
      deleteStation: WildseaShipPartsPanel._onDeleteStation,
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
    const parts = shipParts(this.ship).map((part) => ({
      ...part,
      station: part.section === 'station',
      here: !!partPosition(this.ship, part),
    }))
    return {
      isGM: game.user.isGM,
      sections: SECTIONS.map((section) => ({
        id: section,
        label: game.i18n.localize(`wildsea.SCHEMATIC.SECTIONS.${section}`),
        parts: parts.filter((part) => part.section === section),
      })).filter((section) => section.parts.length || section.id === 'station'),
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

  static async _onAddStation() {
    const data = await DialogV2.input({
      window: { title: game.i18n.localize('wildsea.STATIONS.add') },
      content: [
        createFormGroup({
          label: game.i18n.localize('wildsea.STATIONS.name'),
          input: createTextInput({ name: 'label', required: true }),
        }).outerHTML,
        createFormGroup({
          label: game.i18n.localize('wildsea.STATIONS.role'),
          input: createSelectInput({
            name: 'role',
            options: STATION_ROLES.map((role) => ({
              value: role,
              label: `wildsea.STATIONS.ROLES.${role}`,
            })),
            localize: true,
          }),
        }).outerHTML,
      ].join(''),
      rejectClose: false,
    })
    if (!data?.label?.trim()) return
    const scene = shipScene(this.ship) ?? (await openShipScene(this.ship))
    if (!scene) return
    // Centre of the current view when on the ship's scene, otherwise the scene's centre
    const { sceneX, sceneY, sceneWidth, sceneHeight } = scene.dimensions
    const viewing = canvas.scene === scene
    const position = viewing
      ? canvas.stage.pivot
      : { x: sceneX + sceneWidth / 2, y: sceneY + sceneHeight / 2 }
    const level = viewing ? canvas.level?.id : scene.initialLevel?.id
    await addStation(
      this.ship,
      scene,
      { label: data.label.trim(), role: data.role },
      { x: Math.round(position.x), y: Math.round(position.y) },
      level ? [level] : [],
    )
  }

  static async _onDeleteStation(_event, target) {
    const part = this.partFor(target)
    if (part?.region) await deleteRegion(part.region)
  }

  partFor(target) {
    const key = target.closest('[data-part-key]').dataset.partKey
    return shipParts(this.ship).find((part) => part.key === key)
  }

  // Switches to the part's deck first when it is on another one
  static async _onLocatePart(_event, target) {
    const position = partPosition(this.ship, this.partFor(target))
    if (!position) return
    if (position.level && position.level !== canvas.level?.id)
      await canvas.scene.view({ level: position.level })
    canvas.animatePan({ x: position.x, y: position.y })
  }
}
