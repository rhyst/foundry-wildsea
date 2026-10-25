import { clickModifiers } from '../../helpers.js'
import WildseaTrack from './track.js'

export const DRAG_TYPE = 'WildseaTrack'

// Track markers drawn in the canvas HUD layer, which pans and zooms with the map
export class WildseaSceneTracks {
  constructor(db) {
    this.db = db
  }

  render() {
    const hud = canvas.hud
    if (!canvas.scene || !hud?.rendered) return

    let container = hud.element.querySelector('#wildsea-scene-tracks')
    if (!container) {
      container = document.createElement('div')
      container.id = 'wildsea-scene-tracks'
      hud.element.append(container)
    }

    const markers = this.db.contents
      .filter((data) => data.placement?.scene === canvas.scene.id)
      .filter((data) => game.user.isGM || data.visibility !== 'secret')
      .map((data) => this.createMarker(new WildseaTrack(data), data.placement))
    container.replaceChildren(...markers)
  }

  createMarker(track, placement) {
    const { x, y, scale = 1 } = placement
    const marker = document.createElement('div')
    marker.className = `wildsea wildsea-scene-track ${track.displayVisibility()}`
    marker.dataset.trackId = track.id
    Object.assign(marker.style, { left: `${x}px`, top: `${y}px` })
    marker.style.setProperty('--wildsea-marker-scale', scale)

    const header = document.createElement('div')
    header.className = 'wildsea-scene-track-header'
    const label = document.createElement('span')
    label.className = 'wildsea-track-label'
    label.textContent = track.label
    header.append(label)
    marker.append(header)

    if (game.user.isGM || track.visibility === 'open') {
      const slots = document.createElement('div')
      slots.className = 'wildsea-track-slots'
      slots.innerHTML = track.render()
      marker.append(slots)
      if (game.user.isGM) this.activateSlots(slots, track.id)
    }

    if (game.user.isGM) {
      const remove = document.createElement('a')
      remove.className = 'wildsea-scene-track-remove'
      remove.dataset.tooltip = game.i18n.localize('wildsea.TRACKS.removeFromScene')
      remove.innerHTML = '<i class="fas fa-xmark"></i>'
      remove.addEventListener('click', () => this.db.placeTrack(track.id, null))
      header.append(remove)
      this.activateDrag(marker, header, placement, track.id)
      this.activateResize(marker, placement, track.id)
    }
    return marker
  }

  activateSlots(slots, id) {
    slots.addEventListener('click', (event) =>
      this.db.markTrack(id, clickModifiers(event), 1),
    )
    slots.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      this.db.markTrack(id, clickModifiers(event), -1)
    })
  }

  activateDrag(marker, handle, placement, id) {
    handle.classList.add('wildsea-draggable')
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('a')) return
      event.preventDefault()
      const scale = canvas.stage.scale.x
      const start = { x: event.clientX, y: event.clientY }
      const origin = { x: marker.offsetLeft, y: marker.offsetTop }
      const position = (e) => ({
        x: Math.round(origin.x + (e.clientX - start.x) / scale),
        y: Math.round(origin.y + (e.clientY - start.y) / scale),
      })

      const move = (e) => {
        const { x, y } = position(e)
        Object.assign(marker.style, { left: `${x}px`, top: `${y}px` })
      }
      const up = (e) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        this.db.placeTrack(id, { ...placement, ...position(e) })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }

  // Scales around the marker's centre by the pointer's change in distance from it
  activateResize(marker, placement, id) {
    const handle = document.createElement('a')
    handle.className = 'wildsea-scene-track-resize'
    marker.append(handle)

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const rect = marker.getBoundingClientRect()
      const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      const distance = (e) => Math.hypot(e.clientX - centre.x, e.clientY - centre.y)
      const startDistance = distance(event) || 1
      const startScale = placement.scale ?? 1
      const scaleAt = (e) =>
        Math.clamp((startScale * distance(e)) / startDistance, 0.5, 5)

      const move = (e) =>
        marker.style.setProperty('--wildsea-marker-scale', scaleAt(e))
      const up = (e) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        this.db.placeTrack(id, { ...placement, scale: scaleAt(e) })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    })
  }

  onDropCanvasData(data) {
    if (data.type !== DRAG_TYPE || !game.user.isGM) return
    this.db.placeTrack(data.id, {
      scene: canvas.scene.id,
      x: Math.round(data.x),
      y: Math.round(data.y),
    })
    return false
  }
}
