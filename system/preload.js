import { stakesText } from './enrichers.js'
import { protectionText } from './damage.js'

export const loadHandlebarsPartials = () => {
  const partials = [
    'systems/the-wildsea/templates/applications/tracks/track.hbs',
    'systems/the-wildsea/templates/shared/aspect.hbs',
    'systems/the-wildsea/templates/shared/aspects.hbs',
    'systems/the-wildsea/templates/shared/attribute.hbs',
    'systems/the-wildsea/templates/shared/description.hbs',
    'systems/the-wildsea/templates/shared/effects.hbs',
    'systems/the-wildsea/templates/shared/number_field.hbs',
    'systems/the-wildsea/templates/shared/rating_mods.hbs',
    'systems/the-wildsea/templates/shared/select_field.hbs',
    'systems/the-wildsea/templates/shared/slim_item.hbs',
    'systems/the-wildsea/templates/shared/text_field.hbs',
    'systems/the-wildsea/templates/shared/track.hbs',
    'systems/the-wildsea/templates/sheets/player/background.hbs',
    'systems/the-wildsea/templates/sheets/player/drives.hbs',
    'systems/the-wildsea/templates/sheets/player/edges.hbs',
    'systems/the-wildsea/templates/sheets/player/languages.hbs',
    'systems/the-wildsea/templates/sheets/player/list_track.hbs',
    'systems/the-wildsea/templates/sheets/player/milestones.hbs',
    'systems/the-wildsea/templates/sheets/player/mire.hbs',
    'systems/the-wildsea/templates/sheets/player/mires.hbs',
    'systems/the-wildsea/templates/sheets/player/resource.hbs',
    'systems/the-wildsea/templates/sheets/player/resources.hbs',
    'systems/the-wildsea/templates/sheets/player/skills.hbs',
    'systems/the-wildsea/templates/sheets/ship/cargo.hbs',
    'systems/the-wildsea/templates/sheets/ship/conditions.hbs',
    'systems/the-wildsea/templates/sheets/ship/design.hbs',
    'systems/the-wildsea/templates/sheets/ship/designs.hbs',
    'systems/the-wildsea/templates/sheets/ship/fittings.hbs',
    'systems/the-wildsea/templates/sheets/ship/rating.hbs',
    'systems/the-wildsea/templates/sheets/ship/ratings.hbs',
    'systems/the-wildsea/templates/sheets/ship/reputations.hbs',
    'systems/the-wildsea/templates/sheets/adversary/drives.hbs',
    'systems/the-wildsea/templates/sheets/adversary/aspects.hbs',
    'systems/the-wildsea/templates/sheets/adversary/presence.hbs',
    'systems/the-wildsea/templates/sheets/adversary/quirks.hbs',
    'systems/the-wildsea/templates/sheets/adversary/resource.hbs',
    'systems/the-wildsea/templates/sheets/adversary/resources.hbs',
  ]

  return foundry.applications.handlebars.loadTemplates(partials)
}

export const loadHandlebarsHelpers = () => {
  Handlebars.registerHelper('times', (n, content) => {
    let result = ''
    for (let i = 0; i < n; i++) {
      content.data.index = i + 1
      result += content.fn(i)
    }
    return result
  })

  Handlebars.registerHelper('fieldType', (type = null) => type || 'text')
  Handlebars.registerHelper(
    'any',
    (array) =>
      (array.name ? array.size : Object.values(array || [])?.length || 0) > 0,
  )
  Handlebars.registerHelper('byKey', (array, key) => {
    return array[key]
  })
  Handlebars.registerHelper('join', (array, glue) => array.join(glue))
  Handlebars.registerHelper('displayNumber', (value) =>
    value >= 0 ? `+${value}` : value,
  )
  // Returns a track cell which is either marked, burned, or empty based on the information provided.
  Handlebars.registerHelper('trackCell', (index, value, burn) => {
    const css_class = index <= burn ? 'burned' : index <= value ? 'checked' : ''
    return `<li class="box ${css_class}"><span class="dot" data-index=${index}"></span></li>`
  })
  Handlebars.registerHelper('stakesText', (stakes) => stakesText(stakes))
  Handlebars.registerHelper('protectionSummary', (system) =>
    protectionText(system),
  )
  Handlebars.registerHelper('selectOptGroup', (values, options) => {
    const { label, selected } = options?.hash
    let html = `<optgroup label="${label}">`
    for (const key of Object.keys(values)) {
      html += `<option value="${key}"`
      if (selected === key) html += ` selected`
      html += `>${values[key]}</option>`
    }
    html += '</optgroup>'
    return html
  })
}
