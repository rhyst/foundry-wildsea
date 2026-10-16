const { JournalEntrySheet } = foundry.applications.sheets.journal

export default class WildseaJournalSheet extends JournalEntrySheet {
  static DEFAULT_OPTIONS = {
    position: {
      width: 1100,
      height: 850,
    },
  }
}
