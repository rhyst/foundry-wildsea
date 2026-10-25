import { WILDSEA } from './config.js'

const {
  ArrayField,
  BooleanField,
  HTMLField,
  NumberField,
  ObjectField,
  SchemaField,
  SetField,
  StringField,
} = foundry.data.fields
const { TypeDataModel } = foundry.abstract

const string = () => new StringField({ required: true, initial: '' })
const html = () => new HTMLField({ required: true, initial: '' })
const number = (initial = 0) =>
  new NumberField({ required: true, nullable: false, initial })
const numbers = (keys, initial = {}) =>
  new SchemaField(
    Object.fromEntries(keys.map((key) => [key, number(initial[key] ?? 0)])),
  )
// Slim list entries vary by list, so their shape is left to the sheets
const list = () => new ArrayField(new ObjectField())
const track = (max) =>
  new SchemaField({ value: number(), burn: number(), max: number(max) })

const details = () => ({
  details: html(),
  collapsed: new BooleanField({ initial: false }),
})

export class PlayerData extends TypeDataModel {
  static defineSchema() {
    return {
      bloodline: string(),
      origin: string(),
      post: string(),
      drives: list(),
      milestones: list(),
      mires: list(),
      edges: numbers([
        'grace',
        'iron',
        'instinct',
        'sharps',
        'teeth',
        'tides',
        'veils',
      ]),
      languages: numbers(
        [
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
        ],
        { lowSour: 3 },
      ),
      skills: numbers([
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
      ]),
    }
  }
}

export class ShipData extends TypeDataModel {
  static defineSchema() {
    return {
      armaments: list(),
      cargoPassengers: list(),
      conditions: list(),
      outriders: list(),
      reputations: list(),
      rooms: list(),
      ratings: new SchemaField(
        Object.fromEntries(
          ['armour', 'saws', 'seals', 'speed', 'stealth', 'tilt', 'depth'].map(
            (rating) => [rating, track(1)],
          ),
        ),
      ),
      stakes: new SchemaField({ value: number(), max: number() }),
    }
  }
}

export class HazardData extends TypeDataModel {
  static defineSchema() {
    return {
      type: string(),
      size: string(),
      traits: string(),
      description: html(),
      sight: list(),
      sound: list(),
      smell: list(),
      taste: list(),
    }
  }
}

const damageTypes = (label) =>
  new SetField(
    new StringField({
      choices: Object.fromEntries(
        WILDSEA.damageTypes.map((type) => [type, `wildsea.DAMAGE_TYPES.${type}`]),
      ),
    }),
    { label },
  )

export class TemporaryTrackData extends TypeDataModel {
  static defineSchema() {
    return { ...details(), type: string(), track: track(8) }
  }
}

export class AspectData extends TemporaryTrackData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      resistances: damageTypes('wildsea.DAMAGE.resistances'),
      immunities: damageTypes('wildsea.DAMAGE.immunities'),
      weaknesses: damageTypes('wildsea.DAMAGE.weaknesses'),
    }
  }
}

export class AttributeData extends TypeDataModel {
  static defineSchema() {
    return { ...details(), type: string() }
  }
}

export class ResourceData extends TypeDataModel {
  static defineSchema() {
    return { ...details(), type: string(), tags: string() }
  }
}

export class DesignData extends TypeDataModel {
  static defineSchema() {
    return {
      ...details(),
      type: string(),
      stakes: number(1),
      ratingMods: list(),
    }
  }
}

export class FittingData extends DesignData {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      damaged: new BooleanField({ initial: false }),
    }
  }
}

export class UndercrewData extends DesignData {
  static defineSchema() {
    return { ...super.defineSchema(), track: track(8) }
  }
}

export const registerDataModels = () => {
  Object.assign(CONFIG.Actor.dataModels, {
    player: PlayerData,
    ship: ShipData,
    hazard: HazardData,
  })
  Object.assign(CONFIG.Item.dataModels, {
    aspect: AspectData,
    attribute: AttributeData,
    design: DesignData,
    fitting: FittingData,
    resource: ResourceData,
    temporaryTrack: TemporaryTrackData,
    undercrew: UndercrewData,
  })
}
