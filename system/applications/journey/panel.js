import { WILDSEA } from '../../config.js'
import { sceneShip } from '../ship/schematic.js'
import {
  HELM_ACTIONS,
  JOURNEY_TRACKS,
  adjustJourneyTrack,
  crewNames,
  endJourney,
  getJourney,
  journeyShip,
  makeDiscovery,
  rollThreat,
  rollWeather,
  startJourney,
  takeHelm,
  watchTheWaves,
} from './journey.js'

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } =
  foundry.applications.api
const { createFormGroup, createNumberInput, createSelectInput, createTextInput } =
  foundry.applications.fields

const DEFAULT_LENGTHS = { progress: 6, risk: 6, pathfinding: 0, riot: 6 }

export class WildseaJourneyPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'wildsea-journey',
    classes: ['wildsea-journey'],
    position: { width: 420, height: 'auto' },
    window: { title: 'wildsea.JOURNEY.title', resizable: true },
    actions: {
      startJourney: WildseaJourneyPanel._onStartJourney,
      endJourney: WildseaJourneyPanel._onEndJourney,
      helm: WildseaJourneyPanel._onHelm,
      watchTheWaves: () => watchTheWaves(),
      makeDiscovery: () => makeDiscovery(),
      weather: () => rollWeather(),
      threat: WildseaJourneyPanel._onThreat,
    },
  }

  static PARTS = {
    journey: {
      template: `${WILDSEA.root_path}/templates/journey/panel.hbs`,
    },
  }

  async toggle() {
    if (this.rendered) return this.close()
    return this.render({ force: true })
  }

  async _prepareContext() {
    const journey = getJourney()
    if (!journey.tracks) return { active: false }
    return {
      active: true,
      destination: journey.destination,
      ship: journeyShip(journey)?.name,
      tracks: JOURNEY_TRACKS.filter((key) => journey.tracks[key]?.max > 0).map(
        (key) => ({ key, track: journey.tracks[key] }),
      ),
      helm: crewNames('helm').join(', '),
      watch: crewNames('watch').join(', '),
      helmActions: Object.keys(HELM_ACTIONS),
    }
  }

  _onRender(context, options) {
    super._onRender(context, options)
    for (const track of this.element.querySelectorAll('.wildsea-track')) {
      const key = track.dataset.itemId
      track.addEventListener('click', () => adjustJourneyTrack(key, 1))
      track.addEventListener('contextmenu', (event) => {
        event.preventDefault()
        adjustJourneyTrack(key, -1)
      })
    }
  }

  static async _onStartJourney() {
    const ships = game.actors.filter((actor) => actor.type === 'ship')
    const defaultShip = sceneShip(canvas.scene) ?? ships[0]
    const field = (label, input) =>
      createFormGroup({
        label: game.i18n.localize(`wildsea.JOURNEY.${label}`),
        input,
      }).outerHTML
    const data = await DialogV2.input({
      window: { title: game.i18n.localize('wildsea.JOURNEY.start') },
      content: [
        field(
          'ship',
          createSelectInput({
            name: 'ship',
            value: defaultShip?.uuid,
            options: ships.map((ship) => ({ value: ship.uuid, label: ship.name })),
          }),
        ),
        field('destination', createTextInput({ name: 'destination' })),
        ...Object.entries(DEFAULT_LENGTHS).map(([key, value]) =>
          field(
            `TRACKS.${key}`,
            createNumberInput({ name: key, value, min: 0, max: 20, step: 1 }),
          ),
        ),
        `<p class="hint">${game.i18n.localize('wildsea.JOURNEY.lengthHint')}</p>`,
      ].join(''),
      rejectClose: false,
    })
    if (data) await startJourney(data)
  }

  static async _onEndJourney() {
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize('wildsea.JOURNEY.end') },
      content: `<p>${game.i18n.localize('wildsea.JOURNEY.endConfirm')}</p>`,
      rejectClose: false,
    })
    if (confirmed) await endJourney()
  }

  static _onHelm(_event, target) {
    return takeHelm(target.dataset.helmAction)
  }

  static _onThreat() {
    const hasChart = this.element.querySelector('[name="hasChart"]')?.checked
    return rollThreat(hasChart)
  }
}
