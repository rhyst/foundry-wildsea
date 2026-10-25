import { markTrack } from '../../helpers.js'
import { crewAt } from '../ship/schematic.js'

export const JOURNEY_TRACKS = ['progress', 'risk', 'pathfinding', 'riot']
export const HELM_ACTIONS = { cutPath: 1, forgeAhead: 2, dropAnchor: 0 }
const WATCH_CATEGORIES = { 6: 'peace', 5: 'order', 4: 'order', 3: 'nature', 2: 'nature', 1: 'nature' }

const localize = (key) => game.i18n.localize(`wildsea.JOURNEY.${key}`)
const format = (key, data) => game.i18n.format(`wildsea.JOURNEY.${key}`, data)

export const registerJourneySettings = () =>
  game.settings.register('wildsea', 'journey', {
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => game.wildsea.journeyPanel?.render(),
  })

export const getJourney = () => game.settings.get('wildsea', 'journey')
const saveJourney = (journey) => game.settings.set('wildsea', 'journey', journey)

export const journeyShip = (journey = getJourney()) =>
  journey.ship ? fromUuidSync(journey.ship) : null

export const crewNames = (role) => {
  const ship = journeyShip()
  return ship ? crewAt(ship, role) : []
}

export const startJourney = ({ ship, destination, ...lengths }) =>
  saveJourney({
    ship,
    destination,
    tracks: Object.fromEntries(
      JOURNEY_TRACKS.map((key) => [
        key,
        { value: 0, burn: 0, max: Math.max(parseInt(lengths[key]) || 0, 0) },
      ]),
    ),
  })

export const endJourney = () => saveJourney({})

export const adjustJourneyTrack = async (key, change) => {
  const journey = getJourney()
  const track = journey.tracks?.[key]
  if (!track) return
  const wasComplete = track.value >= track.max
  journey.tracks[key] = { ...track, ...markTrack(track, false, change) }
  await saveJourney(journey)

  const { value, max } = journey.tracks.progress
  if (key === 'progress' && !wasComplete && value >= max)
    await postCard(
      localize('arrivedTitle'),
      format('arrived', { destination: journey.destination }),
    )
}

// Chat card in the system's card style; secret cards go to the Firefly only
const postCard = (title, body, { rolls = [], secret = false } = {}) =>
  ChatMessage.create({
    speaker: { alias: localize('title') },
    content: `<div class="wildsea"><h3>${title}</h3><p>${body}</p></div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    whisper: secret
      ? ChatMessage.getWhisperRecipients('GM').map((user) => user.id)
      : [],
  })

const who = (role) => crewNames(role).join(', ') || localize('someone')

export const takeHelm = async (action) => {
  await postCard(
    localize(`HELM.${action}.name`),
    `${format('helmTaken', { crew: who('helm') })} ${localize(`HELM.${action}.effect`)}`,
  )
  if (HELM_ACTIONS[action]) await adjustJourneyTrack('progress', HELM_ACTIONS[action])
}

const rollD6 = (formula = '1d6') => new Roll(formula).evaluate()

export const watchTheWaves = async () => {
  const category = await rollD6()
  const detail = await rollD6()
  const kind = WATCH_CATEGORIES[category.total]
  await postCard(
    localize('WATCH.watchTheWaves'),
    `${format('watchTaken', { crew: who('watch') })} <strong>${localize(`WATCH.${kind}.name`)}:</strong> ${localize(`WATCH.${kind}.${detail.total}`)}`,
    { rolls: [category, detail] },
  )
}

export const makeDiscovery = () =>
  postCard(
    localize('WATCH.makeDiscovery'),
    `${format('watchTaken', { crew: who('watch') })} ${localize('WATCH.discoveryEffect')}`,
  )

const outcome = (total) => (total === 6 ? 'high' : total >= 4 ? 'mid' : 'low')

export const rollWeather = async () => {
  const roll = await rollD6()
  await postCard(localize('weather'), localize(`WEATHER.${outcome(roll.total)}`), {
    rolls: [roll],
  })
}

// The Firefly rolls threat secretly; a chart of the area rolls 2d6 keeping the highest
export const rollThreat = async (hasChart) => {
  const roll = await rollD6(hasChart ? '2d6kh' : '1d6')
  await postCard(localize('threat'), localize(`THREAT.${outcome(roll.total)}`), {
    rolls: [roll],
    secret: true,
  })
}
