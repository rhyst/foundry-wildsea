import { clickModifiers } from '../../helpers.js'
import {
  createMarker,
  createRemoveButton,
  enableArranging,
  hudLayer,
} from '../hud-markers.js'
import WildseaTrack from './track.js'

export const DRAG_TYPE = 'WildseaTrack'

export class WildseaSceneTracks {
  constructor(db) {
    this.db = db
  }

  render() {
    const layer = hudLayer('wildsea-scene-tracks')
    if (!layer) return

    const markers = this.db.contents
      .filter((data) => data.placement?.scene === canvas.scene.id)
      .filter((data) => game.user.isGM || data.visibility !== 'secret')
      .map((data) =>
        this.createTrackMarker(new WildseaTrack(data), data.placement),
      )
    layer.replaceChildren(...markers)
  }

  createTrackMarker(track, placement) {
    const marker = createMarker(
      `wildsea-scene-track ${track.displayVisibility()}`,
      placement,
    )
    marker.dataset.trackId = track.id

    const header = document.createElement('div')
    header.className = 'wildsea-hud-marker-header'
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
      header.append(
        createRemoveButton('wildsea.TRACKS.removeFromScene', () =>
          this.db.placeTrack(track.id, null),
        ),
      )
      enableArranging(marker, header, placement, (updated) =>
        this.db.placeTrack(track.id, updated),
      )
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
