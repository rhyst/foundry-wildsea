import { WILDSEA, registerSystemSettings } from './system/config.js'
import {
  loadHandlebarsHelpers,
  loadHandlebarsPartials,
} from './system/preload.js'
import WildseaActor from './system/actor.js'
import { addDiceColor } from './system/dice.js'
import WildseaAspectSheet from './system/sheets/aspect.js'
import WildseaAttributeSheet from './system/sheets/attribute.js'
import WildseaDicePool from './system/applications/dice_pool.js'
import WildseaItem from './system/item.js'
import WildseaJournalSheet from './system/sheets/journal.js'
import WildseaPlayerSheet from './system/sheets/player.js'
import WildseaResourceSheet from './system/sheets/resource.js'
import WildseaShipSheet from './system/sheets/ship.js'
import WildseaShipItemSheet from './system/sheets/ship_item.js'
import WildseaAdversarySheet from './system/sheets/adversary.js'
import { setupEnrichers } from './system/enrichers.js'
import { runMigrations } from './system/migrations.js'

import * as WildseaTracks from './system/applications/tracks/index.js'

Hooks.once('init', () => {
  console.log('wildsea | Initializing')

  registerSystemSettings()

  if (game.settings.get('wildsea', 'showDepth'))
    WILDSEA.shipRatings.push('depth')

  CONFIG.wildsea = WILDSEA
  game.wildsea = {}

  WildseaTracks.setup()

  loadHandlebarsPartials()
  loadHandlebarsHelpers()
  setupEnrichers()

  CONFIG.Actor.documentClass = WildseaActor
  CONFIG.Item.documentClass = WildseaItem

  const { Actors, Items, Journal } = foundry.documents.collections
  const ActorSheet = foundry.appv1.sheets.ActorSheet
  const ItemSheet = foundry.appv1.sheets.ItemSheet
  const { JournalEntrySheet } = foundry.applications.sheets.journal

  Actors.unregisterSheet('core', ActorSheet)
  Actors.registerSheet('wildsea', WildseaPlayerSheet, { types: ['player'] })
  Actors.registerSheet('wildsea', WildseaShipSheet, { types: ['ship'] })
  Actors.registerSheet('wildsea', WildseaAdversarySheet, { types: ['hazard'] })

  Items.unregisterSheet('core', ItemSheet)
  Items.registerSheet('wildsea', WildseaAspectSheet, {
    types: ['aspect', 'temporaryTrack'],
  })
  Items.registerSheet('wildsea', WildseaResourceSheet, { types: ['resource'] })
  Items.registerSheet('wildsea', WildseaShipItemSheet, {
    types: ['design', 'fitting', 'undercrew'],
  })
  Items.registerSheet('wildsea', WildseaAttributeSheet, {
    types: ['attribute'],
  })

  Journal.unregisterSheet('core', JournalEntrySheet)
  Journal.registerSheet('wildsea', WildseaJournalSheet)
})

Hooks.once('ready', () => {
  runMigrations()
})

Hooks.on('ready', async () => {
  game.wildsea.dicePool = new WildseaDicePool()
})

Hooks.on('renderJournalEntryPageSheet', (_sheet, container) => {
  // Page sheet elements persist across renders
  if (game.user.isGM && !container.dataset.wildseaTracks) {
    container.dataset.wildseaTracks = 'true'
    container.addEventListener('click', async (event) => {
      const trackEl = event.target.closest('.wildsea-track')
      if (!trackEl) return

      const data = trackEl.dataset

      const result = await game.wildsea.trackDatabase.showTrackDialog(
        'wildsea.TRACKS.addTrack',
        data,
      )
      if (result.cancelled) return
      game.wildsea.trackDatabase.addTrack({ ...result })
    })
  }
})

Hooks.on('getSceneControlButtons', (controls) => {
  controls.wildsea = {
    name: 'wildsea',
    title: 'The Wildsea',
    icon: 'fas fa-anchor',
    order: Object.keys(controls).length,
    tools: {
      dicePool: {
        name: 'dicePool',
        title: 'wildsea.dicePoolTitle',
        icon: 'fas fa-dice',
        order: 0,
        button: true,
        onChange: async () => {
          await game.wildsea.dicePool.toggle()
        },
      },
      sceneTracks: {
        name: 'sceneTracks',
        title: 'wildsea.TRACKS.windowTitle',
        icon: 'fas fa-bars-progress',
        order: 1,
        button: true,
        onChange: async () => {
          await game.wildsea.trackPanel.toggle()
        },
      },
    },
  }
})

Hooks.once('diceSoNiceReady', (dice3d) => {
  const dark = '#2e2c20'
  const mid = '#626256'
  const light = '#858778'

  addDiceColor(dice3d, 'wildsea-dark', 'Dark', dark)
  addDiceColor(dice3d, 'wildsea-mid', 'Mid', mid)
  addDiceColor(dice3d, 'wildsea-light', 'Light', light)
})
