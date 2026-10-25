import { clamp } from './helpers.js'

export default class WildseaActor extends Actor {
  static getDefaultArtwork(data) {
    return {
      img: CONFIG.wildsea.defaultTokens[data.type],
      texture: { src: CONFIG.wildsea.defaultTokens[data.type] },
    }
  }

  prepareBaseData() {
    super.prepareBaseData()

    if (this.type === 'ship') this.prepareShipBaseData()
  }

  prepareShipBaseData() {
    for (const item of this.items.filter((i) =>
      ['design', 'fitting', 'undercrew'].includes(i.type),
    )) {
      for (const ratingMod of item.system.ratingMods) {
        const max = this.system.ratings[ratingMod.rating].max

        this.system.ratings[ratingMod.rating].max = clamp(
          max + parseInt(ratingMod.value),
          8,
        )
      }
    }
  }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user)
    if (data.type === 'player' || data.type === 'ship') {
      const prototypeToken = {
        sight: { enabled: true },
        actorLink: true,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      }
      if (data.type === 'ship') {
        Object.assign(prototypeToken, {
          displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
          bar1: { attribute: 'ratings.armour' },
          bar2: { attribute: 'ratings.speed' },
        })
      }
      return this.updateSource({ prototypeToken })
    }
  }
}
