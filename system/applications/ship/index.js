import { WildseaShipSchematic } from './schematic.js'
import { WildseaShipPartsPanel } from './parts-panel.js'
import { SCOPE } from './schematic.js'

// Generated schematic text is drawn plainly, without core's outline and shadow
const plainGeneratedText = (Drawing) =>
  class extends Drawing {
    _getTextStyle() {
      const style = super._getTextStyle()
      if (this.document.getFlag(SCOPE, 'generated')) {
        style.strokeThickness = 0
        style.dropShadow = false
      }
      return style
    }
  }

export const setup = () => {
  CONFIG.Drawing.objectClass = plainGeneratedText(CONFIG.Drawing.objectClass)

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
}
