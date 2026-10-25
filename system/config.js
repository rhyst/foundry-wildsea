export const WILDSEA = {}
WILDSEA.root_path = 'systems/the-wildsea'
WILDSEA.defaultTokens = {
  player: `${WILDSEA.root_path}/assets/tokens/person.png`,
  ship: `${WILDSEA.root_path}/assets/tokens/iron-hulled-warship.png`,
}
WILDSEA.designTypes = ['size', 'frame', 'hull', 'bite', 'engine']
WILDSEA.edgeMax = 1
WILDSEA.edges = [
  'grace',
  'iron',
  'instinct',
  'sharps',
  'teeth',
  'tides',
  'veils',
]
WILDSEA.languageMax = 3
WILDSEA.languages = [
  'lowSour',
  'cthonic',
  'saprekk',
  'gaudimm',
  'knock',
  'brasstongue',
  'rakaSpit',
  'lyreBite',
  'oldHand',
  'signalling',
  'highvin',
]
WILDSEA.damageTypes = [
  'blunt',
  'keen',
  'spike',
  'hewing',
  'serrated',
  'toxin',
  'acid',
  'blast',
  'volt',
  'salt',
  'frost',
  'flame',
]
// Protection steps net per damage type: two resistances make an immunity
WILDSEA.protectionSteps = { weaknesses: -1, resistances: 1, immunities: 2 }
// Marks added by impact; massive fills the track
WILDSEA.impacts = { low: -1, normal: 0, high: 1, massive: null }
WILDSEA.milestoneSubtypes = ['major', 'minor']
WILDSEA.resourceTypes = ['salvage', 'specimen', 'whisper', 'chart']
WILDSEA.shipRatings = ['armour', 'seals', 'speed', 'saws', 'stealth', 'tilt']
WILDSEA.skillMax = 3
WILDSEA.skills = [
  'brace',
  'break',
  'concoct',
  'cook',
  'delve',
  'flourish',
  'hack',
  'harvest',
  'hunt',
  'outwit',
  'rattle',
  'scavenge',
  'sense',
  'study',
  'sway',
  'tend',
  'vault',
  'wavewalk',
]
WILDSEA.slimDefaults = {
  mires: {
    track: {
      max: 2,
      value: 0,
      burn: 0,
    },
  },
  reputations: {
    track: {
      max: 3,
      value: 0,
    },
  },
  designEffects: {
    rating: '',
    value: 0,
  },
}
WILDSEA.trackVisibilityOptions = {
  open: 'wildsea.TRACKS.open',
  hidden: 'wildsea.TRACKS.hidden',
  secret: 'wildsea.TRACKS.secret',
}

WILDSEA.adversarySizes = {
  small: 'wildsea.small',
  medium: 'wildsea.medium',
  large: 'wildsea.large',
  huge: 'wildsea.huge',
  variable: 'wildsea.variable',
  swarm: 'wildsea.swarm',
}

export const registerSystemSettings = () => {
  game.settings.register('wildsea', 'showBurnTooltip', {
    config: true,
    scope: 'client',
    name: 'SETTINGS.showBurnTooltip.label',
    hint: 'SETTINGS.showBurnTooltip.hint',
    type: Boolean,
    default: true,
  })

  game.settings.register('wildsea', 'showAttributeTooltip', {
    config: true,
    scope: 'client',
    name: 'SETTINGS.showAttributeTooltip.label',
    hint: 'SETTINGS.showAttributeTooltip.hint',
    type: Boolean,
    default: true,
  })

  game.settings.register('wildsea', 'showDepth', {
    config: true,
    scope: 'world',
    name: 'SETTINGS.showDepth.label',
    hint: 'SETTINGS.showDepth.hint',
    type: Boolean,
    default: false,
    requiresReload: true,
  })

  game.settings.register('wildsea', 'systemMigrationVersion', {
    config: false,
    scope: 'world',
    type: String,
    default: '',
  })
}
