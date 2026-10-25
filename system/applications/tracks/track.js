export default class WildseaTrack {
  constructor(data = {}) {
    this.id = data.id
    this.label = data.label
    this.value = data.value
    this.burn = data.burn
    this.visibility = data.visibility
    this.placement = data.placement
    this.slotGroups = data.groups
      .split(/[,\|]/)
      .map((group) => parseInt(group) || 0)
  }

  render() {
    const slots = []
    let index = 0
    for (const group of this.slotGroups) {
      if (group === 0) continue
      const groupSlots = []
      for (let i = 0; i < group; i++) {
        groupSlots.push(
          index < this.burn
            ? this.burnedSlot(index)
            : index < this.value
            ? this.markedSlot(index)
            : this.emptySlot(index),
        )
        index += 1
      }
      slots.push(groupSlots.join(''))
    }
    return slots.join(this.breaker())
  }

  hidden() {
    return visibility === 'hidden'
  }

  secret() {
    return visibility === 'secret'
  }

  slot(index, state = 'empty') {
    const classes = ['wildsea-track-slot']
    if (state !== 'empty') classes.push(state)

    return `<span class="${classes.join(' ')}" data-slot-index="${index}" data-slot-state="${state}"></span>`
  }

  emptySlot(index) {
    return this.slot(index)
  }

  markedSlot(index) {
    return this.slot(index, 'marked')
  }

  burnedSlot(index) {
    return this.slot(index, 'burned')
  }

  breaker() {
    return `<span class="wildsea-track-break"></span>`
  }

  displayVisibility() {
    switch (this.visibility) {
      case 'hidden':
        return 'wildsea-track--hidden'
      default:
        return this.visibility
    }
  }
}
