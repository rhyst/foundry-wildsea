import { registerWildseaTrackSettings } from './settings.js'
import { WildseaTrackDatabase } from './db.js'
import { WildseaTrackPanel } from './panel.js'
import { WildseaSceneTracks } from './scene.js'

export const setup = () => {
  registerWildseaTrackSettings()
  game.wildsea.trackDatabase = new WildseaTrackDatabase()
  game.wildsea.trackPanel = new WildseaTrackPanel(game.wildsea.trackDatabase)
  game.wildsea.sceneTracks = new WildseaSceneTracks(game.wildsea.trackDatabase)
  game.wildsea.trackDatabase.refresh()

  Hooks.on('renderHeadsUpDisplayContainer', () => game.wildsea.sceneTracks.render())
  Hooks.on('canvasReady', () => {
    if (game.wildsea.trackPanel.rendered) game.wildsea.trackPanel.render()
  })
  Hooks.on('dropCanvasData', (_canvas, data) =>
    game.wildsea.sceneTracks.onDropCanvasData(data),
  )

  Handlebars.registerHelper('renderTrack', (track) => track.render())

  Hooks.on('createSetting', (setting) => {
    if (setting.key === 'wildsea.activeTracks') {
      game.wildsea.trackDatabase.refresh()
    }
  })
}
