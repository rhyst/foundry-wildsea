import { SCOPE, canArrange, openShipScene, shipScene } from './schematic.js'

// Longest side of a new piece of furniture, in canvas pixels
const FURNITURE_SIZE = 300

export const STRETCH_FLAG = 'stretchTexture'

const imageSize = (src) =>
  new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 1, height: 1 })
    image.src = src
  })

const createFurniture = async (scene, src) => {
  const { width, height } = await imageSize(src)
  const scale = FURNITURE_SIZE / Math.max(width, height, 1)
  const size = { width: Math.round(width * scale), height: Math.round(height * scale) }
  const { x, y } = canvas.stage.pivot
  await scene.createEmbeddedDocuments('Drawing', [
    {
      author: game.user.id,
      shape: { type: 'r', ...size },
      x: Math.round(x - size.width / 2),
      y: Math.round(y - size.height / 2),
      levels: canvas.level ? [canvas.level.id] : [],
      texture: src,
      fillType: CONST.DRAWING_FILL_TYPES.PATTERN,
      fillColor: '#ffffff',
      fillAlpha: 1,
      strokeWidth: 0,
      flags: { [SCOPE]: { [STRETCH_FLAG]: true } },
    },
  ])
}

// Furniture is an ordinary drawing filled with an image, so its owner moves it with core's drawing tools
export const addFurniture = async (ship) => {
  if (!canArrange(ship)) return
  if (!game.user.can('DRAWING_CREATE'))
    return ui.notifications.warn(game.i18n.localize('wildsea.FURNITURE.noPermission'))

  const scene = shipScene(ship) ?? (await openShipScene(ship))
  if (!scene) return
  if (canvas.scene !== scene) await scene.view()

  const FilePicker = foundry.applications.apps.FilePicker.implementation
  new FilePicker({ type: 'image', callback: (src) => createFurniture(scene, src) }).render({
    force: true,
  })
}

// Adds a "stretch image to fit" option to the drawing config's fill tab
export const addStretchOption = (app, element) => {
  const fill = element.querySelector('.tab[data-tab="fill"]')
  if (!fill || fill.querySelector(`[name="flags.${SCOPE}.${STRETCH_FLAG}"]`)) return
  const group = document.createElement('div')
  group.className = 'form-group'
  group.innerHTML = `<label>${game.i18n.localize('wildsea.FURNITURE.stretch')}</label>
    <div class="form-fields">
      <input type="checkbox" name="flags.${SCOPE}.${STRETCH_FLAG}" ${app.document.getFlag(SCOPE, STRETCH_FLAG) ? 'checked' : ''}>
    </div>
    <p class="hint">${game.i18n.localize('wildsea.FURNITURE.stretchHint')}</p>`
  fill.append(group)
}
