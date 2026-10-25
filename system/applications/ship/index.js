import { WildseaShipSchematic } from './schematic.js'
import { WildseaShipPartsPanel } from './parts-panel.js'

export const setup = () => {
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
