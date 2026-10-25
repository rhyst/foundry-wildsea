import { WILDSEA } from './config.js'
import { clamp, markTrack } from './helpers.js'

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
    const { outcome, actor, rating } = message.flags.wildsea ?? {}
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
        damageShip(actor, rating),
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
  formGroup(
    'wildsea.DAMAGE.impact',
    createSelectInput({
      name: 'impact',
      value: 'normal',
      options: Object.keys(WILDSEA.impacts).map((impact) => ({
        value: impact,
        label: `wildsea.DAMAGE.IMPACTS.${impact}`,
      })),
      localize: true,
    }),
  ),
  formGroup('wildsea.DAMAGE.burn', createCheckboxInput({ name: 'burn' })),
]

const impactMarks = ({ amount, impact, burn }, track) => {
  const step = WILDSEA.impacts[impact]
  if (step === null) return track.max - (burn ? track.burn : track.value)
  return Math.max(amount + (step ?? 0), 0)
}

const SUMMARY_ORDER = ['weaknesses', 'resistances', 'immunities']

// One aspect's own protections, e.g. "Weak: Flame; Resist: Keen, Spike"
export const protectionText = (system) =>
  SUMMARY_ORDER.filter((key) => system?.[key]?.size)
    .map((key) => {
      const types = WILDSEA.damageTypes
        .filter((type) => system[key].has(type))
        .map((type) => game.i18n.localize(`wildsea.DAMAGE_TYPES.${type}`))
      const label = game.i18n.localize(`wildsea.DAMAGE.COLUMNS.${key}`)
      return `${label}: ${types.join(', ')}`
    })
    .join('; ')

// Net protection: -1 weak, 0 none, 1 resistant, 2 immune
export const protectionFor = (actor, damageType) => {
  let level = 0
  const sources = []
  for (const aspect of actor.itemTypes.aspect) {
    const { value, max } = aspect.system.track
    if (max > 0 && value >= max) continue
    for (const [key, step] of Object.entries(WILDSEA.protectionSteps)) {
      if (!aspect.system[key].has(damageType)) continue
      level += step
      sources.push(aspect.name)
    }
  }
  return { level: clamp(level, 2, -1), sources }
}

const adjustDamage = (amount, level) =>
  ({ [-1]: amount + 2, 1: Math.max(amount - 2, 0), 2: 0 })[level] ?? amount

const protectionSummary = (actor) => {
  const rows = []
  for (const type of WILDSEA.damageTypes) {
    const { level, sources } = protectionFor(actor, type)
    if (!sources.length) continue
    const levelLabel = game.i18n.localize(`wildsea.DAMAGE.LEVELS.${level}`)
    const typeLabel = game.i18n.localize(`wildsea.DAMAGE_TYPES.${type}`)
    rows.push(`<li><strong>${typeLabel}</strong>: ${levelLabel} (${sources.join(', ')})</li>`)
  }
  return rows.length ? `<ul class="wildsea-protection-summary">${rows.join('')}</ul>` : ''
}

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
  const typeOptions = WILDSEA.damageTypes.map((type) => ({
    value: type,
    label: `wildsea.DAMAGE_TYPES.${type}`,
  }))
  const data = await promptDamage('wildsea.DAMAGE.trackButton', [
    protectionSummary(actor),
    formGroup(
      'wildsea.DAMAGE.track',
      createSelectInput({ name: 'track', options }),
    ),
    formGroup(
      'wildsea.DAMAGE.type',
      createSelectInput({
        name: 'damageType',
        options: typeOptions,
        blank: game.i18n.localize('wildsea.DAMAGE.untyped'),
        localize: true,
      }),
    ),
    ...damageFields(),
  ])
  if (!data) return

  const { level } = data.damageType
    ? protectionFor(actor, data.damageType)
    : { level: 0 }
  const item = actor.items.get(data.track)
  const amount = adjustDamage(impactMarks(data, item.system.track), level)
  await item.update({
    system: { track: markTrack(item.system.track, data.burn, amount) },
  })
  notifyDamage({ ...data, amount }, `${actor.name}: ${item.name}`, level)
}

const damageShip = async (actorUuid, rolledRating) => {
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
        value: rolledRating,
        localize: true,
      }),
    ),
    ...damageFields(),
  ])
  if (!data) return

  const ship = game.actors.get(data.ship)
  const { value, burn, max } = ship.system.ratings[data.rating]
  const track = { value, burn, max }
  const amount = impactMarks(data, track)
  await ship.update({
    system: {
      ratings: { [data.rating]: markTrack(track, data.burn, amount) },
    },
  })
  notifyDamage(
    { ...data, amount },
    `${ship.name}: ${game.i18n.localize(`wildsea.${data.rating}`)}`,
  )
}

const notifyDamage = ({ amount, burn }, target, level = 0) => {
  let message = game.i18n.format(
    burn ? 'wildsea.DAMAGE.burned' : 'wildsea.DAMAGE.marked',
    { amount, target },
  )
  if (level) message += ` (${game.i18n.localize(`wildsea.DAMAGE.LEVELS.${level}`)})`
  ui.notifications.info(message)
}
