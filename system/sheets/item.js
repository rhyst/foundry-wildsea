import { WILDSEA } from '../config.js'
import { enrich } from '../helpers.js'

const { HandlebarsApplicationMixin } = foundry.applications.api

export default class WildseaItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['item-sheet'],
    position: {
      width: 600,
      height: 400,
    },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    context.item = this.item
    context.editable = this.isEditable
    context.owner = this.document.isOwner
    context.config = WILDSEA
    context.system = this.item.system
    context.system.enrichedDetails = await enrich(this.item.system.details)
    context.effects = this.item.effects
    return context
  }

}
