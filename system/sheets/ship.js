import { WILDSEA } from '../config.js'
import { renderDialog } from '../dialog.js'
import { clamp, clickModifiers, enrich, markTrack } from '../helpers.js'
import WildseaActorSheet from './actor.js'
import * as Dice from '../dice.js'

const { renderTemplate } = foundry.applications.handlebars

export default class WildseaShipSheet extends WildseaActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ['actor-sheet', 'ship-sheet'],
    position: {
      width: 1000,
      height: 750,
    },
    actions: {
      addItem: WildseaShipSheet._onAddItem,
      ratingRoll: WildseaShipSheet._onRatingRoll,
      toggleFittingDamaged: WildseaShipSheet._onToggleFittingDamaged,
    },
  }

  static PARTS = {
    form: {
      template: `${WILDSEA.root_path}/templates/sheets/ship.hbs`,
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    context.system = this.actor.system

    context.stakesUsed = 0

    for (const item of this.actor.items) {
      item.system.enrichedDetails = await enrich(item.system.details)
      if (item.system.stakes)
        context.stakesUsed += parseInt(item.system.stakes) || 0
    }

    context.designs = {}
    for (const designType of WILDSEA.designTypes) {
      context.designs[designType] = this.actor.itemTypes.design.filter(
        (d) => d.system.type === designType,
      )
    }

    context.system.designs = this.actor.itemTypes.design.sort((a, b) =>
      a.sort < b.sort ? -1 : 1,
    )

    context.system.fittings = this.actor.itemTypes.fitting.sort((a, b) =>
      a.sort < b.sort ? -1 : 1,
    )

    context.system.undercrew = this.actor.itemTypes.undercrew.sort((a, b) =>
      a.sort < b.sort ? -1 : 1,
    )

    return context
  }

  _onRender(context, options) {
    super._onRender(context, options)

    if (!this.isEditable || !this.actor.isOwner) return

    // Track click and contextmenu handlers for rating and reputation tracks
    for (const el of this.element.querySelectorAll('.wildsea-track')) {
      el.addEventListener('click', this.adjustTrack.bind(this, 1))
      el.addEventListener('contextmenu', this.adjustTrack.bind(this, -1))
    }
  }

  async adjustTrack(change, event) {
    event.preventDefault()

    const data = event.currentTarget.dataset
    const itemType = data.itemType
    const itemId = data.itemId

    switch (itemType) {
      case 'rating':
        await this.adjustRating(itemId, change, clickModifiers(event))
        break
      case 'reputations':
        await this.adjustSlimTrack(
          itemId,
          itemType,
          clickModifiers(event),
          change,
        )
        break
      default:
        break
    }
  }

  async adjustRating(rating, change = 1, isBurn) {
    const { value, burn, max } = this.actor.system.ratings[rating]
    this.actor.update({
      system: {
        ratings: {
          [rating]: markTrack({ value, burn, max: max || 6 }, isBurn, change),
        },
      },
    })
  }

  static _onAddItem(event, target) {
    event.preventDefault()

    const data = target.dataset

    switch (data.itemType) {
      case 'cargoPassengers':
      case 'conditions':
      case 'reputations':
        this.addSlimItem(data.itemType)
        break
      case 'design':
        this.addDesign(data.itemSubtype)
        break
      case 'fittings':
        this.addFitting()
        break
      case 'undercrew':
        this.addUndercrew()
        break
      default:
        ui.notifications.warn(
          `Type "${data.itemType}" not recognised or not implemented`,
        )
        break
    }
  }

  async addDesign(subtype) {
    this.addEmbeddedDocument({
      name: game.i18n.format('wildsea.newDesignName', {
        subtype: game.i18n.localize(`wildsea.${subtype}`),
      }),
      type: 'design',
      system: {
        details: game.i18n.localize('wildsea.newDesignDetails'),
        type: subtype,
      },
    })
  }

  async addFitting() {
    this.addEmbeddedDocument({
      name: game.i18n.localize('wildsea.newFittingName'),
      type: 'fitting',
      system: {
        details: game.i18n.localize('wildsea.newFittingDetail'),
      },
    })
  }

  async addUndercrew() {
    this.addEmbeddedDocument({
      name: game.i18n.localize('wildsea.newUndercrewName'),
      type: 'undercrew',
      system: {
        details: game.i18n.localize('wildsea.newUndercrewDetails'),
      },
    })
  }

  static async _onRatingRoll(event, target) {
    event.preventDefault()
    const rolling = target.dataset.rating

    const ratings = {}
    for (const rating of WILDSEA.shipRatings) {
      const shipRating = this.actor.system.ratings[rating]
      ratings[rating] = clamp(
        shipRating.max - shipRating.value,
        shipRating.max,
      )
    }

    const data = await renderDialog(
      game.i18n.localize('wildsea.ratingRoll'),
      WildseaShipSheet._handleRatingRoll,
      { rating: rolling, ratings },
      '/systems/the-wildsea/templates/dialogs/rating_roll.hbs',
    )

    if (data.cancelled) return

    const { rating, cut } = data

    const ratingDice = this.actor.system.ratings[rating]

    const dicePool = {
      rating: rolling,
      ratingDice: clamp(ratingDice.max - ratingDice.value, ratingDice.max),
      cut,
    }

    const [roll, outcome] = await Dice.rollPool(dicePool)

    const chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker(),
      content: await renderTemplate(
        'systems/the-wildsea/templates/chat/roll.hbs',
        outcome,
      ),
      rolls: [roll],
      sound: CONFIG.sounds.dice,
      flags: {
        wildsea: { outcome: outcome.resultText, actor: this.actor.uuid },
      },
    }
    ChatMessage.create(chatData)
  }

  static _handleRatingRoll(html) {
    const form = html[0].querySelector('form')
    return {
      rating: form.rating.value,
      cut: parseInt(form.cut.value || 0),
    }
  }

  static _onToggleFittingDamaged(event, target) {
    const fittingID = target.dataset.fittingId

    const fitting = this.actor.items.get(fittingID)
    const prevStatus = fitting.system.damaged
    fitting.update({ 'system.damaged': !prevStatus })
  }
}
