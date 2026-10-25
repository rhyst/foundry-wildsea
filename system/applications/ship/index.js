import { WildseaShipSchematic } from './schematic.js'
import { WildseaShipPartsPanel } from './parts-panel.js'
import { SCOPE, registerShipQueries } from './schematic.js'
import { STRETCH_FLAG, addStretchOption } from './furniture.js'

const wildseaDrawing = (Drawing) =>
  class extends Drawing {
    // Generated schematic text is drawn plainly, without core's outline and shadow
    _getTextStyle() {
      const style = super._getTextStyle()
      if (this.document.getFlag(SCOPE, 'generated')) {
        style.strokeThickness = 0
        style.dropShadow = false
      }
      return style
    }

    // Core tiles a drawing's image; stretched drawings scale it to the shape instead
    _getFillStyle() {
      const style = super._getFillStyle()
      const { width, height } = this.document.shape
      if (style.texture && this.document.getFlag(SCOPE, STRETCH_FLAG))
        style.matrix = new PIXI.Matrix().scale(
          width / style.texture.width,
          height / style.texture.height,
        )
      return style
    }
  }

export const setup = () => {
  CONFIG.Drawing.objectClass = wildseaDrawing(CONFIG.Drawing.objectClass)
  Hooks.on('renderDrawingConfig', addStretchOption)
  registerShipQueries()

  const schematic = new WildseaShipSchematic()
  game.wildsea.shipSchematic = schematic

  const refresh = () => {
    schematic.render()
    WildseaShipPartsPanel.renderAll()
  }
  const isShip = (actor) => actor?.type === 'ship'

  Hooks.on('renderHeadsUpDisplayContainer', () => schematic.render())
  Hooks.on('canvasReady', () => WildseaShipPartsPanel.renderAll())
  Hooks.on('dropCanvasData', (_canvas, data) => schematic.onDropCanvasData(data))
  Hooks.on('updateActor', (actor) => isShip(actor) && refresh())
  for (const hook of ['createItem', 'updateItem', 'deleteItem'])
    Hooks.on(hook, (item) => isShip(item.parent) && refresh())
  // Station crew and region labels follow tokens and regions
  for (const hook of ['createToken', 'updateToken', 'deleteToken'])
    Hooks.on(hook, (token) => token.parent === canvas.scene && schematic.render())
  for (const hook of ['createRegion', 'updateRegion', 'deleteRegion'])
    Hooks.on(hook, (region) => region.parent === canvas.scene && refresh())
}
