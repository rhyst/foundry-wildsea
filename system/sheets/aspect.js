import { WILDSEA } from '../config.js'
import WildseaItemSheet from './item.js'

export default class WildseaAspectSheet extends WildseaItemSheet {
  static DEFAULT_OPTIONS = {
    classes: ['item-sheet'],
    position: {
      width: 600,
      height: 520,
    },
    actions: {
      toggleProtections: WildseaAspectSheet._onToggleProtections,
    },
  }

  protectionsOpen = false

  static PARTS = {
    form: {
      template: `${WILDSEA.root_path}/templates/sheets/aspect.hbs`,
    },
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    if (this.item.type !== 'aspect') return context

    context.protectionsOpen = this.protectionsOpen
    context.protectionKeys = Object.keys(WILDSEA.protectionSteps)
    context.protections = WILDSEA.damageTypes.map((type) => ({
      type,
      cells: context.protectionKeys.map((key) => ({
        key,
        checked: this.item.system[key].has(type),
      })),
    }))
    return context
  }

  static _onToggleProtections() {
    this.protectionsOpen = !this.protectionsOpen
    this.render()
  }

  _onRender(context, options) {
    super._onRender(context, options)
    for (const input of this.element.querySelectorAll('[data-protection]')) {
      input.addEventListener('change', this.toggleProtection.bind(this))
    }
  }

  async toggleProtection(event) {
    event.stopPropagation()
    const { protection, damageType } = event.currentTarget.dataset
    const types = new Set(this.item.system[protection])
    if (event.currentTarget.checked) types.add(damageType)
    else types.delete(damageType)
    await this.item.update({ [`system.${protection}`]: [...types] })
  }
}
