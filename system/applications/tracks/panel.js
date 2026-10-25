import { clickModifiers } from '../../helpers.js'
import WildseaTrack from './track.js'
import SortableJS from '../../lib/sortable.complete.esm.js'
import { DRAG_TYPE } from './scene.js'

const { HandlebarsApplicationMixin } = foundry.applications.api

export class WildseaTrackPanel extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(db, options = {}) {
    super(options)
    this.db = db
    this.sortable = null
  }

  static DEFAULT_OPTIONS = {
    id: 'wildsea-tracks-panel',
    classes: ['track-panel'],
    position: {
      width: 500,
      height: 'auto',
    },
    window: {
      title: 'wildsea.TRACKS.windowTitle',
      resizable: true,
      controls: [],
    },
  }

  static PARTS = {
    panel: {
      template: 'systems/the-wildsea/templates/applications/tracks/panel.hbs',
    },
  }

  async _prepareContext(options) {
    const tracks = await this.prepareTracks()
    return {
      options: {
        editable: game.user.isGM,
      },
      tracks,
    }
  }

  async prepareTracks() {
    const tracks = game.wildsea.trackDatabase.contents
    return tracks.map((track) => new WildseaTrack(track))
  }

  _onRender(context, options) {
    super._onRender(context, options)

    this.sortable?.destroy()
    this.sortable = null

    if (!game.user.isGM) return

    for (const el of this.element.querySelectorAll('[data-action="adjustTrack"]')) {
      el.addEventListener('contextmenu', (event) => {
        event.preventDefault()
        this._onAdjustTrack(event, el, -1)
      })
    }

    // SortableJS for reordering tracks
    const trackList = this.element.querySelector('.track-list')
    if (trackList) {
      this.sortable = new SortableJS(trackList, {
        animation: 200,
        direction: 'vertical',
        draggable: '.wildsea-track-row',
        dragClass: 'wildsea-drag-preview',
        ghostClass: 'wildsea-drag-placeholder',
        // Lets a row be dropped onto the canvas to place it in the scene
        setData: (dataTransfer, row) =>
          dataTransfer.setData(
            'text/plain',
            JSON.stringify({ type: DRAG_TYPE, id: row.dataset.trackId }),
          ),
        onEnd: (event) => {
          const id = event.item.dataset.trackId
          const newIndex = event.newDraggableIndex
          game.wildsea.trackDatabase.moveTrack(id, newIndex)
        },
      })
    }
  }

  async toggle() {
    if (this.rendered) {
      this.close()
    } else {
      await this.render({ force: true })
    }
  }

  async _onClickAction(event, target) {
    event.preventDefault()

    switch (target.dataset.action) {
      case 'addTrack':
        return this._onAddTrack()
      case 'editTrack':
        return this._onEditTrack(target)
      case 'deleteTrack':
        return this._onDeleteTrack(target)
      case 'adjustTrack':
        return this._onAdjustTrack(event, target, 1)
      default:
        return super._onClickAction(event, target)
    }
  }

  _onClose(options) {
    this.sortable?.destroy()
    this.sortable = null
    super._onClose(options)
  }

  async _onAddTrack() {
    if (!game.user.isGM) return

    const data = await this.db.showTrackDialog('wildsea.TRACKS.addTrack')
    if (data.cancelled) return

    this.db.addTrack({ ...data })
  }

  async _onEditTrack(target) {
    if (!game.user.isGM) return

    const id = target.closest('.wildsea-track-row')?.dataset.trackId
    if (!id) return

    const track = this.db.get(id)
    const data = await this.db.showTrackDialog(
      'wildsea.TRACKS.editTrack',
      track,
    )
    if (data.cancelled) return

    this.db.updateTrack(id, data)
  }

  _onDeleteTrack(target) {
    if (!game.user.isGM) return

    const id = target.closest('.wildsea-track-row')?.dataset.trackId
    if (!id) return

    this.db.deleteTrack(id)
  }

  _onAdjustTrack(event, target, amount) {
    if (!game.user.isGM) return

    const id = target.closest('.wildsea-track-row')?.dataset.trackId
    if (!id) return

    this.db.markTrack(id, clickModifiers(event), amount)
  }
}
