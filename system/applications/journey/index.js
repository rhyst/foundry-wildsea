import { registerJourneySettings } from './journey.js'
import { WildseaJourneyPanel } from './panel.js'

export const setup = () => {
  registerJourneySettings()
  const panel = new WildseaJourneyPanel()
  game.wildsea.journeyPanel = panel

  // Crew at the helm and on watch come from tokens standing on ship stations
  const refresh = () => panel.rendered && panel.render()
  for (const hook of ['createToken', 'updateToken', 'deleteToken', 'updateActor'])
    Hooks.on(hook, refresh)
}
