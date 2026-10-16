import { WILDSEA } from './config.js'
import { markTrack } from './helpers.js'

const { DialogV2 } = foundry.applications.api
const {
  createCheckboxInput,
  createFormGroup,
  createNumberInput,
  createSelectInput,
} = foundry.applications.fields

const DAMAGE_OUTCOMES = ['conflict', 'disaster']

export const setupDamageButtons = () => {
  Hooks.on('renderChatMessageHTML', (message, html) => {
    const { outcome, actor } = message.flags.wildsea ?? {}
    if (!game.user.isGM || !DAMAGE_OUTCOMES.includes(outcome)) return

    const card = html.querySelector('.message-content .wildsea')
    if (!card) return

    const buttons = document.createElement('div')
    buttons.className = 'wildsea-damage-buttons flexrow wildsea-gapped'
    buttons.append(
      createButton('wildsea.DAMAGE.trackButton', 'fa-heart-crack', () =>
        damageTrack(actor),
      ),
      createButton('wildsea.DAMAGE.shipButton', 'fa-ship', () =>
        damageShip(actor),
      ),
    )
    card.append(buttons)
  })
}

const createButton = (label, icon, onClick) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.innerHTML = `<i class="fas ${icon}"></i> ${game.i18n.localize(label)}`
  button.addEventListener('click', onClick)
  return button
}

const formGroup = (label, input) =>
  createFormGroup({ label: game.i18n.localize(label), input }).outerHTML

const damageFields = () => [
  formGroup(
    'wildsea.DAMAGE.amount',
    createNumberInput({ name: 'amount', value: 1, min: 1, step: 1 }),
  ),
  formGroup('wildsea.DAMAGE.burn', createCheckboxInput({ name: 'burn' })),
]

const promptDamage = (title, fields) =>
  DialogV2.input({
    window: { title: game.i18n.localize(title) },
    content: fields.join(''),
    rejectClose: false,
  })

const damageTrack = async (actorUuid) => {
  const actor = await fromUuid(actorUuid)
  const items = actor?.items.filter((item) => item.system.track?.max > 0)
  if (!items?.length)
    return ui.notifications.warn(
      game.i18n.format('wildsea.DAMAGE.noTracks', { actor: actor?.name }),
    )

  const options = items.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.system.track.value}/${item.system.track.max})`,
  }))
  const data = await promptDamage('wildsea.DAMAGE.trackButton', [
    formGroup(
      'wildsea.DAMAGE.track',
      createSelectInput({ name: 'track', options }),
    ),
    ...damageFields(),
  ])
  if (!data) return

  const item = actor.items.get(data.track)
  await item.update({
    system: { track: markTrack(item.system.track, data.burn, data.amount) },
  })
  notifyDamage(data, `${actor.name}: ${item.name}`)
}

const damageShip = async (actorUuid) => {
  const roller = await fromUuid(actorUuid)
  const ships = game.actors.filter((actor) => actor.type === 'ship')
  if (!ships.length)
    return ui.notifications.warn(game.i18n.localize('wildsea.DAMAGE.noShips'))

  const shipOptions = ships.map((ship) => ({ value: ship.id, label: ship.name }))
  const ratingOptions = WILDSEA.shipRatings.map((rating) => ({
    value: rating,
    label: `wildsea.${rating}`,
  }))
  const data = await promptDamage('wildsea.DAMAGE.shipButton', [
    formGroup(
      'wildsea.DAMAGE.ship',
      createSelectInput({
        name: 'ship',
        options: shipOptions,
        value: roller?.type === 'ship' ? roller.id : ships[0].id,
      }),
    ),
    formGroup(
      'wildsea.rating',
      createSelectInput({
        name: 'rating',
        options: ratingOptions,
        localize: true,
      }),
    ),
    ...damageFields(),
  ])
  if (!data) return

  const ship = game.actors.get(data.ship)
  const { value, burn, max } = ship.system.ratings[data.rating]
  await ship.update({
    system: {
      ratings: {
        [data.rating]: markTrack({ value, burn, max }, data.burn, data.amount),
      },
    },
  })
  notifyDamage(
    data,
    `${ship.name}: ${game.i18n.localize(`wildsea.${data.rating}`)}`,
  )
}

const notifyDamage = ({ amount, burn }, target) =>
  ui.notifications.info(
    game.i18n.format(burn ? 'wildsea.DAMAGE.burned' : 'wildsea.DAMAGE.marked', {
      amount,
      target,
    }),
  )
