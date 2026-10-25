// Markers drawn in the canvas HUD layer, which pans and zooms with the map.
// Positions are canvas coordinates of the marker's centre.

export const hudLayer = (id) => {
  const hud = canvas.hud
  if (!canvas.scene || !hud?.rendered) return null

  let layer = hud.element.querySelector(`#${id}`)
  if (!layer) {
    layer = document.createElement('div')
    layer.id = id
    hud.element.append(layer)
  }
  return layer
}

export const createMarker = (classes, { x, y, scale = 1 }) => {
  const marker = document.createElement('div')
  marker.className = `wildsea wildsea-hud-marker ${classes}`
  Object.assign(marker.style, { left: `${x}px`, top: `${y}px` })
  marker.style.setProperty('--wildsea-marker-scale', scale)
  return marker
}

export const createRemoveButton = (tooltip, onRemove) => {
  const remove = document.createElement('a')
  remove.className = 'wildsea-hud-marker-remove'
  remove.dataset.tooltip = game.i18n.localize(tooltip)
  remove.innerHTML = '<i class="fas fa-xmark"></i>'
  remove.addEventListener('click', onRemove)
  return remove
}

// Calls onPlace with the updated placement once a drag or resize ends
export const enableArranging = (marker, handle, placement, onPlace) => {
  enableDrag(marker, handle, placement, onPlace)
  enableResize(marker, placement, onPlace)
}

const trackPointer = (event, move, end) => {
  event.preventDefault()
  event.stopPropagation()
  const up = (e) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    end(e)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

const enableDrag = (marker, handle, placement, onPlace) => {
  handle.classList.add('wildsea-draggable')
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('a')) return
    const scale = canvas.stage.scale.x
    const start = { x: event.clientX, y: event.clientY }
    const origin = { x: marker.offsetLeft, y: marker.offsetTop }
    const position = (e) => ({
      x: Math.round(origin.x + (e.clientX - start.x) / scale),
      y: Math.round(origin.y + (e.clientY - start.y) / scale),
    })

    trackPointer(
      event,
      (e) => {
        const { x, y } = position(e)
        Object.assign(marker.style, { left: `${x}px`, top: `${y}px` })
      },
      (e) => onPlace({ ...placement, ...position(e) }),
    )
  })
}

// Scales around the marker's centre by the pointer's change in distance from it
const enableResize = (marker, placement, onPlace) => {
  const handle = document.createElement('a')
  handle.className = 'wildsea-hud-marker-resize'
  marker.append(handle)

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    const rect = marker.getBoundingClientRect()
    const centre = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
    const distance = (e) =>
      Math.hypot(e.clientX - centre.x, e.clientY - centre.y)
    const startDistance = distance(event) || 1
    const startScale = placement.scale ?? 1
    const scaleAt = (e) =>
      Math.clamp((startScale * distance(e)) / startDistance, 0.5, 5)

    trackPointer(
      event,
      (e) => marker.style.setProperty('--wildsea-marker-scale', scaleAt(e)),
      (e) => onPlace({ ...placement, scale: scaleAt(e) }),
    )
  })
}
