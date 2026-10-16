import { WILDSEA } from '../config.js'
import * as Dice from '../dice.js'

const { renderTemplate } = foundry.applications.handlebars
const { createFormGroup, createNumberInput, createSelectInput } =
  foundry.applications.fields

const createSelectField = ({ rootId, label, name, value, options, blank, groups }) => {
  const input = createSelectInput({
    name,
    value,
    options,
    blank,
    groups,
  })

  return createFormGroup({
    rootId,
    label,
    input,
  }).outerHTML
}

const createNumberField = ({ rootId, label, name, value, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1 }) => {
  const input = createNumberInput({
    name,
    value,
    min,
    max,
    step,
    placeholder: '0',
  })

  return createFormGroup({
    rootId,
    label,
    input,
  }).outerHTML
}

const blankPool = {
  edge: '',
  skillLanguage: '',
  advantage: 0,
  cut: 0,
}

const { HandlebarsApplicationMixin } = foundry.applications.api

export default class WildseaDicePool extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  constructor(options = {}) {
    super(options)
    this.dicePool = { ...blankPool }
  }

  static DEFAULT_OPTIONS = {
    id: 'user-dice-pool',
    classes: ['standard-form', 'dice-pool'],
    tag: 'form',
    position: {
      width: 400,
      height: 'auto',
    },
    window: {
      title: 'wildsea.dicePoolTitle',
      resizable: false,
      controls: [],
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: false,
    },
  }

  static PARTS = {
    form: {
      template: 'systems/the-wildsea/templates/applications/dice_pool.hbs',
    },
  }

  async _prepareContext(options) {
    const context = { ...this.dicePool }
    const rootId = this.id

    this.actor = game.user.character?.uuid
      ? await fromUuid(game.user.character?.uuid)
      : null

    if (!this.actor) {
      const error = game.i18n.localize('wildsea.userNotFound')
      ui.notifications.error(error)
      game.user.sheet.render({ force: true })
      this.close()
      return context
    }

    if (!this.actor.isOwner) {
      const error = game.i18n.localize('wildsea.userNotPermitted')
      ui.notifications.error(error)
      throw new Error(error)
    }

    const edgeOptions = []
    for (const edge of WILDSEA.edges) {
      edgeOptions.push({
        value: edge,
        label: game.i18n.format('wildsea.diceRating', {
        label: game.i18n.localize(`wildsea.${edge}`),
        value: this.actor.system.edges[edge] || 0,
        }),
      })
    }

    const skillLanguageOptions = []
    const skillGroup = game.i18n.localize('wildsea.skill')
    for (const skill of WILDSEA.skills) {
      skillLanguageOptions.push({
        value: `skills.${skill}`,
        group: skillGroup,
        label: game.i18n.format('wildsea.diceRating', {
          label: game.i18n.localize(`wildsea.${skill}`),
          value: this.actor.system.skills[skill] || 0,
        }),
      })
    }

    const languageGroup = game.i18n.localize('wildsea.language')
    for (const language of WILDSEA.languages) {
      skillLanguageOptions.push({
        value: `languages.${language}`,
        group: languageGroup,
        label: game.i18n.format('wildsea.diceRating', {
          label: game.i18n.localize(`wildsea.${language}`),
          value: this.actor.system.languages[language] || 0,
        }),
      })
    }

    const advantageOptions = [0, 1, 2].map((n) => ({
      value: `${n}`,
      label: `+${n}d`,
    }))

    context.edgeField = createSelectField({
      rootId,
      label: game.i18n.localize('wildsea.edge'),
      name: 'edge',
      value: this.dicePool.edge,
      options: edgeOptions,
      blank: game.i18n.localize('wildsea.none'),
    })

    context.skillLanguageField = createSelectField({
      rootId,
      label: game.i18n.localize('wildsea.skillLanguage'),
      name: 'skillLanguage',
      value: this.dicePool.skillLanguage,
      options: skillLanguageOptions,
      blank: game.i18n.localize('wildsea.none'),
      groups: [skillGroup, languageGroup],
    })

    context.advantageField = createSelectField({
      rootId,
      label: game.i18n.localize('wildsea.advantage'),
      name: 'advantage',
      value: `${this.dicePool.advantage}`,
      options: advantageOptions,
    })

    context.cutField = createNumberField({
      rootId,
      label: game.i18n.localize('wildsea.cut'),
      name: 'cut',
      value: this.dicePool.cut,
    })

    return context
  }

  _syncDicePoolFromForm() {
    if (!this.form) return

    const formData = Object.fromEntries(new FormData(this.form).entries())
    this.dicePool = {
      ...this.dicePool,
      edge: `${formData.edge ?? ''}`,
      skillLanguage: `${formData.skillLanguage ?? ''}`,
      advantage: Number.parseInt(formData.advantage ?? 0, 10) || 0,
      cut: Number.parseInt(formData.cut ?? 0, 10) || 0,
    }
  }

  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event)
    this._syncDicePoolFromForm()
  }

  async _onSubmitForm(formConfig, event) {
    event.preventDefault()
    return this._submitDicePool()
  }

  async _submitDicePool() {
    this._syncDicePoolFromForm()
    await this.doRoll({ ...this.dicePool })
    this.dicePool = { ...blankPool }
    await this.close()
  }

  async _onClickAction(event, target) {
    event.preventDefault()

    switch (target.dataset.action) {
      case 'submit':
        await this._submitDicePool()
        break
      case 'cancel':
        await this.close()
        break
      default:
        return super._onClickAction(event, target)
    }
  }

  async toggle() {
    if (this.rendered) {
      this.close()
    } else {
      await this.render({ force: true })
    }
  }

  async doRoll(dicePool) {
    const system = this.actor.system

    dicePool.edgeDice = system.edges[dicePool.edge] || 0
    const [skillType, skillKey] = dicePool.skillLanguage.split('.')
    dicePool.skillType = skillType.slice(0, -1)
    dicePool.skillKey = skillKey
    dicePool.skillDice = system[skillType]?.[skillKey] || 0
    dicePool.advantageDice = parseInt(dicePool.advantage)

    const [roll, outcome] = await Dice.rollPool(dicePool)

    const chatData = {
      user: game.user.id,
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

  async setEdge(edge) {
    this.dicePool.edge = edge
    await this.render({ force: true })
  }

  async setSkill(skill) {
    this.dicePool.skillLanguage = `skills.${skill}`
    await this.render({ force: true })
  }

  async setLanguage(language) {
    this.dicePool.skillLanguage = `languages.${language}`
    await this.render({ force: true })
  }
}
